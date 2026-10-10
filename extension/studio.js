(function (root) {
  "use strict";
  const P = root.MidrollPlanner;
  const BUTTONS = 'button, [role="button"], ytcp-button, ytcp-icon-button';
  const INPUTS = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea';
  const INSERT = /^(?:chen|them) (?:(?:vi tri|diem) )?quang cao$|^insert ad (?:slot|break)$/;
  const REMOVE = /^xoa(?: (?:vi tri|diem)?\s*quang cao.*)?$|^delete(?: ad (?:slot|break).*)?$|^remove ad (?:slot|break).*$/;
  let lastInsertion = null;

  function normalize(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/^\s*\+\s*/, "").replace(/\s+/g, " ").trim();
  }

  function parent(element) {
    return element.parentElement || element.getRootNode()?.host || null;
  }

  function inside(element, ancestor) {
    for (let current = element; current; current = parent(current)) if (current === ancestor) return true;
    return false;
  }

  function query(scope, selector) {
    const result = [];
    function walk(node) {
      const all = node.querySelectorAll("*");
      result.push(...(selector === "*" ? all : node.querySelectorAll(selector)));
      for (const element of all) {
        if (element.id === "midroll-helper-host") continue;
        if (element.shadowRoot) walk(element.shadowRoot);
      }
    }
    walk(scope);
    return result.filter((element) => {
      for (let current = element; current; current = parent(current)) {
        if (current.id === "midroll-helper-host") return false;
      }
      return true;
    });
  }

  function isVisible(element, styles, ignoreAriaHidden = false) {
    if (!element.isConnected) return false;
    for (let current = element; current; current = parent(current)) {
      if (current.hidden || (!ignoreAriaHidden && current.getAttribute("aria-hidden") === "true")) return false;
      const style = styles?.get(current) || getComputedStyle(current);
      styles?.set(current, style);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    if (element.getClientRects().length > 0) return true;
    // Some dialog shells use display:contents and do not have their own box.
    return getComputedStyle(element).display === "contents" && [...element.children].some((child) => isVisible(child, styles, ignoreAriaHidden));
  }
  const visible = (element) => isVisible(element);

  function matchesLabel(element, pattern) {
    return [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
      .some((text) => pattern.test(normalize(text)));
  }

  function buttons(scope, pattern, styles, controls) {
    const found = (controls ? controls.filter((node) => node.matches(BUTTONS)) : query(scope, BUTTONS)).filter((element) => matchesLabel(element, pattern) && isVisible(element, styles));
    // Polymer buttons can contain a native button with the same label.
    const matched = new Set(found);
    const ancestors = new Set();
    for (const element of found) {
      for (let ancestor = parent(element); ancestor; ancestor = parent(ancestor)) {
        if (matched.has(ancestor)) ancestors.add(ancestor);
      }
    }
    return found.filter((element) => !ancestors.has(element));
  }

  function enabled(element) {
    if (!element) return false;
    for (let current = element; current; current = parent(current)) {
      if (current.disabled || current.hasAttribute("disabled") || current.getAttribute("aria-disabled") === "true") return false;
    }
    return true;
  }

  function editorScope() {
    const insertButtons = buttons(document, INSERT);
    if (insertButtons.length !== 1) throw new Error("Hãy mở Kiếm tiền → Quản lý vị trí quảng cáo, để nút Chèn vị trí quảng cáo xuất hiện. Nếu đã mở, giao diện này chưa được nhận diện.");
    const insert = insertButtons[0];
    let current = parent(insert);
    while (current && current !== document.body) {
      if (current.getAttribute("role") === "dialog" || ["ytcp-dialog", "dialog", "tp-yt-paper-dialog", "paper-dialog"].includes(current.localName) || /ad-breaks.*(?:dialog|editor)|(?:dialog|editor).*ad-breaks/.test(current.localName)) {
        return { scope: current, insert };
      }
      current = parent(current);
    }
    throw new Error("Chưa nhận diện được hộp quản lý vị trí quảng cáo. Hãy mở hộp này trước khi chạy extension.");
  }

  const readControls = (scope) => query(scope, `input, textarea, ${BUTTONS}, [role="checkbox"]`);
  const isRow = (node) => /(?:^|[\s-])(?:ad-break(?:-row|-item)?|ad-row)(?:\s|$)/.test(node.localName + " " + node.getAttribute("class"));

  function fields(scope, styles, controls) {
    return (controls ? controls.filter((node) => node.matches(INPUTS)) : query(scope, INPUTS)).filter((element) => P.readStudioTime(element.value) !== null && isVisible(element, styles));
  }

  function adRows(scope, controls = readControls(scope)) {
    // Index controls once per read, including shadow ancestry. No cache is
    // retained across reads: DOM replacements and changed values stay visible.
    const styles = new WeakMap();
    const candidates = fields(scope, styles, controls);
    const removes = buttons(scope, REMOVE, styles, controls);
    const fieldCounts = new Map();
    const removeGroups = new Map();
    for (const input of candidates) {
      for (let container = parent(input); container && container !== scope; container = parent(container)) {
        fieldCounts.set(container, (fieldCounts.get(container) || 0) + 1);
      }
    }
    for (const remove of removes) {
      for (let container = parent(remove); container && container !== scope; container = parent(container)) {
        const group = removeGroups.get(container);
        if (group) group.push(remove); else removeGroups.set(container, [remove]);
      }
    }
    const rows = [];
    const pairedInputs = new Set();
    for (const input of candidates) {
      let standalone = null;
      for (let container = parent(input); container && container !== scope; container = parent(container)) {
        if (isRow(container) && fieldCounts.get(container) === 1) standalone = container;
        const deletes = removeGroups.get(container) || [];
        if (deletes.length === 1 && fieldCounts.get(container) === 1) {
          rows.push({ element: container, input, remove: deletes[0], raw: input.value.trim(), seconds: P.readStudioTime(input.value) });
          pairedInputs.add(input);
          break;
        }
        if (deletes.length > 1) break;
      }
      if (!pairedInputs.has(input) && standalone && !(removeGroups.get(standalone)?.length)) {
        rows.push({ element: standalone, input, remove: null, raw: input.value.trim(), seconds: P.readStudioTime(input.value) });
      }
    }
    const removable = rows.filter((row) => row.remove);
    if (removes.length !== removable.length || new Set(removable.map((row) => row.remove)).size !== removable.length) {
      throw Object.assign(new Error("Không đọc được toàn bộ các ô thời gian quảng cáo hiện có. Extension chưa hỗ trợ cấu trúc này; chưa thay đổi điểm nào."), { code: "incomplete-ad-list" });
    }
    for (const row of rows) {
      for (let node = row.element; node && node !== scope; node = parent(node)) {
        const size = Number(node.getAttribute("aria-setsize"));
        if (Number.isInteger(size) && size > rows.length) throw Object.assign(new Error("Studio chỉ tải một phần danh sách quảng cáo. Chưa thay đổi điểm nào; không thể xử lý danh sách chưa đầy đủ."), { code: "incomplete-ad-list" });
      }
    }
    return rows;
  }

  function automaticState(controls, rows) {
    const pattern = /(?:quang cao|vi tri|diem).*tu dong|automatic(?:ally)? (?:ad|mid)/;
    const candidates = controls.filter((node) => node.matches('input[type="checkbox"], [role="checkbox"]') && visible(node) && !rows.some((row) => inside(node, row.element)));
    const native = candidates.filter((node) => node.matches('input[type="checkbox"]'));
    const states = candidates.filter((node) => !native.some((input) => input !== node && inside(input, node))).flatMap((node) => {
      const labels = [node.getAttribute("aria-label"), node.getAttribute("title"), ...(node.labels ? [...node.labels].map((label) => label.textContent) : []), node.localName === "input" ? "" : node.textContent];
      const label = labels.map(normalize).find((text) => pattern.test(text));
      if (!label) return [];
      const checked = node.localName === "input" ? String(node.checked) : node.getAttribute("aria-checked");
      if (!["true", "false"].includes(checked)) throw new Error("Chưa đọc được trạng thái quảng cáo tự động. Chưa thay đổi điểm nào.");
      return [JSON.stringify([label, checked])];
    });
    return JSON.stringify(states.sort());
  }

  function cleanupRows(scope, rows, selectedRow) {
    const manual = /\bthu cong\b|\bmanual\b/;
    const automatic = /\btu dong\b|\bautomatic(?:ally)?\b|\bauto(?:matic)?[-_ ]ad/;
    const poor = /it co kha nang (?:phan phat|hien thi|chay) quang cao|khong phu hop|unlikely to (?:serve|show) ads|low (?:ad )quality/;
    const pending = /dang (?:duoc )?(?:xem xet|xet duyet)|cho (?:xem xet|xet duyet)|under review|being reviewed|in review|review pending/;
    const questionIcon = /(?:^|[\s:#/])(?:help[-_](?:outline|filled)|help[-_]circle(?:[-_](?:outline|filled))?|question[-_](?:mark(?:[-_]circle)?|circle(?:[-_]outline)?|outline)|circle[-_]question)(?:[-_]icon)?(?:$|\s)/;
    const count = new Map();
    const groupEvidence = new Map();
    const rowElements = new Set(rows.map((row) => row.element));
    const styles = new WeakMap();
    const shown = (node) => isVisible(node, styles);
    // Status glyphs are often aria-hidden because their meaning is provided
    // by a tooltip. Keep physical visibility checks for these decorations.
    const shownStatus = (node) => isVisible(node, styles, true);
    const inRow = (node) => { for (let current = node; current && current !== scope; current = parent(current)) if (rowElements.has(current)) return true; return false; };
    for (const row of rows) for (let node = row.element; node && node !== scope; node = parent(node)) count.set(node, (count.get(node) || 0) + 1);
    function labels(node) {
      return [node.getAttribute("aria-label"), node.getAttribute("title"), node.getAttribute("data-tooltip-text"), node.getAttribute("data-ad-type"), node.getAttribute("data-placement-type"), node.getAttribute("data-ad-source")].filter(Boolean).map(normalize);
    }
    function red(node) {
      const colors = [getComputedStyle(node).color, getComputedStyle(node).fill, node.getAttribute("fill")];
      return colors.some((color) => {
        const match = String(color).match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:[, /]+([\d.]+))?\s*\)$/);
        return match && Number(match[1]) >= 160 && Number(match[2]) <= 125 && Number(match[3]) <= 125 && Number(match[1]) > Number(match[2]) * 1.5 && (match[4] === undefined || Number(match[4]) > 0);
      });
    }
    return (selectedRow ? [selectedRow] : rows).map((row) => {
      // Include status siblings around the time/delete controls, but never
      // read another row's warning or the dialog-wide automatic toggle.
      let container = row.element;
      for (let node = row.element; node && node !== scope && count.get(node) === 1; node = parent(node)) {
        container = node;
        if (isRow(node)) break;
      }
      const nodes = [container, ...query(container, "*")].filter(shownStatus);
      const evidence = nodes.flatMap((node) => [...labels(node), ...(node.childElementCount === 0 ? [normalize(node.textContent)] : [])]);
      let origin = evidence.filter((text) => manual.test(text) || automatic.test(text));
      // A labelled manual/automatic list can classify otherwise unlabelled
      // rows. Only headings/accessible labels are used, never all list text.
      if (!origin.length) {
        for (let group = parent(container); group && group !== scope; group = parent(group)) {
          if (!groupEvidence.has(group)) {
            const headings = query(group, 'h1, h2, h3, h4, legend, [role="heading"]').filter((node) => shown(node) && !inRow(node));
            groupEvidence.set(group, [...labels(group), ...headings.map((node) => normalize(node.textContent))]);
          }
          const groupLabels = groupEvidence.get(group);
          origin = groupLabels.filter((text) => manual.test(text) || automatic.test(text));
          if (origin.length) break;
        }
      }
      const hasManual = origin.some((text) => manual.test(text));
      const hasAutomatic = origin.some((text) => automatic.test(text));
      const kind = hasManual && !hasAutomatic ? "manual" : hasAutomatic && !hasManual ? "automatic" : "unknown";
      const warning = evidence.some((text) => poor.test(text)) || nodes.some((node) => {
        const name = normalize([node.getAttribute("icon"), node.getAttribute("data-icon"), node.id, node.getAttribute("class"), ...labels(node)].join(" "));
        return /warning|report[-_ ]problem|error[-_ ]outline|canh bao/.test(name) && [node, ...query(node, "svg, path")].some(red);
      });
      const reviewing = evidence.some((text) => pending.test(text)) || nodes.some((node) => {
        const icon = normalize([node.getAttribute("icon"), node.getAttribute("data-icon"), node.getAttribute("class"), node.id, node.localName === "use" ? node.getAttribute("href") || node.getAttribute("xlink:href") : "", /icon|material/.test(node.localName + " " + node.getAttribute("class")) ? node.textContent : ""].join(" "));
        const description = normalize(node.getAttribute("aria-description"));
        const references = (node.getAttribute("aria-describedby") || "").trim().split(/\s+/).filter(Boolean);
        const describedReview = references.some((id) => {
          const target = node.getRootNode().getElementById?.(id) || document.getElementById(id);
          return target && pending.test(normalize(target.textContent));
        });
        const question = questionIcon.test(icon) || /(?:^|:)help$/.test(normalize(node.getAttribute("icon") || node.getAttribute("data-icon"))) || ["?", "❔", "❓"].includes(node.childElementCount === 0 ? node.textContent.trim() : "");
        let helpControl = false;
        if (question) for (let control = node; control && control !== container; control = parent(control)) {
          if (control.matches(`${BUTTONS}, a`) && labels(control).some((text) => /tro giup|tim hieu|learn more|^help$/.test(text))) { helpControl = true; break; }
        }
        return (!helpControl && question) || pending.test(description) || describedReview;
      });
      const busy = evidence.some((text) => /dang (?:tai|xu ly)|loading|processing/.test(text)) || nodes.some((node) => node.getAttribute("aria-busy") === "true" || /spinner|progress/.test(node.localName));
      return { ...row, kind, warning, pending: reviewing, busy, canRemove: Boolean(row.remove) && enabled(row.remove) };
    });
  }

  const TIME_TOKEN = '\\d{1,4}:\\d{2}(?::\\d{2})?(?::\\d{2}|[.,]\\d{1,3})?';
  const TOTAL_LABEL = /(?:thoi luong|tong (?:do dai|thoi gian|thoi luong)|do dai video|video duration|total duration|duration)/;

  function durationLabel(node) {
    return [node.getAttribute("aria-label"), node.getAttribute("title"), node.getAttribute("placeholder")]
      .some((label) => TOTAL_LABEL.test(normalize(label)));
  }

  function labeledTime(text) {
    const match = normalize(text).match(new RegExp(`(?:thoi luong(?: video)?|tong (?:do dai|thoi gian|thoi luong)(?: video)?|do dai video|(?:video |total )?duration)\\s*:?\\s*(${TIME_TOKEN})$`));
    return match ? P.readStudioTime(match[1]) : null;
  }

  function automaticDuration(scope) {
    function unique(values, message) {
      const valid = values.filter((s) => Number.isFinite(s) && s > 0);
      if (!valid.length) return null;
      if (Math.max(...valid) - Math.min(...valid) > 1) throw new Error(message);
      return Math.max(...valid);
    }
    // Metadata can remain available even when Studio hides its <video>.
    const media = unique(query(scope, "video").map((video) => video.duration), "Studio đang hiển thị nhiều độ dài video khác nhau. Hãy kiểm tra đúng video.");
    if (media !== null) return media;

    const rowContainers = adRows(scope).map((row) => row.element);
    const isDurationControl = (node) => visible(node) && !rowContainers.some((row) => inside(node, row));
    const displayed = query(scope, '.ytp-time-duration, [class*="duration"], [id*="duration"]')
      .filter(isDurationControl).flatMap((node) => [node.matches('.ytp-time-duration') ? P.parseTime(node.textContent.trim()) : P.readStudioTime(node.textContent.trim()), labeledTime(node.textContent), P.readStudioTime(node.value)]);
    for (const node of query(scope, 'span, div, label, time, input, [aria-label], [title]').filter(isDurationControl)) {
      // Nested spans are common: current time / total time. Do not require
      // a leaf node, but accept only the entire time readout, not page prose.
      const text = node.textContent.trim().replace(/\s+/g, " ");
      const total = text.match(new RegExp(`^${TIME_TOKEN}\\s*/\\s*(${TIME_TOKEN})$`));
      if (total) displayed.push(node.matches(".ytp-time-display") || node.closest(".ytp-time-display") ? P.parseTime(total[1]) : P.readStudioTime(total[1]));
      displayed.push(labeledTime(text), labeledTime(node.getAttribute("aria-label")), labeledTime(node.getAttribute("title")));
      if (durationLabel(node)) displayed.push(P.readStudioTime(node.value));
    }
    const inDialog = unique(displayed, "Chưa xác định được tổng độ dài video: Studio hiển thị các giá trị khác nhau. Hãy kiểm tra lại video.");
    if (inDialog !== null) return inDialog;

    // A player may live outside the ad dialog. Restrict this fallback to
    // explicitly named visible duration controls, never arbitrary timecodes.
    const outside = query(document, '.ytp-time-duration, ytcp-video-info .duration, ytcp-video-info [class*="duration"], ytcp-video-player [class*="duration"]')
      .filter((node) => visible(node) && !inside(node, scope))
      .flatMap((node) => [node.matches('.ytp-time-duration') ? P.parseTime(node.textContent.trim()) : P.readStudioTime(node.textContent.trim()), labeledTime(node.textContent)]);
    return unique(outside, "Có nhiều tổng độ dài video ngoài hộp quảng cáo. Hãy mở đúng một video rồi thử lại.");
  }

  function mountPanel(host) {
    // Place the UI INSIDE the active ad dialog. Being outside its focus
    // trap or native modal top layer makes otherwise enabled inputs unusable.
    const current = host.parentElement;
    if (current && current !== document.body && current !== document.documentElement && current.isConnected && visible(current) && buttons(current, INSERT).length === 1) return;
    let container;
    try { container = editorScope().scope; } catch { container = document.body || document.documentElement; }
    if (host.parentNode !== container) container.append(host);
  }

  function setTime(input, seconds) {
    const text = P.formatStudioTime(seconds, input.value);
    const proto = input.localName === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    // Element focus/blur events can be absent in an inactive document.
    // Supply only missing events, and never bring Chrome to the foreground.
    const seen = new Set();
    const capture = (event) => { if (event.target === input) seen.add(event.type); };
    const types = ["focus", "focusin", "blur", "focusout"];
    for (const type of types) input.addEventListener(type, capture);
    const emitMissing = (type) => {
      if (!seen.has(type)) input.dispatchEvent(new FocusEvent(type, { bubbles: type === "focusin" || type === "focusout", composed: true }));
    };
    try {
      input.focus({ preventScroll: true });
      emitMissing("focus");
      emitMissing("focusin");
      setter.call(input, text);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      // Never send Enter: it could submit the whole dialog.
      input.blur();
      emitMissing("blur");
      emitMissing("focusout");
    } finally {
      for (const type of types) input.removeEventListener(type, capture);
    }
  }

  const waitFor = (check, options) => root.MidrollWait.waitFor(check, options);

  async function createAdapter({ signal, onDurationStatus = () => {}, timeout = 10000 } = {}) {
    const { scope } = editorScope();
    const route = location.pathname;
    const videoId = route.match(/^\/video\/([A-Za-z0-9_-]+)\//)?.[1];
    if (!videoId) throw new Error("Hãy mở một video trong YouTube Studio rồi mở Quản lý vị trí quảng cáo để tự đọc độ dài.");
    const started = Date.now();
    let duration = null;
    let source = "studio";
    let lastReason = "metadata-pending";

    function assertContext() {
      if (location.pathname !== route || !scope.isConnected || !visible(scope)) {
        throw new Error("Bạn đã đổi video hoặc đóng trình quảng cáo. Đã dừng; hãy mở lại và Xem trước.");
      }
      const explicitId = scope.getAttribute("video-id") || scope.getAttribute("data-video-id");
      if (explicitId && explicitId !== videoId) throw new Error("Trình quảng cáo còn dữ liệu của video khác. Hãy chờ Studio tải xong rồi Xem trước lại.");
      const current = editorScope();
      if (current.scope !== scope) throw new Error("Trình quảng cáo đã được mở lại. Hãy Xem trước lại.");
      return current.insert;
    }

    while (Date.now() - started < timeout) {
      signal?.throwIfAborted();
      assertContext();
      onDurationStatus("Đang tự đọc tổng độ dài video từ YouTube Studio…");
      let metadata;
      try {
        metadata = await root.MidrollWait.request(() => chrome.runtime.sendMessage({ type: "MIDROLL_READ_DURATION" }), {
          signal, timeout: Math.max(1, Math.min(1500, timeout - (Date.now() - started))), timeoutValue: { seconds: null, reason: "reader-unavailable" }
        });
      } catch (error) { signal?.throwIfAborted(); metadata = { seconds: null, reason: "reader-unavailable" }; }
      signal?.throwIfAborted();
      assertContext();
      if (metadata?.videoId === videoId && Number.isFinite(metadata.seconds) && metadata.seconds > 0) {
        duration = metadata.seconds;
        source = "player";
        break;
      }
      lastReason = metadata?.videoId && metadata.videoId !== videoId ? "video-mismatch" : metadata?.reason || "metadata-pending";
      // Conflicting identity-checked metadata must not be replaced by a
      // guessed UI time. A wrong-video response is never trusted.
      if (lastReason !== "duration-conflict" && lastReason !== "video-changed" && lastReason !== "video-mismatch" && (!metadata?.videoId || metadata.videoId === videoId)) {
        try { duration = automaticDuration(scope); } catch (error) { if (error.code === "incomplete-ad-list") throw error; lastReason = "duration-conflict"; }
        if (duration !== null) break;
      }
      await root.MidrollWait.delay(Math.min(300, Math.max(0, timeout - (Date.now() - started))), { signal });
    }
    if (duration === null && ["video-mismatch", "video-changed"].includes(lastReason)) throw new Error("Studio còn dữ liệu của video khác. Chưa thay đổi điểm nào; hãy đợi tải xong rồi Xem trước lại.");
    if (duration === null) throw new Error(lastReason === "duration-conflict"
      ? "Các nguồn Studio báo độ dài video khác nhau. Chưa thay đổi điểm nào; hãy tải lại tab Studio rồi thử lại."
      : "Studio chưa cung cấp được tổng độ dài video. Chưa thay đổi điểm nào; hãy tải lại tab, mở Quản lý vị trí quảng cáo và bấm Xem trước để extension tự đọc lại.");

    function snapshot() {
      const insert = assertContext();
      const controls = readControls(scope);
      const rows = adRows(scope, controls);
      const automaticSignature = automaticState(controls, rows);
      const keys = rows.map((row) => row.raw);
      const times = rows.map((row) => row.seconds);
      const outside = rows.find((row) => row.seconds > duration);
      if (outside) throw new Error(`Điểm có sẵn ${outside.raw} được đọc là ${P.formatTime(outside.seconds)}, vượt tổng độ dài ${P.formatTime(duration)} đọc từ Studio. Chưa thay đổi điểm nào; hãy kiểm tra định dạng mốc và video.`);
      return { rows, keys, times, insert, duration, source, automaticSignature, fingerprint: JSON.stringify([route, duration, [...keys].sort(), automaticSignature]) };
    }

    function cleanupSnapshot() {
      const current = snapshot();
      const rows = cleanupRows(scope, current.rows);
      if (rows.some((row) => row.busy)) throw new Error("Studio đang tải hoặc xử lý danh sách điểm. Hãy đợi tải xong rồi Xem trước dọn lại; chưa xóa thêm điểm nào.");
      return { ...current, rows, cleanupFingerprint: JSON.stringify([route, duration, root.MidrollCleanup.signature(rows), current.automaticSignature]) };
    }

    async function removePoint(targetKey, { signal, expectedFingerprint, onWaiting = () => {} } = {}) {
      await readyToConfirm({ signal, onPending: onWaiting });
      signal?.throwIfAborted();
      const before = cleanupSnapshot();
      if (before.cleanupFingerprint !== expectedFingerprint) throw new Error("Danh sách hoặc cảnh báo đã thay đổi trước khi xóa. Hãy Xem trước dọn lại.");
      const index = before.rows.findIndex((row) => root.MidrollCleanup.key(row) === targetKey && row.kind === "manual");
      if (index < 0 || !enabled(before.rows[index].remove)) throw new Error("Không nhận diện được nút xóa của điểm thủ công đã chọn. Chưa xóa điểm này.");
      const expected = root.MidrollCleanup.signature(before.rows.filter((_, i) => i !== index));
      // Resolve fresh controls and click once; a rerender must never cause
      // a second click on the next row or an automatic slot.
      before.rows[index].remove.click();
      await waitFor(() => {
        const after = cleanupSnapshot();
        return !document.hidden && after.rows.length === before.rows.length - 1 && root.MidrollCleanup.signature(after.rows) === expected && after.cleanupFingerprint;
      }, { signal, stableFor: 400, backgroundTimeout: Infinity, onPending: onWaiting,
        timeoutMessage: "Studio chưa xác nhận đúng điểm vừa xóa. Đã dừng, không bấm xóa lại và chưa lưu; hãy kiểm tra danh sách." });
    }

    async function removePoints(targets, { signal, expectedFingerprint, onWaiting = () => {} } = {}) {
      if (!targets.length || targets.length > 5) throw new Error("Mỗi nhóm dọn phải có từ 1 đến 5 điểm.");
      let expected = expectedFingerprint;
      let clicked = 0;
      let settled = false;
      try {
        await readyToConfirm({ signal, onPending: onWaiting });
        for (const target of targets) {
          signal?.throwIfAborted();
          if (document.hidden) await readyToConfirm({ signal, onPending: onWaiting });
          const before = cleanupSnapshot();
          if (before.cleanupFingerprint !== expected) throw new Error("Danh sách hoặc cảnh báo đã thay đổi trong nhóm dọn. Đã dừng trước điểm tiếp theo.");
          const index = before.rows.findIndex((row) => root.MidrollCleanup.key(row) === target.key && row.kind === "manual");
          if (index < 0 || !enabled(before.rows[index].remove)) throw new Error("Không xác định chắc chắn nút xóa của điểm thủ công trong nhóm.");
          const remaining = before.rows.filter((_, i) => i !== index);
          const expectedSignature = root.MidrollCleanup.signature(remaining);
          expected = JSON.stringify([route, duration, expectedSignature, before.automaticSignature]);
          // Never hold stale buttons across clicks, even within a group.
          // A full reread must prove the previous deletion before the next.
          before.rows[index].remove.click();
          clicked++;
          // Let queued framework commits finish before deciding whether a
          // full per-point settling window is needed. Never retry the click.
          await Promise.resolve();
          signal?.throwIfAborted();
          const check = () => {
            const after = cleanupSnapshot();
            return !document.hidden && after.rows.length === remaining.length && after.cleanupFingerprint === expected && expected;
          };
          let immediate;
          try { immediate = check(); } catch { immediate = false; }
          settled = false;
          if (!immediate) {
            // Delayed/partial rerenders retain the per-point settling guard.
            await waitFor(() => {
              assertContext();
              try { return check(); } catch { return false; }
            }, { signal, stableFor: 400, backgroundTimeout: Infinity, onPending: onWaiting,
              timeoutMessage: "Studio chưa xác nhận đúng điểm vừa xóa trong nhóm. Không bấm xóa lại." });
            settled = true;
          }
        }
        // For immediate acknowledgments, share one settling window across
        // the group. Progress is counted only after that window completes.
        if (!settled) await verifyCleanup(expected, { signal });
        signal?.throwIfAborted();
        if (cleanupSnapshot().cleanupFingerprint !== expected) throw new Error("Danh sách tiếp tục thay đổi sau nhóm dọn.");
        return { removed: targets.length };
      } catch (error) {
        const failure = new Error(`${error.message}${clicked ? ` Đã bấm xóa ${clicked} điểm trong nhóm này; chưa xác nhận cả nhóm và chưa lưu. Hãy kiểm tra toàn bộ nhóm.` : ""}`);
        failure.name = error.name;
        failure.pendingRemoved = clicked;
        throw failure;
      }
    }

    async function verifyCleanup(expected, { signal } = {}) {
      await waitFor(() => !document.hidden && cleanupSnapshot().cleanupFingerprint === expected && expected, {
        signal, stableFor: 400, backgroundTimeout: Infinity,
        timeoutMessage: "Danh sách đã thay đổi sau khi dọn. Đã dừng; kiểm tra lại trước khi lưu."
      });
    }

    async function readyToConfirm({ signal, onPending } = {}) {
      // Studio's renderer may pause while fully hidden. Keep the same
      // pending operation instead of treating a self-assigned value as saved.
      await waitFor(() => { assertContext(); return !document.hidden; }, {
        signal, backgroundTimeout: Infinity, onPending
      });
    }

    async function insert(seconds, { signal, onWaiting = () => {}, expectedAutomaticSignature } = {}) {
      await readyToConfirm({ signal, onPending: onWaiting });
      const before = snapshot();
      if (expectedAutomaticSignature !== undefined && before.automaticSignature !== expectedAutomaticSignature) throw new Error("Cài đặt quảng cáo tự động đã thay đổi. Hãy Xem trước lại.");
      const insertionStarted = performance.now();
      lastInsertion = { target: P.formatTime(seconds), beforeCount: before.rows.length, phase: "seek", seek: null };
      if (!enabled(before.insert)) throw new Error("Nút Chèn vị trí quảng cáo đang bị khóa. Hãy kiểm tra Studio.");
      // When a separate playhead field exists, move it to the intended time.
      // Row inputs are excluded so an existing ad time cannot be overwritten.
      const playheads = fields(scope).filter((field) => !durationLabel(field) && !before.rows.some((row) => row.input === field));
      if (playheads.length > 1) throw new Error("Có nhiều ô thời gian ngoài danh sách quảng cáo. Không thể chọn chắc chắn ô đặt vị trí; đã dừng.");
      if (playheads.length === 1 && enabled(playheads[0]) && !playheads[0].readOnly) {
        setTime(playheads[0], seconds);
      }
      // An input value is not proof that Studio moved its timeline cursor.
      // Seek the actual preview when a supported player is available.
      const editorToken = crypto.randomUUID();
      scope.setAttribute("data-midroll-editor-token", editorToken);
      let seek;
      try {
        seek = await root.MidrollWait.request(() => chrome.runtime.sendMessage({ type: "MIDROLL_SEEK_PLAYHEAD", videoId, seconds, duration, editorToken }), {
          signal, timeout: 3000, timeoutValue: { ok: false, reason: "seek-timeout" }
        });
      } catch (error) { signal?.throwIfAborted(); seek = { ok: false, reason: "seek-unavailable" }; }
      finally {
        if (scope.getAttribute("data-midroll-editor-token") === editorToken) scope.removeAttribute("data-midroll-editor-token");
      }
      signal?.throwIfAborted();
      assertContext();
      lastInsertion.seek = seek?.ok ? "confirmed" : seek?.reason || "no-response";
      if (!seek?.ok && seek?.reason !== "seek-unavailable") throw new Error("Chưa xác nhận được vị trí thanh thời gian trước khi chèn. Đã dừng; chưa thêm điểm ở lượt này.");
      // The actual player acknowledgment already covers the position. Keep
      // the display-only settling check for interfaces without player support.
      if (!seek?.ok && playheads.length === 1 && enabled(playheads[0]) && !playheads[0].readOnly) {
        await waitFor(() => playheads[0].isConnected && P.readStudioTime(playheads[0].value) === seconds, { signal, stableFor: 300, onPending: onWaiting });
      }
      lastInsertion.timings = { prepareMs: Math.round(performance.now() - insertionStarted) };
      const identificationStarted = performance.now();
      const ready = snapshot();
      if (ready.fingerprint !== before.fingerprint) throw new Error("Danh sách quảng cáo đã thay đổi trước khi chèn. Hãy Xem trước lại.");
      // One click only. Never retry insertion on an ambiguous response.
      ready.insert.click();
      lastInsertion.phase = "identify";
      const oldInputs = new Set(before.rows.map((row) => row.input));
      let pendingReason = "Danh sách chưa xuất hiện điểm mới.";
      function selection() {
        assertContext();
        let current;
        try { current = adRows(scope); }
        catch (error) { pendingReason = error.message; return null; }
        if (current.length !== before.rows.length + 1) {
          pendingReason = `Danh sách đang có ${current.length} điểm; cần ${before.rows.length + 1} điểm sau một lần chèn.`;
          return null;
        }
        const keys = current.map((item) => item.raw);
        lastInsertion.currentCount = current.length;
        const extra = P.additionalKey(before.keys, keys);
        if (extra === null) {
          pendingReason = "Chưa đối chiếu được đầy đủ các mốc cũ sau khi Studio vẽ lại danh sách.";
          return null;
        }
        const fresh = current.filter((item) => !oldInputs.has(item.input));
        lastInsertion.newInputCount = fresh.length;
        lastInsertion.extraTime = extra;
        // A surviving input identity is stronger than its displayed value.
        // Otherwise require a unique occurrence of the extra raw timecode.
        const matches = current.filter((item) => item.raw === extra);
        const row = fresh.length === 1 && fresh[0].raw === extra ? fresh[0]
          : matches.length === 1 ? matches[0] : null;
        if (!row) {
          pendingReason = `Điểm mới được tạo tại vị trí thanh thời gian ${extra}, trùng điểm cũ; Studio đã thay toàn bộ các ô.${seek?.ok ? "" : " Chưa điều khiển được vị trí phát thực tế của giao diện này."}`;
          return null;
        }
        return { row, rows: current, token: JSON.stringify([[...keys].sort(), current.indexOf(row), row.raw]) };
      }
      // Rerenders can expose a temporary default/duplicate or a partial list.
      // Wait for stable evidence instead of stopping on the first frame.
      const immediate = selection();
      const fastIdentification = seek?.ok && immediate?.row.seconds === seconds && !before.keys.includes(immediate.row.raw);
      lastInsertion.fastIdentification = Boolean(fastIdentification);
      const token = fastIdentification ? immediate.token : await waitFor(() => selection()?.token, {
        signal, timeout: 15000, stableFor: 400, onPending: onWaiting,
        timeoutMessage: () => `Không xác định chắc chắn ô mới tại mốc ${P.formatTime(seconds)} sau khi chờ Studio cập nhật. ${pendingReason} Đã dừng; chưa sửa ô chưa rõ và chưa lưu. Hãy kiểm tra điểm vừa thêm trước khi Xem trước lại.`
      });
      signal?.throwIfAborted();
      // Re-read after awaiting: the previous DOM input may be disconnected.
      const latest = selection();
      if (!latest || latest.token !== token) throw new Error(`Studio tiếp tục đổi danh sách tại mốc ${P.formatTime(seconds)}. Đã dừng; chưa sửa ô chưa rõ và chưa lưu. Hãy kiểm tra điểm vừa thêm.`);
      const row = latest.row;
      const classified = cleanupRows(scope, latest.rows, row)[0];
      if (classified.kind === "automatic" || classified.busy) throw new Error("Điểm mới là điểm tự động hoặc còn đang tải. Đã dừng; chưa sửa ô này và chưa lưu.");
      lastInsertion.timings.identifyMs = Math.round(performance.now() - identificationStarted);
      const confirmationStarted = performance.now();
      lastInsertion.phase = "edit";
      if (!enabled(row.input) || row.input.readOnly) throw new Error("Ô thời gian mới chưa cho phép nhập. Đã dừng; hãy kiểm tra điểm vừa thêm.");
      // Commit the new row itself, even if its initial displayed time matches
      // the target; the playhead display alone is not a model acknowledgment.
      setTime(row.input, seconds);
      await waitFor(() => {
        const current = snapshot();
        if (document.hidden) return false;
        if (current.automaticSignature !== before.automaticSignature) throw new Error("Studio đã đổi cài đặt quảng cáo tự động trong lúc chèn. Đã dừng; kiểm tra lại trước khi lưu.");
        return current.keys.length === before.keys.length + 1 && P.preserves(before.keys, current.keys) && current.times.includes(seconds) && current.fingerprint;
      }, { signal, stableFor: 400, backgroundTimeout: Infinity, onPending: onWaiting });
      lastInsertion.phase = "confirmed";
      lastInsertion.timings.confirmMs = Math.round(performance.now() - confirmationStarted);
      lastInsertion.timings.totalMs = Math.round(performance.now() - insertionStarted);
    }
    async function verifyPlan(plan, { signal, onWaiting = () => {} } = {}) {
      await waitFor(() => {
        const current = snapshot();
        if (document.hidden) return false;
        return plan.additions.every((seconds) => current.times.some((time) => Math.abs(time - seconds) <= P.DUPLICATE_WINDOW)) && current.fingerprint;
      }, { signal, stableFor: 400, backgroundTimeout: Infinity, onPending: onWaiting });
    }
    return { snapshot, insert, verifyPlan, cleanupSnapshot, removePoint, removePoints, verifyCleanup };
  }

  // Diagnostics contain only controls in the ad dialog, not video titles,
  // account identifiers, cookies, URLs, HTML dumps, or page-wide content.
  function diagnostics() {
    const { scope } = editorScope();
    return {
      version: "0.1.16",
      lastInsertion,
      editor: scope.localName,
      controls: query(scope, BUTTONS).filter(visible).map((node) => ({ tag: node.localName, label: node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent.trim().slice(0, 100) })),
      timeFields: query(scope, INPUTS).filter(visible).map((node) => ({ tag: node.localName, label: node.getAttribute("aria-label") || "", value: P.readStudioTime(node.value) === null ? "(không phải thời gian)" : node.value })),
      adRows: cleanupRows(scope, adRows(scope)).map((row) => ({ raw: row.raw, kind: row.kind, warning: row.warning, pending: row.pending, busy: row.busy,
        markers: [row.element, ...query(row.element, '[icon], [aria-label], [title], [data-ad-type]')].map((node) => ({ tag: node.localName, icon: node.getAttribute("icon"), label: node.getAttribute("aria-label") || node.getAttribute("title"), type: node.getAttribute("data-ad-type") })) }))
    };
  }
  function isEditorOpen() { try { editorScope(); return true; } catch { return false; } }
  root.MidrollStudio = { createAdapter, diagnostics, mountPanel, isEditorOpen };
})(globalThis);
