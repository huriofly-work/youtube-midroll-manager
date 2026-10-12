(function (root) {
  "use strict";
  function waitFor(check, { signal, timeout = 6000, backgroundTimeout = 120000, stableFor = 0, onPending = () => {}, timeoutMessage = "Studio chưa xác nhận mốc vừa nhập. Đã dừng và chưa lưu; hãy kiểm tra điểm cuối trước khi Xem trước lại." } = {}) {
    return new Promise((resolve, reject) => {
      let timer, observer, finished = false;
      let foreground = 0, background = 0, stable = 0, previousValue;
      let last = performance.now();
      let interval = 100;
      let frozen = false;
      let wasBackground = document.hidden || !document.hasFocus();
      let reportedBackground = false;
      const listeners = [];
      function listen(target, type, handler) {
        target.addEventListener(type, handler, true);
        listeners.push(() => target.removeEventListener(type, handler, true));
      }
      function finish(error, value) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        observer?.disconnect();
        for (const remove of listeners) remove();
        error ? reject(error) : resolve(value);
      }
      function abort() { finish(signal.reason || new DOMException("Đã dừng", "AbortError")); }
      function pump() {
        if (finished) return;
        clearTimeout(timer);
        const now = performance.now();
        // A delayed callback is not evidence that Studio had time to run.
        // Exclude frozen time and excess timer scheduling delay from budgets.
        const elapsed = frozen ? 0 : Math.min(Math.max(0, now - last), interval + 250);
        last = now;
        if (wasBackground) background += elapsed; else foreground += elapsed;
        const inBackground = document.hidden || !document.hasFocus();
        wasBackground = inBackground;
        try {
          signal?.throwIfAborted();
          // Always inspect the result before declaring a timeout, including
          // the first callback after Chrome resumes a suspended page.
          const value = check();
          if (value) {
            if (value === previousValue) stable += elapsed;
            else { previousValue = value; stable = 0; }
            if (stable >= stableFor) { finish(null, value); return; }
          } else { previousValue = undefined; stable = 0; }
          if (foreground >= timeout || background >= backgroundTimeout) {
            throw Object.assign(new Error(typeof timeoutMessage === "function" ? timeoutMessage() : timeoutMessage), { code: "confirmation-timeout" });
          }
          if (inBackground && !reportedBackground) {
            reportedBackground = true;
            onPending(document.hidden
              ? "Tab Studio đang ẩn. Chờ Studio cập nhật; sẽ tiếp tục từ mốc đang xử lý khi tab hoạt động lại."
              : "Đang chờ Studio xác nhận mốc. Bạn có thể dùng ứng dụng khác; chưa chuyển sang mốc kế tiếp.");
          } else if (!inBackground && reportedBackground) {
            reportedBackground = false;
            onPending("Studio đã hoạt động lại. Đang xác nhận mốc đang xử lý trước khi tiếp tục.");
          }
          interval = inBackground ? 1000 : 100;
          timer = setTimeout(pump, interval);
        } catch (error) { finish(error); }
      }
      if (signal?.aborted) { abort(); return; }
      if (signal) listen(signal, "abort", abort);
      listen(document, "visibilitychange", pump);
      listen(document, "input", pump);
      listen(document, "change", pump);
      listen(document, "freeze", () => { frozen = true; stable = 0; previousValue = undefined; });
      listen(document, "resume", () => { frozen = false; last = performance.now(); stable = 0; previousValue = undefined; pump(); });
      listen(window, "focus", (event) => { if (event.target === window) pump(); });
      listen(window, "blur", (event) => { if (event.target === window) pump(); });
      observer = new MutationObserver((records) => {
        const changed = records.some((record) => {
          for (let node = record.target; node; node = node.parentNode || node.host) {
            if (node.id === "midroll-helper-host") return false;
          }
          return true;
        });
        if (changed) pump();
      });
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      pump();
    });
  }
  // Race IPC against cancellation/deadline without leaving listeners or
  // timers behind. Late replies never resume an aborted operation.
  function request(send, { signal, timeout = 10000, timeoutValue, timeoutMessage = "Không nhận được phản hồi từ Studio." } = {}) {
    return new Promise((resolve, reject) => {
      let timer, finished = false;
      const abort = () => finish(signal.reason || new DOMException("Đã dừng", "AbortError"));
      function finish(error, value) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        error ? reject(error) : resolve(value);
      }
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => timeoutValue === undefined ? finish(new Error(timeoutMessage)) : finish(null, timeoutValue), timeout);
      if (send) {
        try { Promise.resolve(send()).then((value) => finish(null, value), (error) => finish(error)); }
        catch (error) { finish(error); }
      }
    });
  }
  const delay = (timeout, { signal } = {}) => request(null, { signal, timeout, timeoutValue: true });
  root.MidrollWait = { waitFor, request, delay };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MidrollWait;
})(globalThis);
