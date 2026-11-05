(function (root) {
  "use strict";
  // Pause only at a confirmed boundary. The current insert/delete group
  // finishes normally; cancellation still aborts its signal immediately.
  function create({ getFingerprint, onChange = () => {} }) {
    let state = "running", wake;
    const change = (value) => { state = value; onChange(value); };
    return {
      get state() { return state; },
      pause() {
        if (state !== "running") return;
        change("pausing");
      },
      resume() {
        if (state !== "paused") return;
        change("resuming");
        wake?.();
      },
      async checkpoint({ signal } = {}) {
        signal?.throwIfAborted();
        if (state !== "pausing") return;
        const before = getFingerprint();
        let cleanup = () => {};
        try {
          await new Promise((resolve, reject) => {
            const abort = () => reject(signal.reason);
            wake = resolve;
            signal?.addEventListener("abort", abort, { once: true });
            // Install the waiter before announcing that Resume is available.
            cleanup = () => signal?.removeEventListener("abort", abort);
            change("paused");
            if (signal?.aborted) abort();
          });
          signal?.throwIfAborted();
          if (getFingerprint() !== before) throw Object.assign(new Error("Dữ liệu Studio đã thay đổi trong lúc tạm dừng. Đã dừng lượt chạy; hãy kiểm tra và Xem trước lại."), { code: "paused-state-changed" });
          change("running");
        } finally {
          cleanup();
          wake = undefined;
        }
      }
    };
  }
  root.MidrollRunControl = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MidrollRunControl;
})(globalThis);
