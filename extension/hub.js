/**
 * Runs on the authenticated hub pages. The hub broadcasts its sync token to
 * same-origin listeners; this script stores it so the SIS page can sync without
 * any copy/paste step. Manual entry in the popup remains a fallback.
 */
(function () {
  var ALLOWED_ORIGINS = [
    "https://ejust-student-hub.vercel.app",
    "http://localhost:3000",
  ];
  var MESSAGE_TYPE = "EJUST_HUB_SYNC_TOKEN";
  var seenToken = null;

  function rememberToken(token) {
    if (typeof token !== "string") return;
    var value = token.trim();
    if (!value || value === seenToken) return;
    seenToken = value;
    chrome.storage.local.set({ syncToken: value });
  }

  chrome.storage.local.get("syncToken", function (settings) {
    if (typeof settings.syncToken === "string") {
      seenToken = settings.syncToken;
    }
  });

  window.addEventListener(
    "message",
    function (event) {
      if (event.source !== window) return;
      if (ALLOWED_ORIGINS.indexOf(event.origin) === -1) return;
      var data = event.data;
      if (!data || data.type !== MESSAGE_TYPE) return;
      rememberToken(data.token);
    },
    false
  );
})();
