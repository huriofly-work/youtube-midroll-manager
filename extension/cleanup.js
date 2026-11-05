(function (root) {
  "use strict";
  const key = (row) => JSON.stringify([row.raw, row.kind, row.kind === "manual" && Boolean(row.warning), row.kind === "manual" && Boolean(row.pending)]);
  const signature = (rows) => JSON.stringify(rows.map(key).sort());
  const counter = (row) => /^\d{1,4}:\d{2}(?::\d{2})?:\d{2}$/.test(row.raw) ? Number(row.raw.split(":").at(-1)) : 0;
  const compare = (a, b) => a.seconds - b.seconds || counter(a) - counter(b);
  function tooClose(a, b, spacing) {
    const difference = Math.abs(a.seconds - b.seconds);
    if (difference !== spacing) return difference < spacing;
    // Compare the subsecond counters at an integer-second boundary without
    // inventing a frame rate. A later counter below the earlier one is short.
    const [earlier, later] = a.seconds < b.seconds ? [a, b] : [b, a];
    return counter(later) < counter(earlier);
  }

  function makePlan(snapshot, minimum, options = {}) {
    const spacing = root.MidrollPlanner.secondsSetting(minimum, "Khoảng cách tối thiểu");
    const start = root.MidrollPlanner.secondsSetting(options.startSeconds ?? 0, "Đoạn đầu khi dọn", true);
    const endMargin = root.MidrollPlanner.secondsSetting(options.endMarginSeconds ?? 0, "Đoạn cuối khi dọn", true);
    const rows = snapshot.rows;
    if (!Number.isFinite(snapshot.duration) || snapshot.duration <= 0 || !Array.isArray(rows) || rows.some((row) => !Number.isFinite(row.seconds) || row.seconds < 0 || row.seconds > snapshot.duration)) {
      throw new Error("Không đọc được đầy đủ thời gian các điểm; chưa dọn điểm nào.");
    }
    if (start + endMargin >= snapshot.duration) throw new Error("Tổng đoạn đầu và đoạn cuối phải nhỏ hơn độ dài video. Chưa dọn điểm nào.");
    const end = snapshot.duration - endMargin;
    const removals = [];
    const automatic = rows.filter((row) => row.kind === "automatic").sort(compare);
    const eligible = rows.filter((row) => row.kind === "manual");
    const suitable = [];
    let marginRemovals = 0;
    for (const row of eligible) {
      let reason = row.pending ? "Đang xem xét" : row.warning ? "Cảnh báo của YouTube" : null;
      if (!reason && start > 0 && row.seconds < start) reason = "Trong đoạn đầu không chèn";
      if (!reason && endMargin > 0) {
        // Studio's unknown-unit counter cannot locate a slot relative to
        // a fractional-second cutoff in the same whole second.
        if (!Number.isInteger(end) && counter(row) > 0 && row.seconds === Math.floor(end)) {
          throw new Error("Không xác định chắc chắn phần nhỏ giây tại ranh giới đoạn cuối. Chưa dọn điểm nào; hãy kiểm tra thời gian trong Studio.");
        }
        if (row.seconds > end || (row.seconds === end && counter(row) > 0)) reason = "Trong đoạn cuối không chèn";
      }
      if (reason) {
        if (reason.startsWith("Trong đoạn")) marginRemovals++;
        removals.push({ key: key(row), raw: row.raw, seconds: row.seconds, reason });
      } else suitable.push(row);
    }
    const spacingRows = [...automatic, ...suitable];
    // Frame counters have an unknown unit. Mixing nonzero counters with
    // decimal seconds makes the actual order/gap unknowable without FPS.
    if (spacingRows.some((row) => counter(row) > 0) && spacingRows.some((row) => !Number.isInteger(row.seconds))) {
      throw new Error("Không so sánh chắc chắn được các mốc dùng phần nhỏ giây khác định dạng. Chưa dọn điểm nào; hãy kiểm tra định dạng thời gian trong Studio.");
    }
    const retained = [];
    let autoIndex = 0;
    for (const row of suitable.sort(compare)) {
      while (autoIndex < automatic.length && compare(automatic[autoIndex], row) < 0) autoIndex++;
      const neighbor = [automatic[autoIndex - 1], automatic[autoIndex], retained.at(-1)].find((kept) => kept && tooClose(kept, row, spacing));
      if (neighbor) removals.push({ key: key(row), raw: row.raw, seconds: row.seconds, reason: `Quá gần ${neighbor.raw}${neighbor.kind === "automatic" ? " (tự động)" : ""}` });
      else retained.push(row);
    }
    const unavailable = new Set(rows.filter((row) => row.canRemove === false).map(key));
    if (removals.some((target) => unavailable.has(target.key))) throw new Error("Một điểm thủ công cần dọn không có nút Xóa khả dụng. Chưa xóa điểm nào; hãy kiểm tra Studio và Xem trước dọn lại.");
    return {
      fingerprint: snapshot.cleanupFingerprint, spacing, start, endMargin, end, marginRemovals,
      removals: removals.sort(compare),
      automatic: automatic.length, unknown: rows.filter((row) => row.kind === "unknown").length,
      pending: rows.filter((row) => row.pending).length,
      reviewRemovals: eligible.filter((row) => row.pending).length,
      total: rows.length, retained: rows.length - removals.length
    };
  }

  async function runPlan(adapter, plan, { signal, checkpoint, onProgress = () => {}, onWaiting = () => {}, onStage = () => {} } = {}) {
    onStage({ phase: "checking", points: [] });
    let removed = 0;
    let expected = plan.fingerprint;
    if (adapter.removePoints) {
      for (let offset = 0; offset < plan.removals.length; offset += 5) {
        if (checkpoint) await checkpoint({ signal });
        signal?.throwIfAborted();
        const targets = plan.removals.slice(offset, offset + 5);
        const before = adapter.cleanupSnapshot();
        if (before.cleanupFingerprint !== expected) throw new Error("Danh sách hoặc cảnh báo đã thay đổi. Hãy Xem trước dọn lại; chưa xóa nhóm tiếp theo.");
        const remaining = [...before.rows];
        for (const target of targets) {
          const index = remaining.findIndex((row) => key(row) === target.key && row.kind === "manual" && row.canRemove !== false);
          if (index < 0) throw new Error("Không xác định chắc chắn toàn bộ điểm thủ công trong nhóm dọn. Chưa xóa nhóm này.");
          remaining.splice(index, 1);
        }
        onStage({ phase: "processing", points: targets.map((t) => t.seconds) });
        const result = await adapter.removePoints(targets, {
          signal, expectedFingerprint: expected,
          onWaiting: (message) => onWaiting({ removed, total: plan.removals.length, message })
        });
        const after = adapter.cleanupSnapshot();
        if (result?.removed !== targets.length || after.rows.length !== remaining.length || signature(after.rows) !== signature(remaining)) {
          throw new Error("Không xác nhận được đúng nhóm đã xóa và các điểm khác được giữ nguyên. Đã dừng; chưa lưu.");
        }
        expected = after.cleanupFingerprint;
        removed += targets.length;
        onProgress({ removed, total: plan.removals.length, seconds: targets.at(-1).seconds });
        onStage({ phase: "checking", points: [] });
      }
      if (checkpoint) await checkpoint({ signal });
      signal?.throwIfAborted();
      onStage({ phase: "verifying", points: [] });
      if (adapter.verifyCleanup) await adapter.verifyCleanup(expected, { signal });
      if (adapter.cleanupSnapshot().cleanupFingerprint !== expected) throw new Error("Danh sách cuối đã thay đổi. Kiểm tra lại trước khi lưu.");
      return { removed };
    }
    for (const target of plan.removals) {
      if (checkpoint) await checkpoint({ signal });
      signal?.throwIfAborted();
      const before = adapter.cleanupSnapshot();
      const beforeCount = before.rows.length;
      if (before.cleanupFingerprint !== expected) throw new Error("Danh sách hoặc cảnh báo đã thay đổi. Hãy Xem trước dọn lại; chưa xóa điểm tiếp theo.");
      const index = before.rows.findIndex((row) => key(row) === target.key && row.kind === "manual" && row.canRemove !== false);
      if (index < 0) throw new Error("Không xác định chắc chắn điểm thủ công cần xóa. Đã dừng.");
      const remaining = before.rows.filter((_, i) => i !== index);
      const expectedSignature = signature(remaining);
      onStage({ phase: "processing", points: [target.seconds] });
      await adapter.removePoint(target.key, {
        signal, expectedFingerprint: expected,
        onWaiting: (message) => onWaiting({ removed, total: plan.removals.length, message })
      });
      const after = adapter.cleanupSnapshot();
      if (signature(after.rows) !== expectedSignature || after.rows.length !== beforeCount - 1) {
        throw new Error("Không xác nhận được đúng một điểm đã xóa và các điểm còn lại được giữ nguyên. Đã dừng; chưa lưu.");
      }
      expected = after.cleanupFingerprint;
      removed++;
      onProgress({ removed, total: plan.removals.length, seconds: target.seconds });
      onStage({ phase: "checking", points: [] });
    }
    if (checkpoint) await checkpoint({ signal });
    signal?.throwIfAborted();
    onStage({ phase: "verifying", points: [] });
    if (adapter.verifyCleanup) await adapter.verifyCleanup(expected, { signal });
    if (adapter.cleanupSnapshot().cleanupFingerprint !== expected) throw new Error("Danh sách cuối đã thay đổi. Kiểm tra lại trước khi lưu.");
    return { removed };
  }
  root.MidrollCleanup = { key, signature, makePlan, runPlan };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MidrollCleanup;
})(globalThis);
