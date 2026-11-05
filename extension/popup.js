(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const VERSION = globalThis.chrome?.runtime?.getManifest?.()?.version || "0.1.21";
  $("version").textContent = `v${VERSION}`;
  let revision = 0;
  let report = null;
  async function openPanel() {
    const current = ++revision;
    report = null;
    $("status").textContent = "Đang kiểm tra trang đang mở…";
    $("status").dataset.tone = "";
    for (const id of ["guide", "retry", "copy-error", "copy-status", "error-details"]) $(id).hidden = true;
    $("copy-error").disabled = false;
    try {
      const result = await chrome.runtime.sendMessage({ type: "MIDROLL_OPEN_PANEL" });
      if (revision !== current) return;
      if (result?.ok) { window.close(); return; }
      $("status").textContent = result?.message || "Chưa mở được bảng điều khiển. Hãy tải lại extension rồi thử lại.";
      $("guide").hidden = false;
      if (result?.kind !== "instruction") {
        $("status").dataset.tone = "error";
        $("retry").hidden = false;
        $("copy-error").hidden = false;
        report = { version: VERSION, message: $("status").textContent, stage: "open-panel" };
      }
    } catch {
      if (revision !== current) return;
      $("status").textContent = "Không kết nối được với extension. Hãy tải lại extension rồi thử lại.";
      $("status").dataset.tone = "error";
      $("guide").hidden = false;
      $("retry").hidden = false;
      $("copy-error").hidden = false;
      report = { version: VERSION, message: $("status").textContent, stage: "open-panel" };
    }
  }
  $("retry").addEventListener("click", () => { void openPanel(); });
  $("copy-error").addEventListener("click", async () => {
    if (!report) return;
    const current = revision;
    $("copy-error").disabled = true;
    const copied = await MidrollErrorCopy.copy(JSON.stringify(report, null, 2), $("error-details"), () => current === revision);
    if (current !== revision) return;
    $("copy-error").disabled = false;
    $("copy-status").hidden = false;
    $("copy-status").textContent = copied ? "Đã sao chép. Bạn có thể dán thông tin khi báo lỗi." : "Chưa sao chép được. Nhấn Ctrl+C để sao chép phần thông tin đang được chọn.";
  });
  void openPanel();
})();
