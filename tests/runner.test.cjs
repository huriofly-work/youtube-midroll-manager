const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../extension/planner.js');
const { runPlan } = require('../extension/runner.js');

function fake(initial = [180], mutate) {
  let times = [...initial];
  const calls = [];
  const adapter = {
    snapshot() { return { times: [...times], keys: times.map(P.formatTime), fingerprint: JSON.stringify(times) }; },
    async insert(s) { calls.push(s); times = mutate ? mutate(times, s) : [...times, s]; }
  };
  return { adapter, calls, change(value) { times = [...value]; } };
}
function plan(adapter) {
  const snapshot = adapter.snapshot();
  return { ...P.makePlan(600, 120, snapshot.times), fingerprint: snapshot.fingerprint };
}

test('runner adds only missing points, verifies preservation and reports confirmed progress', async () => {
  const f = fake();
  const progress = [];
  const result = await runPlan(f.adapter, plan(f.adapter), { onProgress: (p) => progress.push(p) });
  assert.deepEqual(f.calls, [60, 300, 420, 540]);
  assert.equal(result.inserted, 4);
  assert.equal(progress.at(-1).inserted, 4);
  assert.ok(f.adapter.snapshot().times.includes(180));
});
test('stale preview does not mutate the video', async () => {
  const f = fake();
  const p = plan(f.adapter);
  f.change([180, 60]);
  await assert.rejects(runPlan(f.adapter, p), /Xem trước/);
  assert.deepEqual(f.calls, []);
});
test('loss of old points stops after one insertion attempt', async () => {
  const f = fake([180], (_times, s) => [s]);
  await assert.rejects(runPlan(f.adapter, plan(f.adapter)), /giữ nguyên/);
  assert.deepEqual(f.calls, [60]);
});
test('wrong count and wrong timestamp stop immediately', async () => {
  for (const mutation of [(times, s) => [...times, s, s], (times, s) => [...times, s + 10]]) {
    const f = fake([180], mutation);
    await assert.rejects(runPlan(f.adapter, plan(f.adapter)));
    assert.deepEqual(f.calls, [60]);
  }
});
test('cancel before starting or between points stops further clicks', async () => {
  const f = fake();
  const c = new AbortController();
  c.abort();
  await assert.rejects(runPlan(f.adapter, plan(f.adapter), { signal: c.signal }), { name: 'AbortError' });
  assert.deepEqual(f.calls, []);
  const second = new AbortController();
  await assert.rejects(runPlan(f.adapter, plan(f.adapter), { signal: second.signal, onProgress: () => second.abort() }), { name: 'AbortError' });
  assert.deepEqual(f.calls, [60]);
});
test('a point added during processing is not inserted twice', async () => {
  const f = fake();
  const result = await runPlan(f.adapter, plan(f.adapter), { onProgress: ({ inserted }) => {
    if (inserted === 1) f.change([...f.adapter.snapshot().times, 300]);
  } });
  assert.deepEqual(f.calls, [60, 420, 540]);
  assert.equal(result.skipped, 1);
});
test('final verification cannot report success after deferred loss of a new point', async () => {
  const f = fake();
  f.adapter.verifyPlan = async () => { f.change([180]); };
  await assert.rejects(runPlan(f.adapter, plan(f.adapter)), /Studio đã thay đổi mốc/);
});
test('a concurrently added nearby point is accepted by the final audit', async () => {
  const f = fake();
  const result = await runPlan(f.adapter, plan(f.adapter), { onProgress: ({ inserted }) => {
    if (inserted === 1) f.change([...f.adapter.snapshot().times, 300.5]);
  } });
  assert.equal(result.skipped, 1);
  assert.deepEqual(f.calls, [60, 420, 540]);
});
