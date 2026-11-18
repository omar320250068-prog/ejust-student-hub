/**
 * Runs only on https://sis.ejust.edu.eg/*.
 * Reads the relevant course table plus SIS header summary text when the popup
 * asks for it. It never touches form values, passwords, or cookies.
 */
(function () {
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

  function extractTableText() {
    var tables = Array.from(document.querySelectorAll("table"));
    if (tables.length === 0) return null;

    var blocks = tables
      .map(tableToText)
      .filter(function (block) {
        return block.length > 0;
      });
    if (blocks.length === 0) return null;

    var relevant = blocks.filter(isCourseTable);
    var chosen = relevant.length > 0 ? relevant : blocks;
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

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== "EJUST_EXTRACT_SIS") return false;
    try {
      sendResponse({ ok: true, text: extractAll() || extractPageText() });
    } catch (error) {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    }
    return true;
  });
})();
