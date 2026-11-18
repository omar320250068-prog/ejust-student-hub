/* E-JUST Hub SIS Sync — lightweight Manifest V3 popup. */
(function () {
  const API = "https://ejust-student-hub.vercel.app/api/student/sync";
  const SIS_HOST = "sis.ejust.edu.eg";

  const tokenInput = document.getElementById("token");
  const rawInput = document.getElementById("raw");
  const detectButton = document.getElementById("detect");
  const syncButton = document.getElementById("sync");
  const preview = document.getElementById("preview");
  const status = document.getElementById("status");

  function setStatus(message, isError) {
    status.textContent = message || "";
    status.classList.toggle("error", Boolean(isError));
  }

  function token() {
    return tokenInput.value.trim();
  }

  function authHeaders() {
    return token() ? { Authorization: "Bearer " + token() } : {};
  }

  function renderPreview(courses) {
    preview.innerHTML = "";
    if (!courses || courses.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No courses detected yet.";
      preview.appendChild(empty);
      return;
    }
    courses.forEach(function (course) {
      const row = document.createElement("div");
      const grade = course.grade ? " · " + course.grade : "";
      row.textContent = course.courseCode + " — " + (course.courseName || "Course") + grade;
      preview.appendChild(row);
    });
  }

  async function post(payload) {
    const response = await fetch(API, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(data.error || "Request failed (" + response.status + ")");
    }
    return data;
  }

  async function currentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function detect() {
    setStatus("Reading the SIS page…");
    const tab = await currentTab();
    let text = "";

    if (tab && tab.url && tab.url.indexOf(SIS_HOST) !== -1) {
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: "EJUST_EXTRACT_SIS" });
        if (result && result.ok) text = result.text || "";
        if (result && result.error) throw new Error(result.error);
      } catch (error) {
        setStatus("Page reader unavailable — paste the copied table instead.", true);
      }
    }

    if (!text) {
      try {
        text = await navigator.clipboard.readText();
      } catch (error) {
        setStatus("Allow clipboard access or paste the table manually.", true);
        return;
      }
    }

    rawInput.value = text;
    await chrome.storage.local.set({ lastRawText: text });
    setStatus("Detected courses. Review them below.");
    await previewCourses(text);
  }

  async function previewCourses(text) {
    if (!text.trim()) return;
    if (!token()) {
      setStatus("Add your sync token from the hub guide first.", true);
      return;
    }
    try {
      const data = await post({ rawText: text, dryRun: true });
      renderPreview(data.courses || []);
      setStatus("Preview only — nothing saved yet.");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function sync() {
    const text = rawInput.value.trim();
    if (!text) {
      setStatus("Detect or paste your SIS table first.", true);
      return;
    }
    if (!token()) {
      setStatus("Add your sync token from the hub guide first.", true);
      return;
    }
    syncButton.disabled = true;
    setStatus("Saving…");
    try {
      const data = await post({ rawText: text });
      renderPreview(data.courses || []);
      setStatus("Synced! CGPA " + Number(data.cgpa || 0).toFixed(2) + " · " + (data.completedCredits || 0) + " credits.");
      await chrome.storage.local.set({ lastSyncAt: new Date().toISOString() });
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      syncButton.disabled = false;
    }
  }

  detectButton.addEventListener("click", detect);
  syncButton.addEventListener("click", sync);
  tokenInput.addEventListener("change", function () {
    chrome.storage.local.set({ syncToken: token() });
  });
  rawInput.addEventListener("input", function () {
    chrome.storage.local.set({ lastRawText: rawInput.value });
  });

  chrome.storage.local.get(["syncToken", "lastRawText"], function (data) {
    if (data.syncToken) tokenInput.value = data.syncToken;
    if (data.lastRawText) rawInput.value = data.lastRawText;
    renderPreview([]);
  });
})();
