/**
 * Runs only on https://sis.ejust.edu.eg/*.
 * Reads visible course tables (or page text) when the popup asks for it.
 * It never touches form values, passwords, or cookies.
 */
(function () {
  function normalizeCell(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function extractTableText() {
    const tables = Array.from(document.querySelectorAll("table"));
    if (tables.length === 0) return null;

    return tables
      .map((table) =>
        Array.from(table.querySelectorAll("tr"))
          .map((row) =>
            Array.from(row.querySelectorAll("th,td"))
              .map((cell) => normalizeCell(cell.innerText || cell.textContent))
              .filter(Boolean)
              .join(" \t ")
          )
          .filter((line) => line.length > 0)
          .join("\n")
      )
      .filter((block) => block.length > 0)
      .join("\n\n");
  }

  function extractPageText() {
    return normalizeCell(document.body ? document.body.innerText : "").replace(/\t/g, " ");
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== "EJUST_EXTRACT_SIS") return false;
    try {
      sendResponse({ ok: true, text: extractTableText() || extractPageText() });
    } catch (error) {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    }
    return true;
  });
})();
