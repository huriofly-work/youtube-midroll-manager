const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBackgroundSessions } = require('../extension/background-session.js');
const RUN = '12345678-1234-1234-1234-123456789abc';
const SENDER = { id: 'extension', frameId: 0, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' } };

function fixture(options = {}) {
  const calls = []; let detacher, updater, remover, watchdog, now = 0;
  const chrome = { runtime: { id: 'extension' },
    debugger: {
      onDetach: { addListener(fn) { detacher = fn; } },
      async attach(target, version) { calls.push(['attach', target, version]); if (options.attach) await options.attach(); },
      async sendCommand(target, method, params) { calls.push(['command', target, method, params]); if (options.command) await options.command(method, params); },
      async detach(target) { calls.push(['detach', target]); if (options.detach) await options.detach(); detacher(target); }
    },
    tabs: {
      onUpdated: { addListener(fn) { updater = fn; } }, onRemoved: { addListener(fn) { remover = fn; } },
      async sendMessage(tabId, message) { calls.push(['message', tabId, message]); if (options.disconnected) throw Error('renderer unavailable'); }
    }
  };
  const manager = createBackgroundSessions(chrome, { now: () => now, setInterval(fn) { watchdog = fn; return 1; }, clearInterval() { watchdog = null; }, onLost: options.onLost });
  return { calls, manager, send(type, extra = {}, sender = SENDER) { return manager.handle({ type: `MIDROLL_BACKGROUND_${type}`, runId: RUN, videoId: 'test123', ...extra }, sender); },
    detach() { detacher({ tabId: 7 }); }, navigate() { updater(7, { status: 'loading' }); }, close() { remover(7); },
    tick(ms) { now += ms; watchdog?.(); }, async flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
  };
}
test('background session emulates only the sender video tab and cleans up after completion', async () => {
  const f = fixture();
  assert.equal((await f.send('START', { tabId: 999 })).ok, true);
  assert.deepEqual(f.calls.slice(0, 3), [
    ['attach', { tabId: 7 }, '1.3'],
    ['command', { tabId: 7 }, 'Emulation.setFocusEmulationEnabled', { enabled: true }],
    ['command', { tabId: 7 }, 'Page.setWebLifecycleState', { state: 'active' }]
  ]);
  assert.equal((await f.send('STOP')).ok, true);
  assert.deepEqual(f.calls.slice(-2), [['command', { tabId: 7 }, 'Emulation.setFocusEmulationEnabled', { enabled: false }], ['detach', { tabId: 7 }]]);
});
test('background loss reports independently of an unavailable renderer, without alarming on normal stop', async () => {
  const losses = []; const f = fixture({ disconnected: true, onLost: (record, message) => losses.push({ tabId: record.tabId, runId: record.runId, message }) });
  await f.send('START'); f.tick(46000); await f.flush();
  assert.equal(losses.length, 1); assert.equal(losses[0].tabId, 7); assert.equal(losses[0].runId, RUN);
  assert.match(losses[0].message, /Mất kết nối/); assert.ok(f.calls.some(([name]) => name === 'detach'));
  const normal = fixture({ onLost: () => losses.push('unexpected') }); await normal.send('START'); await normal.send('STOP'); assert.equal(losses.length, 1);
  const brokenReporter = fixture({ onLost: () => { throw Error('notification unavailable'); } }); await brokenReporter.send('START'); brokenReporter.tick(46000); await brokenReporter.flush();
  assert.ok(brokenReporter.calls.some(([name]) => name === 'detach'));
});
test('wrong sender, frame, host, video ID or malformed token cannot attach', async () => {
  for (const [sender, extra] of [
    [{ ...SENDER, id: 'other' }, {}], [{ ...SENDER, frameId: 1 }, {}],
    [{ ...SENDER, tab: { id: 7, url: 'https://studio.youtube.com.attacker.test/video/test123/monetization' } }, {}],
    [SENDER, { videoId: 'other' }], [SENDER, { runId: 'short' }]
  ]) { const f = fixture(); assert.equal((await f.send('START', extra, sender)).ok, false); assert.deepEqual(f.calls, []); }
});
test('cannot take over another debugger or existing run', async () => {
  const f = fixture({ attach: async () => { throw Error('another debugger is attached'); } });
  assert.equal((await f.send('START')).ok, false);
  assert.equal(f.calls.filter(([name]) => name === 'detach').length, 0);
  const g = fixture(); await g.send('START');
  assert.equal((await g.send('START', { runId: RUN.replace('abc', 'def') })).ok, false);
  assert.equal(g.calls.filter(([name]) => name === 'attach').length, 1);
});
test('unsupported protocol command detaches its own partial session', async () => {
  const f = fixture({ command: async (_method, params) => { if (params.enabled) throw Error('unsupported'); } });
  assert.equal((await f.send('START')).ok, false);
  assert.equal(f.calls.filter(([name]) => name === 'detach').length, 1);
});
test('cancellation during attach never enables the page afterward', async () => {
  let resolveAttach;
  const f = fixture({ attach: () => new Promise((resolve) => { resolveAttach = resolve; }) });
  const starting = f.send('START'); const stopping = f.send('STOP'); resolveAttach();
  assert.equal((await starting).ok, false); assert.equal((await stopping).ok, true);
  assert.equal(f.calls.some(([name, , , params]) => name === 'command' && params.enabled === true), false);
  assert.equal(f.calls.filter(([name]) => name === 'detach').length, 1);
});
test('stale run token cannot stop a live session; valid heartbeat extends its lease', async () => {
  const f = fixture(); await f.send('START');
  await f.send('STOP', { runId: RUN.replace('abc', 'def') });
  f.tick(40000); await f.send('PING'); f.tick(20000); await f.flush();
  assert.equal(f.calls.filter(([name]) => name === 'detach').length, 0);
  f.tick(30000); await f.flush();
  assert.equal(f.calls.filter(([name]) => name === 'detach').length, 1);
});
test('user detachment stops the run and never automatically reattaches', async () => {
  const f = fixture(); await f.send('START'); f.detach();
  assert.equal((await f.send('PING')).ok, false);
  assert.equal(f.calls.find(([name]) => name === 'message')[2].runId, RUN);
  assert.equal(f.calls.filter(([name]) => name === 'attach').length, 1);
  await f.send('STOP'); assert.equal(f.calls.filter(([name]) => name === 'detach').length, 0);
});
test('navigation releases the session; closing the tab forgets an already closed target', async () => {
  const f = fixture(); await f.send('START'); f.navigate(); await f.flush();
  assert.equal(f.calls.filter(([name]) => name === 'detach').length, 1);
  const g = fixture(); await g.send('START'); g.close();
  assert.equal((await g.send('PING')).ok, false);
});
test('failed detach keeps ownership for a watchdog retry', async () => {
  let attempts = 0;
  const f = fixture({ detach: async () => { if (++attempts === 1) throw Error('temporary failure'); } });
  await f.send('START'); assert.equal((await f.send('STOP')).ok, false);
  f.tick(10000); await f.flush();
  assert.equal(attempts, 2);
  assert.equal((await f.send('PING')).ok, false);
});
