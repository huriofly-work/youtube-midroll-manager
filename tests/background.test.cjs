const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function background(fail = false, panelExists = false) {
  const calls = [];
  let activeTab;
  let message;
  const action = {
    async setBadgeText(details) { calls.push(['badge', details]); },
    async setTitle(details) { calls.push(['title', details]); },
    async setBadgeBackgroundColor(details) { calls.push(['color', details]); }
  };
  const context = vm.createContext({
    URL,
    setInterval() { return 1; }, clearInterval() {},
    importScripts(file) { vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), context); },
    chrome: { action, debugger: { onDetach: { addListener() {} } }, tabs: { async query(options) { calls.push(['query', options]); return activeTab ? [activeTab] : []; }, onUpdated: { addListener() {} }, onRemoved: { addListener() {} } }, runtime: { id: 'test-extension', getURL: (file) => 'chrome-extension://test-extension/' + file, onMessage: { addListener(callback) { message = callback; } } }, scripting: { async executeScript(details) { calls.push(['inject', details]); if (fail) throw new Error('injection unavailable'); if (panelExists && details.func && !details.world) return [{ result: true }]; return [{ result: { videoId: 'test123', seconds: 507 } }]; } } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8'), context);
  const click = async (tab) => {
    activeTab = tab;
    return new Promise((resolve) => message({ type: 'MIDROLL_OPEN_PANEL', tabId: 999 }, { id: 'test-extension', frameId: 0, url: 'chrome-extension://test-extension/popup.html' }, resolve));
  };
  return { calls, click, message };
}

test('popup opens bundled panel scripts in dependency order only on the active Studio video', async () => {
  const f = background();
  await f.click({ id: 7, url: 'https://studio.youtube.com/video/test123/monetization' });
  const injection = f.calls.find(([name, details]) => name === 'inject' && details.files)[1];
  assert.deepEqual(Array.from(injection.files), ['planner.js', 'cleanup.js', 'wait.js', 'studio.js', 'runner.js', 'background-client.js', 'error-copy.js', 'content.js']);
  assert.equal(injection.target.tabId, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(([name]) => name === 'query')[1])), { active: true, currentWindow: true });
  assert.equal(f.calls.filter(([name]) => name === 'inject').length, 2);
});
test('other sites, Studio lists and restricted Chrome pages return visible instructions without injection or an exclamation badge', async () => {
  for (const url of ['https://youtube.com/watch?v=test123', 'https://studio.youtube.com.attacker.test/video/id/monetization', 'https://studio.youtube.com/channel/id/videos', 'chrome://extensions', undefined]) {
    const f = background();
    const result = await f.click({ id: 7, url });
    assert.equal(f.calls.filter(([name]) => name === 'inject').length, 0);
    assert.equal(f.calls.find(([name]) => name === 'badge')[1].text, '');
    assert.equal(result.kind, 'instruction'); assert.ok(result.message);
  }
});
test('injection failure returns an error for the popup and keeps the badge cleared', async () => {
  const f = background(true);
  const result = await f.click({ id: 7, url: 'https://studio.youtube.com/video/test123/monetization' });
  assert.equal(result.kind, 'error'); assert.match(result.message, /Không mở được bảng/);
  assert.equal(f.calls.find(([name]) => name === 'badge')[1].text, '');
});
test('web content, other extension senders and subframes cannot use the popup opening endpoint', async () => {
  for (const sender of [
    { id: 'other', frameId: 0, url: 'chrome-extension://test-extension/popup.html' },
    { id: 'test-extension', frameId: 0, url: 'https://studio.youtube.com/video/test123/monetization' },
    { id: 'test-extension', frameId: 1, url: 'chrome-extension://test-extension/popup.html' }
  ]) {
    const f = background();
    const result = await new Promise((resolve) => f.message({ type: 'MIDROLL_OPEN_PANEL' }, sender, resolve));
    assert.equal(result.ok, false); assert.equal(f.calls.length, 0);
  }
});
test('manifest declares the required background debugger transport and no broad host access', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage', 'debugger']);
  assert.equal(manifest.minimum_chrome_version, '118');
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.action.default_popup, 'popup.html');
  const assets = [manifest.background.service_worker, 'background-session.js', 'background-client.js', 'duration-reader.js', 'playhead-controller.js', 'planner.js', 'wait.js', 'studio.js', 'runner.js', 'content.js', 'error-copy.js', 'popup.html', 'popup.js', 'popup.css'];
  for (const asset of assets) assert.ok(fs.existsSync(path.join(__dirname, '../extension', asset)));
});
test('duration request reads MAIN in the sender tab and returns a minimal result', async () => {
  const f = background();
  const result = await new Promise((resolve) => assert.equal(f.message({ type: 'MIDROLL_READ_DURATION', tabId: 999 }, { id: 'test-extension', frameId: 0, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' } }, resolve), true));
  assert.equal(result.seconds, 507);
  const details = f.calls.find(([name]) => name === 'inject')[1];
  assert.equal(details.target.tabId, 7);
  assert.equal(details.world, 'MAIN');
  assert.equal(typeof details.func, 'function');
  assert.deepEqual(Array.from(details.args), ['test123']);
});
test('duration requests reject wrong host, route or sender without execution', async () => {
  for (const sender of [
    { id: 'other', tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' } },
    { id: 'test-extension', tab: { id: 7, url: 'https://studio.youtube.com.attacker.test/video/test123/monetization' } },
    { id: 'test-extension', tab: { id: 7, url: 'https://studio.youtube.com/channel/test123/videos' } },
    { id: 'test-extension' }
  ]) {
    const f = background();
    const result = await new Promise((resolve) => f.message({ type: 'MIDROLL_READ_DURATION' }, sender, resolve));
    assert.equal(result.seconds, null);
    assert.equal(f.calls.length, 0);
  }
});
test('seek request is restricted to MAIN in the sender video tab with a fixed bundled function', async () => {
  const f = background();
  const token = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  await new Promise((resolve) => f.message({ type: 'MIDROLL_SEEK_PLAYHEAD', tabId: 999, videoId: 'test123', seconds: 60, duration: 507, editorToken: token }, { id: 'test-extension', frameId: 0, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' } }, resolve));
  const details = f.calls.find(([name]) => name === 'inject')[1];
  assert.equal(details.world, 'MAIN'); assert.equal(details.target.tabId, 7);
  assert.equal(details.func.name, 'seekPagePlayhead');
  assert.deepEqual(Array.from(details.args), ['test123', 60, 507, token]);
});
test('seek messages reject subframes, wrong video, malformed times and editor tokens', async () => {
  const base = { type: 'MIDROLL_SEEK_PLAYHEAD', videoId: 'test123', seconds: 60, duration: 507, editorToken: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };
  for (const [changes, frameId] of [[{}, 1], [{ videoId: 'other' }, 0], [{ seconds: 508 }, 0], [{ seconds: '60' }, 0], [{ seconds: -1 }, 0], [{ editorToken: 'invalid' }, 0]]) {
    const f = background();
    const result = await new Promise((resolve) => f.message({ ...base, ...changes }, { id: 'test-extension', frameId, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' } }, resolve));
    assert.equal(result.ok, false); assert.equal(f.calls.length, 0);
  }
});

test('existing panel is reopened without reinjecting or replacing active modules', async () => {
  const f = background(false, true);
  assert.equal((await f.click({ id: 7, url: 'https://studio.youtube.com/video/test123/monetization' })).ok, true);
  assert.equal(f.calls.filter(([name]) => name === 'inject').length, 1);
  assert.equal(f.calls.some(([name, details]) => name === 'inject' && details.files), false);
});
test('duration requests from subframes or invalid tab IDs do not inject MAIN code', async () => {
  for (const changes of [{ frameId: 1 }, { frameId: undefined }, { tab: { id: '7', url: 'https://studio.youtube.com/video/test123/monetization' } }]) {
    const f = background();
    const sender = { id: 'test-extension', frameId: 0, tab: { id: 7, url: 'https://studio.youtube.com/video/test123/monetization' }, ...changes };
    const result = await new Promise((resolve) => f.message({ type: 'MIDROLL_READ_DURATION' }, sender, resolve));
    assert.equal(result.seconds, null); assert.equal(f.calls.length, 0);
  }
});
