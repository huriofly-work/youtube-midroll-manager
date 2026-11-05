(function (root) {
  "use strict";
  async function runPlan(adapter, plan, { signal, checkpoint, onProgress = () => {}, onWaiting = () => {}, onStage = () => {} } = {}) {
    onStage({ phase: "checking", points: [] });
    let inserted = 0;
    let skipped = 0;
    const baseline = adapter.snapshot();
    const expected = [...baseline.keys];
    const checkAutomatic = (snapshot) => {
      if (snapshot.automaticSignature !== baseline.automaticSignature) throw Object.assign(new Error("Cài đặt quảng cáo tự động đã thay đổi trong lúc chèn. Đã dừng; kiểm tra trước khi lưu."), { code: "automatic-changed" });
    };
    if (baseline.fingerprint !== plan.fingerprint) throw Object.assign(new Error("Video hoặc danh sách quảng cáo đã đổi. Hãy bấm Xem trước lại."), { code: "snapshot-changed" });
    for (const seconds of plan.additions) {
      if (checkpoint) await checkpoint({ signal });
      signal?.throwIfAborted();
      const before = adapter.snapshot();
      checkAutomatic(before);
      if (!root.MidrollPlanner.preserves(expected, before.keys)) {
        throw new Error("Danh sách quảng cáo đã thay đổi trong lúc chèn. Đã dừng; hãy kiểm tra các mốc trong Studio.");
      }
      if (before.times.some((time) => Math.abs(time - seconds) <= root.MidrollPlanner.DUPLICATE_WINDOW)) {
        skipped++;
        onProgress({ inserted, skipped, total: plan.additions.length, seconds });
        continue;
      }
      // insert() only edits a newly created row. It never saves, deletes,
      // changes automatic ads, or rewrites an existing row.
      onStage({ phase: "processing", points: [seconds] });
      await adapter.insert(seconds, { signal, expectedAutomaticSignature: baseline.automaticSignature, onWaiting: (message) => onWaiting({ inserted, total: plan.additions.length, seconds, message }) });
      const after = adapter.snapshot();
      checkAutomatic(after);
      if (!root.MidrollPlanner.preserves(before.keys, after.keys) || after.keys.length !== before.keys.length + 1) {
        throw Object.assign(new Error("Không xác nhận được việc giữ nguyên các điểm cũ. Đã dừng; chưa lưu. Hãy kiểm tra Studio."), { code: "preservation-failed" });
      }
      if (!after.times.some((time) => time === seconds)) throw new Error("Studio chưa xác nhận mốc vừa nhập. Đã dừng; chưa lưu.");
      expected.splice(0, expected.length, ...after.keys);
      inserted++;
      onProgress({ inserted, skipped, total: plan.additions.length, seconds });
      onStage({ phase: "checking", points: [] });
    }
    if (checkpoint) await checkpoint({ signal });
    signal?.throwIfAborted();
    onStage({ phase: "verifying", points: [] });
    if (adapter.verifyPlan) await adapter.verifyPlan(plan, { signal, onWaiting: (message) => onWaiting({ inserted, total: plan.additions.length, message }) });
    const final = adapter.snapshot();
    checkAutomatic(final);
    if (!root.MidrollPlanner.preserves(expected, final.keys)) throw new Error("Studio đã thay đổi mốc sau khi nhập. Đã dừng; kiểm tra toàn bộ danh sách trước khi lưu.");
    if (!plan.additions.every((seconds) => final.times.some((time) => Math.abs(time - seconds) <= root.MidrollPlanner.DUPLICATE_WINDOW))) {
      throw new Error("Danh sách cuối còn thiếu mốc dự kiến. Chưa lưu; hãy bấm Xem trước để kiểm tra lại.");
    }
    return { inserted, skipped };
  }
  root.MidrollRunner = { runPlan };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MidrollRunner;
})(globalThis);
