importScripts("duration-reader.js");
importScripts("playhead-controller.js");
importScripts("background-session.js");
importScripts("run-alerts.js");
const runAlerts = globalThis.MidrollRunAlerts.createRunAlerts(chrome);
const backgroundSessions = globalThis.MidrollCreateBackgroundSessions(chrome, { onLost: runAlerts.lost });

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (["MIDROLL_RUN_BEGIN", "MIDROLL_RUN_PROGRESS", "MIDROLL_RUN_ERROR", "MIDROLL_RUN_ACK", "MIDROLL_RUN_END", "MIDROLL_RUN_POSTPONE"].includes(message?.type)) {
    void runAlerts.handle(message, sender).then(reply, () => reply({ ok: false }));
    return true;
  }
  if (message?.type === "MIDROLL_OPEN_PANEL") {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup.html") || (sender.frameId !== undefined && sender.frameId !== 0)) {
      reply({ ok: false, kind: "error", message: "Không mở được bảng từ ngữ cảnh này." });
      return false;
    }
    void openPanel().then(reply);
    return true;
  }
  if (["MIDROLL_BACKGROUND_START", "MIDROLL_BACKGROUND_PING", "MIDROLL_BACKGROUND_STOP"].includes(message?.type)) {
    void backgroundSessions.handle(message, sender).then(reply);
    return true;
  }
  const seeking = message?.type === "MIDROLL_SEEK_PLAYHEAD";
  if (!seeking && message?.type !== "MIDROLL_READ_DURATION") return false;
  (async () => {
    try {
      const url = new URL(sender.tab?.url || "");
      const videoId = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1];
      if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || url.origin !== "https://studio.youtube.com" || !videoId) throw new Error("invalid-context");
      if (seeking && (sender.frameId !== 0 || !Number.isInteger(sender.tab.id) || message.videoId !== videoId || !Number.isFinite(message.seconds) || message.seconds < 0 || !Number.isFinite(message.duration) || message.seconds > message.duration || message.duration > 604800 || !/^[A-Za-z0-9-]{16,80}$/.test(message.editorToken || ""))) throw new Error("invalid-seek-context");
      const result = await chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        world: "MAIN",
        func: seeking ? globalThis.MidrollSeekPagePlayhead : globalThis.MidrollReadPageDuration,
        args: seeking ? [videoId, message.seconds, message.duration, message.editorToken] : [videoId]
      });
      reply(result[0]?.result || { seconds: null, reason: "metadata-pending" });
    } catch (error) {
      reply(seeking ? { ok: false, reason: "seek-unavailable" } : { seconds: null, reason: "reader-unavailable" });
    }
  })();
  return true;
});

async function openPanel() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id)) throw new Error("no-tab");
    const url = new URL(tab.url || "");
    if (url.origin !== "https://studio.youtube.com") {
      return { ok: false, kind: "instruction", message: "Extension chèn điểm trên YouTube Studio. Hãy mở một video rồi vào Quản lý vị trí quảng cáo." };
    }
    if (!/^\/video\/[A-Za-z0-9_-]+\//.test(url.pathname)) {
      return { ok: false, kind: "instruction", message: "Bạn đang ở YouTube Studio. Hãy chọn một video rồi vào Kiếm tiền → Quản lý vị trí quảng cáo." };
    }
    const opened = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Boolean(globalThis.MidrollShowPanel?.())
    });
    if (opened[0]?.result !== true) await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["planner.js", "cleanup.js", "wait.js", "studio.js", "runner.js", "background-client.js", "error-copy.js", "run-alerts.js", "content.js"]
    });
    await runAlerts.restore(tab.id, url.pathname.split("/")[2]);
    return { ok: true };
  } catch (error) {
    if (tab?.url === undefined) return { ok: false, kind: "instruction", message: "Hãy mở một video trong YouTube Studio rồi vào Quản lý vị trí quảng cáo." };
    return { ok: false, kind: "error", message: "Không mở được bảng trên tab này. Hãy tải lại extension và làm mới trang Studio, rồi thử lại." };
  }
}
