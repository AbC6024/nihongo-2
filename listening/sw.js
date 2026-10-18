/* eslint-env serviceworker */
/**
 * 《聞いボード》Service Worker（來源檔）。
 *
 * 這個檔案**不會**直接被使用；`npm run build:pwa` 會在建置後把它複製到
 * dist/sw.js，並把下方 __PRECACHE_MANIFEST__ / __CACHE_VERSION__ 換成
 * 實際的檔案清單與版本雜湊。
 *
 * 快取策略（刻意保守，避免更新後卡在舊版本）：
 * - install：只預快取應用程式外殼（HTML / JS / CSS / 圖示 / 題庫範例）。
 * - activate：只刪除本應用程式範圍的舊快取，並立即接管頁面。
 * - fetch：只對註冊範圍內的同源 GET 請求使用 cache-first。
 *   導覽請求（HTML）改用 network-first，確保線上版本是最新。
 * - 有任何無法快取的資源（跨網域、外部音檔）時，直接走網路；
 *   抓不到就拋出錯誤讓頁面自己處理，不假裝有離線內容。
 *
 * 需要網路才能使用的功能（已明確標示，沒有假裝離線可用）：
 * - 題目的日文 AI 語音（瀏覽器 speechSynthesis 依賴作業系統語音引擎，
 *   通常離線可用，但取決於裝置）。
 * - 使用者匯入的詞彙若來自外部網址。
 */

const PRECACHE_MANIFEST = [
  "./index.html",
  "./manifest.webmanifest",
  "./assets/index-4500zctA.css",
  "./assets/index-Cd6wLBzm.js",
  "./audio/sfx/README.md",
  "./DATA_SOURCE.md",
  "./data/vocabulary.sample.json",
  "./favicon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];
const CACHE_VERSION = "0e450195bf33";
const SCOPE_URL = new URL(self.registration.scope);
// 同網域可以有多款遊戲；版本更新不得刪除其他路徑的離線資料。
const CACHE_PREFIX = `niiki-board-${encodeURIComponent(SCOPE_URL.pathname)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

function isInScope(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(SCOPE_URL.pathname);
}

async function remember(cache, request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return;
  try {
    await cache.put(request, response.clone());
  } catch {
    // 儲存空間不足或無法快取時，仍可使用剛取得的網路內容。
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 逐個加入：單一檔案失敗（例如 404）不應該讓整個安裝失敗。
      await Promise.all(
        PRECACHE_MANIFEST.map(async (url) => {
          try {
            const resolved = new URL(url, SCOPE_URL);
            if (isInScope(resolved)) await cache.add(new Request(resolved, { cache: "reload" }));
          } catch {
            /* 略過無法預快取的檔案 */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 外部資源直接走網路
  if (!isInScope(url)) return; // 主站頁面、排行榜 API 與其他遊戲不使用本遊戲快取

  // 頁面導覽：network-first，線上永遠拿到最新版本。
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          await remember(cache, request, fresh);
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const shell = await cache.match(new URL("./index.html", SCOPE_URL).href, { ignoreSearch: true });
          if (shell) return shell;
          return new Response(
            "<!doctype html><meta charset='utf-8'><p>離線模式：找不到快取的頁面。請連線後重新整理。</p>",
            { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // 其他同源資源：cache-first。
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          await remember(cache, request, fresh);
        }
        return fresh;
      } catch (error) {
        // 不快取錯誤或敏感資料；直接回報失敗由頁面處理。
        throw error;
      }
    })(),
  );
});
