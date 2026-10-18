/**
 * PWA 與部署資產檢查（Node 環境）。
 *
 * 這些檔案位於 public/ 與 dist/，建置時會被原樣複製，
 * 因此可以在測試中直接驗證內容正確性。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const ROOT = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");
const has = (rel: string) => existsSync(resolve(ROOT, rel));

describe("PWA 資產存在", () => {
  it("normalizes directory entry URLs while retaining query, hash and GitHub Pages prefixes", () => {
    const script = read("index.html").match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
    expect(script).toBeTruthy();
    for (const pathname of ["/listening", "/nihongo-2/listening", "/listening/", "/listening/index.html"]) {
      const url = new URL(pathname + "?practice=1#/word", "https://example.com");
      let replacement: string | undefined;
      runInNewContext(script!, {URL, location:{href:url.href, pathname:url.pathname, replace:(href:string) => {replacement = href;}}});
      if (pathname.endsWith('/listening')) {
        expect(replacement).toBe(`https://example.com${pathname}/?practice=1#/word`);
      } else expect(replacement).toBeUndefined();
    }
  });
  it("manifest.webmanifest 存在且是合法 JSON", () => {
    expect(has("public/manifest.webmanifest")).toBe(true);
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it("名稱與短名稱使用固定品牌名稱", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    expect(manifest.short_name).toBe("聞いボード");
    expect(manifest.name).toContain("聞いボード");
  });

  it("三種尺寸圖示齊全，並含 maskable 版本", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose);
    expect(purposes).toContain("maskable");
  });

  it("圖示檔案實際存在且是 PNG", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest"));
    for (const icon of manifest.icons as { src: string }[]) {
      const path = resolve(ROOT, "public", icon.src.replace(/^\.\//, ""));
      expect(existsSync(path), `${icon.src} 不存在`).toBe(true);
      const header = readFileSync(path).subarray(0, 8).toString("hex");
      expect(header).toBe("89504e470d0a1a0a");
    }
  });

  it("apple-touch-icon 與 favicon 存在", () => {
    expect(has("public/icons/apple-touch-icon.png")).toBe(true);
    expect(has("public/favicon.svg")).toBe(true);
  });

  it("Service Worker 來源檔存在且使用相對路徑註冊策略", () => {
    expect(has("pwa/sw.js")).toBe(true);
    const sw = read("pwa/sw.js");
    expect(sw).toContain("self.__PRECACHE_MANIFEST__");
    expect(sw).toContain("self.__CACHE_VERSION__");
    expect(sw).toContain("skipWaiting");
    // 只快取同源資源，不碰跨網域
    expect(sw).toContain("url.origin !== self.location.origin");
  });

  it("index.html 有連結 manifest 與 apple-touch-icon", () => {
    const html = read("index.html");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain("manifest.webmanifest");
    expect(html).toContain("apple-touch-icon");
    expect(html).toContain("viewport-fit=cover");
  });

  it("manifest 使用相對路徑，可部署在子路徑（GitHub Pages）", () => {
    const manifest = read("public/manifest.webmanifest");
    const parsed = JSON.parse(manifest);
    expect(parsed.start_url.startsWith("./")).toBe(true);
    expect(parsed.scope.startsWith("./")).toBe(true);
    for (const icon of parsed.icons as { src: string }[]) {
      expect(icon.src.startsWith("./"), icon.src).toBe(true);
    }
  });
});

