const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../extension/planner.js');

test('ten-minute video: first minute, interval 120, final minute excluded', () => {
  assert.deepEqual(P.makePlan(600, 120).additions, [60, 180, 300, 420, 540]);
});
test('custom beginning and ending margins, zero margins and invalid empty range', () => {
  const plan = P.makePlan(600, 120, [20, 590], { startSeconds: '90', endMarginSeconds: '150' });
  assert.deepEqual(plan.additions, [90, 210, 330, 450]);
  assert.equal(plan.start, 90); assert.equal(plan.endMargin, 150);
  assert.deepEqual(plan.existing, [20, 590]);
  assert.deepEqual(P.makePlan(600, 300, [], { startSeconds: 0, endMarginSeconds: 0 }).additions, [0, 300]);
  assert.equal(P.makePlan(600, 1, [], { startSeconds: 590, endMarginSeconds: 0 }).additions.at(-1), 599);
  for (const bad of ['', '-1', '1.2', '01:00', '1e2']) {
    assert.throws(() => P.makePlan(600, 120, [], { startSeconds: bad }));
    assert.throws(() => P.makePlan(600, 120, [], { endMarginSeconds: bad }));
  }
  assert.throws(() => P.makePlan(600, 120, [], { startSeconds: 300, endMarginSeconds: 300 }));
});
test('non-divisible duration and intervals preserve the endpoint margin', () => {
  const plan = P.makePlan(601.4, 37);
  assert.equal(plan.additions[0], 60);
  assert.equal(plan.additions.at(-1), 541);
  assert.ok(plan.additions.every((s) => s <= 541.4));
});
test('preserves all old points, even within start/end margins, skipping within one second', () => {
  const old = [10, 60, 179.3, 301, 580];
  const plan = P.makePlan(600, '120', old);
  assert.deepEqual(old, [10, 60, 179.3, 301, 580]);
  assert.deepEqual(plan.existing, old);
  assert.deepEqual(plan.additions, [420, 540]);
  assert.deepEqual(plan.skipped, [60, 180, 300]);
});
test('longer than one hour and large interval', () => {
  assert.equal(P.formatTime(3661), '01:01:01');
  assert.deepEqual(P.makePlan(36000, '99999').additions, [60]);
});
test('time formats, frame format handled without assuming a frame rate', () => {
  assert.equal(P.parseTime('10:00'), 600);
  assert.equal(P.parseTime('01:02:03.5'), 3723.5);
  assert.equal(P.readStudioTime('00:01:00:29'), 60);
  assert.equal(P.formatLike(180, '00:00:00:00'), '00:03:00:00');
  assert.equal(P.formatLike(180, '00:00.000'), '03:00.000');
  assert.equal(P.formatLike(3661, '00:00'), '61:01');
  for (const invalid of ['10:60', '0', '-1:00', 'abc', '00:99:00']) assert.equal(P.parseTime(invalid), null);
});
test('real Studio timecode 1:07:17 means 67 whole seconds, not an hour', () => {
  assert.equal(P.readStudioTime('1:07:17'), 67);
  assert.equal(P.readStudioTime('8:27:17'), 507);
  assert.equal(P.readStudioTime('00:01:07:17'), 67);
  assert.equal(P.readStudioTime('1:01:07:17'), 3667);
  assert.equal(P.readStudioTime('1:67:17'), null);
  // The user's own duration field retains ordinary H:MM:SS semantics.
  assert.equal(P.parseTime('08:27'), 507);
  assert.equal(P.parseTime('1:07:17'), 4037);
});
test('writes minutes/seconds/subsecond Studio fields in the same format', () => {
  assert.equal(P.formatStudioTime(60, '1:07:17'), '1:00:00');
  assert.equal(P.formatStudioTime(420, '1:07:17'), '7:00:00');
  assert.equal(P.formatStudioTime(420, '01:07:17'), '07:00:00');
  assert.equal(P.formatStudioTime(3667, '1:07:17'), '61:07:00');
  assert.equal(P.formatStudioTime(3667, '0:00:00:00'), '01:01:07:00');
  assert.equal(P.formatStudioTime(420, '1:07'), '07:00');
});
test('08:27 video keeps its final minute clear and preserves subsecond old timecodes', () => {
  const old = ['1:07:17', '3:00:00', '7:45:00'].map(P.readStudioTime);
  const plan = P.makePlan(P.parseTime('08:27'), 120, old);
  assert.deepEqual(plan.additions, [60, 300, 420]);
  assert.ok(plan.additions.every((time) => time <= 447));
  assert.deepEqual(plan.existing, [67, 180, 465]);
});
test('invalid intervals, ineligible durations, invalid old points and excessive count rejected', () => {
  for (const bad of ['', 0, -1, 1.5, '1e2', NaN, Infinity]) assert.throws(() => P.makePlan(600, bad));
  for (const duration of [479, NaN, 0, Infinity]) assert.throws(() => P.makePlan(duration, 120));
  assert.throws(() => P.makePlan(600, 120, [610]));
  assert.throws(() => P.makePlan(600, 120, [NaN]));
  assert.throws(() => P.makePlan(36000, 1));
  assert.deepEqual(P.makePlan(480, 120).additions, [60, 180, 300, 420]);
});
test('preservation is a multiset so duplicate old points must all remain', () => {
  assert.equal(P.preserves(['a', 'a'], ['a']), false);
  assert.equal(P.preserves(['a', 'a'], ['a', 'b', 'a']), true);
});
test('one extra occurrence handles duplicate old/new keys and rejects lost or changed old slots', () => {
  assert.equal(P.additionalKey(['a', 'a', 'b'], ['b', 'a', 'c', 'a']), 'c');
  assert.equal(P.additionalKey(['a', 'a', 'b'], ['a', 'b', 'a', 'a']), 'a');
  assert.equal(P.additionalKey(['a', 'a', 'b'], ['a', 'b', 'c', 'c']), null);
  assert.equal(P.additionalKey(['a', 'b'], ['a', 'c', 'd']), null);
  assert.equal(P.additionalKey(['a'], ['a']), null);
  assert.equal(P.additionalKey(['a'], ['a', 'b', 'c']), null);
});
test('many boundary combinations never insert inside final minute or collide with old points', () => {
  for (let duration = 480; duration < 8000; duration += 173) {
    for (const interval of [1, 17, 120, 251, 9999]) {
      if (Math.floor((duration - 120) / interval) + 1 > P.MAX_POINTS) continue;
      const old = [60, duration - 30];
      const plan = P.makePlan(duration, interval, old);
      assert.equal(new Set(plan.proposed).size, plan.proposed.length);
      assert.ok(plan.additions.every((s) => s >= 60 && s <= duration - 60 && !old.some((x) => Math.abs(x - s) <= 1)));
      assert.equal(plan.additions.length + plan.skipped.length, plan.proposed.length);
    }
  }
});

test('optimized insertion planner matches a brute-force reference on randomized unsorted duplicate and fractional points', () => {
  let seed = 928174;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let trial = 0; trial < 500; trial++) {
    const duration = 480 + random() * 5000, interval = 6 + Math.floor(random() * 120);
    const startSeconds = Math.floor(random() * 100), endMarginSeconds = Math.floor(random() * 100);
    const existing = Array.from({ length: 100 }, () => random() * duration);
    existing.push(60, 60);
    const plan = P.makePlan(duration, interval, existing, { startSeconds, endMarginSeconds });
    assert.deepEqual(plan.skipped, plan.proposed.filter((time) => existing.some((old) => Math.abs(old - time) <= 1)));
    assert.deepEqual(plan.additions, plan.proposed.filter((time) => !existing.some((old) => Math.abs(old - time) <= 1)));
    assert.deepEqual(plan.existing, existing);
  }
});
