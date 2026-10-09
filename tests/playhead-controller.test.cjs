const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { seekPagePlayhead } = require('../extension/playhead-controller.js');
const token = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
function player(id = 'test123', options = {}) {
  let time = 20;
  const calls = [];
  return {
    calls, nodeType: 1, getAttribute() {}, getClientRects: () => [{}],
    getVideoData: () => ({ video_id: id }), getDuration: () => 600,
    getCurrentTime: () => time,
    pauseVideo() { calls.push('pause'); },
    seekTo(seconds, ahead) { calls.push([seconds, ahead]); if (!options.ignoreSeek) time = seconds; options.onSeek?.(); }
  };
}
async function seek({ nodes = [], videos = [], route = '/video/test123/monetization', seconds = 60, duration = 600, editorToken = token, editor } = {}) {
  let now = 0;
  const active = editor || { isConnected: true, getAttribute: () => token, querySelectorAll: (selector) => selector === '*' ? [] : selector === 'video' ? videos : nodes };
  const document = { querySelectorAll: (selector) => selector === '*' ? [] : selector.startsWith('[data-midroll') ? [active] : nodes };
  return vm.runInNewContext(`(${seekPagePlayhead.toString()})('test123', ${seconds}, ${duration}, '${editorToken}')`, {
    document, location: { pathname: route }, Date: { now: () => now },
    setTimeout(fn, ms) { now += ms; queueMicrotask(fn); }
  });
}
test('MAIN seeks the real current-video preview and pauses it without playing or editing ad slots', async () => {
  const p = player();
  const result = await seek({ nodes: [p] });
  assert.equal(result.ok, true); assert.equal(result.seconds, 60);
  assert.deepEqual(p.calls, ['pause', [60, true]]);
});
test('wrong video and stale inherited identity never seek the other player', async () => {
  const p = player('other');
  assert.equal((await seek({ nodes: [p] })).reason, 'wrong-video');
  const wrapper = { getAttribute: () => 'test123', player: p };
  assert.equal((await seek({ nodes: [wrapper] })).reason, 'wrong-video');
  assert.deepEqual(p.calls, []);
});
test('multiple matching preview players are ambiguous and left untouched', async () => {
  const first = player(), second = player();
  assert.equal((await seek({ nodes: [first, second] })).reason, 'multiple-players');
  assert.deepEqual(first.calls, []); assert.deepEqual(second.calls, []);
});
test('serialized controller finds a supported nested API without walking arbitrary state', async () => {
  const p = player();
  const wrapper = { getAttribute: () => 'test123', playerApi_: p };
  Object.defineProperty(wrapper, 'accountToken', { get() { throw new Error('private'); } });
  assert.equal((await seek({ nodes: [wrapper] })).ok, true);
  assert.equal(p.calls.length, 2);
});
test('display-only seek acknowledgment is rejected if the real player never moves', async () => {
  assert.equal((await seek({ nodes: [player('test123', { ignoreSeek: true })] })).reason, 'seek-unconfirmed');
});
test('changed editor, route, invalid times and mismatching duration block preview mutation', async () => {
  const p = player();
  assert.equal((await seek({ nodes: [p], route: '/video/other/monetization' })).reason, 'video-changed');
  assert.equal((await seek({ nodes: [p], seconds: 601 })).reason, 'invalid-time');
  assert.equal((await seek({ nodes: [p], seconds: -1 })).reason, 'invalid-time');
  assert.equal((await seek({ nodes: [p], duration: 507 })).reason, 'seek-unavailable');
  const editor = { isConnected: false };
  assert.equal((await seek({ nodes: [p], editor })).reason, 'editor-changed');
  assert.deepEqual(p.calls, []);
});
test('editor replacement during seek cannot acknowledge a stale position', async () => {
  const editor = { isConnected: true, getAttribute: () => token, querySelectorAll: (selector) => selector === '*' || selector === 'video' ? [] : [p] };
  const p = player('test123', { onSeek() { editor.isConnected = false; } });
  assert.equal((await seek({ editor })).reason, 'editor-changed');
});
test('native preview fallback is limited to one duration-matched video in the exact editor', async () => {
  const calls = [];
  const video = { duration: 600, seeking: false, currentTime: 20, getAttribute() {}, pause() { calls.push('pause'); } };
  assert.equal((await seek({ videos: [video] })).ok, true);
  assert.equal(video.currentTime, 60); assert.deepEqual(calls, ['pause']);
  video.currentTime = 20;
  assert.equal((await seek({ videos: [video, { ...video }] })).reason, 'seek-unavailable');
  assert.equal(video.currentTime, 20);
});
