/**
 * 介面語言與品牌標題的 UI 測試（jsdom）。
 *
 * 這次改用真實的 App 元件，驗證：
 * - 語言選單位於共用 Header（.topbar）的右上角。
 * - 主要頁面（首頁／遊戲／錯題本／每日挑戰／分析／設定）都能使用語言選單。
 * - 三種語言皆可切換且立即生效，重新載入後仍保留。
 * - 品牌標題《聞いボード》在三種語言下都不變。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../App";
import { BRAND_TITLE, brandDocumentTitle } from "../i18n/brand";
import { en, ja, zhTW } from "../i18n";

const fakeVoice = { lang: "ja-JP", name: "test" } as unknown as SpeechSynthesisVoice;

class FakeUtterance {
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  addEventListener() {}
}

const ROUTES = ["home", "word", "mistakes", "daily", "analytics", "settings"] as const;

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "#/home";
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: () => [fakeVoice],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeUtterance,
  });
});

const roots: Root[] = [];
let container: HTMLDivElement;

function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  roots.push(r);
  act(() => {
    r.render(<App />);
  });
}

async function flush(ms = 60) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  container?.remove();
  document.documentElement.lang = "";
});

/** 讀取 Header 內的語言選單。 */
function langSelect(): HTMLSelectElement | null {
  const topbar = container.querySelector(".topbar");
  if (!topbar) return null;
  return topbar.querySelector<HTMLSelectElement>(".lang-switch__select");
}

async function selectLanguage(locale: "zh-TW" | "ja" | "en") {
  const select = langSelect();
  if (!select) throw new Error("找不到語言選單");
  await act(async () => {
    select.value = locale;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

describe("一、語言選單位置", () => {
  it("位於共用 Header 內", async () => {
    mount();
    await flush();
    const topbar = container.querySelector(".topbar");
    expect(topbar).not.toBeNull();
    expect(langSelect()).not.toBeNull();
  });

  it("顯示在 Header 的右側（title 之後、spacer 靠前）", async () => {
    mount();
    await flush();
    const topbar = container.querySelector(".topbar") as HTMLElement;
    const titleIndex = Array.from(topbar.children).findIndex(
      (child) => child.classList.contains("topbar__title"),
    );
    const switcherIndex = Array.from(topbar.children).findIndex((child) =>
      child.classList.contains("lang-switch"),
    );
    const spacerIndex = Array.from(topbar.children).findIndex((child) =>
      child.classList.contains("topbar__spacer"),
    );
    expect(switcherIndex).toBeGreaterThan(titleIndex);
    expect(switcherIndex).toBeGreaterThan(spacerIndex);
    // 是 Header 最後一個元素 → 視覺上在最右側
    expect(switcherIndex).toBe(topbar.children.length - 1);
  });

  it("按鈕文字就是目前選擇的語言名稱", async () => {
    mount();
    await flush();
    const select = langSelect() as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe("中文");

    await selectLanguage("ja");
    expect((langSelect() as HTMLSelectElement).selectedOptions[0].textContent).toBe("日本語");

    await selectLanguage("en");
    expect((langSelect() as HTMLSelectElement).selectedOptions[0].textContent).toBe("English");
  });

  it("提供三種語言選項", async () => {
    mount();
    await flush();
    const options = Array.from((langSelect() as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["zh-TW", "ja", "en"]);
  });

  it("所有主要頁面都能使用語言選單", async () => {
    for (const route of ROUTES) {
      act(() => {
        roots.splice(0).forEach((r) => r.unmount());
      });
      container?.remove();
      window.location.hash = `#/${route}`;
      mount();
      await flush();

      expect(langSelect(), `${route} 頁面缺少語言選單`).not.toBeNull();

      await selectLanguage("ja");
      expect(document.documentElement.lang, `${route} 切換語言失敗`).toBe("ja");

      await selectLanguage("zh-TW");
      expect(document.documentElement.lang, `${route} 切回中文失敗`).toBe("zh-Hant");
    }
  });

  it("小螢幕也能顯示：語言選單存在且有 aria 標籤", async () => {
    mount();
    await flush();
    const select = langSelect() as HTMLSelectElement;
    expect(select.getAttribute("aria-label")).toBeTruthy();
    expect(container.querySelector(".lang-switch")).not.toBeNull();
    expect(select.className).toContain("lang-switch__select");
  });
});

describe("二、切換語言立即生效並保留設定", () => {
  it("三種語言都能切換且介面立即改變", async () => {
    mount();
    await flush();
    expect(container.textContent).toContain("快速單字");

    await selectLanguage("ja");
    expect(container.textContent).toContain("単語モード");
    expect(container.textContent).not.toContain("快速單字");

    await selectLanguage("en");
    expect(container.textContent).toContain("Word Mode");
    expect(container.textContent).not.toContain("単語モード");

    await selectLanguage("zh-TW");
    expect(container.textContent).toContain("快速單字");
    expect(document.documentElement.lang).toBe("zh-Hant");
  });

  it("寫入 localStorage，重新載入後沿用", async () => {
    mount();
    await flush();
    await selectLanguage("en");

    const raw = window.localStorage.getItem("niiki.settings");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).language).toBe("en");

    // 模擬重新整理
    act(() => {
      for (const r of roots.splice(0)) r.unmount();
    });
    container.remove();
    mount();
    await flush();

    expect(document.documentElement.lang).toBe("en");
    expect(container.textContent).toContain("Word Mode");
  });

  it("切換語言不會影響錯題本、遊玩紀錄或其他設定", async () => {
    mount();
    await flush();
    await selectLanguage("en");

    const settings = JSON.parse(window.localStorage.getItem("niiki.settings") as string);
    expect(settings.inputMethod).toBe("romaji");
    expect(settings.duration).toBe(180);
    expect(settings.difficulties).toEqual(["N5", "N4", "N3", "N2", "N1"]);
    expect(settings.sfxEnabled).toBe(true);
    expect(settings.shortWordRateMultiplier).toBe(0.75);
  });

  it("切換語言不會動到 localStorage 中的錯題本與歷史紀錄", async () => {
    window.localStorage.setItem(
      "niiki.mistakes",
      JSON.stringify({
        "w-neko": {
          questionId: "w-neko",
          mode: "word",
          wrongCount: 2,
          skipCount: 0,
          reviewCount: 1,
          starred: true,
          firstWrongAt: "2026-01-01T00:00:00.000Z",
          lastWrongAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    window.localStorage.setItem(
      "niiki.attempts",
      JSON.stringify([
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          localDate: "2026-01-01",
          gameMode: "word",
          questionId: "w-neko",
          difficulty: "N5",
          category: "動物",
          correct: false,
          wrongAttempts: 1,
          skipped: false,
          score: 0,
          responseTimeMs: 1000,
          inputMethod: "romaji",
        },
      ]),
    );

    mount();
    await flush();
    await selectLanguage("ja");

    expect(window.localStorage.getItem("niiki.mistakes")).toContain("w-neko");
    expect(window.localStorage.getItem("niiki.attempts")).toContain("w-neko");
  });
});

describe("三、品牌標題固定為《聞いボード》", () => {
  it("中文模式顯示品牌標題", async () => {
    mount();
    await flush();
    const title = container.querySelector(".topbar__title");
    expect(title?.textContent).toBe(BRAND_TITLE);
    expect(title?.textContent).toBe("聞いボード");
  });

  it("日文模式顯示品牌標題", async () => {
    mount();
    await flush();
    await selectLanguage("ja");
    expect(container.querySelector(".topbar__title")?.textContent).toBe("聞いボード");
  });

  it("英文模式仍顯示品牌標題，不翻譯", async () => {
    mount();
    await flush();
    await selectLanguage("en");
    const title = container.querySelector(".topbar__title");
    expect(title?.textContent).toBe("聞いボード");
    expect(title?.textContent).not.toContain("Board");
    expect(title?.textContent).not.toContain("Niiki");
  });

  it("首頁大標題也固定為品牌名稱", async () => {
    mount();
    await flush();
    await selectLanguage("en");
    const hero = container.querySelector(".hero__title");
    expect(hero?.textContent).toBe("聞いボード");
  });

  it("各主要頁面的標題都不變", async () => {
    for (const route of ROUTES) {
      act(() => {
        roots.splice(0).forEach((r) => r.unmount());
      });
      container?.remove();
      window.location.hash = `#/${route}`;
      mount();
      await flush();

      await selectLanguage("en");
      expect(
        container.querySelector(".topbar__title")?.textContent,
        `${route} 頁面在英文下標題被翻譯`,
      ).toBe("聞いボード");

      await selectLanguage("ja");
      expect(
        container.querySelector(".topbar__title")?.textContent,
        `${route} 頁面在日文下標題被翻譯`,
      ).toBe("聞いボード");
    }
  });

  it("分頁標題仍包含品牌名稱", async () => {
    mount();
    await flush();
    await selectLanguage("en");
    expect(document.title).toContain("聞いボード");
  });

  it("翻譯字典中已無 appTitle，避免日後被翻譯", () => {
    // 直接檢查三個語言字典，確保品牌名稱不會從翻譯系統被改掉。
    for (const dictionary of [zhTW, ja, en]) {
      expect(Object.keys(dictionary)).not.toContain("appTitle");
    }
    expect(BRAND_TITLE).toBe("聞いボード");
    // 分頁標題在任一語言下都保留品牌名稱
    expect(brandDocumentTitle(en.tagline)).toBe("聞いボード｜Listen, type, remember.");
    expect(brandDocumentTitle(ja.tagline)).toBe("聞いボード｜聞いて、打って、覚えよう。");
  });
});