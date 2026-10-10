const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/planner.js');
const C = require('../extension/cleanup.js');
const row = (seconds, kind = 'manual', warning = false, pending = false, raw = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}:00`) => ({ seconds, raw, kind, warning, pending });
const snapshot = (rows) => ({ rows, duration: 1200, cleanupFingerprint: C.signature(rows) });

test('remove warned manual slots first; greedily keep the earliest unflagged manual slot', () => {
  const rows = [row(300), row(100, 'manual', true), row(220), row(160), row(400)];
  const plan = C.makePlan(snapshot(rows), 120);
  assert.deepEqual(plan.removals.map((r) => r.seconds), [100, 220, 400]);
  assert.equal(plan.retained, 2);
  assert.match(plan.removals[0].reason, /Cảnh báo/);
  assert.equal(rows.length, 5);
});
test('automatic and unknown slots remain protected while pending manual slots are removed', () => {
  const rows = [row(100), row(120, 'automatic', true), row(130, 'automatic'), row(300, 'unknown', true), row(400, 'manual', true, true)];
  const plan = C.makePlan(snapshot(rows), 60);
  assert.deepEqual(plan.removals.map((r) => r.seconds), [100, 400]);
  assert.equal(plan.automatic, 2); assert.equal(plan.unknown, 1); assert.equal(plan.pending, 1);
});
test('pending manual rows are removed regardless of warning or spacing; pending automatic and unknown rows stay', () => {
  const rows = [row(60, 'manual', true, true), row(70, 'manual', false, true), row(80, 'unknown', false, true), row(90, 'automatic', false, true), row(500, 'manual', true)];
  const plan = C.makePlan(snapshot(rows), 300);
  assert.equal(plan.pending, 4);
  assert.deepEqual(plan.removals.map((r) => r.seconds), [60, 70, 500]);
  assert.equal(plan.reviewRemovals, 2);
  assert.deepEqual(plan.removals.slice(0, 2).map((r) => r.reason), ["Đang xem xét", "Đang xem xét"]);
});
test('exact minimum is kept, duplicate manual slots filtered and subsecond boundary stays conservative', () => {
  assert.deepEqual(C.makePlan(snapshot([row(60), row(120), row(180)]), 60).removals, []);
  assert.equal(C.makePlan(snapshot([row(60), row(60)]), 60).removals.length, 1);
  assert.equal(C.makePlan(snapshot([row(60, 'manual', false, false, '1:00:17'), row(120)]), 60).removals.length, 1);
  assert.throws(() => C.makePlan(snapshot([row(60)]), 0));
  assert.throws(() => C.makePlan(snapshot([row(NaN)]), 60));
});
function adapter(rows, mutation) {
  return {
    calls: 0, cleanupSnapshot: () => snapshot(rows),
    async removePoint(key, options) {
      assert.equal(options.expectedFingerprint, C.signature(rows));
      this.calls++;
      const index = rows.findIndex((r) => C.key(r) === key);
      if (mutation) mutation(rows, index); else rows.splice(index, 1);
    }
  };
}
test('cleanup runner preserves every other occurrence including same-time automatic and rerendered rows', async () => {
  const rows = [row(60, 'manual', true), row(60, 'automatic'), row(300), row(310)];
  const a = adapter(rows);
  const plan = C.makePlan(a.cleanupSnapshot(), 60);
  assert.deepEqual(await C.runPlan(a, plan), { removed: 2 });
  assert.deepEqual(rows.map((r) => [r.seconds, r.kind]), [[60, 'automatic'], [300, 'manual']]);
});
test('stale warning/type/list blocks before any deletion', async () => {
  for (const field of ['warning', 'kind', 'raw', 'pending']) {
    const rows = [row(60, 'manual', true)], a = adapter(rows), plan = C.makePlan(a.cleanupSnapshot(), 60);
    rows[0][field] = field === 'warning' ? false : field === 'pending' ? true : 'changed';
    await assert.rejects(C.runPlan(a, plan), /thay đổi/);
    assert.equal(a.calls, 0);
  }
});
test('wrong removal, missing acknowledgment or collateral loss stops after exactly one attempt', async () => {
  for (const mutate of [(rows) => rows.splice(1, 1), () => {}, (rows) => rows.splice(0, 2)]) {
    const rows = [row(60, 'manual', true), row(300, 'automatic'), row(500, 'manual', true)];
    const a = adapter(rows, mutate), plan = C.makePlan(a.cleanupSnapshot(), 60);
    await assert.rejects(C.runPlan(a, plan), /Không xác nhận/);
    assert.equal(a.calls, 1);
  }
});
test('cancellation and changed final snapshot cannot report cleanup success', async () => {
  const rows = [row(60, 'manual', true), row(500, 'manual', true)], a = adapter(rows), plan = C.makePlan(a.cleanupSnapshot(), 60);
  const controller = new AbortController();
  await assert.rejects(C.runPlan(a, plan, { signal: controller.signal, onProgress: () => controller.abort() }), { name: 'AbortError' });
  assert.equal(a.calls, 1);
  const b = adapter([row(60, 'manual', true)]), p = C.makePlan(b.cleanupSnapshot(), 60);
  b.verifyCleanup = async () => { b.cleanupSnapshot = () => snapshot([row(300)]); };
  await assert.rejects(C.runPlan(b, p), /Danh sách cuối/);
});
test('batch runner limits each group to five, validates retained occurrences and reports only complete groups', async () => {
  const rows = [...Array.from({ length: 12 }, (_, i) => row(60 + i * 30, 'manual', true)), row(700, 'automatic')];
  const a = adapter(rows), sizes = [], progress = [];
  a.removePoints = async (targets) => {
    sizes.push(targets.length);
    for (const target of targets) rows.splice(rows.findIndex((r) => C.key(r) === target.key), 1);
    return { removed: targets.length };
  };
  assert.deepEqual(await C.runPlan(a, C.makePlan(a.cleanupSnapshot(), 30), { onProgress: (p) => progress.push(p.removed) }), { removed: 12 });
  assert.deepEqual(sizes, [5, 5, 2]); assert.deepEqual(progress, [5, 10, 12]);
  assert.deepEqual(rows.map((r) => r.kind), ['automatic']);
});
test('batch mismatch and cancellation after the first group stop before another group', async () => {
  for (const bad of [true, false]) {
    const rows = Array.from({ length: 12 }, (_, i) => row(60 + i * 30, 'manual', true)), a = adapter(rows);
    const controller = new AbortController(); let groups = 0;
    a.removePoints = async (targets) => {
      groups++;
      for (const target of targets.slice(0, bad ? 4 : 5)) rows.splice(rows.findIndex((r) => C.key(r) === target.key), 1);
      return { removed: targets.length };
    };
    await assert.rejects(C.runPlan(a, C.makePlan(a.cleanupSnapshot(), 30), { signal: controller.signal, onProgress: () => controller.abort() }), bad ? /Không xác nhận/ : { name: 'AbortError' });
    assert.equal(groups, 1);
  }
});

test('both runner paths delete pending manual occurrences and preserve pending automatic or unknown duplicates', async () => {
  for (const grouped of [false, true]) {
    const rows = [row(60, 'manual', false, true), row(60, 'automatic', true, true), row(60, 'unknown', true, true), row(500)];
    const a = adapter(rows);
    if (grouped) a.removePoints = async (targets) => {
      for (const target of targets) await a.removePoint(target.key, { expectedFingerprint: C.signature(rows) });
      return { removed: targets.length };
    };
    const plan = C.makePlan(a.cleanupSnapshot(), 60);
    assert.equal(plan.reviewRemovals, 1);
    assert.deepEqual(await C.runPlan(a, plan), { removed: 1 });
    assert.deepEqual(rows.map((r) => [r.seconds, r.kind]), [[60, 'automatic'], [60, 'unknown'], [500, 'manual']]);
  }
});

test('earliest subsecond counter wins even when Studio lists same-second rows in reverse order', () => {
  const rows = [row(60, 'manual', false, false, '1:00:50'), row(60, 'manual', false, false, '1:00:05'), row(120)];
  assert.deepEqual(C.makePlan(snapshot(rows), 60).removals.map((target) => target.raw), ['1:00:50', '2:00:00']);
});
test('optimized cleanup agrees with brute-force spacing selection including counter boundaries and mixed types', () => {
  let seed = 84751;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const counter = (r) => Number(r.raw.split(':').at(-1));
  const compare = (a, b) => a.seconds - b.seconds || counter(a) - counter(b);
  const near = (a, b, spacing) => {
    const distance = Math.abs(a.seconds - b.seconds);
    if (distance !== spacing) return distance < spacing;
    const [earlier, later] = a.seconds < b.seconds ? [a, b] : [b, a];
    return counter(later) < counter(earlier);
  };
  for (let trial = 0; trial < 500; trial++) {
    const spacing = 1 + Math.floor(random() * 200);
    const rows = Array.from({ length: 150 }, () => {
      const seconds = Math.floor(random() * 1200), kind = ['manual', 'manual', 'automatic', 'unknown'][Math.floor(random() * 4)];
      return row(seconds, kind, random() < .1, random() < .1, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}`);
    });
    const autos = rows.filter((r) => r.kind === 'automatic'), kept = [], removed = rows.filter((r) => r.kind === 'manual' && (r.warning || r.pending));
    for (const candidate of rows.filter((r) => r.kind === 'manual' && !r.warning && !r.pending).sort(compare)) {
      if ([...autos, ...kept].some((r) => near(r, candidate, spacing))) removed.push(candidate); else kept.push(candidate);
    }
    assert.deepEqual(C.makePlan(snapshot(rows), spacing).removals.map((r) => r.key).sort(), removed.map(C.key).sort());
  }
});
test('automatic and unknown review status changes are irrelevant to cleanup while manual changes remain stale', () => {
  for (const kind of ['automatic', 'unknown']) {
    const a = row(60, kind, false, false), b = { ...a, warning: true, pending: true };
    assert.equal(C.key(a), C.key(b));
  }
  assert.notEqual(C.key(row(60)), C.key(row(60, 'manual', false, true)));
  assert.throws(() => C.makePlan({ rows: [], duration: NaN }, 60));
});

test('missing deletion control blocks the whole preview only when the affected manual point would be removed', () => {
  const locked = { ...row(60, 'manual', true), canRemove: false };
  assert.throws(() => C.makePlan(snapshot([row(30, 'manual', true), locked]), 60), /nút Xóa khả dụng/);
  assert.equal(C.makePlan(snapshot([{ ...row(60, 'automatic', true, true), canRemove: false }, row(500)]), 60).removals.length, 0);
});

test('mixed nonzero frame counters and decimal seconds block ambiguous spacing instead of guessing FPS', () => {
  const frame = row(60, 'manual', false, false, '1:00:17'), decimal = row(120.5, 'manual', false, false, '2:00.500');
  assert.throws(() => C.makePlan(snapshot([frame, decimal]), 60), /khác định dạng/);
  assert.throws(() => C.makePlan(snapshot([{ ...frame, kind: 'automatic' }, decimal]), 60), /khác định dạng/);
  assert.equal(C.makePlan(snapshot([{ ...frame, pending: true }, decimal]), 60).removals.length, 1);
  assert.equal(C.makePlan(snapshot([{ ...frame, raw: '1:00:00' }, decimal]), 60).removals.length, 0);
});

test('a delete control becoming unavailable after preview blocks the entire next group before its first click', async () => {
  const rows = [row(60, 'manual', true), row(180, 'manual', true)], a = adapter(rows);
  let groups = 0; a.removePoints = async () => { groups++; return { removed: 2 }; };
  const plan = C.makePlan(a.cleanupSnapshot(), 60); rows[1].canRemove = false;
  await assert.rejects(C.runPlan(a, plan), /Chưa xóa nhóm này/); assert.equal(groups, 0);
});

test('cleanup margins delete only manual slots outside the inclusive allowed window', () => {
  const rows = [row(0), row(59), row(60), row(600), row(1140), row(1141), row(1200),
    row(0, 'automatic', true, true), row(1200, 'automatic', true, true), row(20, 'unknown', true, true)];
  const plan = C.makePlan(snapshot(rows), 1, { startSeconds: 60, endMarginSeconds: 60 });
  assert.deepEqual(plan.removals.map((r) => r.seconds), [0, 59, 1141, 1200]);
  assert.equal(plan.marginRemovals, 4); assert.equal(plan.automatic, 2); assert.equal(plan.unknown, 1);
  assert.deepEqual(plan.removals.map((r) => r.reason), ['Trong đoạn đầu không chèn', 'Trong đoạn đầu không chèn', 'Trong đoạn cuối không chèn', 'Trong đoạn cuối không chèn']);
});

test('zero cleanup margins disable boundary deletion and invalid margins never produce a plan', () => {
  const rows = [row(0), row(1200)];
  assert.deepEqual(C.makePlan(snapshot(rows), 1).removals, []);
  for (const options of [{ startSeconds: '' }, { endMarginSeconds: '-1' }, { startSeconds: '1.5' }, { startSeconds: 600, endMarginSeconds: 600 }, { endMarginSeconds: 1201 }]) {
    assert.throws(() => C.makePlan(snapshot(rows), 1, options));
  }
});

test('subsecond cleanup boundaries keep the start counter and remove a nonzero end counter without guessing FPS', () => {
  const rows = [row(59, 'manual', false, false, '0:59:99'), row(60, 'manual', false, false, '1:00:17'),
    row(1140, 'manual', false, false, '19:00:00'), row(1140, 'manual', false, false, '19:00:17')];
  const plan = C.makePlan(snapshot(rows), 1, { startSeconds: 60, endMarginSeconds: 60 });
  assert.deepEqual(plan.removals.map((r) => r.raw), ['0:59:99', '19:00:17']);
  assert.equal(C.makePlan({ ...snapshot([row(60.5, 'manual', false, false, '1:00.500'), row(1140.5, 'manual', false, false, '19:00.500')]), duration: 1200.5 }, 1, { startSeconds: 60, endMarginSeconds: 60 }).removals.length, 0);
  const frame = row(1140, 'manual', false, false, '19:00:17');
  assert.throws(() => C.makePlan({ ...snapshot([frame]), duration: 1200.5 }, 1, { endMarginSeconds: 60 }), /ranh giới đoạn cuối/);
  assert.equal(C.makePlan({ ...snapshot([{ ...frame, kind: 'automatic', warning: true, pending: true }]), duration: 1200.5 }, 1, { endMarginSeconds: 60 }).removals.length, 0);
});

test('margin removals do not anchor manual spacing, and flagged margin slots are removed only once', () => {
  const rows = [row(59), row(60), row(61), row(1190, 'manual', true, true)];
  const plan = C.makePlan(snapshot(rows), 60, { startSeconds: 60, endMarginSeconds: 60 });
  assert.deepEqual(plan.removals.map((r) => r.seconds), [59, 61, 1190]);
  assert.equal(plan.reviewRemovals, 1); assert.equal(plan.marginRemovals, 1);
});

test('single and grouped margin cleanup preserve every automatic and unknown occurrence in excluded regions', async () => {
  for (const grouped of [false, true]) {
    const rows = [row(0), row(0, 'automatic', true, true), row(0, 'unknown', true, true), row(1190), row(1190, 'automatic'), row(500)];
    const a = adapter(rows);
    if (grouped) a.removePoints = async (targets) => {
      for (const target of targets) await a.removePoint(target.key, { expectedFingerprint: C.signature(rows) });
      return { removed: targets.length };
    };
    const plan = C.makePlan(a.cleanupSnapshot(), 1, { startSeconds: 60, endMarginSeconds: 60 });
    assert.deepEqual(await C.runPlan(a, plan), { removed: 2 });
    assert.deepEqual(rows.map((r) => [r.seconds, r.kind]), [[0, 'automatic'], [0, 'unknown'], [1190, 'automatic'], [500, 'manual']]);
  }
});

test('cleanup with randomized margins agrees with independent interval and spacing selection', () => {
  let seed = 19339;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let trial = 0; trial < 300; trial++) {
    const start = Math.floor(random() * 500), tail = Math.floor(random() * 500), spacing = 1 + Math.floor(random() * 200);
    const rows = Array.from({ length: 100 }, () => row(Math.floor(random() * 1201), ['manual', 'automatic', 'unknown'][Math.floor(random() * 3)], random() < .1, random() < .1));
    const autos = rows.filter((r) => r.kind === 'automatic'), kept = [], expected = [];
    for (const r of rows.filter((r) => r.kind === 'manual').sort((a, b) => a.seconds - b.seconds)) {
      if (r.pending || r.warning || (start > 0 && r.seconds < start) || (tail > 0 && r.seconds > 1200 - tail) || [...autos, ...kept].some((anchor) => Math.abs(anchor.seconds - r.seconds) < spacing)) expected.push(r);
      else kept.push(r);
    }
    assert.deepEqual(C.makePlan(snapshot(rows), spacing, { startSeconds: start, endMarginSeconds: tail }).removals.map((r) => r.key).sort(), expected.map(C.key).sort());
  }
});
