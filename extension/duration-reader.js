(function (root) {
  "use strict";
  // This entire function is serialized by chrome.scripting into MAIN.
  // Keep helpers inside it: the isolated content script cannot see the
  // player/component objects held by YouTube Studio's JavaScript.
  function readPageDuration(expectedVideoId) {
    const match = location.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//);
    const currentVideoId = match?.[1];
    if (!currentVideoId || currentVideoId !== expectedVideoId) return { seconds: null, reason: "video-changed" };
    const candidates = [];
    const seen = new WeakSet();
    const children = ['video', 'video_', 'videoData', 'videoData_', 'videoDetails', 'playerResponse', 'playerResponse_', 'data', 'data_', 'metadata', 'contentDetails', 'currentVideo', 'currentVideo_', 'player', 'player_', 'playerApi', 'playerApi_'];
    let visited = 0, wrongIdentity = false, conflictingIdentity = false;
    function get(value, key) {
      try { return value?.[key]; } catch { return undefined; }
    }
    function idOf(value) {
      for (const key of ['videoId', 'video_id', 'externalVideoId', 'externalId', 'id']) {
        if (key === 'id' && get(value, 'nodeType') === 1) continue; // DOM IDs identify controls, not videos.
        const id = get(value, key);
        if (typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id)) return id;
        if (id && typeof id === 'object' && typeof get(id, 'externalId') === 'string') return get(id, 'externalId');
      }
      return undefined;
    }
    function add(value, source, scale = 1) {
      if (typeof value !== 'number' && typeof value !== 'string') return;
      if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) return;
      const seconds = Number(value) / scale;
      if (Number.isFinite(seconds) && seconds > 0 && seconds <= 7 * 24 * 3600) candidates.push({ seconds, source });
    }
    function iso(value) {
      if (typeof value !== 'string') return null;
      const m = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
      return m && m.slice(1).some(Boolean) ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : null;
    }
    function call(value, name) {
      try { const fn = get(value, name); return typeof fn === 'function' ? fn.call(value) : undefined; } catch { return undefined; }
    }
    function walk(value, inheritedId, depth, source) {
      if (!value || typeof value !== 'object' || seen.has(value) || depth > 5 || ++visited > 250) return;
      seen.add(value);
      const ownId = idOf(value);
      const videoId = ownId || inheritedId;
      const playerData = call(value, 'getVideoData');
      const playerId = idOf(playerData);
      let urlId;
      const playerUrl = call(value, 'getVideoUrl');
      if (typeof playerUrl === 'string') {
        try { const url = new URL(playerUrl); if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) urlId = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v'); } catch {}
      }
      const identities = [playerId, urlId, ownId || inheritedId].filter(Boolean);
      if (identities.some((id) => id !== expectedVideoId)) wrongIdentity = true;
      if (identities.includes(expectedVideoId) && identities.some((id) => id !== expectedVideoId)) conflictingIdentity = true;
      if (identities.length && identities.every((id) => id === expectedVideoId)) {
        add(call(value, 'getDuration'), 'player.getDuration');
      }
      const response = call(value, 'getPlayerResponse');
      if (response && typeof response === 'object') walk(response, undefined, depth + 1, 'player.response');
      if (videoId === expectedVideoId) {
        for (const key of ['lengthSeconds', 'length_seconds', 'durationSeconds']) add(get(value, key), `${source}.${key}`);
        for (const key of ['durationMs', 'durationMillis', 'lengthMs']) add(get(value, key), `${source}.${key}`, 1000);
        const duration = get(value, 'duration');
        const encoded = iso(duration);
        if (encoded !== null) add(encoded, `${source}.durationISO`);
        // A typed seconds/nanos object has explicit units. A bare numeric
        // "duration" is deliberately ignored because its unit is unknown.
        if (duration && typeof duration === 'object') {
          const seconds = get(duration, 'seconds');
          const nanos = Number(get(duration, 'nanos') || 0);
          if ((typeof seconds === 'number' || (typeof seconds === 'string' && /^\d+(?:\.\d+)?$/.test(seconds))) && Number.isFinite(nanos) && nanos >= 0 && nanos < 1e9) add(Number(seconds) + nanos / 1e9, `${source}.durationSecondsObject`);
        }
      }
      for (const key of children) walk(get(value, key), videoId, depth + 1, `${source}.${key}`);
    }
    function query(scope, selector) {
      const out = [...scope.querySelectorAll(selector)];
      for (const node of scope.querySelectorAll('*')) {
        if (node.id === 'midroll-helper-host') continue;
        if (node.shadowRoot) out.push(...query(node.shadowRoot, selector));
      }
      return out;
    }
    // Read only whitelisted player/video components, never all window
    // properties, cookies, tokens, request payloads or arbitrary app state.
    for (const node of query(document, '#movie_player, .html5-video-player, ytcp-video-player, ytcp-video-info, ytcp-video-editor, ytcp-video-monetization, ytcp-video-monetization-editor')) {
      const nodeId = node.getAttribute('video-id') || node.getAttribute('data-video-id') || undefined;
      walk(node, nodeId, 0, node.localName);
    }
    walk(get(globalThis, 'ytInitialPlayerResponse'), undefined, 0, 'player.response');
    if (location.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1] !== currentVideoId) return { seconds: null, reason: 'video-changed' };
    if (conflictingIdentity) return { videoId: currentVideoId, seconds: null, reason: 'duration-conflict' };
    if (!candidates.length) return { videoId: currentVideoId, seconds: null, reason: wrongIdentity ? 'video-mismatch' : 'metadata-pending' };
    const seconds = candidates.map((candidate) => candidate.seconds);
    if (Math.max(...seconds) - Math.min(...seconds) > 1) return { videoId: currentVideoId, seconds: null, reason: 'duration-conflict' };
    const selected = candidates.find((candidate) => candidate.source === 'player.getDuration') || candidates[0];
    return { videoId: currentVideoId, seconds: selected.seconds, source: selected.source };
  }
  root.MidrollReadPageDuration = readPageDuration;
  if (typeof module !== 'undefined' && module.exports) module.exports = { readPageDuration };
})(globalThis);
