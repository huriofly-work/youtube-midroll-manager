// Dedicated temporary Chrome profile: real CDP and a minimized native window.
// Extension API transport is bridged to CDP; no signed-in Studio is used.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { createBackgroundSessions } = require('../extension/background-session.js');

(async () => {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.startsWith('/video/') ? path.resolve(__dirname, 'studio-fixture.html')
      : /^\/extension\/[a-z-]+\.js$/.test(pathname) ? path.resolve(__dirname, '..', pathname.slice(1)) : null;
    if (!file) { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8'); res.end(await fs.readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    headless: false, args: ['--start-minimized'],
    ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
    ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {})
  });
  try {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const calls = []; let onDetach;
    const manager = createBackgroundSessions({
      runtime: { id: 'local-test' },
      debugger: {
        onDetach: { addListener(fn) { onDetach = fn; } },
        async attach() { calls.push('attach'); },
        async sendCommand(_target, method, params) { calls.push([method, params]); return cdp.send(method, params); },
        async detach() { calls.push('detach'); onDetach({ tabId: 7 }); }
      },
      tabs: {
        onUpdated: { addListener() {} }, onRemoved: { addListener() {} },
        async sendMessage(_tabId, message) { await page.evaluate((m) => fixture.messageListener?.(m), message); }
      }
    });
    await page.exposeFunction('backgroundMessage', (message) => manager.handle(message, {
      id: 'local-test', frameId: 0, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' }
    }));
    const url = `http://127.0.0.1:${server.address().port}/video/test123/monetization`;
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    async function prepare() {
      await page.goto(url);
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled, null, { polling: 100 });
      assert.equal((await cdp.send('Browser.getWindowBounds', { windowId })).bounds.windowState, 'minimized');
      assert.equal(await page.evaluate(() => document.hasFocus()), false);
      await page.evaluate(() => { fixture.requireFocusForInsert = true; fixture.animationCommit = true; MidrollPanelHost.shadowRoot.getElementById('read').click(); });
      await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled, null, { polling: 100 });
    }
    await prepare();
    await page.evaluate(() => MidrollPanelHost.shadowRoot.getElementById('start').click());
    await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success', null, { polling: 100 });
    assert.deepEqual(await page.locator('.ad-row input').evaluateAll((nodes) => nodes.map((n) => n.value)), ['0:20:00', '3:00:00', '9:40:00', '1:00:00', '5:00:00', '7:00:00', '9:00:00']);
    assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves, document.getElementById('automatic').checked]), [4, 0, 0, true]);
    assert.equal((await cdp.send('Browser.getWindowBounds', { windowId })).bounds.windowState, 'minimized');
    assert.equal(await page.evaluate(() => document.hasFocus()), false);
    assert.deepEqual(calls, ['attach', ['Emulation.setFocusEmulationEnabled', { enabled: true }], ['Page.setWebLifecycleState', { state: 'active' }], ['Emulation.setFocusEmulationEnabled', { enabled: false }], 'detach']);
    console.log('PASS real Chrome commands complete all points while window stays minimized; focus emulation restored');

    calls.length = 0;
    await prepare();
    await page.evaluate(() => { fixture.delay = 800; MidrollPanelHost.shadowRoot.getElementById('start').click(); });
    await page.waitForFunction(() => fixture.clicks === 1, null, { polling: 100 });
    await page.evaluate(() => MidrollPanelHost.shadowRoot.getElementById('stop').click());
    await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden, null, { polling: 100 });
    assert.equal(await page.evaluate(() => fixture.clicks), 1);
    assert.equal((await cdp.send('Browser.getWindowBounds', { windowId })).bounds.windowState, 'minimized');
    assert.equal(await page.evaluate(() => document.hasFocus()), false);
    assert.equal(calls.filter((c) => c === 'detach').length, 1);
    assert.deepEqual(errors, []);
    console.log('PASS cancel in minimized Chrome stops further clicks and restores focus emulation');

    for (const finish of ['resume', 'stop']) {
      calls.length = 0;
      await prepare();
      await page.evaluate(() => { fixture.delay = 500; MidrollPanelHost.shadowRoot.getElementById('start').click(); });
      await page.waitForFunction(() => fixture.clicks === 1, null, { polling: 100 });
      await page.evaluate(() => MidrollPanelHost.shadowRoot.getElementById('pause').click());
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('pause').textContent === 'Tiếp tục', null, { polling: 100 });
      assert.equal(await page.evaluate(() => fixture.clicks), 1);
      assert.equal(calls.filter((c) => c === 'detach').length, 0);
      if (finish === 'resume') {
        await page.waitForFunction(() => fixture.backgroundRequests.includes('MIDROLL_BACKGROUND_PING'), null, { polling: 100, timeout: 20000 });
        assert.equal(await page.evaluate(() => fixture.clicks), 1);
        assert.equal(await page.evaluate(() => MidrollPanelHost.shadowRoot.getElementById('pause').textContent), 'Tiếp tục');
      }
      assert.equal((await cdp.send('Browser.getWindowBounds', { windowId })).bounds.windowState, 'minimized');
      await page.evaluate((id) => MidrollPanelHost.shadowRoot.getElementById(id).click(), finish === 'resume' ? 'pause' : 'stop');
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden, null, { polling: 100 });
      assert.deepEqual(await page.evaluate(() => [fixture.clicks, fixture.deletes, fixture.saves]), [finish === 'resume' ? 4 : 1, 0, 0]);
      assert.equal(calls.filter((c) => c === 'detach').length, 1);
      assert.equal((await cdp.send('Browser.getWindowBounds', { windowId })).bounds.windowState, 'minimized');
      assert.equal(await page.evaluate(() => document.hasFocus()), false);
      console.log(`PASS paused minimized Chrome ${finish}: no extra clicks, lease kept alive, background session released`);
    }

    calls.length = 0;
    await prepare();
    const original = await page.locator('.ad-row input').evaluateAll((nodes) => nodes.map((n) => n.value));
    await page.evaluate(() => {
      document.querySelectorAll('.ad-row').forEach((row, i) => {
        row.setAttribute('data-ad-type', i === 0 ? 'automatic' : 'manual');
        if (i === 0) { const icon = document.createElement('span'); icon.setAttribute('icon', 'help-circle'); icon.textContent = '?'; row.append(icon); }
      });
      for (let i = 0; i < 7; i++) {
        const row = addRow(MidrollPlanner.formatStudioTime(60 + i * 30, '0:00:00'), true);
        row.setAttribute('data-ad-type', 'manual');
        const icon = document.createElement('span'); icon.setAttribute('icon', i % 2 ? 'help-circle' : 'yt-icons:warning'); icon.style.color = 'rgb(220,30,30)'; icon.textContent = i % 2 ? '?' : '⚠'; row.append(icon);
        const old = row.querySelector('button'), button = old.cloneNode(true); old.replaceWith(button);
        button.addEventListener('click', () => { if (!document.hasFocus()) return; fixture.deletes++; row.remove(); });
      }
      for (const seconds of [30, 590]) {
        const row = addRow(MidrollPlanner.formatStudioTime(seconds, '0:00:00'), true);
        row.setAttribute('data-ad-type', 'manual');
        const old = row.querySelector('button'), button = old.cloneNode(true); old.replaceWith(button);
        button.addEventListener('click', () => { if (!document.hasFocus()) return; fixture.deletes++; row.remove(); });
      }
      addRow('9:50:00', true).setAttribute('data-ad-type', 'automatic');
      addRow('9:55:00', true).setAttribute('data-ad-type', 'unknown');
      MidrollPanelHost.shadowRoot.getElementById('tab-cleanup').click();
    });
    await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('cleanup-read').disabled, null, { polling: 100 });
    await page.evaluate(() => {
      const ui = MidrollPanelHost.shadowRoot;
      ui.getElementById('minimum-spacing').value = '1';
      ui.getElementById('cleanup-start-margin').value = '60'; ui.getElementById('cleanup-end-margin').value = '60';
      ui.getElementById('cleanup-read').click();
    });
    await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('cleanup-read').disabled, null, { polling: 100 });
    await page.evaluate(() => MidrollPanelHost.shadowRoot.getElementById('cleanup-start').click());
    await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('status').dataset.tone === 'success', null, { polling: 100 });
    assert.deepEqual(await page.locator('.ad-row input').evaluateAll((nodes) => nodes.map((n) => n.value)), [...original.slice(0, 2), '9:50:00', '9:55:00']);
    assert.deepEqual(await page.evaluate(() => [fixture.deletes, fixture.saves, document.getElementById('automatic').checked]), [10, 0, true]);
    assert.equal((await cdp.send('Browser.getWindowBounds', { windowId })).bounds.windowState, 'minimized');
    assert.equal(await page.evaluate(() => document.hasFocus()), false);
    assert.equal(calls.filter((c) => c === 'detach').length, 1);
    assert.deepEqual(errors, []);
    console.log('PASS warning, pending and margin cleanup in minimized Chrome preserves automatic and unknown endpoint slots and restores focus emulation');
    await cdp.detach();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
