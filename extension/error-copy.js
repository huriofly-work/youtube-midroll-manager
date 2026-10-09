(function (root) {
  "use strict";
  async function copy(text, field, isCurrent = () => true) {
    try {
      await navigator.clipboard.writeText(text);
      if (isCurrent()) field.hidden = true;
      return true;
    } catch {
      if (!isCurrent()) return false;
      // Clipboard access may be blocked. Keep the text selectable in the
      // active dialog instead of losing the original error or adding rights.
      field.value = text;
      field.hidden = false;
      field.focus({ preventScroll: true });
      field.select();
      try {
        if (document.execCommand("copy")) { field.hidden = true; return true; }
      } catch {}
      return false;
    }
  }
  root.MidrollErrorCopy = { copy };
})(globalThis);
