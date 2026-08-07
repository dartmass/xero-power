(() => {
  "use strict";

  let paletteKey = "k";

  function parseKey(value) {
    const match = String(value || "").match(/([a-z0-9])\s*$/i);
    return match ? match[1].toLowerCase() : "k";
  }

  function applyShortcuts(shortcuts) {
    paletteKey = parseKey(shortcuts?.palette);
  }

  function canCustomize(data) {
    if (data?.xp_plan) return data.xp_plan === "pro" || data.xp_plan === "practice";
    return data?.xp_pro === true;
  }

  function loadActiveShortcuts() {
    return chrome.storage.local.get(["xp_shortcuts", "xp_pro", "xp_plan"])
      .then((data) => applyShortcuts(canCustomize(data) ? data.xp_shortcuts : null));
  }

  loadActiveShortcuts()
    .catch(() => {});

  chrome.storage.onChanged?.addListener((changes, area) => {
    if (
      area === "local" &&
      (changes.xp_shortcuts || changes.xp_pro || changes.xp_plan)
    ) {
      loadActiveShortcuts().catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "xp-apply-settings") return;
    sendResponse({ reloading: true });
    window.setTimeout(() => window.location.reload(), 50);
  });

  window.addEventListener("keydown", (event) => {
    if (!event.metaKey && !event.ctrlKey) return;
    const keyMatches = String(event.key || "").toLowerCase() === paletteKey;
    const codeMatches = event.code === `Key${paletteKey.toUpperCase()}`;
    if (!keyMatches && !codeMatches) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.dispatchEvent(new CustomEvent("xp-toggle-command-palette"));
  }, true);
})();
