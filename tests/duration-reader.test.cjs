const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPageDuration } = require('../extension/duration-reader.js');

function read({ nodes = [], response, route = '/video/test123/monetization' } = {}) {
  const document = { querySelectorAll(selector) { return selector === '*' ? [] : nodes; } };
  return vm.runInNewContext(`(${readPageDuration.toString()})('test123')`, {
    URL, location: { pathname: route }, document, ytInitialPlayerResponse: response
  });
}
function component(properties = {}, attrs = {}) {
  return { localName: 'ytcp-video-player', nodeType: 1, getAttribute(name) { return attrs[name]; }, ...properties };
}
test('serialized MAIN reader binds getDuration to the current video, never to playback position', () => {
  const result = read({ nodes: [component({ id: 'movie_player', getVideoData: () => ({ video_id: 'test123' }), getDuration: () => 507, getCurrentTime: () => { throw Error('must not read playhead'); } })] });
  assert.equal(result.seconds, 507);
  assert.equal(result.source, 'player.getDuration');
});
test('wrong video, stale global response and changed route are rejected', () => {
  assert.equal(read({ nodes: [component({ getVideoData: () => ({ video_id: 'other' }), getDuration: () => 507 })] }).seconds, null);
  assert.equal(read({ response: { videoDetails: { videoId: 'other', lengthSeconds: '507' } } }).seconds, null);
  assert.equal(read({ route: '/video/other/monetization', response: { videoDetails: { videoId: 'test123', lengthSeconds: '507' } } }).reason, 'video-changed');
});
test('explicit seconds, milliseconds, ISO and typed seconds metadata are supported', () => {
  for (const properties of [
    { lengthSeconds: '507' }, { durationSeconds: 507 }, { durationMs: 507000 },
    { duration: 'PT8M27S' }, { duration: { seconds: '507', nanos: 0 } }
  ]) {
    assert.equal(read({ nodes: [component({ video: { videoId: 'test123', ...properties } })] }).seconds, 507);
  }
  assert.equal(read({ response: { videoDetails: { videoId: 'test123', lengthSeconds: '507' } } }).seconds, 507);
  assert.equal(read({ nodes: [component({ id: 'control-id', durationMs: 507000 }, { 'video-id': 'test123' })] }).seconds, 507);
});
test('zero, infinite, missing ID and ambiguous numeric duration are not guessed', () => {
  for (const properties of [{ lengthSeconds: '507' }, { videoId: 'test123', lengthSeconds: 0 }, { videoId: 'test123', durationSeconds: Infinity }, { videoId: 'test123', duration: 507000 }]) {
    assert.equal(read({ nodes: [component({ video: properties })] }).seconds, null);
  }
});
test('conflicting bound sources block rather than selecting the longest', () => {
  const result = read({ nodes: [component({ getVideoData: () => ({ video_id: 'test123' }), getDuration: () => 507, video: { videoId: 'test123', durationSeconds: 600 } })] });
  assert.equal(result.seconds, null);
  assert.equal(result.reason, 'duration-conflict');
});
test('throwing getters and cyclic metadata do not crash or read arbitrary state', () => {
  const data = { videoId: 'test123', lengthSeconds: 507 };
  data.video = data;
  Object.defineProperty(data, 'durationMs', { get() { throw Error('unavailable'); } });
  assert.equal(read({ nodes: [component({ video: data, accountToken: 'private' })] }).seconds, 507);
});

test('contradictory player identity cannot lend its duration to the expected video', () => {
  const result = read({ nodes: [component({ videoId: 'other', getVideoData: () => ({ video_id: 'test123' }), getDuration: () => 507 })] });
  assert.equal(result.seconds, null); assert.equal(result.reason, 'duration-conflict');
  assert.equal(read({ nodes: [component({ getVideoData: () => ({ video_id: 'other' }), getDuration: () => 507 })] }).reason, 'video-mismatch');
});
test('typed seconds rejects malformed numeric strings and throwing identity getters', () => {
  for (const seconds of ['', ' ', '0x1ff', '-10']) assert.equal(read({ nodes: [component({ video: { videoId: 'test123', duration: { seconds, nanos: 500000000 } } })] }).seconds, null);
  const data = { videoId: 'test123', lengthSeconds: 507 };
  Object.defineProperty(data, 'nodeType', { get() { throw Error('unavailable'); } });
  assert.equal(read({ nodes: [component({ video: data })] }).seconds, 507);
});
