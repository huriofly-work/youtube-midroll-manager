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

  function makePlan(snapshot, minimum) {
    const spacing = root.MidrollPlanner.secondsSetting(minimum, "Khoảng cách tối thiểu");
    const rows = snapshot.rows;
    if (!Number.isFinite(snapshot.duration) || snapshot.duration <= 0 || !Array.isArray(rows) || rows.some((row) => !Number.isFinite(row.seconds) || row.seconds < 0 || row.seconds > snapshot.duration)) {
      throw new Error("Không đọc được đầy đủ thời gian các điểm; chưa dọn điểm nào.");
    }
    const removals = [];
    const automatic = rows.filter((row) => row.kind === "automatic").sort(compare);
    const eligible = rows.filter((row) => row.kind === "manual");
    for (const row of eligible.filter((row) => row.pending || row.warning)) removals.push({ key: key(row), raw: row.raw, seconds: row.seconds, reason: row.pending ? "Đang xem xét" : "Cảnh báo của YouTube" });
    const suitable = eligible.filter((row) => !row.pending && !row.warning);
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
      fingerprint: snapshot.cleanupFingerprint, spacing,
      removals: removals.sort(compare),
      automatic: automatic.length, unknown: rows.filter((row) => row.kind === "unknown").length,
      pending: rows.filter((row) => row.pending).length,
      reviewRemovals: eligible.filter((row) => row.pending).length,
      total: rows.length, retained: rows.length - removals.length
    };
  }

  async function runPlan(adapter, plan, { signal, onProgress = () => {}, onWaiting = () => {} } = {}) {
    let removed = 0;
    let expected = plan.fingerprint;
    if (adapter.removePoints) {
      for (let offset = 0; offset < plan.removals.length; offset += 5) {
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
      }
      signal?.throwIfAborted();
      if (adapter.verifyCleanup) await adapter.verifyCleanup(expected, { signal });
      if (adapter.cleanupSnapshot().cleanupFingerprint !== expected) throw new Error("Danh sách cuối đã thay đổi. Kiểm tra lại trước khi lưu.");
      return { removed };
    }
    for (const target of plan.removals) {
      signal?.throwIfAborted();
      const before = adapter.cleanupSnapshot();
      const beforeCount = before.rows.length;
      if (before.cleanupFingerprint !== expected) throw new Error("Danh sách hoặc cảnh báo đã thay đổi. Hãy Xem trước dọn lại; chưa xóa điểm tiếp theo.");
      const index = before.rows.findIndex((row) => key(row) === target.key && row.kind === "manual" && row.canRemove !== false);
      if (index < 0) throw new Error("Không xác định chắc chắn điểm thủ công cần xóa. Đã dừng.");
      const remaining = before.rows.filter((_, i) => i !== index);
      const expectedSignature = signature(remaining);
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
    }
    signal?.throwIfAborted();
    if (adapter.verifyCleanup) await adapter.verifyCleanup(expected, { signal });
    if (adapter.cleanupSnapshot().cleanupFingerprint !== expected) throw new Error("Danh sách cuối đã thay đổi. Kiểm tra lại trước khi lưu.");
    return { removed };
  }
  root.MidrollCleanup = { key, signature, makePlan, runPlan };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MidrollCleanup;
})(globalThis);
