// Actual Chrome extension APIs in a temporary profile. Studio URL is fulfilled
// locally with inert HTML: no YouTube account, network data or actual ad changes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const context = await chromium.launchPersistentContext('', { headless: false, args: ['--start-minimized', '--enable-unsafe-extension-debugging'],
    ignoreDefaultArgs: ['--disable-extensions'],
    ...(process.env.CHROME_TEST_PATH ? { executablePath: process.env.CHROME_TEST_PATH } : {}) });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '../extension') });
    await context.route('https://studio.youtube.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local notification acceptance fixture</title><p>Inert local fixture. No YouTube data.</p>' }));
    const page = await context.newPage(); await page.goto('https://studio.youtube.com/video/test123/monetization');
    let worker;
    for (let tries = 0; tries < 50 && !worker; tries++) {
      worker = context.serviceWorkers().find((w) => w.url().startsWith(`chrome-extension://${id}/`));
      if (!worker) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Evaluate the actual extension service worker through the browser protocol.
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{}] });
    const pageTarget = targetInfos.find((t) => t.type === 'tab' && t.url === 'https://studio.youtube.com/video/test123/monetization');
    // Clicking the extension action grants activeTab, as in normal use.
    await cdp.send('Extensions.triggerAction', { id, targetId: pageTarget.targetId });
    const target = targetInfos.find((t) => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${id}/`));
    if (!target) throw Error('Extension service worker not available');
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
    let sequence = 0; const pending = new Map();
    cdp.on('Target.receivedMessageFromTarget', ({ sessionId: received, message }) => {
      if (received !== sessionId) return; const response = JSON.parse(message); if (!response.id) return;
      const waiter = pending.get(response.id); if (!waiter) return; pending.delete(response.id);
      if (response.error) waiter.reject(Error(response.error.message)); else waiter.resolve(response.result);
    });
    async function protocol(method, params = {}) {
      const requestId = ++sequence;
      const response = new Promise((resolve, reject) => { const timer = setTimeout(() => { pending.delete(requestId); reject(Error('Worker evaluation timed out')); }, 15000); pending.set(requestId, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } }); });
      await cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: requestId, method, params }) });
      return response;
    }
    await protocol('Runtime.enable');
    async function evaluate(expression) {
      const result = await protocol('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value;
    }
    // Use the actual tab selected by Chrome, never a fabricated ID.
    const tab = await evaluate("chrome.tabs.query({}).then(tabs => tabs.find(t => t.url === 'https://studio.youtube.com/video/test123/monetization'))");
    assert.ok(tab?.id); const runId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const sender = { id, frameId: 0, tab };
    const send = (message) => evaluate(`runAlerts.handle(${JSON.stringify({ runId, ...message })},${JSON.stringify(sender)})`);
    const begin = () => send({ type: 'MIDROLL_RUN_BEGIN', videoId: 'test123', mode: 'insert', total: 4 });
    const failure = (delivery = {}) => send({ type: 'MIDROLL_RUN_ERROR', ...delivery, issue: { code: 'confirmation-timeout', message: 'Kiểm thử thông báo: chưa xác nhận điểm. Không có video thật.', confirmed: 1, phase: 'processing', points: [180], pending: null } });
    const state = () => evaluate(`chrome.windows.get(${tab.windowId})`);
    await evaluate(`chrome.windows.update(${tab.windowId},{state:'minimized'})`);
    await begin(); assert.equal((await state()).state, 'minimized');
    await send({ type: 'MIDROLL_RUN_END' }); assert.equal((await state()).state, 'minimized');
    assert.deepEqual(await evaluate('chrome.notifications.getAll()'), {});
    console.log('PASS actual extension begin/end leaves the minimized window undisturbed');
    await begin(); const result = await failure();
    if (!result.notified) throw Error(await evaluate("chrome.notifications.create('native-probe',{type:'basic',iconUrl:chrome.runtime.getURL('alert-icon.png'),title:'Kiểm thử',message:'Hồ sơ tạm'}).then(()=> 'Notification registration unexpectedly recovered',error=>error.message)"));
    const notifications = await evaluate('chrome.notifications.getAll()'); const notificationId = `midroll-${tab.id}-${runId}`;
    assert.equal(notifications[notificationId], true); assert.equal((await state()).state, 'normal'); assert.equal((await state()).focused, true);
    assert.equal(await evaluate(`chrome.action.getBadgeText({tabId:${tab.id}})`), '!');
    console.log('PASS Chrome accepts the packaged PNG notification and restores/focuses its exact window');
    await failure(); assert.equal(Object.keys(await evaluate('chrome.notifications.getAll()')).length, 1);
    await send({ type: 'MIDROLL_RUN_ACK' }); assert.deepEqual(await evaluate('chrome.notifications.getAll()'), {});
    assert.equal(await evaluate(`chrome.action.getBadgeText({tabId:${tab.id}})`), ''); await send({ type: 'MIDROLL_RUN_END' });
    console.log('PASS repeated reports share one actual notification; acknowledgment clears notification and badge');
    await evaluate(`chrome.storage.local.set({focusOnRunError:false}).then(()=>chrome.windows.update(${tab.windowId},{state:'minimized'}))`);
    await begin(); assert.equal((await failure()).notified, true); assert.equal((await state()).state, 'minimized');
    await evaluate(`runAlerts.open(${JSON.stringify(notificationId)})`);
    assert.equal((await state()).state, 'normal'); assert.equal((await state()).focused, true);
    await page.waitForFunction(() => document.getElementById('midroll-helper-host')?.shadowRoot.getElementById('run-alert').open);
    assert.match(await page.locator('#midroll-helper-host').locator('#alert-count').innerText(), /1\/4/);
    assert.deepEqual(await evaluate('chrome.notifications.getAll()'), {});
    assert.equal(await evaluate(`chrome.action.getBadgeText({tabId:${tab.id}})`), '!');
    console.log('PASS disabled auto focus keeps Chrome minimized; opening the incident restores its guarded error dialog');
    await page.locator('#midroll-helper-host').locator('#alert-later').click();
    for (let i = 0; i < 30; i++) {
      if (await evaluate(`chrome.storage.session.get('midrollRunAlerts').then(s=>s.midrollRunAlerts[${tab.id}].postponed === true)`)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(await evaluate(`chrome.storage.session.get('midrollRunAlerts').then(s=>s.midrollRunAlerts[${tab.id}].postponed)`), true);
    await page.reload();
    const { targetInfos: currentTargets } = await cdp.send('Target.getTargets', { filter: [{}] });
    const reloaded = currentTargets.find((t) => t.type === 'tab' && t.url === tab.url);
    await cdp.send('Extensions.triggerAction', { id, targetId: reloaded.targetId });
    await page.waitForFunction(() => document.getElementById('midroll-helper-host')?.shadowRoot.getElementById('run-alert').open);
    assert.match(await page.locator('#midroll-helper-host').locator('#alert-count').innerText(), /1\/4/);
    assert.equal(await evaluate(`chrome.action.getBadgeText({tabId:${tab.id}})`), '!');
    assert.deepEqual(await evaluate('chrome.notifications.getAll()'), {});
    console.log('PASS local Later persists; after F5 the actual toolbar restores the incident without recreating a notification');
    await send({ type: 'MIDROLL_RUN_ACK' });
    await send({ type: 'MIDROLL_RUN_END' });
    await evaluate(`chrome.tabs.update(${tab.id},{active:true}).then(()=>chrome.windows.update(${tab.windowId},{focused:true}))`);
    assert.equal((await state()).focused, true);
    await begin(); const local = await failure({ presented: true });
    assert.equal(local.local, true); assert.deepEqual(await evaluate('chrome.notifications.getAll()'), {});
    console.log('PASS an actual visible modal in the focused Studio tab suppresses the duplicate desktop notification');
    await send({ type: 'MIDROLL_RUN_ACK' }); await send({ type: 'MIDROLL_RUN_END' });
    await evaluate(`chrome.windows.update(${tab.windowId},{state:'minimized'})`); await begin();
    const light = await send({ type: 'MIDROLL_RUN_ERROR', issue: { code: 'run-failed', message: 'Kiểm thử lỗi trước khi bắt đầu.', confirmed: 0, phase: 'starting', points: [], pending: null } });
    assert.equal(light.notified, true); assert.equal((await state()).state, 'minimized');
    console.log('PASS startup failure registers a system notification without restoring the actual minimized window');
    await send({ type: 'MIDROLL_RUN_ACK' }); await send({ type: 'MIDROLL_RUN_END' }); await begin();
    const stopped = await send({ type: 'MIDROLL_RUN_ERROR', issue: { code: 'stopped-unconfirmed', message: 'Kiểm thử dừng còn nhóm chưa xác nhận.', confirmed: 1, phase: 'processing', points: [180,240], pending: 2 } });
    assert.equal(stopped.quiet, true); assert.deepEqual(await evaluate('chrome.notifications.getAll()'), {});
    assert.deepEqual(await evaluate(`chrome.action.getBadgeBackgroundColor({tabId:${tab.id}})`), [168,91,0,255]);
    assert.equal((await state()).state, 'minimized');
    console.log('PASS uncertain stop keeps an amber badge without a desktop notification or restored window');
    await send({ type: 'MIDROLL_RUN_ACK' }); await send({ type: 'MIDROLL_RUN_END' });
    console.log('8 actual Chrome API scenarios passed. Windows toast visibility and real Studio acceptance are not asserted.');
  } finally { await context.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
