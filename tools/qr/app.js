/* ============================================
   ツール置き場 004-qr-code-generator : app.js
   QRコード作成ツール本体ロジック（バニラJS / 外部依存なし）
   ============================================ */

(function () {
  "use strict";

  const STORAGE_KEY_THEME = "tf_theme"; // "light" | "dark"
  const STORAGE_KEY_PRO = "tf_pro";     // "1" でお布施済みフラグ（擬似）
  const DEBOUNCE_MS = 250;

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

  /* ---------- QRコードツール本体 ---------- */
  let lastResultPngUrl = null;
  let lastResultSvgUrl = null;

  function initTool() {
    const textEl = document.getElementById("qr-text");
    const ecLevelEl = document.getElementById("qr-eclevel");
    const sizeEl = document.getElementById("qr-size");
    const marginEl = document.getElementById("qr-margin");
    const fgEl = document.getElementById("qr-fg");
    const bgEl = document.getElementById("qr-bg");
    const canvas = document.getElementById("qr-canvas");
    const infoEl = document.getElementById("qr-info");
    const errorEl = document.getElementById("qr-error");
    const pngBtn = document.getElementById("qr-download-png");
    const svgBtn = document.getElementById("qr-download-svg");

    if (!textEl || !canvas) return;

    let debounceTimer = null;
    let currentResult = null; // { version, size, modules, ecLevel, maskPattern }

    function scheduleGenerate() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(generate, DEBOUNCE_MS);
    }

    function clearDownloads() {
      if (lastResultPngUrl) {
        URL.revokeObjectURL(lastResultPngUrl);
        lastResultPngUrl = null;
      }
      if (lastResultSvgUrl) {
        URL.revokeObjectURL(lastResultSvgUrl);
        lastResultSvgUrl = null;
      }
      pngBtn.disabled = true;
      svgBtn.disabled = true;
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      currentResult = null;
      clearDownloads();
    }

    function clearError() {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }

    function generate() {
      const text = textEl.value;
      const ecLevel = ecLevelEl.value;
      const size = parseInt(sizeEl.value, 10) || 512;
      const margin = clampMargin(marginEl.value);
      const fg = fgEl.value || "#000000";
      const bg = bgEl.value || "#ffffff";

      if (!text || text.trim().length === 0) {
        clearError();
        currentResult = null;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearDownloads();
        infoEl.textContent = "テキストを入力してください。";
        return;
      }

      let result;
      try {
        result = window.QRCodeLib.encode(text, ecLevel);
      } catch (e) {
        showError(
          e && e.message
            ? "QRコードを生成できませんでした: " + e.message
            : "QRコードを生成できませんでした。入力内容を短くするか、誤り訂正レベルを下げてください。"
        );
        infoEl.textContent = "生成エラー";
        return;
      }

      clearError();
      currentResult = result;

      drawToCanvas(canvas, result, size, margin, fg, bg);

      infoEl.textContent =
        "バージョン " + result.version + "（" + result.size + "×" + result.size + "モジュール）/ " +
        "誤り訂正レベル " + result.ecLevel + " / マスク " + result.maskPattern;

      prepareDownloads(result, size, margin, fg, bg);
    }

    function clampMargin(value) {
      let m = parseInt(value, 10);
      if (isNaN(m) || m < 0) m = 0;
      if (m > 16) m = 16;
      return m;
    }

    function prepareDownloads(result, size, margin, fg, bg) {
      clearDownloads();

      // PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        lastResultPngUrl = URL.createObjectURL(blob);
        pngBtn.disabled = false;
      }, "image/png");

      // SVG
      const svgString = buildSvg(result, size, margin, fg, bg);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
      lastResultSvgUrl = URL.createObjectURL(svgBlob);
      svgBtn.disabled = false;
    }

    pngBtn.addEventListener("click", () => {
      if (!lastResultPngUrl) return;
      triggerDownload(lastResultPngUrl, "qrcode.png");
    });

    svgBtn.addEventListener("click", () => {
      if (!lastResultSvgUrl) return;
      triggerDownload(lastResultSvgUrl, "qrcode.svg");
    });

    function triggerDownload(url, filename) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // 入力・オプション変更で再生成
    textEl.addEventListener("input", scheduleGenerate);
    ecLevelEl.addEventListener("change", generate);
    sizeEl.addEventListener("change", generate);
    marginEl.addEventListener("input", scheduleGenerate);
    marginEl.addEventListener("change", generate);
    fgEl.addEventListener("input", generate);
    bgEl.addEventListener("input", generate);

    // 初期表示
    generate();
  }

  /* ---------- Canvas描画 ---------- */
  function drawToCanvas(canvas, result, size, margin, fg, bg) {
    const moduleCount = result.size;
    const totalModules = moduleCount + margin * 2;
    const moduleSize = size / totalModules;

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);

    // 背景
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // モジュール描画
    ctx.fillStyle = fg;
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (result.modules[r][c]) {
          const x = (c + margin) * moduleSize;
          const y = (r + margin) * moduleSize;
          ctx.fillRect(x, y, moduleSize, moduleSize);
        }
      }
    }
  }

  /* ---------- SVG生成 ---------- */
  function buildSvg(result, size, margin, fg, bg) {
    const moduleCount = result.size;
    const totalModules = moduleCount + margin * 2;

    let rects = "";
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (result.modules[r][c]) {
          rects += '<rect x="' + (c + margin) + '" y="' + (r + margin) + '" width="1" height="1"/>';
        }
      }
    }

    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalModules + ' ' + totalModules +
      '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges">' +
      '<rect width="' + totalModules + '" height="' + totalModules + '" fill="' + escapeXmlAttr(bg) + '"/>' +
      '<g fill="' + escapeXmlAttr(fg) + '">' + rects + '</g>' +
      '</svg>'
    );
  }

  function escapeXmlAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
