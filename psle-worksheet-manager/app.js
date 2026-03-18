// app.js
// SPA router and global state management.
// Coordinates navigation between Library and Builder views.

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const AppState = {
  currentView:   "library",   // "library" | "builder" | "preview" | "questionbank"
  editingId:     null,        // worksheet id being edited, or null for new
  bankQuestions: null,        // questions pre-loaded from Question Bank
  bankMeta:      null         // worksheet metadata pre-loaded from Question Bank
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function navigate(view, params = {}) {
  AppState.currentView = view;
  AppState.editingId   = params.editingId || null;

  // Update nav button active states
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  // Render the requested view
  const main = document.getElementById("app-main");
  main.innerHTML = "";

  if (view === "library") {
    renderLibrary(main);
  } else if (view === "builder") {
    renderBuilder(main, AppState.editingId);
  } else if (view === "preview") {
    renderPreview(main, AppState.editingId);
  } else if (view === "questionbank") {
    renderQuestionBank(main);
  }

  // Scroll to top on navigation
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Export / Import wiring
// ---------------------------------------------------------------------------

function initExportImport() {
  document.getElementById("btn-export").addEventListener("click", () => {
    try {
      exportAll();
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
    reader.onload = (e) => {
      try {
        const result = importAll(e.target.result);
        showToast(`Imported ${result.imported} worksheet(s).`
          + (result.skipped ? ` Skipped ${result.skipped}.` : ""));
        // Refresh library if currently visible
        if (AppState.currentView === "library") {
          navigate("library");
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
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Wire nav buttons
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.view));
  });

  initExportImport();

  // Start on library view
  navigate("library");
});
