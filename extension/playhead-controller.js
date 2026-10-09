(function (root) {
  "use strict";
  // Serialized into MAIN. Only move the preview of the current Studio video.
  async function seekPagePlayhead(expectedVideoId, seconds, expectedDuration, editorToken) {
    const route = location.pathname;
    if (route.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1] !== expectedVideoId) return { ok: false, reason: "video-changed" };
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(expectedDuration) || seconds > expectedDuration || expectedDuration > 604800) return { ok: false, reason: "invalid-time" };
    if (!/^[A-Za-z0-9-]{16,80}$/.test(editorToken || "")) return { ok: false, reason: "invalid-editor" };
    function query(scope, selector) {
      const nodes = [...scope.querySelectorAll(selector)];
      for (const node of scope.querySelectorAll("*")) {
        if (node.id !== "midroll-helper-host" && node.shadowRoot) nodes.push(...query(node.shadowRoot, selector));
      }
      return nodes;
    }
    const editors = query(document, `[data-midroll-editor-token="${editorToken}"]`);
    if (editors.length !== 1 || !editors[0].isConnected) return { ok: false, reason: "editor-changed" };
    const editor = editors[0];
    const contextValid = () => location.pathname === route && editor.isConnected && editor.getAttribute("data-midroll-editor-token") === editorToken;
    function get(value, key) { try { return value?.[key]; } catch { return undefined; } }
    function call(value, key) { try { const fn = get(value, key); return typeof fn === "function" ? fn.call(value) : undefined; } catch { return undefined; } }
    function videoId(value) { return get(value, "videoId") || get(value, "video_id") || get(value, "externalVideoId"); }
    const candidates = [];
    const seen = new WeakSet();
    let wrongVideo = false;
    let visited = 0;
    function walk(value, inheritedId, depth) {
      if (!value || typeof value !== "object" || seen.has(value) || depth > 4 || ++visited > 100) return;
      seen.add(value);
      const id = videoId(call(value, "getVideoData")) || videoId(get(call(value, "getPlayerResponse"), "videoDetails")) || videoId(value) || inheritedId;
      if (id && id !== expectedVideoId) { wrongVideo = true; return; }
      if (id === expectedVideoId && typeof get(value, "seekTo") === "function" && typeof get(value, "getCurrentTime") === "function" && typeof get(value, "pauseVideo") === "function") {
        const duration = call(value, "getDuration");
        if (Number.isFinite(duration) && Math.abs(duration - expectedDuration) <= 1) candidates.push(value);
        return;
      }
      for (const key of ["player", "player_", "playerApi", "playerApi_"]) walk(get(value, key), id, depth + 1);
    }
    const selector = "#movie_player, .html5-video-player, ytcp-video-player";
    const local = query(editor, selector);
    // Prefer the preview inside the ad editor. Outside fallback must be visible.
    const nodes = local.length ? local : query(document, selector).filter((node) => node.getClientRects().length > 0);
    for (const node of nodes) walk(node, node.getAttribute("video-id") || node.getAttribute("data-video-id"), 0);
    let read;
    try {
      if (candidates.length > 1) return { ok: false, reason: "multiple-players" };
      if (candidates.length === 1) {
        const player = candidates[0];
        player.pauseVideo();
        if (!contextValid()) return { ok: false, reason: "editor-changed" };
        player.seekTo(seconds, true);
        read = () => call(player, "getCurrentTime");
      } else {
        if (wrongVideo) return { ok: false, reason: "wrong-video" };
        // Native media in this exact ad editor; never page-wide video elements.
        const videos = query(editor, "video").filter((video) => Number.isFinite(video.duration) && Math.abs(video.duration - expectedDuration) <= 1);
        if (videos.length !== 1) return { ok: false, reason: "seek-unavailable" };
        const video = videos[0];
        const explicitId = video.getAttribute("video-id") || video.getAttribute("data-video-id");
        if (explicitId && explicitId !== expectedVideoId) return { ok: false, reason: "wrong-video" };
        video.pause();
        video.currentTime = seconds;
        read = () => video.seeking ? null : video.currentTime;
      }
      const started = Date.now();
      let stableSince = null;
      while (Date.now() - started < 2000) {
        if (!contextValid()) return { ok: false, reason: "editor-changed" };
        const actual = read();
        if (Number.isFinite(actual) && Math.abs(actual - seconds) <= 1) {
          stableSince ??= Date.now();
          if (Date.now() - stableSince >= 150) return { ok: true, seconds: actual };
        } else stableSince = null;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return { ok: false, reason: "seek-unconfirmed" };
    } catch { return { ok: false, reason: "seek-failed" }; }
  }
  root.MidrollSeekPagePlayhead = seekPagePlayhead;
  if (typeof module !== "undefined" && module.exports) module.exports = { seekPagePlayhead };
})(globalThis);
