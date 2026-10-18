import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 元素");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Service Worker 註冊。
 *
 * 只在「正式建置 + http(s)」時註冊：
 * - 開發模式不註冊，避免快取舊的 dev 資源造成除錯困擾。
 * - Electron 桌面版使用 app:// 協定且資源本來就在本地，不註冊。
 *   （app:// 不是安全上下文的傳統 origin，註冊反而可能造成奇怪的行為）
 * - 桌面版已完全離線，不需要此機制。
 */
const isDesktop = Boolean((window as { niikiDesktop?: unknown }).niikiDesktop);

if (import.meta.env.PROD && !isDesktop && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // 相對路徑註冊，才能同時相容 GitHub Pages 子路徑與網域根目錄。
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // 註冊失敗（例如無 HTTPS、使用者停用）不影響遊戲運作。
    });
  });
}