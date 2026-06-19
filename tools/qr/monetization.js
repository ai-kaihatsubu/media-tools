/* ============================================
   ツール置き場 : monetization.js
   収益3レール（AdSense / アフィリエイト / お布施）統合エンジン

   ★ 有効化は下の「設定ブロック(CONFIG)」だけ編集すればOK。HTMLの編集は不要です ★
     - 値が未設定（ca-pub-XXXX / スロットXXXX / 空文字 / example.com）の間は、
       各レールは自動的に「無効（準備中）」のまま安全に表示されます。
     - 実値を入れたレールだけが、ページ再読み込み時に自動でONになります。
   ============================================ */

(function () {
  "use strict";

  const CONFIG = {
    ADSENSE_CLIENT_ID: "ca-pub-6568622993777242",
    ADSENSE_SLOTS: { top: "XXXXXXXXXX", bottom: "XXXXXXXXXX" },
    AFFILIATE_ITEMS: [
      { label: "TODO: おすすめ商品・サービス1", url: "https://example.com/affiliate-placeholder-1" },
      { label: "TODO: おすすめ商品・サービス2", url: "https://example.com/affiliate-placeholder-2" },
      { label: "TODO: おすすめ商品・サービス3", url: "https://example.com/affiliate-placeholder-3" },
    ],
    STRIPE_DONATION_URL: "",
  };

  var isPlaceholderAd   = function (id)  { return !id || /X{4,}/.test(id); };
  var isPlaceholderSlot = function (s)   { return !s  || /X{4,}/.test(s); };
  var isPlaceholderAff  = function (url) { return !url || /example\.com/.test(url); };

  function initAdsense() {
    if (isPlaceholderAd(CONFIG.ADSENSE_CLIENT_ID)) return;
    if (!document.querySelector("script[data-adsense-loader]")) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(CONFIG.ADSENSE_CLIENT_ID);
      s.crossOrigin = "anonymous";
      s.setAttribute("data-adsense-loader", "1");
      document.head.appendChild(s);
    }
    document.querySelectorAll(".ad-slot").forEach(function (slot) {
      var pos = slot.getAttribute("data-ad-position") || "top";
      var slotId = (CONFIG.ADSENSE_SLOTS || {})[pos];
      if (isPlaceholderSlot(slotId)) return;
      slot.innerHTML = "";
      slot.removeAttribute("aria-hidden");
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", CONFIG.ADSENSE_CLIENT_ID);
      ins.setAttribute("data-ad-slot", slotId);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      slot.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  function renderAffiliateLinks() {
    var list = document.getElementById("affiliate-list");
    if (!list) return;
    var box = document.querySelector(".affiliate-box");
    var items = (CONFIG.AFFILIATE_ITEMS || []).filter(function (it) { return it && !isPlaceholderAff(it.url); });
    if (!items.length) { if (box) box.style.display = "none"; return; }
    if (box) box.style.display = "";
    list.innerHTML = "";
    items.forEach(function (it) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = it.url;
      a.textContent = it.label;
      a.rel = "sponsored nofollow noopener";
      a.target = "_blank";
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function initOfuseButton() {
    var btn = document.getElementById("ofuse-button");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (CONFIG.STRIPE_DONATION_URL) {
        window.open(CONFIG.STRIPE_DONATION_URL, "_blank", "noopener");
      } else {
        var status = document.getElementById("ofuse-status");
        if (status) {
          status.textContent = "お布施の受付は準備中です。応援ありがとうございます。";
        } else {
          alert("お布施の受付は準備中です。応援ありがとうございます。");
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderAffiliateLinks();
    initOfuseButton();
  });
  window.addEventListener("load", function () {
    initAdsense();
  });

  window.ToolFactoryMonetization = { CONFIG: CONFIG };
})();