const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRunAlerts, issue } = require('../extension/run-alerts.js');
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const sender = { id: 'test', frameId: 0, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' } };
function fixture(options = {}) {
  const calls = [], events = {}, data = {}, notifications = new Set();
  const event = (name) => ({ addListener(fn) { events[name] = fn; } });
  let tab = { id: 7, windowId: 9, url: sender.tab.url };
  const api = {
    runtime: { id: 'test', getURL: (path) => 'chrome-extension://test/' + path },
    storage: { session: { async get() { return structuredClone(data); }, async set(values) { Object.assign(data, structuredClone(values)); } }, local: { async get() { return { focusOnRunError: options.focus !== false }; } } },
    action: Object.fromEntries(['setBadgeText','setTitle','setBadgeBackgroundColor'].map((name) => [name, async (value) => calls.push([name, value])])),
    notifications: {
      onClicked: event('clicked'), onButtonClicked: event('button'),
      async getPermissionLevel() { return options.denied ? 'denied' : 'granted'; },
      async create(id, value) { if (options.failNotification) throw Error('blocked'); calls.push(['create', id, value]); notifications.add(id); return id; },
      async update(id, value) { calls.push(['update', id, value]); return notifications.has(id); },
      async clear(id) { calls.push(['clear', id]); return notifications.delete(id); }
    },
    tabs: { onUpdated: event('updated'), onRemoved: event('removed'), async get() { return { ...tab }; }, async update(id, value) { calls.push(['tab', id, value]); }, async sendMessage(id, value) { calls.push(['show', id, value]); if (options.reload && !calls.some((c) => c[0] === 'inject')) throw Error('no receiver'); return { ok: true }; } },
    windows: { async get() { return { state: 'minimized' }; }, async update(id, value) { calls.push(['window', id, value]); if (options.failFocus && value.focused) throw Error('OS blocked'); } },
    scripting: { async executeScript(value) { calls.push(['inject', value]); } }
  };
  const manager = createRunAlerts(api);
  const send = (value, context = sender) => manager.handle({ runId: id, ...value }, context);
  const begin = () => send({ type: 'MIDROLL_RUN_BEGIN', videoId: 'test123', mode: 'insert', total: 4 });
  const error = (changes = {}) => send({ type: 'MIDROLL_RUN_ERROR', issue: { code: 'confirmation-timeout', message: 'Chưa xác nhận mốc.', confirmed: 1, phase: 'processing', points: [180], pending: null, ...changes } });
  return { manager, api, calls, data, events, begin, send, error, navigate: (url) => { tab.url = url; } };
}
test('run error restores the exact window, selects its tab and creates one actionable notification', async () => {
  const f = fixture(); await f.begin(); const result = await f.error();
  assert.equal(result.notified, true);
  assert.deepEqual(f.calls.filter((c) => c[0] === 'window').map((c) => c[2]), [{ state: 'normal' }, { focused: true }]);
  assert.deepEqual(f.calls.find((c) => c[0] === 'tab'), ['tab', 7, { active: true }]);
  const notification = f.calls.find((c) => c[0] === 'create'); assert.match(notification[2].message, /1\/4/);
  assert.equal(notification[2].requireInteraction, true); assert.equal(notification[2].buttons.length, 2);
  await f.error({ confirmed: 2 });
  assert.equal(f.calls.filter((c) => c[0] === 'create').length, 1);
  assert.equal(f.calls.filter((c) => c[0] === 'window' && c[2].focused).length, 1);
  assert.equal(f.calls.find((c) => c[0] === 'update')[2].silent, true);
});
test('disabled auto focus only requests attention; notification click foregrounds the matching tab', async () => {
  const f = fixture({ focus: false }); await f.begin(); await f.error();
  assert.equal(f.calls.some((c) => c[0] === 'tab'), false);
  assert.deepEqual(f.calls.find((c) => c[0] === 'window')[2], { drawAttention: true });
  await f.manager.open(f.data.midrollRunAlerts[7].notificationId);
  assert.equal(f.calls.filter((c) => c[0] === 'tab').length, 1);
  assert.equal(f.data.midrollRunAlerts[7].acknowledged, undefined);
});
test('permission or API failures preserve alert state and badge without failing the run', async () => {
  for (const options of [{ denied: true }, { failNotification: true, failFocus: true }]) {
    const f = fixture(options); await f.begin(); const result = await f.error();
    assert.equal(result.ok, true); assert.equal(result.notified, false);
    assert.equal(f.data.midrollRunAlerts[7].alerted, true);
    assert.ok(f.calls.some((c) => c[0] === 'setBadgeText' && c[1].text === '!'));
  }
});
test('state survives worker recreation and a late error cannot re-alert an acknowledged incident', async () => {
  const f = fixture(); await f.begin(); await f.error();
  const restored = createRunAlerts(f.api); await restored.open(f.data.midrollRunAlerts[7].notificationId);
  await f.send({ type: 'MIDROLL_RUN_ACK' });
  const count = f.calls.length; await f.error({ confirmed: 2 });
  assert.equal(f.calls.length, count);
});
test('navigation, subframes, stale run IDs and malformed progress cannot route or change an alert', async () => {
  const f = fixture(); await f.begin();
  for (const context of [{ ...sender, id: 'other' }, { ...sender, frameId: 1 }, { ...sender, tab: { id: 7, url: 'https://studio.youtube.com.attacker.test/video/test123/monetization' } }]) {
    assert.equal((await f.send({ type: 'MIDROLL_RUN_ERROR', issue: {} }, context)).ok, false);
  }
  for (const changes of [{ confirmed: -1 }, { confirmed: 5 }, { points: [Infinity] }, { phase: 'execute' }]) {
    assert.equal((await f.send({ type: 'MIDROLL_RUN_PROGRESS', confirmed: 1, phase: 'processing', points: [], ...changes })).ok, false);
  }
  assert.equal((await f.send({ type: 'MIDROLL_RUN_ACK', runId: 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee' })).ok, false);
  await f.error(); f.navigate('https://studio.youtube.com/video/other/monetization');
  const count = f.calls.length; await f.manager.open(f.data.midrollRunAlerts[7].notificationId);
  assert.equal(f.calls.length, count);
});
test('success and user cancellation have no notification or foreground change', async () => {
  const f = fixture(); await f.begin(); await f.send({ type: 'MIDROLL_RUN_PROGRESS', confirmed: 4, phase: 'verifying', points: [] });
  await f.send({ type: 'MIDROLL_RUN_END' });
  assert.deepEqual(f.data.midrollRunAlerts, {});
  assert.equal(f.calls.some((c) => ['window','tab','create'].includes(c[0])), false);
});
test('watchdog loss and content error share one incident, preserving last confirmed progress', async () => {
  const f = fixture(); await f.begin(); await f.send({ type: 'MIDROLL_RUN_PROGRESS', confirmed: 1, phase: 'processing', points: [180] });
  await f.manager.lost({ tabId: 7, runId: id }, 'Mất kết nối.'); await f.error();
  assert.equal(f.calls.filter((c) => c[0] === 'create').length, 1);
  assert.equal(f.data.midrollRunAlerts[7].issue.confirmed, 1);
  assert.equal(f.data.midrollRunAlerts[7].issue.phase, 'processing');
});
test('notification dismissed for later is not recreated by a delayed content error', async () => {
  const f = fixture(); await f.begin(); await f.error();
  await f.api.notifications.clear(f.data.midrollRunAlerts[7].notificationId); await f.error();
  assert.equal(f.calls.filter((c) => c[0] === 'create').length, 1);
  assert.equal(f.data.midrollRunAlerts[7].acknowledged, undefined);
});
test('an early handling decision prevents a delayed first error from interrupting the user', async () => {
  const f = fixture(); await f.begin(); await f.send({ type: 'MIDROLL_RUN_ACK' });
  const count = f.calls.length; const result = await f.error();
  assert.equal(result.acknowledged, true); assert.equal(f.calls.length, count);
});
test('opening then postponing an incident keeps its badge and never redirects a closed or changed tab', async () => {
  const f = fixture(); await f.begin(); await f.error(); const count = f.calls.filter((c) => c[0] === 'setBadgeText').length;
  await f.manager.open(f.data.midrollRunAlerts[7].notificationId);
  assert.equal(f.calls.filter((c) => c[0] === 'setBadgeText').length, count);
  assert.equal(f.data.midrollRunAlerts[7].acknowledged, undefined);
  f.navigate('https://studio.youtube.com/video/next123/monetization'); f.events.updated(7, { url: 'https://studio.youtube.com/video/next123/monetization' });
  await f.send({ type: 'MIDROLL_RUN_ACK' }); assert.deepEqual(f.data.midrollRunAlerts, {});
});
test('a notification can restore its readonly error UI after reloading the same video', async () => {
  const f = fixture({ reload: true }); await f.begin(); await f.error(); await f.manager.open(f.data.midrollRunAlerts[7].notificationId);
  assert.equal(f.calls.filter((c) => c[0] === 'inject').length, 1);
  assert.equal(f.data.midrollRunAlerts[7].acknowledged, undefined);
});
test('issue fields distinguish processing uncertainty from confirmed totals without private URLs', () => {
  const detail = issue(Object.assign(Error('Chưa xác nhận'), { pendingRemoved: 3 }), { runId: id, mode: 'cleanup', confirmed: 5, total: 12, phase: 'processing', points: [60,120] });
  assert.equal(detail.pending, 3); assert.equal(detail.confirmed, 5); assert.equal(detail.code, 'run-failed');
  assert.equal('videoId' in detail, false); assert.equal('url' in detail, false);
});
