const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness() {
  let now = 0, sequence = 0, mutations;
  const timers = new Map();
  const document = new EventTarget();
  document.hidden = false;
  document.focused = true;
  document.hasFocus = () => document.focused;
  document.documentElement = {};
  const window = new EventTarget();
  let disconnected = false;
  const context = vm.createContext({ document, window, DOMException,
    performance: { now: () => now },
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class { constructor(fn) { mutations = fn; } observe() {} disconnect() { disconnected = true; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension/wait.js'), 'utf8'), context);
  return {
    wait: context.MidrollWait.waitFor, request: context.MidrollWait.request, delay: context.MidrollWait.delay, timerCount: () => timers.size, document,
    tick(ms) {
      now += ms;
      const due = [...timers].filter(([, t]) => t.at <= now);
      for (const [id, t] of due) { if (timers.delete(id)) t.fn(); }
    },
    jump(ms) { now += ms; },
    mutate() { mutations([{ target: { id: 'studio-control' } }]); },
    event(type) { document.dispatchEvent(new Event(type)); },
    clean() { assert.equal(timers.size, 0); assert.equal(disconnected, true); }
  };
}
test('DOM acknowledgment wakes immediately without waiting for a throttled timer', async () => {
  const h = harness(); let value = false;
  const waiting = h.wait(() => value);
  value = 'confirmed'; h.mutate();
  assert.equal(await waiting, 'confirmed'); h.clean();
});
test('stable confirmation rejects a transient self-assigned value', async () => {
  const h = harness(); let value = 'first';
  let done = false;
  const waiting = h.wait(() => value, { stableFor: 400 }).then((v) => { done = true; return v; });
  h.tick(100); value = false; h.mutate(); h.tick(100);
  assert.equal(done, false);
  value = 'committed'; h.mutate();
  for (let i = 0; i < 4; i++) h.tick(100);
  assert.equal(await waiting, 'committed'); h.clean();
});
test('an overdue timer checks the current result before any timeout', async () => {
  const h = harness(); let value = false;
  const waiting = h.wait(() => value);
  value = 'late but valid'; h.tick(60000);
  assert.equal(await waiting, 'late but valid'); h.clean();
});
test('foreground nonresponse still has a finite deadline', async () => {
  const h = harness();
  const waiting = h.wait(() => false, { timeout: 500 });
  for (let i = 0; i < 5; i++) h.tick(100);
  await assert.rejects(waiting, /Studio chưa xác nhận/); h.clean();
});
test('timeout explanation uses the final observation and does not replace a context error', async () => {
  const h = harness(); let reason = 'initial';
  const waiting = h.wait(() => false, { timeout: 200, timeoutMessage: () => reason });
  h.tick(100); reason = 'duplicate cursor position'; h.tick(100);
  await assert.rejects(waiting, /duplicate cursor position/); h.clean();
  const next = harness();
  await assert.rejects(next.wait(() => { throw new Error('editor closed'); }, { timeoutMessage: 'timeout' }), /editor closed/);
  next.clean();
});
test('background waiting uses its own budget and reports waiting once', async () => {
  const h = harness(); h.document.focused = false;
  const messages = [];
  const waiting = h.wait(() => false, { timeout: 500, backgroundTimeout: 3000, onPending: (v) => messages.push(v) });
  h.tick(1000); h.tick(1000); h.tick(1000);
  await assert.rejects(waiting, /Studio chưa xác nhận/);
  assert.equal(messages.length, 1); h.clean();
});
test('freeze time is excluded and the same operation resumes', async () => {
  const h = harness(); let value = false;
  const waiting = h.wait(() => value, { timeout: 500 });
  h.tick(100); h.event('freeze'); h.jump(60000); h.event('resume');
  value = 'resumed'; h.mutate();
  assert.equal(await waiting, 'resumed'); h.clean();
});
test('hidden renderer can wait until visible without skipping a pending operation', async () => {
  const h = harness(); h.document.hidden = true;
  const waiting = h.wait(() => !h.document.hidden, { backgroundTimeout: Infinity });
  h.tick(120000);
  h.document.hidden = false; h.event('visibilitychange');
  assert.equal(await waiting, true); h.clean();
});
test('cancel removes observers and timers immediately while waiting', async () => {
  const h = harness(); const controller = new AbortController();
  const waiting = h.wait(() => false, { signal: controller.signal });
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' }); h.clean();
});

test('IPC cancellation is immediate, clears timers, ignores late replies and never sends after pre-abort', async () => {
  const h = harness(), controller = new AbortController(); let resolve, calls = 0;
  const result = h.request(() => { calls++; return new Promise((r) => { resolve = r; }); }, { signal: controller.signal });
  controller.abort(); await assert.rejects(result, { name: 'AbortError' });
  assert.equal(h.timerCount(), 0); resolve('too late'); await Promise.resolve();
  await assert.rejects(h.request(() => { calls++; }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1); assert.equal(h.timerCount(), 0);
});
test('IPC success, rejection, timeout fallback and cancellable delay release every timer', async () => {
  const h = harness();
  assert.equal(await h.request(() => Promise.resolve('ok')), 'ok'); assert.equal(h.timerCount(), 0);
  await assert.rejects(h.request(() => { throw Error('failed'); }), /failed/); assert.equal(h.timerCount(), 0);
  const timeout = h.request(() => new Promise(() => {}), { timeout: 500, timeoutValue: 'fallback' });
  h.tick(500); assert.equal(await timeout, 'fallback'); assert.equal(h.timerCount(), 0);
  const delay = h.delay(300); h.tick(300); await delay; assert.equal(h.timerCount(), 0);
  const controller = new AbortController(), cancelled = h.delay(300, { signal: controller.signal });
  controller.abort(); await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(h.timerCount(), 0);
});
