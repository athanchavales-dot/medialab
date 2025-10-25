function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
const pageName = document.body?.dataset?.page || "page";
function restoreFields() {
  $all("[data-save]").forEach(el => {
    const key = makeKey(el);
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      if (el.type === "file") {
        const previewKey = key + "_preview";
        const previewData = localStorage.getItem(previewKey);
        if (previewData) {
          const img = $(el.dataset.previewTarget);
          if (img) {
            img.src = previewData;
            img.style.display = "block";
          }
        }
      } else if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        el.value = saved;
      }
    }
  });
}
function makeKey(el) {
  const name = el.getAttribute("name") || el.id || "field";
  return pageName + "::" + name;
}
function saveField(el) {
  const key = makeKey(el);
  if (el.type === "file") {
    return;
  } else {
    localStorage.setItem(key, el.value);
  }
  showSavedStatus();
}
let saveTimeout;
function showSavedStatus() {
  const statusEl = $(".save-status");
  if (!statusEl) return;
  statusEl.textContent = "Saved";
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    statusEl.textContent = " ";
  }, 2000);
}
function handleFileUpload(inputEl) {
  const files = inputEl.files;
  if (!files || !files[0]) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const previewSel = inputEl.dataset.previewTarget;
    const img = $(previewSel);
    if (img) {
      img.src = dataUrl;
      img.style.display = "block";
    }
    const key = makeKey(inputEl) + "_preview";
    localStorage.setItem(key, dataUrl);
    showSavedStatus();
  };
  reader.readAsDataURL(file);
}
function exportWorksheet() {
  const out = {};
  $all("[data-save]").forEach(el => {
    const baseKey = el.getAttribute("name") || el.id || "field";
    if (el.type === "file") {
      const previewData = localStorage.getItem(makeKey(el) + "_preview");
      if (previewData) {
        out[baseKey] = previewData;
      }
    } else {
      out[baseKey] = el.value;
    }
  });
  const exportBlob = new Blob([JSON.stringify(out, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(exportBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pageName + "_worksheet.json";
  a.click();
  URL.revokeObjectURL(url);
}
function initWorksheetPage() {
  restoreFields();
  $all("[data-save]").forEach(el => {
    if (el.type === "file") {
      el.addEventListener("change", () => handleFileUpload(el));
    } else {
      el.addEventListener("input", () => saveField(el));
    }
  });
  const exportBtn = $("#exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportWorksheet);
  }
}
document.addEventListener("DOMContentLoaded", initWorksheetPage);
