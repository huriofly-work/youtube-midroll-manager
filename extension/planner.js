(function (root) {
  "use strict";
  const START = 60;
  const END_MARGIN = 60;
  const MIN_DURATION = 480;
  const MAX_POINTS = 1000;
  const DUPLICATE_WINDOW = 1;

  function parseTime(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{1,4}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?$/.test(text)) return null;
    const [whole, fraction = ""] = text.replace(",", ".").split(".");
    const parts = whole.split(":").map(Number);
    if (parts.slice(1).some((p) => p >= 60)) return null;
    return parts.reduce((sum, part) => sum * 60 + part, 0) + (fraction ? Number(`0.${fraction}`) : 0);
  }

  // Studio ad fields use M:SS:subsecond (e.g. 1:07:17), unlike a normal
  // H:MM:SS duration. Four-part fields use H:MM:SS:subsecond. Compare whole
  // seconds conservatively: no frame rate is assumed and old text is kept.
  function readStudioTime(value) {
    const text = String(value ?? "").trim();
    if (/^\d{1,4}:\d{2}:\d{2}:\d{2}$/.test(text)) return parseTime(text.slice(0, -3));
    if (/^\d{1,4}:\d{2}:\d{2}$/.test(text)) {
      const [minutes, seconds] = text.split(":").map(Number);
      return seconds < 60 ? minutes * 60 + seconds : null;
    }
    return parseTime(text);
  }

  function formatTime(seconds) {
    const value = Math.floor(seconds);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const rest = value % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`;
  }

  function formatLike(seconds, sample) {
    const full = formatTime(seconds);
    const text = String(sample).trim();
    if (/^\d{2,4}:\d{2}:\d{2}:\d{2}$/.test(text)) return `${full}:00`;
    const parts = text.split(/[.,]/)[0].split(":").length;
    let result = parts === 2 ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${full.slice(-2)}` : full;
    const fraction = text.match(/([.,])(\d{1,3})$/);
    if (fraction) result += fraction[1] + "0".repeat(fraction[2].length);
    return result;
  }

  function formatStudioTime(seconds, sample) {
    const text = String(sample).trim();
    if (/^\d{1,4}:\d{2}:\d{2}:\d{2}$/.test(text)) return `${formatTime(seconds)}:00`;
    if (/^\d{1,4}:\d{2}:\d{2}$/.test(text)) {
      const whole = Math.floor(seconds);
      const minutes = String(Math.floor(whole / 60)).padStart(text.split(":")[0].length, "0");
      return `${minutes}:${String(whole % 60).padStart(2, "0")}:00`;
    }
    return formatLike(seconds, sample);
  }

  function secondsSetting(value, label, allowZero = false) {
    const text = String(value ?? "").trim();
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < (allowZero ? 0 : 1)) {
      throw new Error(`${label} phải là số giây nguyên ${allowZero ? "từ 0 trở lên" : "lớn hơn 0"}.`);
    }
    return Number(text);
  }

  function makePlan(duration, interval, existing = [], options = {}) {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Chưa đọc được tổng độ dài video. Hãy tải lại Studio, mở Quản lý vị trí quảng cáo rồi bấm Xem trước để tự đọc lại.");
    if (duration < MIN_DURATION) throw new Error("Video ngắn hơn 8 phút, không thuộc phạm vi quảng cáo giữa video của extension.");
    const raw = String(interval).trim();
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) {
      throw new Error("Khoảng cách phải là số giây nguyên lớn hơn 0.");
    }
    const step = Number(raw);
    const start = secondsSetting(options.startSeconds ?? START, "Đoạn đầu không chèn", true);
    const endMargin = secondsSetting(options.endMarginSeconds ?? END_MARGIN, "Đoạn cuối không chèn", true);
    if (start + endMargin >= duration) throw new Error("Tổng đoạn đầu và đoạn cuối phải nhỏ hơn độ dài video.");
    if (!Array.isArray(existing) || existing.some((s) => !Number.isFinite(s) || s < 0 || s > duration)) {
      throw new Error("Không đọc được đầy đủ các mốc quảng cáo hiện có. Extension dừng để bạn kiểm tra.");
    }
    // Even with a zero end margin, never insert at the exact end of a video.
    const end = Math.min(duration - endMargin, Math.ceil(duration) - 1);
    const count = Math.max(0, Math.floor((end - start) / step) + 1);
    if (count > MAX_POINTS) throw new Error(`Có hơn ${MAX_POINTS} mốc dự kiến. Hãy tăng khoảng cách để chia việc chèn thành số lượng hợp lý.`);
    const proposed = Array.from({ length: count }, (_, index) => start + index * step);
    const ordered = [...existing].sort((a, b) => a - b);
    const skipped = [], additions = [];
    let index = 0;
    for (const seconds of proposed) {
      while (index < ordered.length && ordered[index] < seconds - DUPLICATE_WINDOW) index++;
      (index < ordered.length && ordered[index] <= seconds + DUPLICATE_WINDOW ? skipped : additions).push(seconds);
    }
    return { duration, interval: step, start, endMargin, end, existing: [...existing], proposed, skipped, additions };
  }

  function preserves(before, after) {
    const remaining = new Map();
    for (const value of after) remaining.set(value, (remaining.get(value) || 0) + 1);
    for (const value of before) {
      const count = remaining.get(value) || 0;
      if (!count) return false;
      remaining.set(value, count - 1);
    }
    return true;
  }

  // Return the one extra occurrence, not just a value absent from before.
  // Duplicate timecodes are valid; every old occurrence must still exist.
  function additionalKey(before, after) {
    if (after.length !== before.length + 1) return null;
    const counts = new Map();
    for (const key of before) counts.set(key, (counts.get(key) || 0) + 1);
    let extra = null;
    for (const key of after) {
      const count = counts.get(key) || 0;
      if (count) counts.set(key, count - 1);
      else if (extra === null) extra = key;
      else return null;
    }
    return [...counts.values()].every((count) => count === 0) ? extra : null;
  }

  const api = { START, END_MARGIN, MIN_DURATION, MAX_POINTS, DUPLICATE_WINDOW, parseTime, readStudioTime, formatTime, formatLike, formatStudioTime, secondsSetting, makePlan, preserves, additionalKey };
  root.MidrollPlanner = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
