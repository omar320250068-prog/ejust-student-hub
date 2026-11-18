/**
 * Runs on https://sis.ejust.edu.eg/*.
 * - answers popup requests for the visible course table and its snapshot hash
 * - watches for Registered Courses / Academic Transcript tables and asks the
 *   background worker to sync changed data when auto-sync is enabled.
 * It never reads form values, passwords, or cookies.
 */
(function () {
  var AUTO_SYNC_DELAY = 800;
  var TOAST_ID = "ejust-hub-sync-toast";
  var debounceTimer = null;
  var syncPending = false;

  function normalizeCell(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function tableToText(table) {
    return Array.from(table.querySelectorAll("tr"))
      .map(function (row) {
        return Array.from(row.querySelectorAll("th,td"))
          .map(function (cell) {
            return normalizeCell(cell.innerText || cell.textContent);
          })
          .filter(Boolean)
          .join(" \t ");
      })
      .filter(function (line) {
        return line.length > 0;
      })
      .join("\n");
  }

  function isCourseTable(block) {
    return /course\s*code|teaching\s+method|delete\s+section|reg\.?\s*approved|academic\s+transcript|\bgrade\b/i.test(
      block
    );
  }

  function isRegisteredTable(block) {
    return (
      /teaching\s+method|delete\s+section|reg\.?\s*approved/i.test(block) ||
      (/\bstatus\b/i.test(block) && /\bpayment\b/i.test(block))
    );
  }

  function courseBlocks() {
    var tables = Array.from(document.querySelectorAll("table"));
    if (tables.length === 0) return [];
    var blocks = tables
      .map(tableToText)
      .filter(function (block) {
        return block.length > 0;
      });
    var relevant = blocks.filter(isCourseTable);
    return relevant.length > 0 ? relevant : blocks;
  }

  function extractTableText() {
    var chosen = courseBlocks();
    if (chosen.length === 0) return null;
    var registered = chosen.filter(isRegisteredTable);
    return (registered.length > 0 ? registered : chosen).join("\n\n");
  }

  function pageLines() {
    var body = document.body ? document.body.innerText : "";
    return body
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function extractPageText() {
    return pageLines().join("\n");
  }

  /** Summary fields usually sit outside the table but are needed for the preview. */
  function extractHeaderSummary() {
    return pageLines()
      .filter(function (line) {
        return (
          /^(total\s+passed\s+ch|cgpa|registered\s+ch)\b/i.test(line) ||
          /\b20\d{2}\s*\/\s*20\d{2}\b/.test(line)
        );
      })
      .join("\n");
  }

  function extractAll() {
    var tableText = extractTableText() || "";
    var summary = extractHeaderSummary();
    return [tableText, summary].filter(Boolean).join("\n");
  }

  function detectTableType() {
    var tableText = courseBlocks().join("\n");
    if (isRegisteredTable(tableText) || /registered\s+courses/i.test(tableText)) return "REGISTERED";
    if (/academic\s+transcript|\bcgpa\b|total\s+passed\s+ch|\bgrade\b/i.test(tableText)) {
      return "TRANSCRIPT";
    }
    var pageText = extractPageText();
    if (/registered\s+courses/i.test(pageText)) return "REGISTERED";
    if (/academic\s+transcript/i.test(pageText)) return "TRANSCRIPT";
    return null;
  }

  /** FNV-1a keeps the change check local and dependency-free. */
  function hashCode(value) {
    var hash = 2166136261;
    for (var index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function snapshot() {
    var tableType = detectTableType();
    if (!tableType) return null;
    var rawText = extractAll() || extractPageText();
    if (!rawText.trim()) return null;
    var normalized = tableType + "\n" + rawText.replace(/\s+/g, " ").trim();
    return { rawText: rawText, tableType: tableType, hash: hashCode(normalized) };
  }

  function showToast(message) {
    var previous = document.getElementById(TOAST_ID);
    if (previous && previous.parentNode) previous.parentNode.removeChild(previous);
    if (!document.body) return;

    var toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;" +
      "display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #bbf7d0;" +
      "border-radius:10px;background:#f0fdf4;color:#166534;box-shadow:0 8px 24px rgba(15,23,42,.18);" +
      "font:12px/1.4 system-ui,-apple-system,sans-serif;";

    var text = document.createElement("span");
    text.textContent = message;

    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    close.style.cssText =
      "border:0;background:transparent;color:#166534;font-size:16px;line-height:1;cursor:pointer;padding:0 2px;";
    close.addEventListener("click", function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });

    toast.appendChild(text);
    toast.appendChild(close);
    document.body.appendChild(toast);
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 6000);
  }

  async function runAutoSync() {
    if (syncPending) return;
    var current = snapshot();
    if (!current) return;

    var settings = await chrome.storage.local.get(["autoSync", "syncToken", "lastSyncedHash"]);
    if (settings.autoSync === false || !settings.syncToken) return;
    if (settings.lastSyncedHash === current.hash) return;

    syncPending = true;
    try {
      var result = await chrome.runtime.sendMessage({
        type: "EJUST_AUTO_SYNC",
        rawText: current.rawText,
        tableType: current.tableType,
        hash: current.hash,
      });
      if (result && result.ok) {
        showToast("E-JUST Hub: Synced " + (result.count || 0) + " courses");
      }
    } catch (error) {
      // The worker may be restarting; the next mutation or page load retries.
    } finally {
      syncPending = false;
    }
  }

  function scheduleAutoSync() {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(function () {
      debounceTimer = null;
      runAutoSync().catch(function () {});
    }, AUTO_SYNC_DELAY);
  }

  function startAutoSync() {
    scheduleAutoSync();
    var target = document.body || document.documentElement;
    if (!target || typeof MutationObserver === "undefined") return;
    // ASP.NET postbacks replace table nodes instead of navigating.
    new MutationObserver(scheduleAutoSync).observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAutoSync, { once: true });
  } else {
    startAutoSync();
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message) return false;

    if (message.type === "EJUST_EXTRACT_SIS") {
      try {
        sendResponse({ ok: true, text: extractAll() || extractPageText() });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
      return true;
    }

    if (message.type === "EJUST_HASH_SIS") {
      try {
        var current = snapshot();
        sendResponse({ ok: true, hash: current ? current.hash : null });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
      return true;
    }

    return false;
  });
})();
