/* ============================================
   画像圧縮ツール : app.js
   バニラJS / 外部依存なし
   - ダーク/ライト切替（localStorage保存）
   - お布施フラグ判定（分岐の起点）
   - 画像のドラッグ&ドロップ／選択 → Canvas APIで圧縮・リサイズ
   - 画像データはサーバーに送信・保存しない（設定のみ保存）
   ============================================ */

(function () {
  "use strict";

  const STORAGE_KEY_THEME = "tf_theme"; // "light" | "dark"
  const STORAGE_KEY_PRO = "tf_pro";     // "1" でお布施済みフラグ（擬似）
  const STORAGE_KEY_SETTINGS = "imgcomp_settings"; // 画質・リサイズ・形式の設定のみ保存

  /* ---------- テーマ切替 ---------- */
  function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    const root = document.documentElement;

    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (prefersDark ? "dark" : "light");
    applyTheme(initial);

    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY_THEME, next);
      });
    }

    function applyTheme(theme) {
      if (theme === "dark") {
        root.setAttribute("data-theme", "dark");
        if (toggle) {
          toggle.setAttribute("aria-pressed", "true");
          toggle.innerHTML = '<span aria-hidden="true">☀️</span>';
        }
      } else {
        root.removeAttribute("data-theme");
        if (toggle) {
          toggle.setAttribute("aria-pressed", "false");
          toggle.innerHTML = '<span aria-hidden="true">🌙</span>';
        }
      }
    }
  }

  /* ---------- お布施フラグ判定 ---------- */
  function isPro() {
    return localStorage.getItem(STORAGE_KEY_PRO) === "1";
  }

  function applyProState() {
    if (isPro()) {
      document.body.classList.add("is-pro");
      document.querySelectorAll(".ad-slot").forEach((el) => {
        el.style.display = "none";
      });
    }
  }

  /* ---------- 開発用Pro切替ボタン ---------- */
  function initDevProToggle() {
    const btn = document.getElementById("dev-pro-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = isPro() ? "0" : "1";
      localStorage.setItem(STORAGE_KEY_PRO, next);
      location.reload();
    });
  }

  /* ============================================
     画像圧縮ツール本体
     ============================================ */

  // 内部状態: 画像データ本体はメモリ上にのみ保持し、永続化しない
  const state = {
    items: [], // { id, file, originalUrl, originalSize, resultBlob, resultUrl, resultSize, name, status }
  };

  let dom = {};
  let debounceTimer = null;

  function initTool() {
    dom = {
      dropZone: document.getElementById("drop-zone"),
      fileInput: document.getElementById("file-input"),
      qualitySlider: document.getElementById("quality-slider"),
      qualityValue: document.getElementById("quality-value"),
      resizePreset: document.getElementById("resize-preset"),
      customSizeRow: document.getElementById("custom-size-row"),
      maxWidth: document.getElementById("max-width"),
      maxHeight: document.getElementById("max-height"),
      formatSelect: document.getElementById("format-select"),
      downloadAllBtn: document.getElementById("download-all-btn"),
      clearBtn: document.getElementById("clear-btn"),
      statusText: document.getElementById("status-text"),
      resultList: document.getElementById("result-list"),
      itemTemplate: document.getElementById("result-item-template"),
    };

    if (!dom.dropZone || !dom.fileInput) return; // tool-root未実装ページでは何もしない

    loadSettings();
    bindEvents();
    initDevProToggle();
  }

  /* ---------- 設定の保存・復元（画像データは含まない） ---------- */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.quality === "number") {
        dom.qualitySlider.value = String(s.quality);
      }
      if (typeof s.resizePreset === "string") {
        dom.resizePreset.value = s.resizePreset;
      }
      if (typeof s.maxWidth === "number") dom.maxWidth.value = String(s.maxWidth);
      if (typeof s.maxHeight === "number") dom.maxHeight.value = String(s.maxHeight);
      if (typeof s.format === "string") dom.formatSelect.value = s.format;
    } catch (e) {
      // 破損データは無視
    }
    dom.qualityValue.textContent = dom.qualitySlider.value;
    toggleCustomSizeRow();
  }

  function saveSettings() {
    const s = {
      quality: Number(dom.qualitySlider.value),
      resizePreset: dom.resizePreset.value,
      maxWidth: dom.maxWidth.value ? Number(dom.maxWidth.value) : null,
      maxHeight: dom.maxHeight.value ? Number(dom.maxHeight.value) : null,
      format: dom.formatSelect.value,
    };
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(s));
    } catch (e) {
      // 保存失敗は無視（容量超過等）
    }
  }

  function toggleCustomSizeRow() {
    dom.customSizeRow.hidden = dom.resizePreset.value !== "custom";
  }

  /* ---------- イベント登録 ---------- */
  function bindEvents() {
    // ドラッグ&ドロップ
    dom.dropZone.addEventListener("click", () => dom.fileInput.click());
    dom.dropZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dom.fileInput.click();
      }
    });
    dom.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dom.dropZone.classList.add("drop-zone--active");
    });
    dom.dropZone.addEventListener("dragleave", () => {
      dom.dropZone.classList.remove("drop-zone--active");
    });
    dom.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dom.dropZone.classList.remove("drop-zone--active");
      const files = Array.from(e.dataTransfer.files || []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) handleFiles(files);
    });

    dom.fileInput.addEventListener("change", () => {
      const files = Array.from(dom.fileInput.files || []);
      if (files.length) handleFiles(files);
      dom.fileInput.value = ""; // 同じファイルを再選択できるようにする
    });

    // 設定変更 → debounceで再圧縮
    dom.qualitySlider.addEventListener("input", () => {
      dom.qualityValue.textContent = Number(dom.qualitySlider.value).toFixed(2);
      scheduleReprocess();
    });
    dom.resizePreset.addEventListener("change", () => {
      toggleCustomSizeRow();
      scheduleReprocess();
    });
    dom.maxWidth.addEventListener("input", scheduleReprocess);
    dom.maxHeight.addEventListener("input", scheduleReprocess);
    dom.formatSelect.addEventListener("change", scheduleReprocess);

    dom.downloadAllBtn.addEventListener("click", downloadAll);
    dom.clearBtn.addEventListener("click", clearAll);
  }

  function scheduleReprocess() {
    saveSettings();
    if (!state.items.length) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      reprocessAll();
    }, 400);
  }

  /* ---------- ファイル受け取り ---------- */
  function handleFiles(files) {
    files.forEach((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        id,
        file,
        originalUrl: URL.createObjectURL(file),
        originalSize: file.size,
        resultBlob: null,
        resultUrl: null,
        resultSize: null,
        name: file.name,
        status: "pending",
        el: null,
      };
      state.items.push(item);
      renderItem(item);
    });
    updateButtons();
    processQueue();
  }

  /* ---------- 一覧表示 ---------- */
  function renderItem(item) {
    const frag = dom.itemTemplate.content.cloneNode(true);
    const li = frag.querySelector(".result-item");
    const thumb = frag.querySelector(".result-item__thumb");
    const name = frag.querySelector(".result-item__name");
    const before = frag.querySelector(".result-item__before");
    const after = frag.querySelector(".result-item__after");
    const ratio = frag.querySelector(".result-item__ratio");
    const statusEl = frag.querySelector(".result-item__status");
    const download = frag.querySelector(".result-item__download");

    thumb.src = item.originalUrl;
    thumb.alt = `${item.name} のサムネイル`;
    name.textContent = item.name;
    before.textContent = `元: ${formatSize(item.originalSize)}`;
    after.textContent = "";
    ratio.textContent = "";
    statusEl.textContent = "処理待ち...";
    download.setAttribute("aria-disabled", "true");
    download.classList.add("is-disabled");
    download.addEventListener("click", (e) => {
      if (!item.resultUrl) e.preventDefault();
    });

    dom.resultList.appendChild(frag);
    item.el = {
      li,
      thumb,
      after,
      ratio,
      statusEl,
      download,
    };
  }

  function updateItemView(item) {
    if (!item.el) return;
    if (item.status === "done") {
      item.el.after.textContent = `圧縮後: ${formatSize(item.resultSize)}`;
      const reduction = item.originalSize > 0
        ? Math.round((1 - item.resultSize / item.originalSize) * 100)
        : 0;
      item.el.ratio.textContent = reduction > 0
        ? `（${reduction}%削減）`
        : reduction < 0
          ? `（${Math.abs(reduction)}%増加）`
          : "（変化なし）";
      item.el.statusEl.textContent = "完了";
      item.el.download.href = item.resultUrl;
      item.el.download.download = item.resultName || item.name;
      item.el.download.removeAttribute("aria-disabled");
      item.el.download.classList.remove("is-disabled");
    } else if (item.status === "processing") {
      item.el.statusEl.textContent = "処理中...";
    } else if (item.status === "error") {
      item.el.statusEl.textContent = "処理に失敗しました";
    }
  }

  /* ---------- 圧縮処理 ---------- */
  function getOptions() {
    const quality = Number(dom.qualitySlider.value);
    let maxWidth = 0;
    let maxHeight = 0;
    const preset = dom.resizePreset.value;
    if (preset === "custom") {
      maxWidth = dom.maxWidth.value ? Number(dom.maxWidth.value) : 0;
      maxHeight = dom.maxHeight.value ? Number(dom.maxHeight.value) : 0;
    } else {
      const presetValue = Number(preset);
      if (presetValue > 0) {
        maxWidth = presetValue;
        maxHeight = presetValue;
      }
    }
    return { quality, maxWidth, maxHeight, format: dom.formatSelect.value };
  }

  async function processQueue() {
    const opts = getOptions();
    const pending = state.items.filter((i) => i.status === "pending");
    if (!pending.length) return;

    setStatus(`画像を処理しています（0/${pending.length}）...`);
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      item.status = "processing";
      updateItemView(item);
      try {
        await compressItem(item, opts);
        item.status = "done";
      } catch (e) {
        item.status = "error";
      }
      updateItemView(item);
      setStatus(`画像を処理しています（${i + 1}/${pending.length}）...`);
    }
    setStatus(`処理が完了しました（${state.items.filter((i) => i.status === "done").length}/${state.items.length}枚）`);
    updateButtons();
  }

  async function reprocessAll() {
    if (!state.items.length) return;
    const opts = getOptions();
    setStatus(`設定を変更したため再処理しています（0/${state.items.length}）...`);
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      item.status = "processing";
      updateItemView(item);
      try {
        await compressItem(item, opts);
        item.status = "done";
      } catch (e) {
        item.status = "error";
      }
      updateItemView(item);
      setStatus(`設定を変更したため再処理しています（${i + 1}/${state.items.length}）...`);
    }
    setStatus(`再処理が完了しました（${state.items.length}枚）`);
  }

  async function compressItem(item, opts) {
    const bitmap = await loadImage(item.file);
    const { width, height } = calcSize(bitmap.width, bitmap.height, opts.maxWidth, opts.maxHeight);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);

    if (typeof bitmap.close === "function") bitmap.close();

    let outputType = opts.format;
    if (outputType === "auto") outputType = "image/jpeg";

    // PNG互換: 元がPNGでアルファを持つ場合、JPEG/WebP出力時は白背景で合成済み（drawImageで透過は黒/透明として処理されるためfillRect推奨）
    if (outputType !== "image/png") {
      // 透過を白背景に合成（JPEG/WebPはアルファ非対応のため）
      const composited = document.createElement("canvas");
      composited.width = width;
      composited.height = height;
      const cctx = composited.getContext("2d");
      cctx.fillStyle = "#ffffff";
      cctx.fillRect(0, 0, width, height);
      cctx.drawImage(canvas, 0, 0);
      const blob = await canvasToBlob(composited, outputType, opts.quality);
      finalizeResult(item, blob, outputType);
      return;
    }

    const blob = await canvasToBlob(canvas, outputType, opts.quality);
    finalizeResult(item, blob, outputType);
  }

  function finalizeResult(item, blob, outputType) {
    if (item.resultUrl) {
      URL.revokeObjectURL(item.resultUrl);
    }
    item.resultBlob = blob;
    item.resultSize = blob.size;
    item.resultUrl = URL.createObjectURL(blob);
    item.resultName = buildResultName(item.name, outputType);
  }

  function buildResultName(originalName, mimeType) {
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const dot = originalName.lastIndexOf(".");
    const base = dot > 0 ? originalName.slice(0, dot) : originalName;
    return `${base}.compressed.${ext}`;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        },
        type,
        quality
      );
    });
  }

  function calcSize(srcWidth, srcHeight, maxWidth, maxHeight) {
    if (!maxWidth && !maxHeight) {
      return { width: srcWidth, height: srcHeight };
    }
    let ratio = 1;
    if (maxWidth && maxHeight) {
      ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight, 1);
    } else if (maxWidth) {
      ratio = Math.min(maxWidth / srcWidth, 1);
    } else if (maxHeight) {
      ratio = Math.min(maxHeight / srcHeight, 1);
    }
    return {
      width: Math.max(1, Math.round(srcWidth * ratio)),
      height: Math.max(1, Math.round(srcHeight * ratio)),
    };
  }

  // 正しい向きで画像を読み込む（EXIF回転を考慮）。非対応ブラウザはImage要素にフォールバック。
  async function loadImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (e) {
        // フォールバックへ
      }
    }
    return await loadImageViaElement(file);
  }

  function loadImageViaElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  /* ---------- ダウンロード ---------- */
  async function downloadAll() {
    const done = state.items.filter((i) => i.status === "done" && i.resultUrl);
    for (const item of done) {
      triggerDownload(item.resultUrl, item.resultName || item.name);
      // 連続ダウンロードがブラウザにブロックされないよう間隔をあける
      await sleep(300);
    }
  }

  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ---------- クリア ---------- */
  function clearAll() {
    state.items.forEach((item) => {
      URL.revokeObjectURL(item.originalUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    state.items = [];
    dom.resultList.innerHTML = "";
    setStatus("");
    updateButtons();
  }

  /* ---------- UI状態更新 ---------- */
  function updateButtons() {
    const hasItems = state.items.length > 0;
    const hasDone = state.items.some((i) => i.status === "done");
    dom.clearBtn.disabled = !hasItems;
    dom.downloadAllBtn.disabled = !hasDone;
  }

  function setStatus(text) {
    dom.statusText.textContent = text;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    applyProState();
    initTool();
  });

  // 他ファイルから利用できるよう公開
  window.ToolFactory = {
    isPro,
    STORAGE_KEY_PRO,
    STORAGE_KEY_THEME,
  };
})();
