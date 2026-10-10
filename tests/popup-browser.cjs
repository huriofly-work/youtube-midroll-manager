// Local popup rendering with mocked Chrome transport; no logged-in profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer(async (req, res) => {
    const file = new URL(req.url, 'http://localhost').pathname.slice(1);
    if (!['popup.html', 'popup.css', 'popup.js', 'error-copy.js'].includes(file)) { res.writeHead(404).end(); return; }
    try {
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
      res.end(await fs.readFile(path.join(root, 'extension', file)));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 380, height: 650 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const version = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8')).version;
  await page.addInitScript((version) => {
    const state = new URL(location.href).searchParams.get('state');
    globalThis.fixture = { messages: [], closed: false };
    window.close = () => { fixture.closed = true; };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(text) { fixture.copied = text; } } });
    globalThis.chrome = { runtime: { getManifest() { return { version }; }, async sendMessage(message) {
      fixture.messages.push(message);
      if (fixture.nextReply) return fixture.nextReply;
      if (state === 'success') return { ok: true };
      if (state === 'missing') throw Error('worker unavailable');
      if (state === 'error') return { ok: false, kind: 'error', message: 'Không mở được bảng trên tab này. Hãy tải lại extension và làm mới trang Studio, rồi thử lại.' };
      return { ok: false, kind: 'instruction', message: state === 'studio-list' ? 'Bạn đang ở YouTube Studio. Hãy chọn một video rồi vào Kiếm tiền → Quản lý vị trí quảng cáo.' : 'Extension chèn điểm trên YouTube Studio. Hãy mở một video rồi vào Quản lý vị trí quảng cáo.' };
    } } };
  }, version);
  let passed = 0;
  async function scenario(name, state, check) {
    await page.goto(`http://127.0.0.1:${server.address().port}/popup.html?state=${state}`);
    await page.waitForFunction(() => fixture.closed || document.getElementById('guide').hidden === false);
    await check(); passed++; console.log(`PASS ${name}`);
  }
  try {
    await scenario('wrong site or Chrome page shows guidance instead of a silent badge', 'wrong-site', async () => {
      assert.equal(await page.locator('#guide').isVisible(), true);
      assert.equal(await page.locator('#copy-error').isVisible(), false);
      assert.match(await page.locator('#status').innerText(), /YouTube Studio/);
      assert.equal(await page.locator('a').getAttribute('href'), 'https://studio.youtube.com/');
      assert.deepEqual(await page.evaluate(() => fixture.messages), [{ type: 'MIDROLL_OPEN_PANEL' }]);
      await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
      await page.screenshot({ path: path.join(root, 'artifacts/popup-preview.png') });
    });
    await scenario('Studio channel list explains choosing a video', 'studio-list', async () => {
      assert.match(await page.locator('#status').innerText(), /chọn một video/);
      assert.equal(await page.locator('#status').getAttribute('data-tone'), '');
      assert.equal(await page.locator('#copy-error').isVisible(), false);
    });
    await scenario('successful panel opening closes the popup', 'success', async () => {
      assert.equal(await page.evaluate(() => fixture.closed), true);
      assert.equal(await page.locator('#guide').isVisible(), false);
    });
    await scenario('panel opening failure offers explicit error copy and retry recovery', 'error', async () => {
      assert.equal(await page.locator('#copy-error').isVisible(), true);
      assert.equal(await page.evaluate(() => fixture.copied), undefined);
      await page.locator('#copy-error').click();
      await page.waitForFunction(() => Boolean(fixture.copied));
      const report = JSON.parse(await page.evaluate(() => fixture.copied));
      assert.equal(report.stage, 'open-panel');
      assert.equal(report.version, version);
      assert.equal(await page.locator('#version').innerText(), 'v' + version);
      assert.ok(!Object.keys(report).some((key) => /url|tab|account|videoId/i.test(key)));
      await page.evaluate(() => { fixture.nextReply = { ok: true }; });
      await page.locator('#retry').click();
      await page.waitForFunction(() => fixture.closed);
      assert.equal(await page.locator('#copy-error').isVisible(), false);
    });
    await scenario('missing background reports a visible recoverable error', 'missing', async () => {
      assert.match(await page.locator('#status').innerText(), /Không kết nối/);
      assert.equal(await page.locator('#retry').isVisible(), true);
      assert.equal(await page.locator('#copy-error').isVisible(), true);
    });
    await scenario('guidance and long error remain usable at 300 pixels without horizontal overflow', 'error', async () => {
      await page.setViewportSize({ width: 300, height: 650 });
      await page.evaluate(() => { fixture.nextReply = { ok: false, kind: 'error', message: 'Thông tin lỗi: ' + 'x'.repeat(200) }; });
      await page.locator('#retry').click();
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('xxx'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#retry').isVisible(), true);
      await page.screenshot({ path: path.join(root, 'artifacts/ui-popup-error-v0.1.16.png') });
    });
    assert.deepEqual(errors, []);
    console.log(`${passed} local popup scenarios passed. Real Chrome toolbar popup acceptance is not covered by this mock.`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
