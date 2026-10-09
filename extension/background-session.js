(function (root) {
  "use strict";
  function createBackgroundSessions(chrome, { now = () => Date.now(), setInterval: every = setInterval, clearInterval: cancelEvery = clearInterval } = {}) {
    const sessions = new Map();
    let watchdog;
    function identity(sender) {
      const url = new URL(sender.tab?.url || "");
      const videoId = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1];
      if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || url.origin !== "https://studio.youtube.com" || !videoId) throw new Error("Không phải tab video Studio được phép xử lý.");
      return { tabId: sender.tab.id, videoId };
    }
    function notify(record, message) {
      void chrome.tabs.sendMessage(record.tabId, { type: "MIDROLL_BACKGROUND_LOST", runId: record.runId, message }).catch(() => {});
    }
    function remove(record) {
      if (sessions.get(record.tabId) === record) sessions.delete(record.tabId);
      if (!sessions.size && watchdog) { cancelEvery(watchdog); watchdog = undefined; }
    }
    async function cleanup(record) {
      if (record.cleanup) return record.cleanup;
      record.closing = true;
      record.cleanup = (async () => {
        try {
          if (record.attached) {
            try { await chrome.debugger.sendCommand({ tabId: record.tabId }, "Emulation.setFocusEmulationEnabled", { enabled: false }); } catch {}
            if (record.attached) await chrome.debugger.detach({ tabId: record.tabId });
          }
          record.attached = false;
          remove(record);
        } catch (error) {
          if (!record.attached) { remove(record); return; }
          // Keep ownership so the watchdog can retry a failed detach. Never
          // forget an attached target while leaving emulation enabled.
          record.lastSeen = now();
          record.cleanup = undefined;
          throw error;
        }
      })();
      return record.cleanup;
    }
    async function stop(record, message) {
      record.cancelled = true;
      if (message) notify(record, message);
      await record.operation;
      await cleanup(record);
    }
    function watch() {
      if (watchdog) return;
      watchdog = every(() => {
        for (const record of sessions.values()) {
          if (record.closing && record.attached && now() - record.lastSeen >= 10000) void cleanup(record).catch(() => {});
          else if (!record.cancelled && now() - record.lastSeen > 45000) void stop(record, "Mất kết nối với bảng chèn quảng cáo. Đã dừng chế độ chạy nền; kiểm tra điểm cuối trước khi chạy lại.").catch(() => {});
        }
      }, 10000);
    }
    async function start(tabId, videoId, runId) {
      if (sessions.has(tabId)) throw new Error("Tab này đang có một lượt chèn. Hãy dừng lượt đó trước khi chạy lại.");
      const record = { tabId, videoId, runId, lastSeen: now(), attached: false, cancelled: false, closing: false };
      sessions.set(tabId, record);
      watch();
      record.operation = (async () => {
        try {
          await chrome.debugger.attach({ tabId }, "1.3");
          record.attached = true;
          if (record.cancelled || sessions.get(tabId) !== record) throw new Error("Đã dừng khi đang bật chế độ chạy nền.");
          // These commands affect only this page's renderer, never OS focus,
          // mouse/keyboard input, window bounds or the selected Chrome tab.
          await chrome.debugger.sendCommand({ tabId }, "Emulation.setFocusEmulationEnabled", { enabled: true });
          await chrome.debugger.sendCommand({ tabId }, "Page.setWebLifecycleState", { state: "active" });
          if (record.cancelled || !record.attached || sessions.get(tabId) !== record) throw new Error("Phiên chạy nền đã bị ngắt.");
          record.lastSeen = now();
          return { ok: true, runId };
        } catch (error) {
          try { await cleanup(record); } catch {}
          return { ok: false, error: `Không bật được chế độ chạy nền: ${error.message}. Đóng DevTools của tab Studio hoặc kiểm tra quyền debugger rồi thử lại.` };
        }
      })();
      return record.operation;
    }
    async function handle(message, sender) {
      try {
        const { tabId, videoId } = identity(sender);
        if (!/^[A-Za-z0-9-]{16,80}$/.test(message.runId || "")) throw new Error("Mã lượt chạy không hợp lệ.");
        if (message.type === "MIDROLL_BACKGROUND_START") {
          if (message.videoId !== videoId) throw new Error("Video đã thay đổi; hãy Xem trước lại.");
          return await start(tabId, videoId, message.runId);
        }
        const record = sessions.get(tabId);
        if (!record || record.runId !== message.runId || record.videoId !== videoId) {
          return message.type === "MIDROLL_BACKGROUND_STOP" ? { ok: true } : { ok: false, error: "Phiên chạy nền không còn hoạt động." };
        }
        if (message.type === "MIDROLL_BACKGROUND_PING") {
          if (record.cancelled || !record.attached) return { ok: false, error: "Phiên chạy nền đã bị ngắt." };
          record.lastSeen = now();
          return { ok: true };
        }
        if (message.type === "MIDROLL_BACKGROUND_STOP") { await stop(record); return { ok: true }; }
        throw new Error("Lệnh chạy nền không hợp lệ.");
      } catch (error) { return { ok: false, error: error.message }; }
    }
    chrome.debugger.onDetach.addListener((source) => {
      const record = sessions.get(source.tabId);
      if (!record) return;
      record.attached = false;
      record.cancelled = true;
      remove(record);
      if (!record.closing) notify(record, "Chrome đã ngắt phiên chạy nền. Đã dừng chèn; kiểm tra điểm cuối rồi Xem trước lại.");
    });
    chrome.tabs.onUpdated.addListener((tabId, change) => {
      const record = sessions.get(tabId);
      if (!record) return;
      if (change.status === "loading" || change.url) void stop(record, "Tab Studio đã tải lại hoặc chuyển trang. Đã dừng chèn.").catch(() => {});
    });
    chrome.tabs.onRemoved.addListener((tabId) => {
      const record = sessions.get(tabId);
      if (record) { record.attached = false; record.cancelled = true; remove(record); }
    });
    return { handle };
  }
  root.MidrollCreateBackgroundSessions = createBackgroundSessions;
  if (typeof module !== "undefined" && module.exports) module.exports = { createBackgroundSessions };
})(globalThis);
