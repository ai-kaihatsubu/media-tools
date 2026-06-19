/* ============================================
   カテゴリ統合アプリ シェルテンプレート : app.js
   window.SUITE_CONFIG（config.js）を読み込み、
   タブバー(#tab-bar)とiframeパネル(#panels)を動的生成する。
   タブ切替（iframe遅延ロード）・テーマ切替・Pro判定を担う。
   バニラJS / IIFE / 外部依存なし / 完全クライアントサイド
   ============================================ */

(function () {
  "use strict";

  const STORAGE_KEY_THEME = "tf_theme";        // "light" | "dark"
  const STORAGE_KEY_PRO = "tf_pro";            // "1" でお布施済みフラグ（擬似）
  const STORAGE_KEY_ACTIVE_TAB = "tf_cat_active"; // 最後に開いたタブ（インデックス）

  /* ---------- ブランド表示 ---------- */
  function applyBrand(config) {
    const brandEl = document.getElementById("brand");
    if (brandEl && config.brand) {
      brandEl.textContent = config.brand;
    }
    const proHeading = document.getElementById("pro-heading");
    if (proHeading && config.brand) {
      proHeading.textContent = config.brand + "のお布施";
    }
  }

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

  /* ---------- Pro判定 ---------- */
  function isPro() {
    return localStorage.getItem(STORAGE_KEY_PRO) === "1";
  }

  function applyProState() {
    const isProUser = isPro();
    document.body.classList.toggle("is-pro", isProUser);
    document.querySelectorAll(".ad-slot").forEach((el) => {
      el.style.display = isProUser ? "none" : "";
    });
  }

  function initDevProToggle() {
    const btn = document.getElementById("dev-pro-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = isPro() ? "0" : "1";
      localStorage.setItem(STORAGE_KEY_PRO, next);
      applyProState();
    });
  }

  /* ---------- タブ・パネル動的生成 + 切替 ---------- */
  function buildTabsAndPanels(config) {
    const tabBar = document.getElementById("tab-bar");
    const panelsContainer = document.getElementById("panels");
    if (!tabBar || !panelsContainer) return;

    const tabs = Array.isArray(config.tabs) ? config.tabs : [];
    if (!tabs.length) return;

    tabBar.innerHTML = "";
    panelsContainer.innerHTML = "";

    tabs.forEach((tab, index) => {
      const tabId = "tab-" + index;
      const panelId = "panel-" + index;
      const frameId = "frame-" + index;

      // タブボタン生成
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab-button";
      btn.id = tabId;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", "false");
      btn.setAttribute("aria-controls", panelId);
      btn.dataset.index = String(index);
      btn.tabIndex = -1;
      btn.textContent = tab.label || "";
      tabBar.appendChild(btn);

      // パネル(iframe)生成
      const section = document.createElement("section");
      section.className = "tool-panel";
      section.id = panelId;
      section.setAttribute("role", "tabpanel");
      section.setAttribute("aria-labelledby", tabId);
      section.dataset.index = String(index);
      section.hidden = true;

      const wrapper = document.createElement("div");
      wrapper.className = "tool-frame-wrapper";

      const iframe = document.createElement("iframe");
      iframe.className = "tool-frame";
      iframe.id = frameId;
      iframe.title = tab.label || "";
      iframe.dataset.src = tab.path || "";
      iframe.loading = index === 0 ? "eager" : "lazy";

      // iframe内のツールが持つ重複チロム（ヘッダー/お布施/広告/アフィリ/フッター）を非表示にし、
      // ツール本体だけを表示する。お布施・フッター・広告はシェル(このページ)側に1つだけ置く。
      iframe.addEventListener("load", function () {
        try {
          var doc = iframe.contentDocument;
          if (doc && doc.head && !doc.getElementById("__tf_embed_style")) {
            var st = doc.createElement("style");
            st.id = "__tf_embed_style";
            st.textContent =
              ".site-header,.ofuse-box,.affiliate-box,.ad-slot,.site-footer{display:none !important;}" +
              "main#main{padding-top:8px !important;}";
            doc.head.appendChild(st);
          }
        } catch (e) {}
      });

      wrapper.appendChild(iframe);
      section.appendChild(wrapper);
      panelsContainer.appendChild(section);
    });

    function activate(index, focusTab) {
      tabs.forEach((tab, i) => {
        const btnEl = document.getElementById("tab-" + i);
        const panelEl = document.getElementById("panel-" + i);
        const frameEl = document.getElementById("frame-" + i);
        const isActive = i === index;

        if (btnEl) {
          btnEl.setAttribute("aria-selected", isActive ? "true" : "false");
          btnEl.tabIndex = isActive ? 0 : -1;
        }
        if (panelEl) {
          if (isActive) {
            panelEl.hidden = false;
            panelEl.setAttribute("data-active", "true");
          } else {
            panelEl.hidden = true;
            panelEl.removeAttribute("data-active");
          }
        }
        // 初回アクティブ化時に iframe の src を遅延セット
        if (isActive && frameEl && !frameEl.getAttribute("src")) {
          const dataSrc = frameEl.dataset.src;
          if (dataSrc) {
            frameEl.setAttribute("src", dataSrc);
          }
        }
      });

      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, String(index));

      if (focusTab) {
        const btnEl = document.getElementById("tab-" + index);
        if (btnEl) btnEl.focus();
      }
    }

    const tabButtons = tabs.map((_, i) => document.getElementById("tab-" + i));

    tabButtons.forEach((btnEl, index) => {
      if (!btnEl) return;

      btnEl.addEventListener("click", () => {
        activate(index, false);
      });

      btnEl.addEventListener("keydown", (event) => {
        let targetIndex = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          targetIndex = (index + 1) % tabButtons.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
        } else if (event.key === "Home") {
          targetIndex = 0;
        } else if (event.key === "End") {
          targetIndex = tabButtons.length - 1;
        }

        if (targetIndex !== null) {
          event.preventDefault();
          activate(targetIndex, true);
        }
      });
    });

    // 復元: localStorageに保存されたインデックスがあれば復元、なければ最初のタブ
    const savedIndex = parseInt(localStorage.getItem(STORAGE_KEY_ACTIVE_TAB), 10);
    const initialIndex = !isNaN(savedIndex) && savedIndex >= 0 && savedIndex < tabs.length ? savedIndex : 0;
    activate(initialIndex, false);
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const config = window.SUITE_CONFIG || { brand: "", desc: "", tabs: [] };

    applyBrand(config);
    initTheme();
    applyProState();
    initDevProToggle();
    buildTabsAndPanels(config);
  });

  window.ToolFactory = {
    isPro: isPro,
  };
})();
