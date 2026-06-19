/* ============================================
   ツール置き場 004-qr-code-generator : sw.js
   最小構成 Service Worker（オフライン対応）
   戦略: ネットワーク優先（常に最新を取得）＋オフライン時はキャッシュにフォールバック。
        再デプロイ後すぐ最新版が反映され、古い壊れた状態が残らない。
   ============================================ */

const CACHE_NAME = "qr-code-generator-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./qrcode-lib.js",
  "./monetization.js",
  "./manifest.webmanifest",
  "./privacy.html",
  "./terms.html",
  "./operator.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
  self.clients.claim();
});

// ネットワーク優先: オンライン時は常に最新を取得しキャッシュ更新。失敗時のみキャッシュを返す。
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
