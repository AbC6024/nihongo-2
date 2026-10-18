/**
 * 建置後處理：
 *  1. 讀取 dist/ 的實際檔案清單
 *  2. 產生帶有預快取清單與版本雜湊的 dist/sw.js
 *
 * 為什麼不用 vite-plugin-pwa？
 * 這個流程只需要掃描 dist 就能完成，不需要額外相依套件，
 * 也讓快取策略完全透明可控。
 *
 * 用法：node scripts/build-sw.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "../../listening");
const SOURCE_SW = resolve(ROOT, "pwa/sw.js");

if (!existsSync(DIST)) {
  console.error("[build-sw] 找不到 dist/，請先執行 vite build。");
  process.exit(1);
}
if (!existsSync(SOURCE_SW)) {
  console.error("[build-sw] 找不到 pwa/sw.js。");
  process.exit(1);
}

/** 不需要預快取的檔案（每次應該取最新的資源）。 */
const EXCLUDE = [/^sw\.js$/, /\.map$/, /robots\.txt$/];

/** 預快取的檔案大小上限（跳過過大的檔案，例如示範影片）。 */
const MAX_PRECACHE_BYTES = 4 * 1024 * 1024;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST)
  .map((file) => ({ file, rel: relative(DIST, file).split("\\").join("/"), size: statSync(file).size }))
  .filter((item) => !EXCLUDE.some((pattern) => pattern.test(item.rel)))
  .filter((item) => item.size <= MAX_PRECACHE_BYTES)
  .sort((a, b) => a.rel.localeCompare(b.rel));

// 版本 = 所有檔案內容的雜湊。只要任何資源改變，版本就會變，
// 使用者下次開啟時會自動清掉舊快取，不會長期停在舊版本。
const hash = createHash("sha256");
for (const item of files) {
  hash.update(item.rel);
  hash.update(readFileSync(item.file));
}
const version = hash.digest("hex").slice(0, 12);

// 一律以 "./" 相對路徑註冊，才能同時相容 GitHub Pages 子路徑與網域根目錄。
const precache = ["./index.html", "./manifest.webmanifest", ...files.map((item) => `./${item.rel}`)];
const uniquePrecache = Array.from(new Set(precache));

const source = readFileSync(SOURCE_SW, "utf8");
const output = source
  .replace("self.__PRECACHE_MANIFEST__ || []", JSON.stringify(uniquePrecache, null, 2))
  .replace("self.__CACHE_VERSION__ || \"dev\"", JSON.stringify(version));

writeFileSync(resolve(DIST, "sw.js"), output, "utf8");

console.log(`[build-sw] 已產生 dist/sw.js`);
console.log(`[build-sw] 快取版本：${version}`);
console.log(`[build-sw] 預快取 ${uniquePrecache.length} 個檔案`);
