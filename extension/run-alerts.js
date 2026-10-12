(function (root) {
  "use strict";
  const runIdValid = (id) => /^[A-Za-z0-9-]{16,80}$/.test(id || "");
  const video = (url) => {
    try { const parsed = new URL(url); return parsed.origin === "https://studio.youtube.com" ? parsed.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1] : null; } catch { return null; }
  };
  const issue = (error, run) => ({
    runId: run.runId, mode: run.mode, code: error.code || "run-failed",
    message: String(error.message || "Lượt chạy gặp lỗi.").slice(0, 2000),
    confirmed: run.confirmed, total: run.total, phase: run.phase,
    points: run.points || [], pending: Number.isInteger(error.pendingRemoved) ? error.pendingRemoved : null
  });
  function createRunAlerts(api) {
    const key = "midrollRunAlerts";
    let memory = {}, queue = Promise.resolve();
    const serial = (task) => {
      const result = queue.then(task); queue = result.catch(() => {}); return result;
    };
    async function read() { return api.storage?.session ? (await api.storage.session.get(key))[key] || {} : memory; }
    async function write(records) { if (api.storage?.session) await api.storage.session.set({ [key]: records }); else memory = records; }
    function identity(sender) {
      const videoId = video(sender.tab?.url);
      if (sender.id !== api.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || !videoId) throw Error("invalid-alert-context");
      return { tabId: sender.tab.id, videoId };
    }
    async function clear(record) {
      await api.notifications?.clear?.(record.notificationId).catch(() => {});
      await api.action.setBadgeText({ tabId: record.tabId, text: "" }).catch(() => {});
      await api.action.setTitle({ tabId: record.tabId, title: "Chèn điểm quảng cáo YouTube" }).catch(() => {});
    }
    async function target(record) {
      const tab = await api.tabs.get(record.tabId);
      if (video(tab.url) !== record.videoId) throw Error("alert-video-changed");
      return tab;
    }
    async function focus(record, foreground) {
      const tab = await target(record);
      if (!foreground) { await api.windows.update(tab.windowId, { drawAttention: true }); return; }
      const window = await api.windows.get(tab.windowId);
      if (window.state === "minimized") await api.windows.update(tab.windowId, { state: "normal" });
      // Revalidate after restoring a window; do not select a navigated tab.
      await target(record);
      await api.tabs.update(tab.id, { active: true });
      await api.windows.update(tab.windowId, { focused: true });
    }
    async function display(record, first) {
      await api.action.setBadgeBackgroundColor({ tabId: record.tabId, color: "#b32d32" }).catch(() => {});
      await api.action.setBadgeText({ tabId: record.tabId, text: "!" }).catch(() => {});
      await api.action.setTitle({ tabId: record.tabId, title: "Lượt chạy đã dừng — cần kiểm tra trong Studio" }).catch(() => {});
      let notified = false, focused = false;
      try {
        if (await api.notifications.getPermissionLevel() === "granted") {
          const data = {
            type: "basic", iconUrl: api.runtime.getURL("alert-icon.png"),
            title: record.mode === "cleanup" ? "Đã dừng dọn điểm — cần kiểm tra" : "Đã dừng chèn điểm — cần kiểm tra",
            message: `${record.confirmed}/${record.total} điểm đã xác nhận. Chưa lưu. ${record.issue.message}`.slice(0, 280),
            buttons: [{ title: "Mở Studio để kiểm tra" }, { title: "Để sau" }], requireInteraction: true, priority: 2, silent: !first
          };
          if (!first) notified = await api.notifications.update(record.notificationId, data);
          // A dismissed notification must not be recreated by a late report.
          else { await api.notifications.create(record.notificationId, data); notified = true; }
        }
      } catch {}
      if (first) {
        try {
          const saved = await api.storage.local.get({ focusOnRunError: true });
          const foreground = saved.focusOnRunError !== false;
          await focus(record, foreground); focused = foreground;
        } catch {
          try { await focus(record, false); } catch {}
        }
      }
      return { ok: true, notified, focused };
    }
    async function report(records, record, detail) {
      const first = !record.alerted;
      record.issue = detail; record.alerted = true;
      await write(records);
      if (record.acknowledged) return { ok: true, notified: false, acknowledged: true };
      return display(record, first);
    }
    async function handle(message, sender) {
      return serial(async () => {
        try {
          const { tabId, videoId } = identity(sender);
          if (!runIdValid(message.runId)) throw Error("invalid-alert-run");
          const records = await read();
          let record = records[tabId];
          if (message.type === "MIDROLL_RUN_BEGIN") {
            if (message.videoId !== videoId || !["insert", "cleanup"].includes(message.mode) || !Number.isInteger(message.total) || message.total < 0 || message.total > 10000) throw Error("invalid-alert-plan");
            if (record?.runId === message.runId) return { ok: true };
            if (record) await clear(record);
            record = { tabId, videoId, runId: message.runId, mode: message.mode, total: message.total, confirmed: 0, phase: "starting", points: [], notificationId: `midroll-${tabId}-${message.runId}` };
            records[tabId] = record; await write(records); return { ok: true };
          }
          if (!record || record.runId !== message.runId || record.videoId !== videoId) throw Error("stale-alert-run");
          if (message.type === "MIDROLL_RUN_PROGRESS") {
            if (record.alerted || !Number.isInteger(message.confirmed) || message.confirmed < record.confirmed || message.confirmed > record.total || !["starting", "checking", "processing", "verifying"].includes(message.phase) || !Array.isArray(message.points) || message.points.length > 5 || message.points.some((n) => !Number.isFinite(n) || n < 0 || n > 604800)) throw Error("invalid-alert-progress");
            Object.assign(record, { confirmed: message.confirmed, phase: message.phase, points: message.points });
            await write(records); return { ok: true };
          }
          if (message.type === "MIDROLL_RUN_ERROR") {
            if (typeof message.issue?.message !== "string" || !Number.isInteger(message.issue.confirmed) || message.issue.confirmed < record.confirmed || message.issue.confirmed > record.total || !["starting", "checking", "processing", "verifying"].includes(message.issue.phase) || !Array.isArray(message.issue.points) || message.issue.points.length > 5 || message.issue.points.some((n) => !Number.isFinite(n) || n < 0 || n > 604800) || (message.issue.pending !== null && (!Number.isInteger(message.issue.pending) || message.issue.pending < 0 || message.issue.pending > 5))) throw Error("invalid-alert-issue");
            record.confirmed = message.issue.confirmed;
            record.phase = message.issue.phase; record.points = message.issue.points;
            const detail = issue({ message: message.issue.message, code: /^[a-z-]{1,60}$/.test(message.issue.code || "") ? message.issue.code : "run-failed", pendingRemoved: message.issue.pending }, record);
            return report(records, record, detail);
          }
          if (message.type === "MIDROLL_RUN_ACK") {
            record.acknowledged = true; await write(records); await clear(record); return { ok: true };
          }
          if (message.type === "MIDROLL_RUN_END") {
            if (record.alerted && !record.acknowledged) return { ok: true };
            delete records[tabId]; await write(records); await clear(record); return { ok: true };
          }
          throw Error("invalid-alert-command");
        } catch { return { ok: false }; }
      });
    }
    const lost = (record, message) => serial(async () => {
      const records = await read(), current = records[record.tabId];
      if (!current || current.runId !== record.runId) return;
      await report(records, current, issue({ code: "background-lost", message }, current));
    }).catch(() => {});
    async function open(notificationId) {
      return serial(async () => {
        const records = await read(), record = Object.values(records).find((r) => r.notificationId === notificationId);
        if (!record?.issue || record.acknowledged) return;
        try {
          await target(record);
          await focus(record, true);
          const message = { type: "MIDROLL_SHOW_RUN_ERROR", videoId: record.videoId, issue: record.issue };
          let response;
          try { response = await api.tabs.sendMessage(record.tabId, message); }
          catch {
            await target(record);
            await api.scripting.executeScript({ target: { tabId: record.tabId }, files: ["planner.js", "cleanup.js", "wait.js", "studio.js", "runner.js", "background-client.js", "error-copy.js", "run-alerts.js", "content.js"] });
            await target(record);
            response = await api.tabs.sendMessage(record.tabId, message);
          }
          // Opening is not a handling decision: Later must keep the badge.
          if (response?.ok) await api.notifications.clear(record.notificationId).catch(() => {});
        } catch { /* A closed/navigated tab must never be reopened or redirected. */ }
      });
    }
    api.notifications?.onClicked?.addListener((id) => { void open(id).catch(() => {}); });
    api.notifications?.onButtonClicked?.addListener((id, index) => {
      if (index === 0) void open(id).catch(() => {});
      else if (index === 1) void api.notifications.clear(id).catch(() => {});
    });
    api.tabs.onRemoved.addListener((tabId) => { void serial(async () => {
      const records = await read(); if (!records[tabId]) return;
      await clear(records[tabId]); delete records[tabId]; await write(records);
    }).catch(() => {}); });
    api.tabs.onUpdated.addListener((tabId, change) => {
      if (!change.url) return;
      void serial(async () => {
        const records = await read(), record = records[tabId];
        if (record && video(change.url) !== record.videoId) { await clear(record); delete records[tabId]; await write(records); }
      }).catch(() => {});
    });
    return { handle, lost, open };
  }
  root.MidrollRunAlerts = { issue, createRunAlerts };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MidrollRunAlerts;
})(globalThis);
