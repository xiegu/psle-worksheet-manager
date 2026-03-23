// app.js
// SPA router and global state management.
// Coordinates navigation between Library, Builder, Preview, Question Bank, and Students views.

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const AppState = {
  currentView:   "library",   // "library" | "builder" | "preview" | "questionbank" | "students"
  editingId:     null,        // worksheet id being edited, or null for new
  bankQuestions: null,        // questions pre-loaded from Question Bank
  bankMeta:      null         // worksheet metadata pre-loaded from Question Bank
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function navigate(view, params = {}) {
  AppState.currentView = view;
  AppState.editingId   = params.editingId || null;

  // Update nav button active states + aria-current
  document.querySelectorAll(".nav-btn").forEach(btn => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle("active", isActive);
    if (isActive) btn.setAttribute("aria-current", "page");
    else          btn.removeAttribute("aria-current");
  });

  const main = document.getElementById("app-main");
  main.innerHTML = "";

  if      (view === "library")      await renderLibrary(main);
  else if (view === "builder")      await renderBuilder(main, AppState.editingId);
  else if (view === "preview")      await renderPreview(main, AppState.editingId);
  else if (view === "questionbank") await renderQuestionBank(main);
  else if (view === "students")     await renderStudents(main);

  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Export / Import wiring
// ---------------------------------------------------------------------------

function initExportImport() {
  document.getElementById("btn-export").addEventListener("click", async () => {
    try {
      await exportAll();
      showToast("Backup downloaded.");
    } catch (e) {
      showToast("Export failed: " + e.message, "error");
    }
  });

  const fileInput = document.getElementById("import-file-input");

  document.getElementById("btn-import").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      showToast("Importing…");
      try {
        const result = await importAll(e.target.result);
        showToast(`Imported ${result.imported} worksheet(s).`
          + (result.skipped ? ` Skipped ${result.skipped}.` : ""), "success");
        if (AppState.currentView === "library") {
          await navigate("library");
        }
      } catch (err) {
        showToast("Import failed: " + err.message, "error");
      } finally {
        fileInput.value = "";
      }
    };
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

let toastTimer = null;

/**
 * Show a brief notification at the bottom of the screen.
 * @param {string} message
 * @param {"info"|"error"|"success"} type
 */
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast toast--visible toast--" + type;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

// Expose globally so modules can call it
window.showToast = showToast;
window.navigate  = navigate;

// ---------------------------------------------------------------------------
// Logo loader — converts logo.png to a base64 data URL for use in print windows
// ---------------------------------------------------------------------------

function _loadLogoDataUrl() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = "logo.png";
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // Load logo as base64 data URL so it works in print windows (blank tab, no base URL)
  window.LOGO_DATA_URL = await _loadLogoDataUrl();

  // Initialise IndexedDB (opens DB, migrates legacy localStorage data, primes cache)
  try {
    await initDB();
  } catch (e) {
    console.error("Failed to open IndexedDB:", e);
    document.getElementById("app-main").innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#9888;</div>
        <div class="empty-state__text">
          Failed to open database: ${e.message}<br>
          Try refreshing the page. If the problem persists, check that your browser supports IndexedDB.
        </div>
      </div>`;
    return;
  }

  // Wire nav buttons
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.view));
  });

  initExportImport();
  renderActiveStudentIndicator();

  // Start on library view
  await navigate("library");
});
