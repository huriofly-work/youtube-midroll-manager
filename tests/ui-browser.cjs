// Visual and interaction checks on a local Studio fixture, without a user profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
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
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const host = page.locator('#midroll-helper-host');
  const ui = (id) => host.locator('#' + id);
  const ready = () => page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled);
  const done = () => page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
  let passed = 0;
  async function fresh(viewport = { width: 1366, height: 900 }) {
    await page.setViewportSize(viewport);
    await page.goto(`http://127.0.0.1:${server.address().port}/video/test123/monetization`);
    await ready();
  }
  async function scenario(name, check) { await check(); passed++; console.log('PASS ' + name); }
  async function layout() {
    const result = await host.evaluate((node) => {
      const shadow = node.shadowRoot;
      const panel = shadow.querySelector('.panel'), main = shadow.querySelector('main');
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        fits: main.scrollWidth <= main.clientWidth && panel.scrollWidth <= panel.clientWidth };
    });
    assert.ok(result.left >= 0 && result.top >= 0 && result.right <= result.viewportWidth && result.bottom <= result.viewportHeight + 1, JSON.stringify(result));
    assert.equal(result.fits, true, JSON.stringify(result));
    for (const selector of ['header', '.tabs', '.action-bar']) {
      const box = await host.locator(selector).boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= result.viewportHeight + 1, `${selector}: ${JSON.stringify(box)}`);
    }
  }
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 640, height: 480 }, { width: 1366, height: 900 }]) {
      await scenario(`fixed tabs and actions fit ${viewport.width}x${viewport.height} in both modes after scrolling`, async () => {
        await fresh(viewport);
        for (const mode of ['insert', 'cleanup']) {
          if (mode === 'cleanup') { await ui('tab-cleanup').click(); await ready(); }
          await layout();
          await host.locator('main').evaluate((main) => { main.scrollTop = main.scrollHeight; });
          await layout();
          const read = ui(mode === 'insert' ? 'read' : 'cleanup-read');
          assert.equal(await read.isVisible(), true);
          await read.click(); await ready();
          assert.equal(await ui('preview').isVisible(), true);
          await layout();
          assert.equal(await ui(mode === 'insert' ? 'cleanup-actions' : 'insert-actions').isVisible(), false);
          // Restore the initial configuration view for the screenshot.
          await ui('load').click(); await ready();
          await host.locator('main').evaluate((main) => { main.scrollTop = 0; });
          await host.screenshot({ path: path.join(root, `artifacts/ui-${mode}-${viewport.width}x${viewport.height}-v0.1.16.png`) });
        }
        assert.equal(await page.evaluate(() => fixture.clicks + fixture.deletes + fixture.saves), 0);
      });
    }
    await scenario('seconds hints, validation and keyboard tabs keep preview consistent', async () => {
      await fresh();
      assert.equal(await ui('interval-hint').innerText(), '120 giây = 02:00');
      await ui('interval').fill('61'); assert.equal(await ui('interval-hint').innerText(), '61 giây = 01:01');
      assert.equal(await host.locator('#increase, #decrease').count(), 0);
      await ui('interval').fill('1.5'); assert.equal(await ui('interval').getAttribute('aria-invalid'), 'true');
      await ui('read').click(); await ready(); assert.equal(await ui('start').isDisabled(), true);
      await ui('interval').fill('120'); await ui('read').click(); await ready();
      assert.match(await ui('start').innerText(), /^Chèn \d+ điểm$/);
      await ui('start-margin').fill('90'); assert.equal(await ui('preview').isVisible(), false);
      await ui('tab-insert').press('End'); await ready();
      assert.equal(await ui('tab-cleanup').getAttribute('aria-selected'), 'true');
      assert.match(await ui('spacing-rule').innerText(), /trước hoặc sau/);
      await ui('tab-cleanup').press('Home'); await ready();
      assert.equal(await ui('start-margin').inputValue(), '90');
    });
    await scenario('cleanup preview explains the later automatic anchor and keeps the completed plan for review', async () => {
      await fresh();
      await page.evaluate(() => {
        document.getElementById('list').replaceChildren();
        addRow('2:01:00', true).dataset.adType = 'manual';
        const automatic = addRow('3:00:00', true); automatic.dataset.adType = 'automatic'; automatic.querySelector('input').readOnly = true;
        addRow('6:00:00', true).dataset.adType = 'manual';
      });
      await ui('tab-cleanup').click(); await ready();
      await ui('cleanup-start-margin').fill('120'); await ui('cleanup-end-margin').fill('120');
      await ui('cleanup-read').click(); await ready();
      assert.equal(await ui('times').locator('li').count(), 1);
      assert.equal(await ui('times').locator('.point-time').innerText(), '2:01:00');
      assert.match(await ui('times').locator('.point-reason').innerText(), /Quá gần 3:00:00 \(tự động\)/);
      assert.equal(await ui('cleanup-start').innerText(), 'Dọn 1 điểm');
      const listBox = await ui('times').boundingBox(), mainBox = await host.locator('main').boundingBox();
      assert.ok(listBox.y >= mainBox.y && listBox.y + listBox.height <= mainBox.y + mainBox.height, 'preview list must be in view after reading');
      await ui('preview-title').scrollIntoViewIfNeeded();
      await host.screenshot({ path: path.join(root, 'artifacts/ui-cleanup-plan-v0.1.16.png') });
      await ui('cleanup-start').click(); await done();
      assert.equal(await ui('status').getAttribute('data-tone'), 'success');
      assert.equal(await ui('preview').isVisible(), true);
      assert.equal(await ui('preview-title').innerText(), 'Kế hoạch lần chạy vừa rồi');
      assert.match(await ui('preview-note').innerText(), /không phải kết quả xác nhận/);
      assert.equal(await ui('cleanup-start').isDisabled(), true);
      assert.deepEqual(await page.locator('.ad-row input').evaluateAll((inputs) => inputs.map((input) => input.value)), ['3:00:00', '6:00:00']);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
      await ui('cleanup-end-margin').fill('0'); assert.equal(await ui('preview').isVisible(), false);
    });
    await scenario('running view keeps confirmed progress and stop reachable in a short window, then invalidates execution', async () => {
      await fresh({ width: 640, height: 480 });
      await page.evaluate(() => { fixture.delay = 1000; });
      await ui('read').click(); await ready(); await ui('start').click();
      assert.equal(await ui('run-progress').isVisible(), true);
      assert.equal(await ui('insert-actions').isVisible(), false);
      assert.equal(await ui('interval').isDisabled(), true);
      await layout();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('progress').value >= 1);
      assert.match(await ui('progress-text').innerText(), /Đã xác nhận: [1-9]/);
      await host.screenshot({ path: path.join(root, 'artifacts/ui-running-v0.1.16.png') });
      await ui('stop').click(); await done();
      assert.equal(await ui('run-progress').isVisible(), false);
      assert.equal(await ui('insert-actions').isVisible(), true);
      assert.equal(await ui('start').isDisabled(), true);
      assert.equal(await ui('preview').isVisible(), true);
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    assert.deepEqual(errors, []);
    console.log(`${passed} local UI scenarios passed. Signed-in Studio acceptance is not covered.`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
