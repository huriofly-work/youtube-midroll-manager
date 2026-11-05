(function () {
  "use strict";
  const HOST_ID = "midroll-helper-host";
  const old = globalThis.MidrollPanelHost || document.getElementById(HOST_ID);
  if (old) {
    if (globalThis.MidrollShowPanel) globalThis.MidrollShowPanel();
    else { globalThis.MidrollStudio.mountPanel(old); old.hidden = false; globalThis.MidrollRefreshDuration?.(); globalThis.MidrollFocusPanel?.(); }
    return;
  }
  const P = globalThis.MidrollPlanner;
  const VERSION = "0.1.21";
  const host = document.createElement("div");
  globalThis.MidrollPanelHost = host;
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;right:12px;top:12px;width:380px;max-width:calc(100vw - 24px);z-index:2147483647;color-scheme:light;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: Arial, sans-serif; }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .panel { color: #233149; background: #fff; border: 1px solid #d4dfec; border-radius: 16px; box-shadow: 0 12px 48px #12203938; max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); display: flex; flex-direction: column; overflow: hidden; font-size: 14px; line-height: 1.5; }
      header { padding: 16px; display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
      h2 { margin: 0; font-size: 18px; line-height: 1.4; }
      .subtitle { color: #596a80; font-size: 12px; margin: 3px 0 0; }
      .version { font-size: 10px; color: #596a80; background: #f1f5f9; border-radius: 5px; padding: 3px 5px; margin-left: auto; }
      #close { padding: 0; width: 32px; height: 32px; border: 0; background: none; font-size: 22px; color: #596a80; }
      .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 0 16px 12px; padding: 4px; background: #edf1f6; border-radius: 11px; flex-shrink: 0; }
      .tabs button { border: 0; background: transparent; min-height: 36px; padding: 6px; color: #596a80; }
      .tabs button[aria-selected="true"] { background: #fff; color: #1967d2; box-shadow: 0 1px 4px #23314918; }
      main { padding: 0 16px 16px; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
      .data { background: #f3f7fc; border: 1px solid #e1e9f4; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
      .data-head { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
      .data label { font-size: 11px; color: #596a80; margin: 0; }
      #load { font-size: 11px; min-height: 32px; padding: 5px 7px; background: #fff; }
      #duration { display: block; font: 600 22px/1.4 monospace; margin: 3px 0; overflow-wrap: anywhere; }
      #data-summary { margin: 0; font-size: 12px; color: #596a80; }
      fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
      legend { padding: 0; margin: 0 0 12px; font-size: 12px; font-weight: 600; color: #596a80; }
      label { display: block; font-weight: 600; margin-bottom: 6px; }
      input { width: 100%; min-width: 0; height: 42px; border: 1px solid #b9c8da; border-radius: 8px; padding: 9px 12px; color: #233149; background: #fff; font: inherit; }
      input:focus { outline: 2px solid #c0d8ff; border-color: #1967d2; }
      input[aria-invalid="true"] { border-color: #ba3438; }
      .input-hint[data-invalid="true"] { color: #a72428; }
      .input-hint { font-size: 11px; color: #596a80; margin: 5px 0 12px; }
      .help { font-size: 12px; color: #596a80; margin: 6px 0 12px; }
      .limits { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .limits label { font-size: 12px; }
      .policy { padding: 10px 12px; border-radius: 8px; border: 1px solid #d3e9dc; background: #f1f9f4; color: #23623a; font-size: 12px; margin: 12px 0 0; }
      .policy strong { display: block; margin-bottom: 3px; }
      details { font-size: 12px; margin: 12px 0 0; color: #596a80; }
      summary { cursor: pointer; font-weight: 600; }
      details ul { padding-left: 18px; margin: 8px 0; }
      details li { margin: 6px 0; }
      button { cursor: pointer; font: inherit; border-radius: 8px; min-height: 42px; padding: 9px 10px; font-weight: 600; border: 1px solid #c4d2e3; color: #233149; background: #f8fafc; }
      button:hover:not(:disabled) { filter: brightness(.97); }
      button:focus-visible, summary:focus-visible { outline: 2px solid #1967d2; outline-offset: 2px; }
      button:disabled { opacity: .5; cursor: default; }
      .action-bar { padding: 12px 16px; border-top: 1px solid #e1e9f4; flex-shrink: 0; background: #fff; }
      .actions { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
      .primary { background: #1967d2; color: #fff; border-color: #1967d2; }
      .danger { background: #b32d32; color: #fff; border-color: #b32d32; }
      #stop { color: #a72428; border-color: #e7babc; }
      #run-state { margin: 0 0 8px; font-size: 12px; color: #596a80; white-space: pre-line; }
      #run-progress { margin-bottom: 10px; font-size: 12px; color: #596a80; }
      progress { display: block; width: 100%; height: 6px; margin-top: 6px; accent-color: #1967d2; }
      #status { padding: 10px 12px; border: 1px solid #e1e9f4; border-radius: 8px; background: #f3f7fc; white-space: pre-line; overflow-wrap: anywhere; margin-top: 14px; font-size: 12px; }
      #status[data-tone="error"] { background: #fff1f0; border-color: #efc9c7; color: #9b2723; }
      #status[data-tone="success"] { background: #edf8f0; border-color: #d3e9dc; color: #23623a; }
      #preview { margin-top: 16px; border-top: 1px solid #e1e9f4; padding-top: 14px; }
      #preview-title { font-size: 14px; margin: 0 0 4px; }
      #preview-note { margin: 0 0 10px; font-size: 11px; color: #596a80; }
      #summary { font-size: 12px; margin: 0 0 10px; color: #596a80; }
      #summary p { margin: 4px 0; }
      #summary p:first-child { font-weight: 600; color: #233149; font-size: 13px; }
      #times { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; max-height: 220px; overflow: auto; overscroll-behavior: contain; }
      #times li { font: 12px/1.5 monospace; text-align: center; border-radius: 6px; background: #f1f5f9; padding: 7px; }
      #times[data-mode="cleanup"] { grid-template-columns: 1fr; }
      #times[data-mode="cleanup"] li { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; text-align: left; border-left: 3px solid #e7babc; }
      .point-reason { font: 12px/1.5 Arial, sans-serif; color: #596a80; overflow-wrap: anywhere; }
      #copy-error { width: 100%; margin-top: 8px; font-size: 12px; }
      #copy-status { color: #596a80; font-size: 12px; }
      textarea { margin-top: 8px; width: 100%; height: 110px; font: 11px monospace; border: 1px solid #c4d2e3; border-radius: 6px; padding: 8px; }
      #review-error { width: 100%; color: #9b2723; border-color: #e7babc; background: #fff1f0; margin-top: 8px; }
      .notification-settings { margin-top: 14px; }
      .check { display: flex; align-items: start; gap: 8px; margin-top: 10px; font-size: 12px; font-weight: normal; }
      .check input { width: 16px; height: 16px; flex-shrink: 0; accent-color: #1967d2; margin: 2px 0; }
      #run-alert { color: #233149; background: #fff; width: 480px; max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px); border: 1px solid #e7babc; border-top: 5px solid #b32d32; border-radius: 14px; padding: 22px; box-shadow: 0 20px 70px #12203955; font: 14px/1.6 Arial, sans-serif; overflow: auto; overscroll-behavior: contain; }
      #run-alert::backdrop { background: #12203970; }
      #run-alert[data-severity="error"], #run-alert[data-severity="warning"] { border-color: #e4c797; border-top-color: #a85b00; }
      #status[data-tone="warning"] { background: #fff8e8; border-color: #e4c797; color: #805000; }
      #review-error[data-severity="error"], #review-error[data-severity="warning"] { background: #fff8e8; border-color: #e4c797; color: #805000; }
      #run-alert h3 { margin: 0 0 12px; font-size: 19px; line-height: 1.4; }
      #alert-message { white-space: pre-line; overflow-wrap: anywhere; }
      #alert-count { background: #f3f7fc; padding: 10px 12px; border-radius: 8px; font-weight: 600; }
      #alert-guidance { color: #596a80; }
      .alert-save { color: #9b2723; font-weight: 600; }
      .alert-actions { display: grid; gap: 8px; }
      #alert-later, #alert-copy { font-size: 12px; }
      #alert-notice, #alert-copy-status { color: #596a80; font-size: 12px; }
      footer { color: #596a80; font-size: 10px; margin-top: 7px; text-align: center; }
      @media (max-width: 480px) { header { padding: 12px; } .tabs { margin: 0 12px 10px; } main { padding: 0 12px 12px; } .action-bar { padding: 10px 12px; } .limits { gap: 8px; } #times { grid-template-columns: repeat(2, minmax(0, 1fr)); } .data { padding: 10px; } }
    </style>
    <section class="panel" aria-label="Chèn và dọn điểm quảng cáo YouTube">
      <header><div><h2>Điểm quảng cáo</h2><p class="subtitle">Một video · Bạn tự xem lại và lưu</p></div><span class="version">v${VERSION}</span><button id="close" type="button" title="Ẩn bảng điều khiển" aria-label="Ẩn bảng điều khiển">×</button></header>
      <div class="tabs" role="tablist" aria-label="Chức năng quảng cáo"><button id="tab-insert" role="tab" aria-selected="true" aria-controls="insert-panel" type="button">Chèn điểm</button><button id="tab-cleanup" role="tab" aria-selected="false" aria-controls="cleanup-panel" tabindex="-1" type="button">Dọn điểm</button></div>
      <main>
        <div class="data"><div class="data-head"><label for="duration">Thời lượng · tự động</label><button id="load" type="button" title="Đọc lại thời lượng, điểm chèn và cảnh báo đang hiển thị trong Studio">↻ Tải lại dữ liệu</button></div><output id="duration" aria-live="polite">Đang đọc…</output><p id="data-summary" aria-live="polite">Đang đọc dữ liệu từ Studio…</p></div>
        <section id="insert-panel" role="tabpanel" aria-labelledby="tab-insert">
          <fieldset><legend>Thiết lập chèn · số giây</legend>
            <div class="limits"><div><label for="start-margin">Đoạn đầu không chèn</label><input id="start-margin" type="text" value="60" inputmode="numeric" autocomplete="off" aria-describedby="start-margin-hint"><p class="input-hint" id="start-margin-hint"></p></div><div><label for="end-margin">Đoạn cuối không chèn</label><input id="end-margin" type="text" value="60" inputmode="numeric" autocomplete="off" aria-describedby="end-margin-hint"><p class="input-hint" id="end-margin-hint"></p></div></div>
            <label for="interval">Khoảng cách giữa các điểm</label><input id="interval" type="text" value="120" inputmode="numeric" autocomplete="off" spellcheck="false" aria-describedby="interval-hint"><p class="input-hint" id="interval-hint"></p>
          </fieldset>
          <p class="help">Điểm đầu ở giây bạn nhập. Đoạn cuối tính lùi từ cuối video; nhập 0 nếu không chừa.</p>
          <div class="policy"><strong>Giữ mọi điểm có sẵn</strong>Giữ cả điểm tự động. Bỏ qua mốc gần hoặc trùng điểm cũ.</div>
        </section>
        <section id="cleanup-panel" role="tabpanel" aria-labelledby="tab-cleanup" hidden>
          <fieldset><legend>Thiết lập dọn · số giây</legend>
            <div class="limits"><div><label for="cleanup-start-margin">Đoạn đầu không chèn</label><input id="cleanup-start-margin" type="text" value="0" inputmode="numeric" autocomplete="off" aria-describedby="cleanup-start-margin-hint"><p class="input-hint" id="cleanup-start-margin-hint"></p></div><div><label for="cleanup-end-margin">Đoạn cuối không chèn</label><input id="cleanup-end-margin" type="text" value="0" inputmode="numeric" autocomplete="off" aria-describedby="cleanup-end-margin-hint"><p class="input-hint" id="cleanup-end-margin-hint"></p></div></div>
            <label for="minimum-spacing">Khoảng cách tối thiểu khi dọn</label><input id="minimum-spacing" type="text" value="120" inputmode="numeric" autocomplete="off" aria-describedby="minimum-spacing-hint spacing-rule"><p class="input-hint" id="minimum-spacing-hint"></p>
          </fieldset>
          <p class="help" id="spacing-rule">Điểm thủ công quá gần điểm tự động ở <strong>trước hoặc sau</strong> sẽ bị xóa. Giữa các điểm thủ công phù hợp, giữ điểm sớm hơn.</p>
          <div class="policy"><strong>Luôn giữ mọi điểm tự động</strong>Kể cả trong đoạn đầu/cuối, có cảnh báo hoặc Đang xem xét. Giữ cả điểm chưa rõ loại.</div>
          <details><summary>Các điểm thủ công sẽ được dọn</summary><ul><li>Điểm trong đoạn đầu/cuối. Giữ mốc đúng ranh giới; nhập 0 để bỏ qua đoạn đó.</li><li>Điểm có cảnh báo đỏ hoặc Đang xem xét.</li><li>Điểm còn lại gần nhau hơn khoảng cách tối thiểu.</li></ul>Cài đặt dọn độc lập với cài đặt chèn. Áp dụng cả điểm thủ công có sẵn.</details>
        </section>
        <div id="status" role="status" aria-live="polite">Mở Quản lý vị trí quảng cáo trong YouTube Studio, rồi bấm Xem trước.</div>
        <button id="review-error" type="button" hidden>⚠ Xem lỗi và cách xử lý</button>
        <button id="copy-error" type="button" hidden>Sao chép thông tin lỗi</button><p id="copy-status" role="status" hidden></p><textarea id="error-details" readonly hidden aria-label="Thông tin lỗi để sao chép"></textarea>
        <section id="preview" hidden><h3 id="preview-title">Xem trước thay đổi</h3><p id="preview-note">Chưa thay đổi điểm nào. Kiểm tra danh sách trước khi chạy.</p><div id="summary"></div><ul id="times" aria-label="Các điểm sẽ thêm"></ul></section>
        <details class="notification-settings"><summary>Thông báo khi gặp lỗi</summary><label class="check"><input id="focus-on-error" type="checkbox" checked>Đưa Chrome lên trước khi cần kiểm tra</label><p class="help">Áp dụng khi lỗi có thể ảnh hưởng điểm. Lỗi chưa bắt đầu và nút Dừng không đưa Chrome lên trước. Khi tắt, bấm thông báo hệ thống để mở Studio.</p></details>
      </main>
      <div class="action-bar"><div id="run-progress" hidden><span id="progress-text"></span><progress id="progress" max="1" value="0" aria-label="Tiến độ đã xác nhận"></progress></div><div id="insert-actions" class="actions"><button id="read" type="button">Xem trước</button><button id="start" type="button" class="primary" disabled>Chèn điểm</button></div><div id="cleanup-actions" class="actions" hidden><button id="cleanup-read" type="button">Xem trước</button><button id="cleanup-start" type="button" class="danger" disabled>Dọn điểm</button></div><p id="run-state" role="status" aria-live="polite" hidden></p><div id="run-actions" class="actions" hidden><button id="pause" type="button" hidden>Tạm dừng</button><button id="stop" type="button" title="Kết thúc lượt chạy, giữ thay đổi chưa lưu để kiểm tra" hidden>Dừng / Hủy lượt</button></div><footer>Xem trước tự đọc dữ liệu mới · Bạn tự bấm Tiếp tục/Lưu</footer></div>
    </section>
    <dialog id="run-alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-message alert-count alert-guidance">
      <h3 id="alert-title">⚠ Đã dừng — cần kiểm tra</h3><p id="alert-message"></p><p id="alert-count"></p><p id="alert-guidance"></p><p class="alert-save">Extension chưa tự lưu thay đổi. Bạn kiểm tra Studio trước khi bấm Tiếp tục/Lưu.</p>
      <div class="alert-actions"><button id="alert-inspect" class="primary" type="button" autofocus>Kiểm tra trong Studio</button><button id="alert-preview" type="button">Đọc lại và xem trước</button><button id="alert-later" type="button">Để sau</button><button id="alert-copy" type="button">Sao chép thông tin lỗi</button></div><p id="alert-notice" hidden></p><p id="alert-copy-status" role="status" hidden></p><textarea id="alert-error-details" readonly hidden aria-label="Thông tin lỗi để sao chép"></textarea>
    </dialog>`;

  globalThis.MidrollStudio.mountPanel(host);
  // Keep text-entry keys inside the helper so Studio's bubbling shortcuts
  // do not intercept typing. Native text editing and Tab remain available.
  for (const type of ["keydown", "keyup", "keypress"]) {
    shadow.addEventListener(type, (event) => event.stopPropagation());
  }
  let mountTimer;
  const observer = new MutationObserver((records) => {
    const outsideChange = records.some((record) => {
      for (let node = record.target; node; node = node.parentNode || node.host) if (node === host) return false;
      return true;
    });
    if (location.pathname !== panelRoute) {
      panelRoute = location.pathname;
      closeAlert(); lastIssue = null; $("review-error").hidden = true;
      durationController?.abort();
      controller?.abort(new Error("Bạn đã chuyển trang. Đã dừng; kiểm tra thay đổi trước khi lưu."));
      invalidate();
      $("duration").textContent = "Đang đọc…";
      if (!host.hidden && !controller) void refreshDuration(false);
    }
    if (!outsideChange || host.hidden) return;
    const container = host.parentElement;
    // Changes inside a connected, visible dialog do not require searching
    // the entire Studio page or moving the helper again.
    if (host.isConnected && container !== document.body && container !== document.documentElement && container?.getClientRects().length) return;
    clearTimeout(mountTimer);
    mountTimer = setTimeout(() => globalThis.MidrollStudio.mountPanel(host), 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "open", "style", "class"] });
  const $ = (id) => shadow.getElementById(id);
  let plan = null;
  let cleanupPlan = null;
  let adapter = null;
  let controller = null;
  let runControl = null;
  let durationController = null;
  let panelRoute = location.pathname;
  let touched = false;
  let statusRevision = 0;
  let lastError = "";
  let activeTab = "insert";
  let activeRun = null, lastIssue = null, postponedRun = null;
  let focusTouched = false;
  const sendAlert = (message, signal) => globalThis.MidrollWait.request(() => chrome.runtime.sendMessage(message), { signal, timeout: 5000, timeoutValue: { ok: false } }).catch(() => ({ ok: false }));
  function runStage(stage) {
    if (!activeRun) return;
    Object.assign(activeRun, stage);
    if (stage.phase === "verifying") {
      $("pause").disabled = true;
      $("run-state").textContent = "Đang kiểm tra kết quả cuối. Có thể Dừng / Hủy lượt; thay đổi chưa được lưu.";
    }
    void sendAlert({ type: "MIDROLL_RUN_PROGRESS", ...activeRun });
  }
  // The task can settle seconds before busy(false) while the background
  // session stops; no checkpoint remains, so Pause must not stay clickable.
  const lockPause = () => { $("pause").disabled = true; };
  function createRunControl(currentAdapter, mode) {
    if (typeof globalThis.MidrollRunControl?.create !== "function") {
      throw Object.assign(new Error("Chưa nạp được thành phần điều khiển lượt chạy. Hãy tải lại extension và làm mới Studio trước khi Xem trước lại."), { code: "run-control-unavailable" });
    }
    return globalThis.MidrollRunControl.create({
      getFingerprint: () => mode === "cleanup" ? currentAdapter.cleanupSnapshot().cleanupFingerprint : currentAdapter.snapshot().fingerprint,
      onChange: (state) => {
        $("pause").textContent = state === "paused" ? "Tiếp tục" : state === "pausing" ? "Đang tạm dừng…" : state === "resuming" ? "Đang kiểm tra…" : "Tạm dừng";
        $("pause").disabled = !["running", "paused"].includes(state);
        const message = state === "pausing" ? "Đang xác nhận xong điểm/nhóm hiện tại trước khi tạm dừng…"
          : state === "paused" ? "Đã tạm dừng. Tiếp tục để xử lý phần còn lại, hoặc Dừng / Hủy lượt. Chưa lưu thay đổi."
          : state === "resuming" ? "Đang kiểm tra lại dữ liệu Studio…"
          : "Đang chạy. Dừng / Hủy lượt sẽ giữ thay đổi chưa lưu để kiểm tra.";
        $("run-state").textContent = message;
        // #run-state already announces the state; #status carries only the count.
        if (state === "paused" || state === "running") status(`Đã xác nhận ${activeRun.mode === "cleanup" ? "xóa" : "thêm"} ${activeRun.confirmed}/${activeRun.total} điểm. Chưa lưu thay đổi.`);
      }
    });
  }
  function closeAlert(acknowledge = false) {
    $("run-alert").close();
    if (acknowledge && lastIssue) {
      lastIssue.acknowledged = true;
      if (lastIssue.runId) void sendAlert({ type: "MIDROLL_RUN_ACK", runId: lastIssue.runId });
    }
  }
  function showRunError(detail, reveal = true) {
    lastIssue = detail;
    lastError = detail.message;
    const level = globalThis.MidrollRunAlerts.severity(detail);
    $("run-alert").dataset.severity = level;
    $("review-error").dataset.severity = level;
    if (reveal) { host.hidden = false; globalThis.MidrollStudio.mountPanel(host); }
    $("review-error").hidden = false;
    $("alert-title").textContent = level === "warning" ? "⚠ Đã dừng — còn điểm cần kiểm tra" : level === "error" ? "⚠ Chưa thay đổi điểm — cần kiểm tra" : detail.mode === "cleanup" ? "⚠ Đã dừng dọn — cần kiểm tra" : "⚠ Đã dừng chèn — cần kiểm tra";
    $("alert-message").textContent = detail.message;
    $("alert-count").textContent = `Đã xác nhận ${detail.mode === "cleanup" ? "xóa" : "thêm"} ${detail.confirmed}/${detail.total} điểm.`;
    $("alert-guidance").textContent = detail.code === "run-control-unavailable" ? "Tải lại extension trong chrome://extensions. Kiểm tra các chỉnh sửa đang dở trước khi làm mới trang Studio, rồi mở lại bảng và Xem trước. Chưa bắt đầu chèn hoặc dọn."
      : detail.code === "alert-monitor-unavailable" ? "Tải lại extension trong chrome://extensions, rồi mở lại bảng để đọc dữ liệu và xem trước. Chưa bắt đầu chèn hoặc dọn."
      : ["automatic-changed", "preservation-failed"].includes(detail.code) ? "Kiểm tra toàn bộ danh sách điểm và lựa chọn quảng cáo tự động trong Studio trước khi lưu. Sau đó đọc lại để lập kế hoạch mới."
      : detail.phase === "starting" ? "Lỗi xảy ra khi bật chế độ chạy nền. Kiểm tra quyền extension và đóng DevTools của tab Studio, rồi đọc lại để xem trước."
      : detail.phase === "processing" ? `Kiểm tra ${detail.mode === "cleanup" ? "nhóm" : "điểm"} đang xử lý${detail.points?.length ? `: ${detail.points.map(P.formatTime).join(", ")}` : ""}. ${detail.pending !== null && detail.pending !== undefined ? `Đã bấm xóa ${detail.pending} điểm nhưng chưa xác nhận. ` : "Kết quả thao tác này chưa được xác nhận. "}Sau đó đọc lại để lập kế hoạch mới.`
      : "Kiểm tra toàn bộ danh sách và lựa chọn quảng cáo tự động trong Studio. Sau đó đọc lại để lập kế hoạch mới.";
    $("alert-notice").hidden = true;
    $("alert-copy-status").hidden = true;
    $("alert-copy").disabled = false;
    $("alert-error-details").hidden = true;
    if (reveal) { if (!$("run-alert").open) $("run-alert").showModal(); $("alert-inspect").focus(); }
  }
  async function publishError(error) {
    if (activeRun?.videoId !== location.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1]) return;
    const detail = globalThis.MidrollRunAlerts.issue(error, activeRun);
    try { showRunError(detail, !detail.runId || postponedRun !== detail.runId); } catch { /* Background notification still reports the original run failure. */ }
    // A failure while creating the run ID still needs a local error dialog,
    // but it has no valid identity to register with the background worker.
    if (!detail.runId) return;
    const result = await sendAlert({ type: "MIDROLL_RUN_ERROR", runId: detail.runId, issue: detail, presented: $("run-alert").open && host.isConnected && !host.hidden });
    if (lastIssue !== detail || !$("run-alert").open || result.acknowledged) return;
    if (result.postponed) { postponedRun = detail.runId; closeAlert(); return; }
    if (!result.ok || (!result.notified && !result.local && !result.quiet)) {
      $("alert-notice").textContent = "Chưa hiện được thông báo hệ thống. Kiểm tra quyền thông báo của extension và cài đặt Chrome/Windows; thông tin lỗi vẫn có trong bảng này.";
      $("alert-notice").hidden = false;
    }
  }
  $("review-error").addEventListener("click", () => { if (lastIssue) showRunError(lastIssue); });
  $("alert-inspect").addEventListener("click", () => { closeAlert(true); $("status").scrollIntoView({ block: "nearest" }); $("review-error").focus(); });
  function postponeAlert() {
    closeAlert();
    if (lastIssue) { postponedRun = lastIssue.runId; if (lastIssue.runId) void sendAlert({ type: "MIDROLL_RUN_POSTPONE", runId: lastIssue.runId }); }
  }
  $("alert-later").addEventListener("click", postponeAlert);
  $("run-alert").addEventListener("cancel", (event) => { event.preventDefault(); postponeAlert(); });
  $("run-alert").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...$("run-alert").querySelectorAll("button:not(:disabled), textarea:not([hidden])")].filter((node) => node.getClientRects().length);
    if (!controls.length) return;
    event.preventDefault();
    const index = controls.indexOf(shadow.activeElement);
    controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });
  $("alert-preview").addEventListener("click", () => { const mode = lastIssue?.mode; closeAlert(true); touched = true; selectTab(mode === "cleanup" ? "cleanup" : "insert", false, false); void refreshDuration(true); });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (!["MIDROLL_SHOW_RUN_ERROR", "MIDROLL_HIDE_RUN_ERROR"].includes(message?.type)) return false;
    const videoId = location.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1];
    if (message.type === "MIDROLL_HIDE_RUN_ERROR") {
      if (sender?.id !== chrome.runtime.id || message.videoId !== videoId || ![lastIssue?.runId, activeRun?.runId].includes(message.runId) || !message.runId) { reply?.({ ok: false }); return false; }
      postponedRun = message.runId; if (lastIssue?.runId === message.runId) closeAlert(); reply?.({ ok: true }); return false;
    }
    if (sender?.id !== chrome.runtime.id || message.videoId !== videoId || controller || (activeRun && activeRun.runId !== message.issue?.runId) || !message.issue?.message) { reply?.({ ok: false }); return false; }
    durationController?.abort(); durationController = null; invalidate(); busy(false);
    status(message.issue.message, globalThis.MidrollRunAlerts.severity(message.issue) === "warning" ? "warning" : "error"); showRunError(message.issue); reply?.({ ok: true }); return false;
  });

  function status(message, tone = "") {
    statusRevision++;
    lastError = tone === "error" ? message : "";
    $("status").textContent = message;
    $("status").dataset.tone = tone;
    $("copy-error").hidden = !lastError;
    $("copy-error").disabled = false;
    $("copy-status").hidden = true;
    $("error-details").hidden = true;
  }
  function invalidate({ keepPreview = false } = {}) {
    plan = null;
    cleanupPlan = null;
    adapter = null;
    $("start").disabled = true;
    $("cleanup-start").disabled = true;
    $("start").textContent = "Chèn điểm";
    $("cleanup-start").textContent = "Dọn điểm";
    if (!keepPreview) $("preview").hidden = true;
    else {
      $("preview-title").textContent = "Kế hoạch lần chạy vừa rồi";
      $("preview-note").textContent = "Đây là kế hoạch đã dùng, không phải kết quả xác nhận. Kiểm tra kết quả thực tế trong Studio; xem trước lại để chạy tiếp.";
    }
  }
  function updateProgress(count, total) {
    $("progress").max = Math.max(1, total);
    $("progress").value = count;
    $("progress-text").textContent = `Đã xác nhận: ${count}/${total} điểm`;
  }
  function showSummary(lines) {
    if (lastIssue?.acknowledged) { lastIssue = null; $("review-error").hidden = true; }
    $("summary").replaceChildren(...lines.filter(Boolean).map((line) => {
      const item = document.createElement("p"); item.textContent = line; return item;
    }));
    $("preview-title").textContent = "Xem trước thay đổi";
    $("preview-note").textContent = "Chưa thay đổi điểm nào. Kiểm tra danh sách trước khi chạy.";
  }
  function updateHint(id) {
    const text = $(id).value.trim(), value = Number(text);
    const minimum = ["interval", "minimum-spacing"].includes(id) ? 1 : 0;
    const valid = /^\d+$/.test(text) && Number.isSafeInteger(value) && value >= minimum;
    $(id).setAttribute("aria-invalid", String(!valid));
    $(id + "-hint").dataset.invalid = String(!valid);
    $(id + "-hint").textContent = valid ? `${value} giây${value ? ` = ${P.formatTime(value).replace(/^00:/, "")}` : " · Không chừa đoạn này"}` : `Nhập số giây nguyên ${minimum ? "lớn hơn 0" : "từ 0 trở lên"}.`;
  }
  function busy(value) {
    for (const id of ["start-margin", "end-margin", "cleanup-start-margin", "cleanup-end-margin", "minimum-spacing", "tab-insert", "tab-cleanup", "focus-on-error"]) $(id).disabled = value;
    $("interval").disabled = value;
    $("read").disabled = value || Boolean(durationController);
    $("load").disabled = value || Boolean(durationController);
    $("close").disabled = value;
    $("stop").hidden = !value;
    $("stop").disabled = false;
    $("run-actions").hidden = !value;
    $("pause").hidden = !value;
    $("pause").disabled = false;
    $("pause").textContent = "Tạm dừng";
    $("run-state").hidden = !value;
    $("run-state").textContent = value ? "Đang chạy. Dừng / Hủy lượt sẽ giữ thay đổi chưa lưu để kiểm tra." : "";
    $("start").disabled = value || !plan?.additions.length;
    $("cleanup-read").disabled = value || Boolean(durationController);
    $("cleanup-start").disabled = value || !cleanupPlan?.removals.length;
    $(activeTab + "-actions").hidden = value;
    $("run-progress").hidden = !value;
    if (value) updateProgress(0, activeTab === "insert" ? plan.additions.length : cleanupPlan.removals.length);
  }

  chrome.storage.local.get({ intervalSeconds: 120, startSeconds: 60, endMarginSeconds: 60, minimumSpacingSeconds: 120, cleanupStartSeconds: 0, cleanupEndMarginSeconds: 0 }).then((saved) => {
    if (touched) return;
    for (const [id, name, minimum] of [["interval", "intervalSeconds", 1], ["start-margin", "startSeconds", 0], ["end-margin", "endMarginSeconds", 0], ["minimum-spacing", "minimumSpacingSeconds", 1], ["cleanup-start-margin", "cleanupStartSeconds", 0], ["cleanup-end-margin", "cleanupEndMarginSeconds", 0]]) {
      if (/^\d+$/.test(String(saved[name])) && Number.isSafeInteger(Number(saved[name])) && Number(saved[name]) >= minimum) $(id).value = saved[name];
      updateHint(id);
    }
  }).catch(() => {});
  chrome.storage.local.get({ focusOnRunError: true }).then((saved) => { if (!focusTouched) $("focus-on-error").checked = saved.focusOnRunError !== false; }).catch(() => {});
  $("focus-on-error").addEventListener("change", () => {
    focusTouched = true;
    chrome.storage.local.set({ focusOnRunError: $("focus-on-error").checked }).catch(() => {});
  });
  for (const id of ["interval", "start-margin", "end-margin", "cleanup-start-margin", "cleanup-end-margin", "minimum-spacing"]) {
    updateHint(id);
    $(id).addEventListener("input", () => { touched = true; updateHint(id); invalidate(); });
  }
  function selectTab(next, focus = false, refresh = true) {
    if (controller || next === activeTab) return;
    activeTab = next;
    for (const name of ["insert", "cleanup"]) {
      const selected = name === next;
      $("tab-" + name).setAttribute("aria-selected", String(selected));
      $("tab-" + name).tabIndex = selected ? 0 : -1;
      $(name + "-panel").hidden = !selected;
      $(name + "-actions").hidden = !selected;
    }
    shadow.querySelector("main").scrollTop = 0;
    if (focus) $("tab-" + next).focus();
    if (refresh) void refreshDuration(false);
  }
  for (const name of ["insert", "cleanup"]) {
    $("tab-" + name).addEventListener("click", () => selectTab(name));
    $("tab-" + name).addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      selectTab(event.key === "Home" ? "insert" : event.key === "End" ? "cleanup" : activeTab === "insert" ? "cleanup" : "insert", true);
    });
  }
  globalThis.MidrollFocusPanel = () => $(activeTab === "insert" ? "interval" : "minimum-spacing").focus();
  $("close").addEventListener("click", () => {
    host.hidden = true;
    durationController?.abort();
    invalidate();
  });
  async function refreshDuration(preview = false) {
    if (controller) return;
    durationController?.abort();
    const reading = new AbortController();
    durationController = reading;
    panelRoute = location.pathname;
    invalidate();
    $("read").disabled = true;
    $("cleanup-read").disabled = true;
    $("load").disabled = true;
    $("duration").textContent = "Đang đọc…";
    $("data-summary").textContent = "Đang đọc dữ liệu từ Studio…";
    let knownDuration = null;
    try {
      if (!globalThis.MidrollStudio.isEditorOpen()) {
        $("duration").textContent = "Chưa mở trình quảng cáo";
        $("data-summary").textContent = "Mở Quản lý vị trí quảng cáo để đọc dữ liệu.";
        status("Vào Kiếm tiền → Quản lý vị trí quảng cáo, mở hộp có nút Chèn vị trí quảng cáo, rồi bấm Xem trước.");
        return;
      }
      const found = await globalThis.MidrollStudio.createAdapter({
        signal: reading.signal,
        onDurationStatus: (message) => { if (durationController === reading) status(message); }
      });
      if (reading.signal.aborted || durationController !== reading) return;
      adapter = found;
      const cleaning = activeTab === "cleanup";
      const current = cleaning ? adapter.cleanupSnapshot() : adapter.snapshot();
      knownDuration = current.duration;
      $("duration").textContent = P.formatTime(current.duration);
      const warningCount = cleaning ? current.rows.filter((row) => row.kind === "manual" && row.warning).length : 0;
      const pendingCount = cleaning ? current.rows.filter((row) => row.pending).length : 0;
      $("data-summary").textContent = [`${current.rows.length} điểm hiện có`, warningCount && `${warningCount} điểm thủ công có cảnh báo`, pendingCount && `${pendingCount} điểm đang xem xét`].filter(Boolean).join(" · ") + ".";
      if (!preview) {
        status(cleaning ? "Chọn đoạn đầu/cuối và khoảng cách tối thiểu rồi bấm Xem trước." : "Chọn đoạn đầu/cuối và khoảng cách rồi bấm Xem trước.");
        return;
      }
      if (cleaning) {
        cleanupPlan = globalThis.MidrollCleanup.makePlan(current, $("minimum-spacing").value, { startSeconds: $("cleanup-start-margin").value, endMarginSeconds: $("cleanup-end-margin").value });
        chrome.storage.local.set({ minimumSpacingSeconds: cleanupPlan.spacing, cleanupStartSeconds: cleanupPlan.start, cleanupEndMarginSeconds: cleanupPlan.endMargin }).catch(() => {});
        showSummary([
          `Sẽ xóa ${cleanupPlan.removals.length}/${cleanupPlan.total} điểm · Giữ ${cleanupPlan.retained} điểm`,
          `Giữ ${cleanupPlan.automatic} điểm tự động · ${cleanupPlan.unknown} điểm chưa rõ loại`,
          `Đoạn đầu: ${cleanupPlan.start} giây · Đoạn cuối: ${cleanupPlan.endMargin} giây`,
          cleanupPlan.marginRemovals && `Sẽ xóa ${cleanupPlan.marginRemovals} điểm theo đoạn đầu/cuối`,
          cleanupPlan.reviewRemovals && `Sẽ xóa ${cleanupPlan.reviewRemovals} điểm thủ công Đang xem xét`,
          `Khoảng cách tối thiểu: ${cleanupPlan.spacing} giây`
        ]);
        $("times").dataset.mode = "cleanup";
        $("times").setAttribute("aria-label", "Các điểm sẽ xóa và lý do");
        $("times").replaceChildren(...cleanupPlan.removals.map((target) => {
          const item = document.createElement("li");
          const time = document.createElement("span"), reason = document.createElement("span");
          time.className = "point-time"; time.textContent = target.raw;
          reason.className = "point-reason"; reason.textContent = ` — ${target.reason}`;
          item.append(time, reason); return item;
        }));
        $("preview").hidden = false;
        $("cleanup-start").disabled = cleanupPlan.removals.length === 0;
        $("cleanup-start").textContent = `Dọn ${cleanupPlan.removals.length} điểm`;
        const unknown = cleanupPlan.unknown ? `\nCó ${cleanupPlan.unknown} điểm chưa xác định được thủ công/tự động; giữ nguyên các điểm đó.` : "";
        status((cleanupPlan.removals.length ? "Kiểm tra danh sách sẽ xóa, rồi bấm Dọn điểm. Chưa thay đổi điểm nào." : "Không có điểm được nhận diện cần dọn.") + unknown, cleanupPlan.unknown ? "warning" : "");
        $("preview").scrollIntoView({ block: "start" });
        return;
      }
      plan = { ...P.makePlan(current.duration, $("interval").value, current.times, { startSeconds: $("start-margin").value, endMarginSeconds: $("end-margin").value }), fingerprint: current.fingerprint };
      chrome.storage.local.set({ intervalSeconds: plan.interval, startSeconds: plan.start, endMarginSeconds: plan.endMargin }).catch(() => {});
      showSummary([`Sẽ thêm ${plan.additions.length} điểm`, `Thời lượng: ${P.formatTime(plan.duration)} (tự động)`, `Bắt đầu: ${P.formatTime(plan.start)} · Chừa cuối: ${plan.endMargin} giây`, `Giữ ${plan.existing.length} điểm có sẵn · Bỏ qua ${plan.skipped.length} mốc gần/trùng`]);
      $("times").dataset.mode = "insert";
      $("times").setAttribute("aria-label", "Các điểm sẽ thêm");
      $("times").replaceChildren(...plan.additions.map((seconds) => {
        const item = document.createElement("li");
        item.textContent = P.formatTime(seconds);
        return item;
      }));
      $("preview").hidden = false;
      $("start").disabled = plan.additions.length === 0;
      $("start").textContent = `Chèn ${plan.additions.length} điểm`;
      status(plan.additions.length ? "Kiểm tra các mốc bên dưới, rồi bấm Chèn điểm." : "Các mốc dự kiến đều đã có điểm gần/trùng. Không cần thêm.");
      $("preview").scrollIntoView({ block: "start" });
    } catch (error) {
      if (reading.signal.aborted || durationController !== reading) return;
      invalidate();
      $("duration").textContent = knownDuration === null ? "Chưa đọc được" : P.formatTime(knownDuration);
      $("data-summary").textContent = knownDuration === null ? "Chưa đọc được dữ liệu mới." : "Đã đọc dữ liệu; kiểm tra lại cài đặt.";
      status(error.message, "error");
      $("status").scrollIntoView({ block: "nearest" });
    } finally {
      if (durationController === reading) {
        durationController = null;
        $("read").disabled = Boolean(controller);
        $("cleanup-read").disabled = Boolean(controller);
        $("load").disabled = Boolean(controller);
      }
    }
  }
  globalThis.MidrollRefreshDuration = () => refreshDuration(false);
  $("read").addEventListener("click", () => { touched = true; void refreshDuration(true); });
  $("cleanup-read").addEventListener("click", () => { touched = true; void refreshDuration("cleanup"); });
  $("load").addEventListener("click", () => { touched = true; void refreshDuration(false); });
  // Reopening the popup uses this entry point without reinjecting modules
  // or replacing diagnostics while a run is still active.
  globalThis.MidrollShowPanel = () => {
    globalThis.MidrollStudio.mountPanel(host);
    host.hidden = false;
    if (!controller) {
      if (lastIssue && !lastIssue.acknowledged) showRunError(lastIssue);
      else { void refreshDuration(false); globalThis.MidrollFocusPanel(); }
    }
    return true;
  };

  $("start").addEventListener("click", async () => {
    if (!plan || controller || activeTab !== "insert") return;
    const currentPlan = plan;
    const currentAdapter = adapter;
    lastIssue = null; $("review-error").hidden = true;
    activeRun = { runId: null, videoId: location.pathname.split("/")[2], mode: "insert", total: currentPlan.additions.length, confirmed: 0, phase: "starting", points: [] };
    let inserted = 0;
    let failure;
    try {
      activeRun.runId = crypto.randomUUID();
      controller = new AbortController();
      busy(true);
      status("Đang bật chế độ chạy nền cho tab Studio…");
      const monitorRequest = sendAlert({ type: "MIDROLL_RUN_BEGIN", ...activeRun }, controller.signal);
      runControl = createRunControl(currentAdapter, "insert");
      const monitor = await monitorRequest;
      controller.signal.throwIfAborted();
      if (!monitor.ok) throw Object.assign(new Error("Không kết nối được phần theo dõi lỗi. Chưa xử lý điểm nào; tải lại extension rồi mở lại bảng."), { code: "alert-monitor-unavailable" });
      const result = await globalThis.MidrollBackgroundClient.run(({ signal }) => globalThis.MidrollRunner.runPlan(currentAdapter, currentPlan, {
        signal,
        checkpoint: (options) => runControl.checkpoint(options),
        onStage: runStage,
        onWaiting: ({ inserted: count, total, seconds, message }) => {
          status(`${message}\nĐã xác nhận ${count}/${total} điểm${Number.isFinite(seconds) ? ` · Mốc đang xử lý: ${P.formatTime(seconds)}` : ""}. Chưa lưu.`);
        },
        onProgress: (progress) => {
          inserted = progress.inserted;
          activeRun.confirmed = inserted;
          updateProgress(progress.inserted, progress.total);
          status(`Đã thêm ${progress.inserted}/${progress.total} điểm. Mốc vừa xử lý: ${P.formatTime(progress.seconds)}.\nChưa lưu thay đổi.`);
        }
      }).finally(lockPause), { signal: controller.signal, runId: activeRun.runId });
      status(`Đã xác nhận thêm ${result.inserted} điểm; giữ các điểm cũ.${result.skipped ? ` Bỏ qua thêm ${result.skipped} mốc đã có.` : ""}\nBạn hãy kiểm tra trong Studio, rồi tự bấm Tiếp tục/Lưu.`, "success");
    } catch (error) {
      const stopped = error.name === "AbortError";
      if (!stopped) failure = error;
      status(`${stopped ? "Đã dừng theo yêu cầu." : error.message}\n${activeRun.phase === "starting" ? "Chưa chèn điểm nào trong lượt này." : `Đã xác nhận thêm ${inserted} điểm; chưa lưu. Kiểm tra cả điểm cuối đang nhập. Các điểm đã thêm vẫn nằm trong bản chỉnh sửa Studio.`}`, stopped ? "" : "error");
    } finally {
      controller = null;
      runControl = null;
      invalidate({ keepPreview: true });
      busy(false);
      $("status").scrollIntoView({ block: "nearest" });
      if (failure) void publishError(failure).catch(() => {});
      else void sendAlert({ type: "MIDROLL_RUN_END", runId: activeRun.runId });
    }
  });
  $("cleanup-start").addEventListener("click", async () => {
    if (!cleanupPlan || controller || activeTab !== "cleanup") return;
    const currentPlan = cleanupPlan, currentAdapter = adapter;
    lastIssue = null; $("review-error").hidden = true;
    activeRun = { runId: null, videoId: location.pathname.split("/")[2], mode: "cleanup", total: currentPlan.removals.length, confirmed: 0, phase: "starting", points: [] };
    let removed = 0;
    let failure;
    try {
      activeRun.runId = crypto.randomUUID();
      controller = new AbortController();
      busy(true);
      status("Đang bật chế độ chạy nền để dọn điểm…");
      const monitorRequest = sendAlert({ type: "MIDROLL_RUN_BEGIN", ...activeRun }, controller.signal);
      runControl = createRunControl(currentAdapter, "cleanup");
      const monitor = await monitorRequest;
      controller.signal.throwIfAborted();
      if (!monitor.ok) throw Object.assign(new Error("Không kết nối được phần theo dõi lỗi. Chưa xử lý điểm nào; tải lại extension rồi mở lại bảng."), { code: "alert-monitor-unavailable" });
      const result = await globalThis.MidrollBackgroundClient.run(({ signal }) => globalThis.MidrollCleanup.runPlan(currentAdapter, currentPlan, {
        signal,
        checkpoint: (options) => runControl.checkpoint(options),
        onStage: runStage,
        onWaiting: (progress) => status(`${progress.message}\nĐã xác nhận xóa ${progress.removed}/${progress.total} điểm. Chưa lưu.`),
        onProgress: (progress) => { removed = progress.removed; activeRun.confirmed = removed; updateProgress(removed, progress.total); status(`Đã xác nhận xóa ${removed}/${progress.total} điểm · ${P.formatTime(progress.seconds)}.\nChưa lưu thay đổi.`); }
      }).finally(lockPause), { signal: controller.signal, runId: activeRun.runId });
      status(`Đã xác nhận xóa ${result.removed} điểm thủ công; giữ các điểm khác và điểm tự động.\nBạn hãy kiểm tra trong Studio, rồi tự bấm Tiếp tục/Lưu.`, "success");
    } catch (error) {
      const uncertainStop = error.name === "AbortError" && error.pendingRemoved > 0;
      if (uncertainStop) failure = Object.assign(new Error(`Đã dừng theo yêu cầu. Đã bấm xóa ${error.pendingRemoved} điểm trong nhóm đang xử lý nhưng chưa xác nhận; cần kiểm tra nhóm này.`), { code: "stopped-unconfirmed", pendingRemoved: error.pendingRemoved });
      else if (error.name !== "AbortError") failure = error;
      status(`${failure?.message || (error.name === "AbortError" ? "Đã dừng theo yêu cầu." : error.message)}\n${activeRun.phase === "starting" ? "Chưa xóa điểm nào trong lượt này." : `Đã xác nhận xóa ${removed} điểm; chưa lưu. Kiểm tra cả nhóm đang xử lý.`}`, uncertainStop ? "warning" : error.name === "AbortError" ? "" : "error");
    } finally {
      controller = null;
      runControl = null;
      invalidate({ keepPreview: true }); busy(false);
      $("status").scrollIntoView({ block: "nearest" });
      if (failure) void publishError(failure).catch(() => {});
      else void sendAlert({ type: "MIDROLL_RUN_END", runId: activeRun.runId });
    }
  });
  $("pause").addEventListener("click", () => {
    if (!controller || controller.signal.aborted || !runControl) return;
    if (runControl.state === "paused") runControl.resume();
    else runControl.pause();
  });
  $("stop").addEventListener("click", () => {
    controller?.abort();
    $("stop").disabled = true;
    $("pause").disabled = true;
    $("run-state").textContent = "Đang dừng lượt chạy… Giữ thay đổi chưa lưu để kiểm tra.";
    status("Đang dừng… Chưa lưu; các thay đổi vẫn nằm trong bản chỉnh sửa.");
  });
  async function copyError() {
    if (!lastError || controller) return;
    const current = statusRevision;
    let studio;
    try { studio = globalThis.MidrollStudio.diagnostics(); } catch { studio = { available: false }; }
    const interval = $("interval").value.trim();
    const report = { version: VERSION, message: lastError, intervalSeconds: /^\d+$/.test(interval) ? interval : null, studio,
      ...(lastIssue ? { code: lastIssue.code, mode: lastIssue.mode, confirmed: lastIssue.confirmed, total: lastIssue.total, phase: lastIssue.phase, points: lastIssue.points, pending: lastIssue.pending, severity: globalThis.MidrollRunAlerts.severity(lastIssue) } : {}) };
    const modal = $("run-alert").open, button = $(modal ? "alert-copy" : "copy-error"), output = $(modal ? "alert-copy-status" : "copy-status");
    button.disabled = true;
    const copied = await globalThis.MidrollErrorCopy.copy(JSON.stringify(report, null, 2), $(modal ? "alert-error-details" : "error-details"), () => current === statusRevision && modal === $("run-alert").open);
    if (current !== statusRevision || modal !== $("run-alert").open) return;
    button.disabled = false;
    output.hidden = false;
    output.textContent = copied ? "Đã sao chép. Bạn có thể dán thông tin khi báo lỗi." : "Chưa sao chép được. Nhấn Ctrl+C để sao chép phần thông tin đang được chọn.";
  }
  $("copy-error").addEventListener("click", () => { void copyError(); });
  $("alert-copy").addEventListener("click", () => { void copyError(); });
  $("interval").focus();
  void refreshDuration(false);
})();
