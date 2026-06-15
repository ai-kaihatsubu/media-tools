/* ============================================
   画像圧縮ツール : monetization.js
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
    // TODO: 提携先のアフィリエイトリンクに置き換える（オンラインストレージ/写真管理/画像編集ソフト等）
    AFFILIATE_ITEMS: [
      {
        label: "TODO: オンラインストレージサービス（写真バックアップ向け）",
        url: "https://example.com/affiliate-link-1", // TODO
      },
      {
        label: "TODO: 写真管理・編集ソフト",
        url: "https://example.com/affiliate-link-2", // TODO
      },
    ],

    // 3) Stripe
    // TODO: Stripe Payment LinkのURLを設定する
    STRIPE_PAYMENT_LINK_URL: "", // TODO 例: "https://buy.stripe.com/XXXXXXXX"
  };

  /* ---------- 1) AdSense 初期化（プレースホルダ） ---------- */
  function initAdsense() {
    // Pro利用者には広告を表示しない
    if (window.ToolFactory && window.ToolFactory.isPro && window.ToolFactory.isPro()) {
      return;
    }
    // AdSenseローダーを1回だけ注入（二重読み込みガード）
    try {
      if (CONFIG.ADSENSE_CLIENT_ID && !document.querySelector('script[src*="adsbygoogle.js"]')) {
        var s = document.createElement("script");
        s.async = true;
        s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CONFIG.ADSENSE_CLIENT_ID;
        s.crossOrigin = "anonymous";
        document.head.appendChild(s);
      }
    } catch (e) { /* noop */ }
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
