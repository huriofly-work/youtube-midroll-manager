// Startup failures must stay visible and release the run before any Studio edit.
// This uses a local fixture and a temporary browser, never the user's profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const version = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8')).version;
  const server = http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    const file = route.startsWith('/video/') ? path.join(__dirname, 'studio-fixture.html')
      : /^\/extension\/[a-z-]+\.js$/.test(route) ? path.join(root, route.slice(1)) : null;
    if (!file) { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8'); res.end(await fs.readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = []; page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE ERROR: ' + error.message); });
  const ui = (id) => page.locator('#midroll-helper-host').locator('#' + id);
  const ready = () => page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled);
  const done = () => page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
  let passed = 0;
  async function fresh(mode = 'insert') {
    await page.goto(`http://127.0.0.1:${server.address().port}/video/test123/monetization`);
    await ready();
    if (mode === 'cleanup') {
      await page.evaluate(() => {
        const row = document.querySelector('.ad-row'); row.dataset.adType = 'manual';
        const warning = document.createElement('span'); warning.textContent = 'Đang xem xét'; row.append(warning);
      });
      await ui('tab-cleanup').click(); await ready();
    }
    await ui(mode === 'insert' ? 'read' : 'cleanup-read').click(); await ready();
  }
  async function scenario(name, check) { await check(); passed++; console.log('PASS ' + name); }
  async function assertFailed(mode, message) {
    await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'error', null, { timeout: 3000 });
    assert.match(await ui('status').innerText(), message);
    // Added by the ship coverage audit (Claude Opus 5.5).
    // Value: protects=a startup failure says no point was inserted/removed in this run; fails_when=the phase-starting status branch is dropped or inverted; why_new=scenarios matched only the error text; seam=none; no_claim=live Studio (local fixture)
    assert.match(await ui('status').innerText(), mode === 'insert' ? /Chưa chèn điểm nào trong lượt này/ : /Chưa xóa điểm nào trong lượt này/);
    assert.equal(await ui('run-alert').isVisible(), true);
    assert.match(await ui('alert-count').innerText(), /0\//);
    assert.equal(await ui('run-actions').isVisible(), false);
    assert.equal(await ui('close').isEnabled(), true);
    assert.equal(await ui(mode === 'insert' ? 'start' : 'cleanup-start').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [0, 0, 0]);
    assert.equal(await page.evaluate(() => (fixture.backgroundRequests || []).includes('MIDROLL_BACKGROUND_START')), false);
    await ui('alert-inspect').click();
    await ui(mode === 'insert' ? 'read' : 'cleanup-read').click(); await ready();
    assert.equal(await ui(mode === 'insert' ? 'start' : 'cleanup-start').isEnabled(), true);
  }
  try {
    for (const mode of ['insert', 'cleanup']) {
      await scenario(`${mode}: missing run-control module reports an error and releases startup`, async () => {
        await fresh(mode);
        // An old worker can inject its old file list after the files were updated.
        await page.evaluate(() => { globalThis.savedRunControl = MidrollRunControl; delete globalThis.MidrollRunControl; });
        await ui(mode === 'insert' ? 'start' : 'cleanup-start').click();
        await assertFailed(mode, /thành phần điều khiển lượt chạy/);
        const requests = await page.evaluate(() => fixture.alertRequests || []);
        assert.deepEqual(requests.slice(0, 2).map((r) => r.type), ['MIDROLL_RUN_BEGIN', 'MIDROLL_RUN_ERROR']);
        assert.equal(requests[0].runId, requests[1].runId);
        await page.evaluate(() => { globalThis.MidrollRunControl = savedRunControl; });
        await ui(mode === 'insert' ? 'start' : 'cleanup-start').click(); await done();
        assert.equal(await ui('status').getAttribute('data-tone'), 'success', await ui('status').innerText());
        assert.equal(await page.evaluate(() => fixture.saves), 0);
      });
      await scenario(`${mode}: unexpected controller initialization failure stays visible and recoverable`, async () => {
        await fresh(mode);
        await page.evaluate(() => { MidrollRunControl.create = () => { throw new Error('Startup initialization failed'); }; });
        await ui(mode === 'insert' ? 'start' : 'cleanup-start').click();
        await assertFailed(mode, /Startup initialization failed/);
      });
      await scenario(`${mode}: run ID initialization failure is caught before editing`, async () => {
        await fresh(mode);
        await page.evaluate(() => { crypto.randomUUID = () => { throw new Error('Run ID initialization failed'); }; });
        await ui(mode === 'insert' ? 'start' : 'cleanup-start').click();
        await assertFailed(mode, /Run ID initialization failed/);
        assert.equal(await page.evaluate(() => (fixture.alertRequests || []).length), 0);
      });
    }
    await scenario('302-point preview immediately shows startup and can stop before the monitor responds', async () => {
      await fresh();
      await page.evaluate(() => {
        document.querySelector('.duration').textContent = '21:01';
        document.getElementById('list').replaceChildren();
        for (const time of ['1:23:04', '9:16:03', '13:49:24', '18:34:15']) {
          const row = addRow(time, true); row.dataset.adType = 'automatic'; row.querySelector('input').readOnly = true;
        }
        globalThis.alertMessage = async (message) => {
          if (message.type === 'MIDROLL_RUN_BEGIN') await new Promise((resolve) => setTimeout(resolve, 500));
          return { ok: true };
        };
      });
      await ui('start-margin').fill('180'); await ui('end-margin').fill('780'); await ui('interval').fill('1');
      await ui('read').click(); await ready();
      assert.equal(await ui('start').innerText(), 'Chèn 302 điểm');
      await ui('start').click();
      assert.equal(await ui('run-progress').isVisible(), true);
      assert.equal(await ui('stop').isVisible(), true);
      assert.match(await ui('status').innerText(), /Đang bật chế độ chạy nền/);
      await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
      await page.locator('#midroll-helper-host').screenshot({ path: path.join(root, `artifacts/startup-302-v${version}.png`) });
      await ui('stop').click(); await done(); await page.waitForTimeout(600);
      assert.match(await ui('status').innerText(), /Đã dừng theo yêu cầu/);
      assert.match(await ui('status').innerText(), /Chưa chèn điểm nào trong lượt này/);
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [0, 0, 0]);
      assert.equal(await page.evaluate(() => (fixture.backgroundRequests || []).includes('MIDROLL_BACKGROUND_START')), false);
    });
    assert.deepEqual(errors, []);
    console.log(`${passed} startup scenarios passed. Live Studio acceptance is not covered.`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
