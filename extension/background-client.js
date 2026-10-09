(function (root) {
  "use strict";
  const request = (message, timeout = 10000, signal) => root.MidrollWait.request(() => chrome.runtime.sendMessage(message), {
    signal, timeout, timeoutMessage: "Không nhận được phản hồi chế độ chạy nền."
  });
  async function run(task, { signal } = {}) {
    const runId = crypto.randomUUID();
    const controller = new AbortController();
    const videoId = location.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1];
    let heartbeat, failure;
    const abort = () => controller.abort(signal.reason);
    const lost = (message) => {
      if (message?.type === "MIDROLL_BACKGROUND_LOST" && message.runId === runId) controller.abort(new Error(message.message));
      return false;
    };
    const leave = () => controller.abort(new Error("Tab Studio đã đóng hoặc chuyển trang. Đã dừng chèn."));
    const stop = () => { void request({ type: "MIDROLL_BACKGROUND_STOP", runId }, 5000).catch(() => {}); };
    chrome.runtime.onMessage.addListener(lost);
    signal?.addEventListener("abort", abort, { once: true });
    controller.signal.addEventListener("abort", stop, { once: true });
    window.addEventListener("pagehide", leave, { once: true });
    try {
      signal?.throwIfAborted();
      const response = await request({ type: "MIDROLL_BACKGROUND_START", runId, videoId }, 10000, controller.signal);
      controller.signal.throwIfAborted();
      if (!response?.ok || response.runId !== runId) throw new Error(response?.error || "Không bật được chế độ chạy nền; chưa chèn điểm nào.");
      if (document.hidden) throw new Error("Chrome chưa giữ được tab Studio hoạt động. Đã dừng; kiểm tra quyền chạy nền rồi thử lại.");
      heartbeat = setInterval(() => {
        void request({ type: "MIDROLL_BACKGROUND_PING", runId }).then((result) => {
          if (!result?.ok) controller.abort(new Error(result?.error || "Mất phiên chạy nền. Đã dừng chèn."));
        }).catch((error) => controller.abort(error));
      }, 10000);
      return await task({ signal: controller.signal });
    } catch (error) { failure = error; throw error; }
    finally {
      clearInterval(heartbeat);
      chrome.runtime.onMessage.removeListener(lost);
      signal?.removeEventListener("abort", abort);
      controller.signal.removeEventListener("abort", stop);
      window.removeEventListener("pagehide", leave);
      try {
        const result = await request({ type: "MIDROLL_BACKGROUND_STOP", runId }, 5000);
        if (!result?.ok) throw new Error(result?.error || "Không ngắt được phiên chạy nền.");
      } catch (error) {
        if (!failure) throw new Error(`Các mốc đã xử lý nhưng chưa kết thúc được phiên chạy nền: ${error.message}. Bấm Hủy trên thanh thông báo Chrome; chưa lưu thay đổi.`);
      }
    }
  }
  root.MidrollBackgroundClient = { run };
})(globalThis);
