// Local browser fixtures exercise actual dialogs; Chrome notification APIs are mocked.
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
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const ui = (id) => page.locator('#midroll-helper-host').locator('#' + id);
  const ready = () => page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('read').disabled);
  const alert = () => page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('run-alert').open);
  const done = () => page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden);
  const requests = () => page.evaluate(() => fixture.alertRequests || []);
  let passed = 0;
  async function fresh() {
    await page.goto(`http://127.0.0.1:${server.address().port}/video/test123/monetization`); await ready();
    await page.evaluate(() => { const wait = MidrollWait.waitFor; MidrollWait.waitFor = (check, options) => wait(check, { ...options, timeout: Math.min(options?.timeout || 800, 800) }); });
  }
  async function preview() { await ui('read').click(); await ready(); }
  async function failStartup() {
    await page.evaluate(() => { fixture.backgroundStartError = 'Không bật được chế độ nền.'; });
    await preview(); await ui('start').click(); await alert();
  }
  async function restoredIssue(mode = 'cleanup', overrides = {}) {
    return page.evaluate(({ mode, overrides }) => {
      let response;
      fixture.messageListener({ type: 'MIDROLL_SHOW_RUN_ERROR', videoId: 'test123', issue: { runId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', mode, code: 'background-lost', message: 'Đã mất kết nối khi chạy.', confirmed: 2, total: 4, phase: 'processing', points: [60, 120], pending: 2, ...overrides } }, { id: 'local-test' }, (value) => { response = value; });
      return response;
    }, { mode, overrides });
  }
  async function scenario(name, run) { await fresh(); await run(); passed++; console.log('PASS ' + name); }
  try {
    await scenario('invalid preview stays inline without run alarm or mutations', async () => {
      await ui('interval').fill('0'); await preview();
      assert.equal(await ui('status').getAttribute('data-tone'), 'error');
      assert.equal(await ui('run-alert').isVisible(), false); assert.deepEqual(await requests(), []);
      assert.equal(await page.evaluate(() => fixture.clicks + fixture.deletes + fixture.saves), 0);
    });
    await scenario('startup error provides an actionable modal, confirmed count and no unsafe retry', async () => {
      await failStartup(); assert.match(await ui('alert-title').innerText(), /Chưa thay đổi điểm/);
      assert.equal(await ui('run-alert').getAttribute('data-severity'), 'error');
      assert.match(await ui('alert-count').innerText(), /0\/4/); assert.match(await ui('alert-guidance').innerText(), /quyền extension/);
      const log = await requests(); assert.equal(log.filter((r) => r.type === 'MIDROLL_RUN_ERROR').length, 1);
      assert.equal(log[0].runId, log.find((r) => r.type === 'MIDROLL_RUN_ERROR').runId);
      assert.equal(await page.evaluate(() => fixture.clicks), 0); assert.equal(await ui('start').isDisabled(), true);
      assert.equal(await page.evaluate(() => MidrollPanelHost.shadowRoot.activeElement.id), 'alert-inspect');
    });
    await scenario('Later and Escape preserve the incident for reopening; inspect acknowledges without editing', async () => {
      await failStartup(); await ui('alert-later').click();
      assert.ok((await requests()).some((r) => r.type === 'MIDROLL_RUN_POSTPONE'));
      assert.equal((await requests()).some((r) => r.type === 'MIDROLL_RUN_ACK'), false);
      await page.evaluate(() => MidrollShowPanel()); await alert(); await page.keyboard.press('Escape');
      assert.equal(await ui('run-alert').isVisible(), false); assert.equal(await ui('review-error').isVisible(), true);
      await ui('review-error').click(); await alert(); await ui('alert-inspect').click();
      assert.ok((await requests()).some((r) => r.type === 'MIDROLL_RUN_ACK'));
      assert.equal(await ui('start').isDisabled(), true); assert.equal(await page.evaluate(() => fixture.clicks + fixture.deletes + fixture.saves), 0);
    });
    await scenario('read again produces a fresh plan and never starts it automatically', async () => {
      await failStartup(); await page.evaluate(() => { fixture.backgroundStartError = null; });
      await ui('alert-preview').click(); await ready(); assert.equal(await ui('start').isDisabled(), false);
      assert.equal(await ui('review-error').isVisible(), false); assert.equal(await page.evaluate(() => fixture.clicks), 0);
      assert.equal((await requests()).filter((r) => r.type === 'MIDROLL_RUN_BEGIN').length, 1);
    });
    await scenario('an uncertain insertion names the pending point, stops once and preserves the original error', async () => {
      await page.evaluate(() => { fixture.wrongTime = true; }); await preview(); await ui('start').click(); await alert();
      assert.match(await ui('alert-guidance').innerText(), /01:00/); assert.match(await ui('alert-guidance').innerText(), /chưa được xác nhận/);
      assert.equal(await page.evaluate(() => fixture.clicks), 1); assert.match(await ui('alert-count').innerText(), /0\/4/);
      const log = await requests(); const error = log.find((r) => r.type === 'MIDROLL_RUN_ERROR');
      assert.deepEqual(error.issue.points, [60]); assert.equal(error.issue.phase, 'processing');
      assert.equal(await page.evaluate(() => fixture.saves + fixture.deletes), 0);
    });
    await scenario('notification permission failure remains visible alongside the original cause', async () => {
      await page.evaluate(() => { fixture.notificationDenied = true; }); await failStartup();
      await ui('alert-notice').waitFor({ state: 'visible' }); assert.match(await ui('alert-notice').innerText(), /Chưa hiện được/);
      assert.equal(await ui('alert-message').innerText(), 'Không bật được chế độ nền.');
    });
    await scenario('a locally handled modal does not claim that OS notifications failed', async () => {
      await page.evaluate(() => { globalThis.alertMessage = async (message) => message.type === 'MIDROLL_RUN_ERROR' ? { ok: true, local: true, notified: false } : { ok: true }; });
      await failStartup(); assert.equal(await ui('alert-notice').isVisible(), false);
      assert.equal((await requests()).find((r) => r.type === 'MIDROLL_RUN_ERROR').presented, true);
    });
    await scenario('desktop Later closes the modal and rejects old-run or other-video requests', async () => {
      await failStartup(); const runId = (await requests())[0].runId;
      await page.evaluate((runId) => fixture.messageListener({ type: 'MIDROLL_HIDE_RUN_ERROR', videoId: 'other', runId }), runId);
      assert.equal(await ui('run-alert').isVisible(), true);
      await page.evaluate((runId) => fixture.messageListener({ type: 'MIDROLL_HIDE_RUN_ERROR', videoId: 'test123', runId }), runId);
      assert.equal(await ui('run-alert').isVisible(), false); assert.equal(await ui('review-error').isVisible(), true);
      assert.equal((await requests()).some((r) => r.type === 'MIDROLL_RUN_ACK'), false);
    });
    await scenario('a restored incident cancels a late duration read and locks any old preview', async () => {
      await preview(); await page.evaluate(() => {
        const original = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = (message) => message.type === 'MIDROLL_READ_DURATION' ? new Promise((resolve) => { fixture.lateRead = resolve; }) : original(message);
        document.querySelector('.duration').remove();
        MidrollRefreshDuration();
      });
      await page.waitForFunction(() => Boolean(fixture.lateRead)); assert.deepEqual(await restoredIssue(), { ok: true });
      await page.evaluate(() => fixture.lateRead({ seconds: 600, videoId: 'test123' }));
      assert.equal(await ui('run-alert').isVisible(), true); assert.equal(await ui('alert-message').innerText(), 'Đã mất kết nối khi chạy.');
      assert.equal(await ui('start').isDisabled(), true); assert.equal(await ui('preview').isVisible(), false);
      assert.equal(await page.evaluate(() => fixture.clicks + fixture.deletes + fixture.saves), 0);
    });
    await scenario('an uncertain-stop warning remains copyable with its severity and pending count', async () => {
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { fixture.copiedWarning = text; } } }); });
      await restoredIssue('cleanup', { code: 'stopped-unconfirmed' }); await ui('alert-copy').click();
      await page.waitForFunction(() => Boolean(fixture.copiedWarning));
      const report = await page.evaluate(() => JSON.parse(fixture.copiedWarning));
      assert.equal(report.severity, 'warning'); assert.equal(report.pending, 2); assert.equal(report.message, 'Đã mất kết nối khi chạy.');
      assert.equal(await ui('run-alert').getAttribute('data-severity'), 'warning');
    });
    await scenario('copy fallback is selectable inside the modal and does not include a video URL', async () => {
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('blocked'); } } }); document.execCommand = () => false; });
      await failStartup(); await ui('alert-copy').click(); await ui('alert-error-details').waitFor({ state: 'visible' });
      const report = JSON.parse(await ui('alert-error-details').inputValue()); assert.equal(report.mode, 'insert'); assert.equal(report.confirmed, 0);
      assert.equal(JSON.stringify(report).includes('/video/test123/'), false);
      assert.equal(await ui('alert-error-details').evaluate((n) => n.selectionEnd - n.selectionStart), (await ui('alert-error-details').inputValue()).length);
      await ui('alert-later').click(); await ui('review-error').click(); assert.equal(await ui('alert-copy').isDisabled(), false);
    });
    await scenario('a restored cleanup incident opens its own preview tab and reports unconfirmed group separately', async () => {
      assert.deepEqual(await restoredIssue(), { ok: true }); await alert();
      assert.match(await ui('alert-count').innerText(), /xóa 2\/4/); assert.match(await ui('alert-guidance').innerText(), /Đã bấm xóa 2 điểm nhưng chưa xác nhận/);
      await ui('alert-preview').click(); await ready(); assert.equal(await ui('tab-cleanup').getAttribute('aria-selected'), 'true');
      assert.equal(await page.evaluate(() => fixture.deletes + fixture.clicks + fixture.saves), 0);
    });
    await scenario('stale or other-video notification commands cannot replace an active incident', async () => {
      await failStartup(); const original = await ui('alert-message').innerText();
      assert.deepEqual(await restoredIssue('insert'), { ok: false });
      await page.evaluate(() => fixture.messageListener({ type: 'MIDROLL_SHOW_RUN_ERROR', videoId: 'other123', issue: { message: 'Wrong video' } }));
      assert.equal(await ui('alert-message').innerText(), original);
    });
    await scenario('navigation dismisses the previous video incident without editing', async () => {
      await failStartup(); await page.evaluate(() => { history.pushState({}, '', '/video/next123/monetization'); document.body.append(document.createElement('i')); });
      await page.waitForFunction(() => !MidrollPanelHost.shadowRoot.getElementById('run-alert').open);
      assert.equal(await ui('review-error').isVisible(), false); assert.equal(await page.evaluate(() => fixture.clicks), 0);
    });
    await scenario('navigation during processing cannot open the previous video error in the next video', async () => {
      await page.evaluate(() => { fixture.delay = 2000; }); await preview(); await ui('start').click();
      await page.waitForFunction(() => fixture.clicks === 1);
      await page.evaluate(() => { history.pushState({}, '', '/video/next123/monetization'); document.body.append(document.createElement('i')); });
      await done(); assert.equal(await ui('run-alert').isVisible(), false);
      assert.equal((await requests()).some((r) => r.type === 'MIDROLL_RUN_ERROR'), false);
      assert.equal(await page.evaluate(() => fixture.clicks), 1);
    });
    await scenario('unavailable error monitor blocks mutations and keeps a readable local failure', async () => {
      await page.evaluate(() => { globalThis.alertMessage = async () => ({ ok: false }); });
      await preview(); await ui('start').click(); await alert(); assert.match(await ui('alert-message').innerText(), /Không kết nối được phần theo dõi lỗi/);
      assert.equal(await page.evaluate(() => fixture.clicks + fixture.deletes + fixture.saves), 0);
    });
    await scenario('stop during a stalled error-monitor startup is immediate and never raises a fatal alert', async () => {
      await page.evaluate(() => { globalThis.alertMessage = (message) => message.type === 'MIDROLL_RUN_BEGIN' ? new Promise(() => {}) : Promise.resolve({ ok: true }); });
      await preview(); await ui('start').click(); await ui('stop').click();
      await page.waitForFunction(() => MidrollPanelHost.shadowRoot.getElementById('stop').hidden, null, { timeout: 1500 });
      assert.equal(await ui('run-alert').isVisible(), false); assert.equal(await page.evaluate(() => fixture.clicks), 0);
      assert.equal((await requests()).some((r) => r.type === 'MIDROLL_RUN_ERROR'), false);
    });
    await scenario('foreground preference persists across both tabs and is locked while running', async () => {
      await page.locator('#midroll-helper-host').locator('.notification-settings summary').click();
      await ui('focus-on-error').uncheck(); assert.equal(await page.evaluate(() => fixture.savedSettings.focusOnRunError), false);
      await ui('tab-cleanup').click(); await ready(); assert.equal(await ui('focus-on-error').isChecked(), false);
      await ui('tab-insert').click(); await ready(); await page.evaluate(() => { fixture.delay = 1000; }); await preview(); await ui('start').click();
      assert.equal(await ui('focus-on-error').isDisabled(), true); await ui('stop').click(); await done();
      assert.equal(await ui('focus-on-error').isDisabled(), false); assert.equal(await ui('run-alert').isVisible(), false);
      assert.equal((await requests()).some((r) => r.type === 'MIDROLL_RUN_ERROR'), false);
    });
    await scenario('successful runs close the incident record without a run-error notification', async () => {
      await preview(); await ui('start').click(); await done(); assert.equal(await ui('status').getAttribute('data-tone'), 'success');
      const log = await requests(); assert.equal(log.some((r) => r.type === 'MIDROLL_RUN_ERROR'), false); assert.equal(log.at(-1).type, 'MIDROLL_RUN_END');
      assert.equal(await page.evaluate(() => fixture.saves), 0);
    });
    await scenario('alert dialog traps keyboard focus and remains usable inside a native Studio dialog', async () => {
      await page.evaluate(() => { const editor = document.getElementById('editor'), dialog = document.createElement('dialog'); dialog.id = editor.id; dialog.setAttribute('aria-label', 'Quản lý vị trí quảng cáo'); dialog.append(...editor.childNodes); editor.replaceWith(dialog); dialog.showModal(); });
      await page.waitForFunction(() => MidrollPanelHost.parentElement?.tagName === 'DIALOG'); await failStartup();
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => MidrollPanelHost.shadowRoot.activeElement.id), 'alert-copy');
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => MidrollPanelHost.shadowRoot.activeElement.id), 'alert-inspect');
      await ui('alert-inspect').click(); assert.equal(await page.locator('dialog#editor').evaluate((n) => n.open), true);
    });
    for (const viewport of [{ width: 320, height: 568 }, { width: 640, height: 480 }, { width: 1366, height: 900 }]) {
      await scenario(`alert fits ${viewport.width}x${viewport.height} with reachable actions`, async () => {
        await page.setViewportSize(viewport); await failStartup();
        const box = await ui('run-alert').boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify(box));
        assert.equal(await ui('run-alert').evaluate((n) => n.scrollWidth <= n.clientWidth), true);
        await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
        await ui('run-alert').screenshot({ path: path.join(root, `artifacts/alert-${viewport.width}x${viewport.height}-v${version}.png`) });
        await ui('alert-later').click(); assert.equal(await ui('run-alert').isVisible(), false);
      });
    }
    assert.deepEqual(errors, []); console.log(`${passed} local alert scenarios passed. OS notifications and signed-in Studio are separate acceptance checks.`);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
