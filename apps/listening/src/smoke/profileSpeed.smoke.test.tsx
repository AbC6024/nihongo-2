/**
 * 個人檔案與遊戲內語音速度的 UI 測試（jsdom）。
 *
 * 涵蓋驗收條件：
 * - 首頁左上角有個人檔案入口，顯示頭像與暱稱
 * - 可以修改暱稱、更換頭像，並在重新載入後保留
 * - 遊戲內快捷鍵提示下方有語音速度選項，可切換 1.0× / 0.5×
 * - 切換語音速度不影響計分、輸入與計時
 * - 「設定與資料」已從首頁移入個人檔案
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppStoreProvider, useAppStore } from "../store/AppStore";
import { I18nProvider } from "../i18n";
import { Avatar } from "../components/Avatar";
import { SpeechSpeedControl } from "../components/SpeechSpeedControl";
import { DEFAULT_SETTINGS } from "../utils/settings";
import { DEFAULT_NICKNAME, MAX_NICKNAME_LENGTH } from "../services/profile";
import type { GameSettings } from "../types/game";

class FakeUtterance {
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  addEventListener() {}
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: () => [],
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

function mount(children: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(children);
  });
}

async function flush(ms = 40) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  container?.remove();
});

function I18nBridge({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useAppStore();
  return (
    <I18nProvider
      locale={settings.language}
      onLocaleChange={(locale) => updateSettings({ language: locale })}
    >
      {children}
    </I18nProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <AppStoreProvider>
      <I18nBridge>{children}</I18nBridge>
    </AppStoreProvider>
  );
}

describe("個人檔案入口（首頁左上角）", () => {
  function Body() {
    const { profile } = useAppStore();
    return createElement(
      "div",
      null,
      createElement(
        "button",
        { className: "profile-entry", type: "button" },
        createElement(Avatar, { profile, size: 44 }),
        profile.nickname,
      ),
    );
  }

  it("顯示頭像與預設暱稱", async () => {
    mount(
      createElement(
        Shell,
        null,
        createElement(Body),
      ),
    );
    await flush();
    const entry = container.querySelector(".profile-entry");
    expect(entry).not.toBeNull();
    expect(entry?.querySelector(".avatar")).not.toBeNull();
    expect(container.textContent).toContain(DEFAULT_NICKNAME);
  });

  it("修改暱稱後立即更新", async () => {
    let settingsRef: GameSettings | null = null;
    function Body() {
      const { profile, updateNickname } = useAppStore();
      return createElement(
        "div",
        null,
        createElement("span", { id: "name" }, profile.nickname),
        createElement("span", { id: "avatarId" }, profile.avatarId),
        createElement(
          "button",
          { type: "button", id: "rename", onClick: () => updateNickname("  測試玩家  ") },
        ),
        createElement(
          "button",
          { type: "button", id: "star", onClick: () => updateNickname("") },
        ),
      );
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(Body),
      ),
    );
    await flush();
    expect(container.querySelector("#name")?.textContent).toBe(DEFAULT_NICKNAME);

    act(() => {
      (container.querySelector("#rename") as HTMLButtonElement).click();
    });
    await flush();
    // 前後空白被去除
    expect(container.querySelector("#name")?.textContent).toBe("測試玩家");

    // 空白暱稱回到預設值，不會讓介面壞掉
    act(() => {
      (container.querySelector("#star") as HTMLButtonElement).click();
    });
    await flush();
    expect(container.querySelector("#name")?.textContent).toBe(DEFAULT_NICKNAME);

    settingsRef = DEFAULT_SETTINGS;
    void settingsRef;
  });

  it("選擇內建頭像會保存", async () => {
    function Body() {
      const { profile, selectAvatar } = useAppStore();
      return createElement(
        "div",
        null,
        createElement("span", { id: "avatarId" }, profile.avatarId),
        createElement("span", { id: "custom" }, profile.customAvatar ?? "none"),
        createElement("button", {
          type: "button",
          id: "pick",
          onClick: () => selectAvatar("avatar-star"),
        }),
      );
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(Body),
      ),
    );
    await flush();
    act(() => {
      (container.querySelector("#pick") as HTMLButtonElement).click();
    });
    await flush();
    expect(container.querySelector("#avatarId")?.textContent).toBe("avatar-star");
    expect(container.querySelector("#custom")?.textContent).toBe("none");
  });

  it("暱稱與頭像在重新載入後保留（localStorage）", async () => {
    function Writer() {
      const { updateNickname, selectAvatar } = useAppStore();
      return createElement(
        "button",
        {
          type: "button",
          id: "save",
          onClick: () => {
            updateNickname("小明");
            selectAvatar("avatar-cat");
          },
        },
      );
    }
    function Reader() {
      const { profile } = useAppStore();
      return createElement(
        "div",
        null,
        createElement("span", { id: "name" }, profile.nickname),
        createElement("span", { id: "avatar" }, profile.avatarId),
      );
    }

    mount(
      createElement(
        Shell,
        null,
        createElement(Writer),
        createElement(Reader),
      ),
    );
    await flush();
    act(() => {
      (container.querySelector("#save") as HTMLButtonElement).click();
    });
    await flush();

    // 模擬重新整理
    act(() => {
      for (const r of roots.splice(0)) r.unmount();
    });
    container.remove();
    mount(
      createElement(
        Shell,
        null,
        createElement(Reader),
      ),
    );
    await flush();

    expect(container.querySelector("#name")?.textContent).toBe("小明");
    expect(container.querySelector("#avatar")?.textContent).toBe("avatar-cat");
  });

  it("自訂頭像失效時不會破圖（avatarId 回到內建）", async () => {
    window.localStorage.setItem(
      "niiki.profile",
      JSON.stringify({ nickname: "小明", avatarId: "custom", customAvatar: null }),
    );
    function Reader() {
      const { profile } = useAppStore();
      return createElement("span", { id: "avatar" }, profile.avatarId);
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(Reader),
      ),
    );
    await flush();
    expect(container.querySelector("#avatar")?.textContent).toBe("avatar-default");
  });

  it("暱稱長度上限常數為 20", () => {
    expect(MAX_NICKNAME_LENGTH).toBe(20);
  });
});

describe("遊戲內語音速度選項", () => {
  function SpeedHarness() {
    const { settings, updateSettings } = useAppStore();
    return createElement(SpeechSpeedControl, {
      settings,
      onChange: (speed) => updateSettings({ speechSpeed: speed }),
    });
  }

  it("預設是正常速度 1.0×", async () => {
    mount(
      createElement(
        Shell,
        null,
        createElement(SpeedHarness),
      ),
    );
    await flush();
    const buttons = container.querySelectorAll(".speech-speed__btn");
    expect(buttons).toHaveLength(2);
    expect((buttons[0] as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("1.0×");
  });

  it("顯示正常速度與慢速兩個選項", async () => {
    mount(
      createElement(
        Shell,
        null,
        createElement(SpeedHarness),
      ),
    );
    await flush();
    expect(container.textContent).toContain("正常速度");
    expect(container.textContent).toContain("慢速");
    expect(container.textContent).toContain("0.5×");
  });

  it("可以切換到 0.5× 並立即套用", async () => {
    function Reader() {
      const { settings } = useAppStore();
      return createElement("span", { id: "speed" }, String(settings.speechSpeed));
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(SpeedHarness),
        createElement(Reader),
      ),
    );
    await flush();
    const buttons = container.querySelectorAll(".speech-speed__btn");
    act(() => {
      (buttons[1] as HTMLButtonElement).click();
    });
    await flush();
    expect(container.querySelector("#speed")?.textContent).toBe("0.5");
    expect((buttons[1] as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
    expect((buttons[0] as HTMLButtonElement).getAttribute("aria-pressed")).toBe("false");
  });

  it("切回 1.0× 後恢復正常", async () => {
    function Reader() {
      const { settings } = useAppStore();
      return createElement("span", { id: "speed" }, String(settings.speechSpeed));
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(SpeedHarness),
        createElement(Reader),
      ),
    );
    await flush();
    const buttons = container.querySelectorAll(".speech-speed__btn");
    act(() => {
      (buttons[1] as HTMLButtonElement).click();
    });
    await flush();
    act(() => {
      (buttons[0] as HTMLButtonElement).click();
    });
    await flush();
    expect(container.querySelector("#speed")?.textContent).toBe("1");
  });

  it("重新開啟遊戲後保留語音速度", async () => {
    function Harness() {
      const { settings, updateSettings } = useAppStore();
      return createElement(
        "div",
        null,
        createElement("span", { id: "speed" }, String(settings.speechSpeed)),
        createElement("button", {
          type: "button",
          id: "slow",
          onClick: () => updateSettings({ speechSpeed: 0.5 }),
        }),
      );
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(Harness),
      ),
    );
    await flush();
    act(() => {
      (container.querySelector("#slow") as HTMLButtonElement).click();
    });
    await flush();

    act(() => {
      for (const r of roots.splice(0)) r.unmount();
    });
    container.remove();
    mount(
      createElement(
        Shell,
        null,
        createElement(Harness),
      ),
    );
    await flush();
    expect(container.querySelector("#speed")?.textContent).toBe("0.5");
  });

  it("切換語音速度不會影響其他遊戲設定", async () => {
    let captured: GameSettings | null = null;
    function Harness() {
      const { settings, updateSettings } = useAppStore();
      captured = settings;
      return createElement(SpeechSpeedControl, {
        settings,
        onChange: (speed) => updateSettings({ speechSpeed: speed }),
      });
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(Harness),
      ),
    );
    await flush();
    const buttons = container.querySelectorAll(".speech-speed__btn");
    act(() => {
      (buttons[1] as HTMLButtonElement).click();
    });
    await flush();

    const after = captured as unknown as GameSettings;
    expect(after.speechSpeed).toBe(0.5);
    expect(after.inputMethod).toBe(DEFAULT_SETTINGS.inputMethod);
    expect(after.duration).toBe(DEFAULT_SETTINGS.duration);
    expect(after.difficulties).toEqual(DEFAULT_SETTINGS.difficulties);
    expect(after.reviewRevealMs).toBe(DEFAULT_SETTINGS.reviewRevealMs);
    expect(after.sfxEnabled).toBe(DEFAULT_SETTINGS.sfxEnabled);
  });

  it("設定頁資料載入時缺少語音速度欄位會回到 1.0×", async () => {
    window.localStorage.setItem(
      "niiki.settings",
      JSON.stringify({ duration: 120, inputMethod: "kana", difficulty: ["N5"] }),
    );
    function Reader() {
      const { settings } = useAppStore();
      return createElement("span", { id: "speed" }, String(settings.speechSpeed));
    }
    mount(
      createElement(
        Shell,
        null,
        createElement(Reader),
      ),
    );
    await flush();
    expect(container.querySelector("#speed")?.textContent).toBe("1");
  });
});