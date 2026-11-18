/**
 * Manifest V3 service worker for automatic SIS sync.
 *
 * The content script never sees the token: it sends the changed table snapshot
 * here, and this worker reads the paired sync token from extension storage.
 */
(function () {
  var API_URL = "https://ejust-student-hub.vercel.app/api/sis/sync";

  function badgeSynced() {
    try {
      chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
      chrome.action.setBadgeText({ text: "✓" });
    } catch (error) {
      // Badge APIs are best effort; sync success must not depend on them.
    }
  }

  function clearBadge() {
    try {
      chrome.action.setBadgeText({ text: "" });
    } catch (error) {
      // Ignore badge failures.
    }
  }

  chrome.runtime.onInstalled.addListener(function () {
    // Default enabled for new installs, and normalize older installs too.
    chrome.storage.local.get("autoSync", function (settings) {
      if (typeof settings.autoSync !== "boolean") {
        chrome.storage.local.set({ autoSync: true });
      }
    });
  });

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== "EJUST_AUTO_SYNC") return false;

    (async function () {
      var settings = await chrome.storage.local.get([
        "autoSync",
        "syncToken",
        "lastSyncedHash",
      ]);

      if (settings.autoSync === false) {
        sendResponse({ ok: false, reason: "disabled" });
        return;
      }
      if (!settings.syncToken) {
        sendResponse({ ok: false, reason: "no_token" });
        return;
      }
      if (!message.rawText) {
        sendResponse({ ok: false, reason: "no_data" });
        return;
      }
      if (settings.lastSyncedHash === message.hash) {
        sendResponse({ ok: false, reason: "unchanged" });
        return;
      }

      try {
        var response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + settings.syncToken,
          },
          body: JSON.stringify({
            rawText: message.rawText,
            tableType: message.tableType || "unknown",
          }),
        });

        var data = await response.json().catch(function () {
          return {};
        });
        if (!response.ok) {
          throw new Error(data.error || "Sync failed (" + response.status + ")");
        }

        await chrome.storage.local.set({ lastSyncedHash: message.hash });
        badgeSynced();
        sendResponse({
          ok: true,
          count: Array.isArray(data.courses) ? data.courses.length : 0,
        });
      } catch (error) {
        clearBadge();
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return true; // asynchronous sendResponse
  });
})();
