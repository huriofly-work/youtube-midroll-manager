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
  const host = document.createElement("div");
  globalThis.MidrollPanelHost = host;
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;right:18px;top:18px;width:360px;max-width:calc(100vw - 36px);z-index:2147483647;color-scheme:light;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: Arial, sans-serif; }
      * { box-sizing: border-box; }
      .panel { color: #233149; background: #fff; border: 1px solid #d4dfec; border-radius: 16px; box-shadow: 0 12px 48px #12203938; max-height: calc(100vh - 36px); overflow: auto; font-size: 14px; line-height: 1.5; }
      header { padding: 18px 20px; border-bottom: 1px solid #e7edf5; display: flex; gap: 8px; align-items: start; }
      h2 { margin: 0; font-size: 17px; line-height: 1.4; }
      .subtitle { color: #596a80; font-size: 12px; margin: 3px 0 0; }
      #close { margin-left: auto; padding: 2px 7px; border: 0; background: none; font-size: 22px; color: #596a80; }
      main { padding: 18px 20px 20px; }
      .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 16px; }
      .tabs button[aria-selected="true"] { background: #1967d2; border-color: #1967d2; color: #fff; }
      .data { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e7edf5; }
      #load { width: 100%; margin-top: 8px; }
      #data-summary { margin-bottom: 0; }
      label { display: block; font-weight: 600; margin-bottom: 6px; }
      input { width: 100%; border: 1px solid #b9c8da; border-radius: 8px; padding: 10px 12px; color: #233149; background: #fff; font: inherit; }
      input:focus { outline: 2px solid #c0d8ff; border-color: #1967d2; }
      .stepper { display: grid; grid-template-columns: 40px 1fr 40px; gap: 6px; }
      .stepper button { padding: 8px; font-size: 20px; user-select: none; }
      .help { font-size: 12px; color: #64748b; margin: 6px 0 12px; }
      .limits { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .limits label { font-size: 12px; }
      #times[data-mode="cleanup"] { grid-template-columns: 1fr; }
      #times[data-mode="cleanup"] li { text-align: left; font: 12px Arial, sans-serif; }
      #duration { display: block; padding: 10px 12px; border-radius: 8px; background: #eff5ff; font-weight: 600; }
      button { cursor: pointer; font: inherit; border-radius: 8px; padding: 10px 12px; font-weight: 600; border: 1px solid #c4d2e3; color: #233149; background: #f8fafc; }
      button:focus-visible { outline: 2px solid #1967d2; outline-offset: 2px; }
      button:disabled { opacity: .5; cursor: default; }
      .actions { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; margin-top: 14px; }
      .primary { background: #1967d2; color: #fff; border-color: #1967d2; }
      #stop { color: #a72428; border-color: #e7babc; width: 100%; margin-top: 8px; }
      [hidden] { display: none !important; }
      #status { padding: 11px 12px; border-radius: 8px; background: #f1f5f9; white-space: pre-line; margin-top: 14px; font-size: 13px; }
      #status[data-tone="error"] { background: #fff1f0; color: #9b2723; }
      #status[data-tone="success"] { background: #edf8f0; color: #23623a; }
      #preview { border-top: 1px solid #e7edf5; margin-top: 16px; padding-top: 14px; }
      #summary { font-size: 13px; margin: 0 0 8px; white-space: pre-line; }
      #times { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-height: 170px; overflow: auto; }
      #times li { font: 12px monospace; text-align: center; border-radius: 6px; background: #f1f5f9; padding: 5px; }
      #copy-error { width: 100%; margin-top: 10px; font-size: 12px; }
      #copy-status { color: #596a80; font-size: 12px; }
      textarea { margin-top: 8px; width: 100%; height: 110px; font: 11px monospace; border: 1px solid #c4d2e3; border-radius: 6px; padding: 8px; }
      footer { color: #64748b; font-size: 11px; padding-top: 14px; }
    </style>
    <section class="panel" aria-label="Chèn điểm quảng cáo YouTube">
        <header><div><h2>Chèn và dọn điểm quảng cáo</h2><p class="subtitle">Một video · Bạn tự xem lại và lưu · v0.1.14</p></div><button id="close" type="button" title="Ẩn bảng điều khiển" aria-label="Ẩn bảng điều khiển">×</button></header>
      <main>
        <div class="tabs" role="tablist" aria-label="Chức năng quảng cáo"><button id="tab-insert" role="tab" aria-selected="true" aria-controls="insert-panel" type="button">Chèn điểm</button><button id="tab-cleanup" role="tab" aria-selected="false" aria-controls="cleanup-panel" tabindex="-1" type="button">Dọn điểm</button></div>
        <div class="data">
          <label for="duration">Độ dài video · tự động</label>
          <output id="duration" aria-live="polite">Đang đọc…</output>
          <button id="load" type="button" title="Đọc lại thời lượng, điểm chèn và cảnh báo đang hiển thị trong Studio">↻ Tải lại dữ liệu</button>
          <p id="data-summary" class="help" aria-live="polite">Đang đọc dữ liệu từ Studio…</p>
        </div>
        <section id="insert-panel" role="tabpanel" aria-labelledby="tab-insert">
        <div class="limits"><div><label for="start-margin">Đoạn đầu không chèn (giây)</label><input id="start-margin" type="text" value="60" inputmode="numeric" autocomplete="off"></div><div><label for="end-margin">Đoạn cuối không chèn (giây)</label><input id="end-margin" type="text" value="60" inputmode="numeric" autocomplete="off"></div></div>
        <p class="help">Điểm đầu ở giây bạn nhập. Đoạn cuối được tính lùi từ cuối video. Có thể nhập 0.</p>
        <label for="interval">Khoảng cách giữa các điểm (giây)</label>
        <div class="stepper"><button id="decrease" type="button" aria-label="Giảm 1 giây" title="Giảm 1 giây">−</button><input id="interval" type="text" value="120" inputmode="numeric" autocomplete="off" spellcheck="false"><button id="increase" type="button" aria-label="Tăng 1 giây" title="Tăng 1 giây">+</button></div>
        <p class="help">Mỗi điểm mới cách điểm dự kiến trước đó theo số giây này.</p>
        <p class="help">Khi chèn, giữ mọi điểm có sẵn và giữ quảng cáo tự động.</p>
        <div class="actions"><button id="read">Xem trước</button><button id="start" class="primary" disabled>Chèn điểm</button></div>
        </section>
        <section id="cleanup-panel" role="tabpanel" aria-labelledby="tab-cleanup" hidden>
          <label for="minimum-spacing">Khoảng cách tối thiểu khi dọn (giây)</label><input id="minimum-spacing" type="text" value="120" inputmode="numeric" autocomplete="off">
          <p class="help">Xóa điểm thủ công Đang xem xét hoặc có cảnh báo đỏ, rồi lọc các điểm thủ công còn lại quá gần nhau. Giữ điểm sớm hơn; giữ mọi điểm tự động và điểm chưa rõ loại. Áp dụng cả điểm thủ công có sẵn.</p>
          <p class="help">Xem trước dọn tự đọc lại dữ liệu. Tải lại dữ liệu dùng khi bạn chỉ muốn cập nhật trạng thái.</p>
          <div class="actions"><button id="cleanup-read">Xem trước dọn</button><button id="cleanup-start" class="primary" disabled>Dọn điểm</button></div>
        </section>
        <button id="stop" hidden>Dừng</button>
        <div id="status" role="status" aria-live="polite">Mở Quản lý vị trí quảng cáo trong YouTube Studio, rồi bấm Xem trước.</div>
        <button id="copy-error" type="button" hidden>Sao chép thông tin lỗi</button>
        <p id="copy-status" role="status" hidden></p>
        <textarea id="error-details" readonly hidden aria-label="Thông tin lỗi để sao chép"></textarea>
        <section id="preview" hidden><p id="summary"></p><ul id="times" aria-label="Các điểm sẽ thêm"></ul></section>
        <footer>Có thể dùng ứng dụng khác khi chạy. Chrome hiện thanh thông báo điều khiển tab trong lúc chạy.<br>Sau khi chèn hoặc dọn, kiểm tra trong Studio rồi tự bấm Tiếp tục/Lưu.</footer>
      </main>
    </section>`;
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
  let durationController = null;
  let panelRoute = location.pathname;
  let touched = false;
  let statusRevision = 0;
  let lastError = "";
  let activeTab = "insert";

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
  function invalidate() {
    plan = null;
    cleanupPlan = null;
    adapter = null;
    $("start").disabled = true;
    $("cleanup-start").disabled = true;
    $("preview").hidden = true;
  }
  function busy(value) {
    for (const id of ["start-margin", "end-margin", "minimum-spacing", "tab-insert", "tab-cleanup"]) $(id).disabled = value;
    $("interval").disabled = value;
    $("decrease").disabled = value;
    $("increase").disabled = value;
    $("read").disabled = value || Boolean(durationController);
    $("load").disabled = value || Boolean(durationController);
    $("close").disabled = value;
    $("stop").hidden = !value;
    $("stop").disabled = false;
    $("start").disabled = value || !plan?.additions.length;
    $("cleanup-read").disabled = value || Boolean(durationController);
    $("cleanup-start").disabled = value || !cleanupPlan?.removals.length;
  }

  chrome.storage.local.get({ intervalSeconds: 120, startSeconds: 60, endMarginSeconds: 60, minimumSpacingSeconds: 120 }).then((saved) => {
    if (touched) return;
    for (const [id, name, minimum] of [["interval", "intervalSeconds", 1], ["start-margin", "startSeconds", 0], ["end-margin", "endMarginSeconds", 0], ["minimum-spacing", "minimumSpacingSeconds", 1]]) {
      if (/^\d+$/.test(String(saved[name])) && Number.isSafeInteger(Number(saved[name])) && Number(saved[name]) >= minimum) $(id).value = saved[name];
    }
  }).catch(() => {});
  for (const id of ["start-margin", "end-margin", "minimum-spacing"]) $(id).addEventListener("input", () => { touched = true; invalidate(); });
  function selectTab(next, focus = false) {
    if (controller || next === activeTab) return;
    activeTab = next;
    for (const name of ["insert", "cleanup"]) {
      const selected = name === next;
      $("tab-" + name).setAttribute("aria-selected", String(selected));
      $("tab-" + name).tabIndex = selected ? 0 : -1;
      $(name + "-panel").hidden = !selected;
    }
    if (focus) $("tab-" + next).focus();
    void refreshDuration(false);
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
  $("interval").addEventListener("input", () => { touched = true; invalidate(); });
  function stepInterval(direction) {
    if ($("interval").disabled) return;
    const text = $("interval").value.trim();
    const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1) {
      status("Nhập số giây nguyên lớn hơn 0 trước khi tăng hoặc giảm.", "error");
      $("interval").focus();
      return;
    }
    const next = Math.max(1, value + direction);
    if (!Number.isSafeInteger(next)) return;
    $("interval").value = String(next);
    $("interval").dispatchEvent(new Event("input", { bubbles: true }));
    $("interval").focus();
  }
  // No press-and-hold timer or native number spinner: one click, one step.
  $("decrease").addEventListener("click", () => stepInterval(-1));
  $("increase").addEventListener("click", () => stepInterval(1));
  $("interval").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (!event.repeat) stepInterval(event.key === "ArrowUp" ? 1 : -1);
  });
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
      $("data-summary").textContent = `${current.rows.length} điểm hiện có${cleaning ? ` · ${current.rows.filter((row) => row.kind === "manual" && row.warning).length} điểm thủ công có cảnh báo · ${current.rows.filter((row) => row.pending).length} điểm đang xem xét` : ""}.`;
      if (!preview) {
        status(cleaning ? "Đã đọc lại dữ liệu. Chọn khoảng cách tối thiểu rồi bấm Xem trước dọn." : "Đã đọc độ dài video. Chọn khoảng cách rồi bấm Xem trước.");
        return;
      }
      if (cleaning) {
        cleanupPlan = globalThis.MidrollCleanup.makePlan(current, $("minimum-spacing").value);
        chrome.storage.local.set({ minimumSpacingSeconds: cleanupPlan.spacing }).catch(() => {});
        $("summary").textContent = `Sẽ xóa ${cleanupPlan.removals.length}/${cleanupPlan.total} điểm · Giữ ${cleanupPlan.retained} điểm\nGiữ ${cleanupPlan.automatic} điểm tự động · ${cleanupPlan.unknown} điểm chưa rõ loại\nSẽ xóa ${cleanupPlan.reviewRemovals} điểm thủ công Đang xem xét\nKhoảng cách tối thiểu: ${cleanupPlan.spacing} giây (điểm tự động được giữ dù gần nhau).`;
        $("times").dataset.mode = "cleanup";
        $("times").setAttribute("aria-label", "Các điểm sẽ xóa và lý do");
        $("times").replaceChildren(...cleanupPlan.removals.map((target) => {
          const item = document.createElement("li"); item.textContent = `${target.raw} — ${target.reason}`; return item;
        }));
        $("preview").hidden = false;
        $("cleanup-start").disabled = cleanupPlan.removals.length === 0;
        const unknown = cleanupPlan.unknown ? `\nCó ${cleanupPlan.unknown} điểm chưa xác định được thủ công/tự động; giữ nguyên các điểm đó.` : "";
        status((cleanupPlan.removals.length ? "Kiểm tra danh sách sẽ xóa, rồi bấm Dọn điểm. Chưa thay đổi điểm nào." : "Không có điểm được nhận diện cần dọn.") + unknown, cleanupPlan.unknown && !cleanupPlan.removals.length ? "error" : "");
        return;
      }
      plan = { ...P.makePlan(current.duration, $("interval").value, current.times, { startSeconds: $("start-margin").value, endMarginSeconds: $("end-margin").value }), fingerprint: current.fingerprint };
      chrome.storage.local.set({ intervalSeconds: plan.interval, startSeconds: plan.start, endMarginSeconds: plan.endMargin }).catch(() => {});
      $("summary").textContent = `Thời lượng: ${P.formatTime(plan.duration)} (tự động)\nBắt đầu: ${P.formatTime(plan.start)} · Chừa cuối: ${plan.endMargin} giây\nGiữ ${plan.existing.length} điểm có sẵn · Bỏ qua ${plan.skipped.length} mốc gần/trùng\nSẽ thêm ${plan.additions.length} điểm:`;
      $("times").dataset.mode = "insert";
      $("times").setAttribute("aria-label", "Các điểm sẽ thêm");
      $("times").replaceChildren(...plan.additions.map((seconds) => {
        const item = document.createElement("li");
        item.textContent = P.formatTime(seconds);
        return item;
      }));
      $("preview").hidden = false;
      $("start").disabled = plan.additions.length === 0;
      status(plan.additions.length ? "Kiểm tra các mốc bên dưới, rồi bấm Chèn điểm." : "Các mốc dự kiến đều đã có điểm gần/trùng. Không cần thêm.");
    } catch (error) {
      if (reading.signal.aborted || durationController !== reading) return;
      invalidate();
      $("duration").textContent = knownDuration === null ? "Chưa đọc được" : P.formatTime(knownDuration);
      $("data-summary").textContent = knownDuration === null ? "Chưa đọc được dữ liệu mới." : "Đã đọc dữ liệu; kiểm tra lại cài đặt.";
      status(error.message, "error");
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
    if (!controller) { void refreshDuration(false); globalThis.MidrollFocusPanel(); }
    return true;
  };

  $("start").addEventListener("click", async () => {
    if (!plan || controller || activeTab !== "insert") return;
    const currentPlan = plan;
    const currentAdapter = adapter;
    controller = new AbortController();
    busy(true);
    let inserted = 0;
    status("Đang bật chế độ chạy nền cho tab Studio…");
    try {
      const result = await globalThis.MidrollBackgroundClient.run(({ signal }) => globalThis.MidrollRunner.runPlan(currentAdapter, currentPlan, {
        signal,
        onWaiting: ({ inserted: count, total, seconds, message }) => {
          status(`${message}\nĐã xác nhận ${count}/${total} điểm${Number.isFinite(seconds) ? ` · Mốc đang xử lý: ${P.formatTime(seconds)}` : ""}. Chưa lưu.`);
        },
        onProgress: (progress) => {
          inserted = progress.inserted;
          status(`Đã thêm ${progress.inserted}/${progress.total} điểm. Mốc vừa xử lý: ${P.formatTime(progress.seconds)}.\nChưa lưu thay đổi.`);
        }
      }), { signal: controller.signal });
      status(`Đã xác nhận thêm ${result.inserted} điểm; giữ các điểm cũ.${result.skipped ? ` Bỏ qua thêm ${result.skipped} mốc đã có.` : ""}\nBạn hãy kiểm tra trong Studio, rồi tự bấm Tiếp tục/Lưu.`, "success");
    } catch (error) {
      const stopped = error.name === "AbortError";
      status(`${stopped ? "Đã dừng theo yêu cầu." : error.message}\nĐã xác nhận thêm ${inserted} điểm; chưa lưu. Kiểm tra cả điểm cuối đang nhập. Các điểm đã thêm vẫn nằm trong bản chỉnh sửa Studio.`, stopped ? "" : "error");
    } finally {
      controller = null;
      invalidate();
      busy(false);
    }
  });
  $("cleanup-start").addEventListener("click", async () => {
    if (!cleanupPlan || controller || activeTab !== "cleanup") return;
    const currentPlan = cleanupPlan, currentAdapter = adapter;
    controller = new AbortController();
    busy(true);
    let removed = 0;
    status("Đang bật chế độ chạy nền để dọn điểm…");
    try {
      const result = await globalThis.MidrollBackgroundClient.run(({ signal }) => globalThis.MidrollCleanup.runPlan(currentAdapter, currentPlan, {
        signal,
        onWaiting: (progress) => status(`${progress.message}\nĐã xác nhận xóa ${progress.removed}/${progress.total} điểm. Chưa lưu.`),
        onProgress: (progress) => { removed = progress.removed; status(`Đã xác nhận xóa ${removed}/${progress.total} điểm · ${P.formatTime(progress.seconds)}.\nChưa lưu thay đổi.`); }
      }), { signal: controller.signal });
      status(`Đã xác nhận xóa ${result.removed} điểm thủ công; giữ các điểm khác và điểm tự động.\nBạn hãy kiểm tra trong Studio, rồi tự bấm Tiếp tục/Lưu.`, "success");
    } catch (error) {
      status(`${error.name === "AbortError" ? `Đã dừng theo yêu cầu.${error.pendingRemoved ? ` Đã bấm xóa ${error.pendingRemoved} điểm trong nhóm đang xử lý; chưa xác nhận nhóm.` : ""}` : error.message}\nĐã xác nhận xóa ${removed} điểm; chưa lưu. Kiểm tra cả nhóm đang xử lý.`, error.name === "AbortError" ? "" : "error");
    } finally {
      controller = null;
      invalidate(); busy(false);
    }
  });
  $("stop").addEventListener("click", () => {
    controller?.abort();
    $("stop").disabled = true;
    status("Đang dừng… Chưa lưu; các thay đổi vẫn nằm trong bản chỉnh sửa.");
  });
  $("copy-error").addEventListener("click", async () => {
    if (!lastError || controller) return;
    const current = statusRevision;
    let studio;
    try { studio = globalThis.MidrollStudio.diagnostics(); } catch { studio = { available: false }; }
    const interval = $("interval").value.trim();
    const report = { version: "0.1.14", message: lastError, intervalSeconds: /^\d+$/.test(interval) ? interval : null, studio };
    $("copy-error").disabled = true;
    const copied = await globalThis.MidrollErrorCopy.copy(JSON.stringify(report, null, 2), $("error-details"), () => current === statusRevision);
    if (current !== statusRevision) return;
    $("copy-error").disabled = false;
    $("copy-status").hidden = false;
    $("copy-status").textContent = copied ? "Đã sao chép. Bạn có thể dán thông tin khi báo lỗi." : "Chưa sao chép được. Nhấn Ctrl+C để sao chép phần thông tin đang được chọn.";
  });
  $("interval").focus();
  void refreshDuration(false);
})();
