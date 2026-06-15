/* ============================================
   カテゴリ統合アプリ シェルテンプレート : monetization.js
   収益3レール（AdSense / アフィリエイト / Stripe）を一元管理（シェルレベル）
   すべてプレースホルダ。実キーは社長が後から設定する。
   ============================================ */

var ADSENSE_CLIENT_ID = "ca-pub-6568622993777242";
(function () {
  "use strict";
  try {
    var p = window.ToolFactory && window.ToolFactory.isPro && window.ToolFactory.isPro();
    if (ADSENSE_CLIENT_ID && !p && !document.querySelector('script[src*="adsbygoogle.js"]')) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADSENSE_CLIENT_ID;
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
  } catch (e) {}
})();

(function () {
  "use strict";

  /* ============================================
     設定（社長が値を入れる箇所）
     ============================================ */
  const CONFIG = {
    // アフィリエイト（あわせて使いたい効率化ツール枠）
    // TODO: 実際の提携リンクに置き換える
    AFFILIATE_ITEMS: [
      {
        label: "TODO: おすすめのクラウドストレージサービス",
        url: "https://example.com/affiliate-placeholder-storage", // TODO
      },
      {
        label: "TODO: おすすめのオンラインメモ・ノートアプリ",
        url: "https://example.com/affiliate-placeholder-notes", // TODO
      },
      {
        label: "TODO: おすすめのセキュリティ・パスワード管理サービス",
        url: "https://example.com/affiliate-placeholder-security", // TODO
      },
    ],

    // Stripe Payment Link（Pro: ¥480 買い切り、シェル全体の広告非表示）
    // TODO: Stripe Payment Link発行後、URLを設定する
    STRIPE_PAYMENT_LINK_URL: "", // TODO 例: "https://buy.stripe.com/XXXXXXXX"
  };

  /* ---------- アフィリエイト枠レンダリング ---------- */
  function renderAffiliateLinks() {
    const list = document.getElementById("affiliate-list");
    if (!list) return;

    list.innerHTML = "";
    CONFIG.AFFILIATE_ITEMS.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.url;
      a.textContent = item.label;
      a.rel = "sponsored nofollow noopener";
      a.target = "_blank";
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ---------- Stripe Payment Link（Proボタン） ---------- */
  function initProButton() {
    const btn = document.getElementById("pro-button");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (!CONFIG.STRIPE_PAYMENT_LINK_URL) {
        // TODO: Stripe Payment Link 発行後、CONFIG.STRIPE_PAYMENT_LINK_URLを設定すると
        //       このボタンが実際の決済ページへ遷移するようになる。
        alert("Pro機能は準備中です。公開までお待ちください。");
        return;
      }
      window.open(CONFIG.STRIPE_PAYMENT_LINK_URL, "_blank", "noopener");
    });
  }

  /* ---------- 起動 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderAffiliateLinks();
    initProButton();
  });

  window.ToolFactoryMonetization = { CONFIG };
})();
