const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const { create } = require('../extension/run-control.js');
const P = require('../extension/planner.js');
const R = require('../extension/runner.js');
const C = require('../extension/cleanup.js');
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('pause waits for a checkpoint and repeated resume requests release only that waiter', async () => {
  const states = [], control = create({ getFingerprint: () => 'same', onChange: (s) => states.push(s) });
  const c = new AbortController();
  control.pause(); control.pause(); control.resume();
  assert.deepEqual(states, ['pausing']);
  const pending = control.checkpoint({ signal: c.signal });
  assert.equal(control.state, 'paused');
  assert.equal(getEventListeners(c.signal, 'abort').length, 1);
  control.resume(); control.resume(); await pending;
  assert.deepEqual(states, ['pausing', 'paused', 'resuming', 'running']);
  assert.equal(getEventListeners(c.signal, 'abort').length, 0);
  control.pause(); const again = control.checkpoint({ signal: c.signal });
  assert.equal(control.state, 'paused'); control.resume(); await again;
});

test('cancellation while paused wakes immediately, removes listeners and cannot resume', async () => {
  const control = create({ getFingerprint: () => 'same' }), c = new AbortController();
  control.pause();
  const pending = control.checkpoint({ signal: c.signal });
  c.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(getEventListeners(c.signal, 'abort').length, 0);
  control.resume();
  await assert.rejects(control.checkpoint({ signal: c.signal }), { name: 'AbortError' });
});

test('lost background session while paused preserves its failure reason', async () => {
  const control = create({ getFingerprint: () => 'same' }), c = new AbortController();
  control.pause(); const pending = control.checkpoint({ signal: c.signal });
  const reason = new Error('background disconnected'); c.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
});

test('resume revalidates state and rejects changed or unavailable Studio context', async () => {
  for (const unavailable of [false, true]) {
    let current = 'original';
    const control = create({ getFingerprint: () => { if (unavailable && current !== 'original') throw Error('editor closed'); return current; } });
    control.pause(); const pending = control.checkpoint();
    current = 'changed'; control.resume();
    await assert.rejects(pending, unavailable ? /editor closed/ : { code: 'paused-state-changed' });
  }
});

test('insertion pauses after a confirmed point, resumes twice without repeating points, and audits the last point', async () => {
  const times = [180], calls = [];
  const adapter = {
    snapshot: () => ({ times: [...times], keys: times.map(P.formatTime), fingerprint: JSON.stringify(times) }),
    insert: async (time) => { calls.push(time); times.push(time); }
  };
  const plan = { ...P.makePlan(600, 120, times), fingerprint: adapter.snapshot().fingerprint };
  const control = create({ getFingerprint: () => adapter.snapshot().fingerprint });
  const run = R.runPlan(adapter, plan, { checkpoint: control.checkpoint, onProgress: ({ inserted }) => { if ([1, 4].includes(inserted)) control.pause(); } });
  await tick(); assert.equal(control.state, 'paused'); assert.deepEqual(calls, [60]);
  control.resume(); await tick();
  assert.equal(control.state, 'paused'); assert.deepEqual(calls, [60, 300, 420, 540]);
  control.resume(); assert.deepEqual(await run, { inserted: 4, skipped: 0 });
});

// Rows pausing at the last removal were added by the ship coverage audit (Claude Opus 5.5).
// Value: protects=cleanup pause after the last single/grouped removal holds before final verification; fails_when=the post-loop cleanup checkpoint is removed; why_new=existing rows paused only mid-run; seam=none; no_claim=Studio DOM timing (in-memory adapter; unit only)
test('single and grouped cleanup pause at confirmed boundaries and keep counts and protected points on resume', async () => {
  for (const [grouped, pauseAt] of [[false, 1], [true, 5], [false, 7], [true, 7]]) {
    const rows = Array.from({ length: 7 }, (_, i) => ({ seconds: 60 * (i + 1), raw: `${i + 1}:00:00`, kind: 'manual', warning: true }));
    rows.push({ seconds: 500, raw: '8:20:00', kind: 'automatic' });
    const snapshot = () => ({ rows: [...rows], duration: 600, cleanupFingerprint: C.signature(rows) });
    let verified = 0;
    const calls = [], adapter = {
      cleanupSnapshot: snapshot,
      removePoint: async (key) => { calls.push(key); rows.splice(rows.findIndex((r) => C.key(r) === key), 1); },
      verifyCleanup: async () => { verified++; }
    };
    if (grouped) adapter.removePoints = async (targets) => { for (const target of targets) await adapter.removePoint(target.key); return { removed: targets.length }; };
    const control = create({ getFingerprint: () => snapshot().cleanupFingerprint });
    const run = C.runPlan(adapter, C.makePlan(snapshot(), 1), { checkpoint: control.checkpoint, onProgress: ({ removed }) => { if (removed === pauseAt) control.pause(); } });
    await tick(); assert.equal(control.state, 'paused'); assert.equal(calls.length, pauseAt);
    assert.equal(verified, 0, 'final verification must wait until Resume');
    control.resume(); assert.deepEqual(await run, { removed: 7 });
    assert.equal(verified, 1);
    assert.equal(new Set(calls).size, 7); assert.deepEqual(rows.map((r) => r.kind), ['automatic']);
  }
});

// Added by /ship Fix-First for the untested state-matrix cells (Claude Opus 5.5).
// Value: protects=a paused single or grouped cleanup that is stopped, loses its background session, navigates away or sees Studio change deletes nothing more and never verifies; fails_when=checkpoint stops honouring the abort reason or the resume fingerprint check in either cleanup path; why_new=the matrix covered these actions for insert only; seam=none; no_claim=real abort sources and Studio DOM (in-memory adapter; unit only)
test('paused cleanup ends on stop, session loss, navigation or changed Studio data without deleting more', async () => {
  const lost = new Error('Mất phiên chạy nền'), left = new Error('Tab Studio đã đóng hoặc chuyển trang. Đã dừng chèn.');
  for (const grouped of [false, true]) for (const action of ['stop', 'lost', 'navigate', 'change']) {
    const rows = Array.from({ length: 7 }, (_, i) => ({ seconds: 60 * (i + 1), raw: `${i + 1}:00:00`, kind: 'manual', warning: true }));
    rows.push({ seconds: 500, raw: '8:20:00', kind: 'automatic' });
    const snapshot = () => ({ rows: [...rows], duration: 600, cleanupFingerprint: C.signature(rows) });
    let verified = 0;
    const calls = [], adapter = {
      cleanupSnapshot: snapshot,
      removePoint: async (key) => { calls.push(key); rows.splice(rows.findIndex((r) => C.key(r) === key), 1); },
      verifyCleanup: async () => { verified++; }
    };
    if (grouped) adapter.removePoints = async (targets) => { for (const target of targets) await adapter.removePoint(target.key); return { removed: targets.length }; };
    const pauseAt = grouped ? 5 : 1, c = new AbortController();
    const control = create({ getFingerprint: () => snapshot().cleanupFingerprint });
    const run = C.runPlan(adapter, C.makePlan(snapshot(), 1), { signal: c.signal, checkpoint: control.checkpoint, onProgress: ({ removed }) => { if (removed === pauseAt) control.pause(); } });
    await tick(); assert.equal(control.state, 'paused', `${grouped}/${action}`);
    if (action === 'stop') c.abort();
    else if (action === 'lost') c.abort(lost);
    else if (action === 'navigate') c.abort(left);
    else { rows.push({ seconds: 590, raw: '9:50:00', kind: 'manual' }); control.resume(); }
    await assert.rejects(run, action === 'stop' ? { name: 'AbortError' } : action === 'lost' ? (e) => e === lost : action === 'navigate' ? (e) => e === left : { code: 'paused-state-changed' });
    assert.equal(calls.length, pauseAt, `${grouped}/${action}`); assert.equal(verified, 0);
    assert.ok(rows.some((r) => r.kind === 'automatic'));
  }
});
