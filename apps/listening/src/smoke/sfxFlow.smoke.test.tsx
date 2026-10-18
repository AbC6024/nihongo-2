/**
 * 音效與答題流程的整合測試（jsdom）。
 *
 * 驗證音效觸發點放在**遊戲狀態判定之後**：
 * - 只有確定判定正確才播 correct
 * - 答錯播 wrong
 * - 跳過成功才播 skip，且連點不會重播
 * - 結算最多播一次 gameover
 * - 重複送出／React 重複渲染不會重複播放
 * - 音效不影響計分、計時、答案揭示與自動下一題
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppStoreProvider, useAppStore } from "../store/AppStore";
import { GameShell } from "../components/GameShell";
import { SettingsPage } from "../pages/SettingsPage";
import { useQuizEngine } from "../hooks/useQuizEngine";
import { DEFAULT_SETTINGS } from "../utils/settings";
import { BUILTIN_WORDS } from "../data/words";
import { playSfx, resetSfxState, type SfxName } from "../services/sfx";
import type { GameSettings } from "../types/game";
import type { Question, WordQuestion } from "../types/question";

const settings: GameSettings = { ...DEFAULT_SETTINGS, revealCorrectMs: 20, revealSkipMs: 20 };

const fakeVoice = { lang: "ja-JP", name: "test" } as unknown as SpeechSynthesisVoice;

class FakeUtterance {
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  addEventListener() {}
}

beforeEach(() => {
  window.localStorage.clear();
  resetSfxState();
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
let engine: ReturnType<typeof useQuizEngine> | null = null;
let sfxCalls: SfxName[] = [];
let realPlaySfx: boolean | undefined;

const DEFAULT_POOL: Question[] = BUILTIN_WORDS.slice(0, 5);

function mount(children: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  roots.push(r);
  act(() => {
    r.render(children);
  });
}

function Harness({
  pool = DEFAULT_POOL,
  mode = "word",
  sfxEnabled = true,
  timed = true,
}: {
  pool?: Question[];
  mode?: "word" | "review" | "daily";
  sfxEnabled?: boolean;
  timed?: boolean;
}) {
  const api = useQuizEngine(
    {
      mode,
      settings: { ...settings, sfxEnabled },
      questions: pool,
      ordered: mode === "daily",
      timeLimitSeconds: timed ? 60 : 0,
      skipPenalty: mode === "word",
      dailyScoring: mode === "daily",
      autoSpeak: false,
    },
    {
      onAttemptSettled: () => {},
      onWrongRegistered: () => {},
      onGameFinished: () => {},
      onSfx: (name) => {
        sfxCalls.push(name);
        if (realPlaySfx) {
          playSfx(name, { enabled: sfxEnabled, volume: 0.6 });
        }
      },
    },
    async () => {},
  );
  engine = api;
  return createElement(GameShell, {
    engine: api,
    inputMethod: "romaji",
    imageMode: "disabled",
    showImageHintDuringPlay: false,
    timed,
    totalQuestions: null,
    progressLabel: `${api.answeredCount}`,
    onExit: () => {},
    renderCard: () => createElement("p", null, "請輸入你聽到的答案"),
  });
}

async function tick(ms: number) {
  if (vi.isFakeTimers()) {
    await act(async () => {
      await vi.advanceTimersByTime(ms);
    });
    return;
  }
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

const ready = () => tick(2600);

function answer(text: string) {
  act(() => {
    engine?.setInput(text);
  });
  act(() => {
    engine?.submit();
  });
}

function currentWord(): WordQuestion {
  const question = engine?.question;
  if (!question || !("japanese" in question)) throw new Error("預期單字題");
  return question as WordQuestion;
}

function render(props: Parameters<typeof Harness>[0] = {}) {
  mount(
    createElement(AppStoreProvider, null, createElement(Harness, props)),
  );
}

afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  container?.remove();
  vi.useRealTimers();
  engine = null;
  sfxCalls = [];
  realPlaySfx = undefined;
});

describe("音效觸發：答題結果決定", () => {
  it("答對時播放一次 correct 音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();
    expect(sfxCalls).toHaveLength(0);

    answer(currentWord().romaji);
    expect(sfxCalls).toEqual(["correct"]);
    expect(engine?.score).toBe(100);
  });

  it("答錯時播放 wrong 音效，且不影響計分", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();

    answer("definitely-wrong");
    expect(sfxCalls).toEqual(["wrong"]);
    expect(engine?.score).toBe(0);
    expect(engine?.wrongAttempts).toBe(1);
  });

  it("答錯重試後答對：wrong 一次、correct 一次", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();

    answer("nope");
    answer("still-nope");
    answer(currentWord().romaji);
    expect(sfxCalls).toEqual(["wrong", "wrong", "correct"]);
    expect(engine?.score).toBe(80);
  });

  it("答錯音效後題目語音會稍後重播，不與音效同時", async () => {
    vi.useFakeTimers();
    const speakSpy = vi.fn().mockResolvedValue(undefined);
    function SpeakHarness() {
      const api = useQuizEngine(
        {
          mode: "word",
          settings,
          questions: [BUILTIN_WORDS[0]],
          timeLimitSeconds: 60,
          skipPenalty: true,
          autoSpeak: true,
        },
        {
          onAttemptSettled: () => {},
          onWrongRegistered: () => {},
          onGameFinished: () => {},
          onSfx: (name) => sfxCalls.push(name),
        },
        speakSpy,
      );
      engine = api;
      return null;
    }
    mount(
      createElement(AppStoreProvider, null, createElement(SpeakHarness)),
    );
    await tick(20);
    await ready();
    speakSpy.mockClear();

    answer("wrong");
    expect(sfxCalls).toEqual(["wrong"]);
    // 答錯當下尚未重播題目語音
    expect(speakSpy).not.toHaveBeenCalled();

    await tick(300);
    expect(speakSpy).toHaveBeenCalledTimes(1);
  });
});

describe("音效觸發：跳過", () => {
  it("跳過成功才播 skip 音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();

    expect(engine?.canSkipNow).toBe(false);
    act(() => {
      engine?.skip();
    });
    expect(sfxCalls).toHaveLength(0);

    answer("x1");
    answer("x2");
    answer("x3");
    expect(engine?.canSkipNow).toBe(true);
    expect(sfxCalls).toEqual(["wrong", "wrong", "wrong"]);

    act(() => {
      engine?.skip();
    });
    expect(sfxCalls).toEqual(["wrong", "wrong", "wrong", "skip"]);
    expect(engine?.phase).toBe("SKIPPED");
    expect(engine?.skippedCount).toBe(1);
  });

  it("連點跳過不會重複播放 skip 音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();

    answer("x1");
    answer("x2");
    answer("x3");
    act(() => {
      engine?.skip();
    });
    act(() => {
      engine?.skip();
    });
    act(() => {
      engine?.skip();
    });

    expect(sfxCalls.filter((name) => name === "skip")).toHaveLength(1);
    expect(engine?.skippedCount).toBe(1);
    expect(engine?.score).toBe(0);
  });

  it("複習模式跳過也會播放 skip 音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]], mode: "review", timed: false });
    await tick(20);
    await ready();
    answer("x1");
    answer("x2");
    answer("x3");
    act(() => {
      engine?.skip();
    });
    expect(sfxCalls).toContain("skip");
    expect(engine?.score).toBe(0);
  });
});

describe("音效去重：不因重複送出或重複渲染而重播", () => {
  it("答案揭示中重複送出不會再播放音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();

    answer(currentWord().romaji);
    expect(sfxCalls).toEqual(["correct"]);
    answer(currentWord().romaji);
    answer("anything");
    answer("more");
    expect(sfxCalls).toEqual(["correct"]);
    expect(engine?.score).toBe(100);
  });

  it("React 重複渲染不會重複觸發音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();
    answer(currentWord().romaji);
    const before = sfxCalls.length;
    // 強制多次重繪
    for (let i = 0; i < 5; i += 1) await tick(10);
    expect(sfxCalls).toHaveLength(before);
  });

  it("音效不阻塞計分與自動下一題", async () => {
    vi.useFakeTimers();
    realPlaySfx = true;
    render({ pool: [BUILTIN_WORDS[0], BUILTIN_WORDS[1]] });
    await tick(20);
    await ready();

    answer(currentWord().romaji);
    // 音效是 fire-and-forget：分數立即更新，自動下一題也照常
    expect(engine?.score).toBe(100);
    expect(engine?.phase).toBe("CORRECT");
    await tick(1200);
    expect(engine?.question?.id).toBe(BUILTIN_WORDS[1].id);
    expect(engine?.phase).toBe("PLAYING");
  });
});

describe("音效觸發：結算", () => {
  it("限時歸零時播放一次 gameover 音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();
    expect(sfxCalls).toHaveLength(0);

    await tick(61_000);
    expect(engine?.phase).toBe("GAME_OVER");
    expect(sfxCalls.filter((name) => name === "gameover")).toHaveLength(1);
  });

  it("今日挑戰完成時播放一次 gameover 音效", async () => {
    vi.useFakeTimers();
    const pool: Question[] = BUILTIN_WORDS.slice(0, 3);
    render({ pool, mode: "daily", timed: false });
    await tick(20);
    await ready();

    for (let i = 0; i < 3; i += 1) {
      answer(currentWord().romaji);
      await tick(1200);
    }
    expect(engine?.phase).toBe("GAME_OVER");
    expect(sfxCalls.filter((name) => name === "gameover")).toHaveLength(1);
    expect(sfxCalls.filter((name) => name === "correct")).toHaveLength(3);
  });

  it("結算後不會重複播放 gameover", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0]] });
    await tick(20);
    await ready();
    await tick(61_000);
    await tick(5000);
    await tick(5000);
    expect(sfxCalls.filter((name) => name === "gameover")).toHaveLength(1);
  });

  it("複習模式的單題倒數結束不會誤觸結算音效以外的音效", async () => {
    vi.useFakeTimers();
    render({ pool: [BUILTIN_WORDS[0], BUILTIN_WORDS[1]], mode: "review", timed: false });
    await tick(20);
    await ready();
    answer(currentWord().romaji);
    expect(sfxCalls).toEqual(["correct"]);
    await tick(11_000);
    // 10 秒倒數自動下一題，仍然只有一次 correct
    expect(sfxCalls).toEqual(["correct"]);
    expect(engine?.phase).toBe("PLAYING");
  });
});

describe("音效開關", () => {
  it("關閉音效時不播放任何提示音，但遊戲流程完全正常", async () => {
    vi.useFakeTimers();
    realPlaySfx = true;
    render({ pool: [BUILTIN_WORDS[0]], sfxEnabled: false });
    await tick(20);
    await ready();

    answer("nope");
    answer(currentWord().romaji);
    expect(engine?.phase).toBe("CORRECT");
    expect(engine?.score).toBe(90);

    // onSfx 仍會被呼叫，但 playSfx 內部因 enabled:false 不會發聲。
    // 這裡確認音效服務本身正確回傳 false（沒有建立任何節點）。
    expect(playSfx("correct", { enabled: false, volume: 0.6 })).toBe(false);
  });
});

describe("音效設定介面", () => {
  it("設定頁有音效開關與音量，預設開啟", async () => {
    let current: GameSettings | null = null;
    function Body() {
      current = useAppStore().settings;
      return createElement(SettingsPage, { onBack: () => {} });
    }
    mount(createElement(AppStoreProvider, null, createElement(Body)));
    await tick(20);

    const text = container.textContent ?? "";
    expect(text).toContain("音效");
    expect(text).toContain("答題提示音效");
    expect(text).toContain("音效音量");

    const before = current as unknown as GameSettings;
    expect(before.sfxEnabled).toBe(true);
    expect(before.sfxVolume).toBeGreaterThan(0);

    const all = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(all.length).toBeGreaterThan(0);

    act(() => {
      const sfxToggle = all.find(
        (input) =>
          input.closest(".toggle")?.textContent?.includes("答題提示音效") ?? false,
      );
      if (!sfxToggle) throw new Error("找不到音效開關");
      sfxToggle.click();
    });
    await tick(20);

    const after = current as unknown as GameSettings;
    expect(after.sfxEnabled).toBe(false);
    // 設定保存到 localStorage
    const stored = JSON.parse(window.localStorage.getItem("niiki.settings") as string);
    expect(stored.sfxEnabled).toBe(false);
    // 其他設定不受影響
    expect(stored.inputMethod).toBe("romaji");
    expect(stored.duration).toBe(180);
  });
});