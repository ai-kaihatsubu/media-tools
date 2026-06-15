/* ============================================
   ツール工房 004-qr-code-generator : monetization.js
   収益3レールを1ファイルで管理
   1) AdSense  2) アフィリエイト  3) Stripe Payment Link (Pro)
   すべてプレースホルダ / 設定変数で外出し
   ============================================ */

(function () {
  "use strict";

  /* ============================================
     設定（社長が値を入れる箇所）
     ============================================ */
  const CONFIG = {
    // 1) AdSense
    // TODO: AdSense審査通過後、publisher IDを設定し、
    //       index.html内のコメントアウトされた<ins>タグを有効化する
    ADSENSE_CLIENT_ID: "ca-pub-6568622993777242",

    // 2) アフィリエイト
    // TODO: 提携先のアフィリエイトリンクに置き換える（名刺・ショップカード作成サービス等を想定）
    AFFILIATE_ITEMS: [
      {
        label: "TODO: 名刺・ショップカード作成サービス（QR付き）",
        url: "https://example.com/affiliate-link-1", // TODO
      },
      {
        label: "TODO: ラベル・ステッカー印刷サービス",
        url: "https://example.com/affiliate-link-2", // TODO
      },
    ],

    // 3) Stripe
    // TODO: Stripe Payment LinkのURLを設定する
    STRIPE_PAYMENT_LINK_URL: "", // TODO 例: "https://buy.stripe.com/XXXXXXXX"
  };

  /* ---------- 1) AdSense 初期化：広告ローダーを1回だけ注入（Pro時は注入しない） ---------- */
  function initAdsense() {
    try {
      var isPro = window.ToolFactory && window.ToolFactory.isPro && window.ToolFactory.isPro();
      if (
        CONFIG.ADSENSE_CLIENT_ID &&
        !isPro &&
        !document.querySelector('script[src*="adsbygoogle.js"]')
      ) {
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CONFIG.ADSENSE_CLIENT_ID;
        s.crossOrigin = "anonymous";
        document.head.appendChild(s);
      }
    } catch (e) {}
  }

  /* ---------- 2) アフィリエイト枠レンダリング ---------- */
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

  /* ---------- 3) Stripe Payment Link（Proボタン） ---------- */
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
    initAdsense();
    renderAffiliateLinks();
    initProButton();
  });

  window.ToolFactoryMonetization = { CONFIG };
})();
