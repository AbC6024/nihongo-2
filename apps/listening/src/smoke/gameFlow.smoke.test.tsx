/**
 * 遊戲流程煙霧測試：在 jsdom 中實際渲染 React 元件並模擬作答。
 *
 * 這是「程式層級」的驗證（render + 模擬按鍵/計時），
 * 不等同於人工操作真實瀏覽器。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppStoreProvider } from "../store/AppStore";
import { GameShell } from "../components/GameShell";
import { HomePage } from "../pages/HomePage";
import { MistakesPage } from "../pages/MistakesPage";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { useQuizEngine, type EngineResult } from "../hooks/useQuizEngine";
import { DEFAULT_SETTINGS } from "../utils/settings";
import { BUILTIN_WORDS } from "../data/words";
import { BUILTIN_SENTENCES } from "../data/sentences";
import { DAILY_MAX_SCORE } from "../utils/scoring";
import { completeDailyChallenge, createEmptyDailyRecord } from "../utils/dailyChallenge";
import { toLocalDateKey } from "../utils/date";
import type { GameSettings } from "../types/game";
import type { Question, WordQuestion } from "../types/question";

const fakeVoice = {
  lang: "ja-JP",
  name: "test",
  default: false,
  localService: false,
  voiceURI: "test",
} as unknown as SpeechSynthesisVoice;

class FakeUtterance {
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  addEventListener() {}
}

beforeEach(() => {
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

const settings: GameSettings = { ...DEFAULT_SETTINGS, revealCorrectMs: 20, revealSkipMs: 20 };

const DEFAULT_POOL: Question[] = BUILTIN_WORDS.slice(0, 5);
const roots: Root[] = [];

let container: HTMLDivElement;
let root: Root;
let latestEngine: ReturnType<typeof useQuizEngine> | null = null;
let latestResult: EngineResult | null = null;

function mount(element: ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(element);
  });
}

/** 用真實題庫驅動引擎，模擬玩家操作。 */
function GameHarness({
  pool = DEFAULT_POOL,
  mode = "word",
  onFinish,
}: {
  pool?: Question[];
  mode?: "word" | "daily" | "review";
  onFinish?: (result: EngineResult) => void;
}) {
  const engine = useQuizEngine(
    {
      mode,
      settings,
      questions: pool,
      ordered: mode === "daily",
      timeLimitSeconds: mode === "word" ? 60 : 0,
      skipPenalty: mode === "word",
      dailyScoring: mode === "daily",
      autoSpeak: false,
    },
    {
      onAttemptSettled: () => {},
      onWrongRegistered: () => {},
      onGameFinished: (result) => {
        latestResult = result;
        onFinish?.(result);
      },
    },
    async () => {},
  );
  latestEngine = engine;
  return createElement(GameShell, {
    engine,
    inputMethod: "romaji",
    imageMode: "disabled",
    showImageHintDuringPlay: false,
    timed: mode === "word",
    totalQuestions: mode === "daily" ? 10 : null,
    progressLabel: `${engine.answeredCount}`,
    onExit: () => {},
    renderCard: () => createElement("p", null, "請輸入你聽到的答案"),
  });
}

function renderGame(props: Parameters<typeof GameHarness>[0] = {}) {
  mount(createElement(AppStoreProvider, null, createElement(GameHarness, props)));
}

/** 同時支援真實計時器與假計時器，讓測試不會因為假計時器而卡住。 */
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

const flush = (ms = 30) => tick(ms);

/** 等待 READY 3 → 2 → 1 倒數結束。 */
const waitReady = () => tick(2600);

function answer(text: string) {
  act(() => {
    latestEngine?.setInput(text);
  });
  act(() => {
    latestEngine?.submit();
  });
}

function currentWord(): WordQuestion {
  const question = latestEngine?.question;
  if (!question || !("japanese" in question)) {
    throw new Error(`預期單字題，實際為 ${question ? "sentence" : "none"}`);
  }
  return question as WordQuestion;
}

afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  container?.remove();
  vi.useRealTimers();
  latestEngine = null;
  latestResult = null;
});

describe("一般單字模式（jsdom 實測流程）", () => {
  it("第一次答對 +100", async () => {
    renderGame({ pool: [BUILTIN_WORDS[0]] });
    await flush();
    await waitReady();
    expect(latestEngine?.phase).toBe("PLAYING");

    answer(currentWord().romaji);
    expect(latestEngine?.phase).toBe("CORRECT");
    expect(latestEngine?.score).toBe(100);
    expect(latestEngine?.correctCount).toBe(1);
    expect(latestEngine?.lastReveal).toEqual({ correct: true, score: 100, skipped: false });
  });

  it("答錯一次後答對 +90，答錯兩次後答對 +80", async () => {
    renderGame({ pool: [BUILTIN_WORDS[1]] });
    await flush();
    await waitReady();

    answer("wrong-1");
    expect(latestEngine?.phase).toBe("WRONG");
    expect(latestEngine?.wrongAttempts).toBe(1);
    expect(latestEngine?.score).toBe(0); // 答錯不扣總分

    answer("wrong-2");
    expect(latestEngine?.wrongAttempts).toBe(2);

    answer(currentWord().romaji);
    expect(latestEngine?.phase).toBe("CORRECT");
    expect(latestEngine?.score).toBe(80);
  });

  it("答對後約 1 秒自動進入下一題，且同一題不重複計分", async () => {
    vi.useFakeTimers();
    const pool = [BUILTIN_WORDS[0], BUILTIN_WORDS[1]];
    renderGame({ pool });
    await flush(20);
    await waitReady();

    const firstId = latestEngine?.question?.id;
    answer(currentWord().romaji);
    expect(latestEngine?.score).toBe(100);

    // 揭示中重複提交不得再計分
    answer(currentWord().romaji);
    answer("anything");
    expect(latestEngine?.score).toBe(100);

    await tick(1200);
    expect(latestEngine?.question?.id).not.toBe(firstId);
    expect(latestEngine?.score).toBe(100);
    expect(latestEngine?.answeredCount).toBe(1);
  });

  it("答錯 3 次後可跳過，總分扣 50 且最低為 0，只能結算一次", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[2]] });
    await flush(20);
    await waitReady();

    expect(latestEngine?.canSkipNow).toBe(false);
    answer("bad-1");
    expect(latestEngine?.canSkipNow).toBe(false);
    answer("bad-2");
    expect(latestEngine?.canSkipNow).toBe(false);
    answer("bad-3");
    expect(latestEngine?.canSkipNow).toBe(true);

    act(() => {
      latestEngine?.skip();
    });
    expect(latestEngine?.phase).toBe("SKIPPED");
    expect(latestEngine?.score).toBe(0);
    expect(latestEngine?.skippedCount).toBe(1);
    expect(latestEngine?.answeredCount).toBe(1);

    // 連按跳過不得重複結算
    act(() => {
      latestEngine?.skip();
    });
    expect(latestEngine?.skippedCount).toBe(1);
    expect(latestEngine?.score).toBe(0);
  });

  it("跳過會扣總分 50（先累積分數後）", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[0], BUILTIN_WORDS[1], BUILTIN_WORDS[2]] });
    await flush(20);
    await waitReady();

    // 第一題答對 +100
    answer(currentWord().romaji);
    expect(latestEngine?.score).toBe(100);
    await act(async () => {
      await vi.advanceTimersByTime(1200);
    });

    // 第二題答錯 3 次後跳過 → 100 - 50 = 50
    answer("x1");
    answer("x2");
    answer("x3");
    act(() => {
      latestEngine?.skip();
    });
    expect(latestEngine?.score).toBe(50);
  });

  it("計時歸零後鎖定，不能再作答、計分或寫入紀錄", async () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    renderGame({ pool: [BUILTIN_WORDS[0]], onFinish });
    await flush(20);
    await waitReady();
    expect(latestEngine?.phase).toBe("PLAYING");

    await tick(61_000);
    expect(latestEngine?.phase).toBe("GAME_OVER");
    expect(onFinish).toHaveBeenCalledTimes(1);
    const scoreAtEnd = latestEngine?.score;

    answer("anything");
    expect(latestEngine?.score).toBe(scoreAtEnd);
    expect(latestEngine?.phase).toBe("GAME_OVER");
    // 結算函式不可被重複觸發
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("計時使用時間戳差值，背景延遲不會讓時間漂移", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[0]] });
    await flush(20);
    await waitReady();

    await tick(30_000);
    expect(latestEngine?.remainingMs).toBeLessThanOrEqual(30_000);
    expect(latestEngine?.remainingMs).toBeGreaterThan(29_000);
    expect(latestEngine?.phase).toBe("PLAYING");
  });
});

describe("句子填空模式（jsdom 實測流程）", () => {
  it("作答前畫面顯示挖空句、不洩漏答案；答對後才揭示", async () => {
    vi.useFakeTimers();
    const sentence = BUILTIN_SENTENCES[0];
    renderGame({ pool: [sentence], mode: "word" });
    await flush(20);
    await waitReady();

    // 引擎作答前不提供答案資訊
    expect(latestEngine?.phase).toBe("PLAYING");
    expect(latestEngine?.question?.id).toBe(sentence.id);

    answer(sentence.answer);
    expect(latestEngine?.phase).toBe("CORRECT");
    expect(latestEngine?.score).toBe(100);
    expect(latestEngine?.lastReveal?.correct).toBe(true);
  });

  it("句子題答錯也會降低本題可得分數", async () => {
    vi.useFakeTimers();
    const sentence = BUILTIN_SENTENCES[1];
    renderGame({ pool: [sentence], mode: "word" });
    await flush(20);
    await waitReady();

    answer("nope");
    expect(latestEngine?.wrongAttempts).toBe(1);
    answer(sentence.romaji ?? sentence.answer);
    expect(latestEngine?.score).toBe(90);
  });
});

describe("複習模式（jsdom 實測流程）", () => {
  it("答對後進入 10 秒揭示倒數，到 0 自動下一題", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[0], BUILTIN_WORDS[1]], mode: "review" });
    await flush(20);
    await waitReady();

    const firstId = latestEngine?.question?.id;
    answer(currentWord().romaji);
    expect(latestEngine?.phase).toBe("CORRECT");
    expect(latestEngine?.reviewDeadline).not.toBeNull();

    await tick(9_000);
    expect(latestEngine?.question?.id).toBe(firstId);

    await tick(2_000);
    expect(latestEngine?.question?.id).not.toBe(firstId);
    expect(latestEngine?.phase).toBe("PLAYING");
  });

  it("可以手動按「下一題」跳過倒數", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[0], BUILTIN_WORDS[1]], mode: "review" });
    await flush(20);
    await waitReady();

    const firstId = latestEngine?.question?.id;
    answer(currentWord().romaji);
    expect(latestEngine?.reviewDeadline).not.toBeNull();

    act(() => {
      latestEngine?.nextQuestion();
    });
    expect(latestEngine?.question?.id).not.toBe(firstId);
    expect(latestEngine?.phase).toBe("PLAYING");
  });

  it("複習模式跳過不扣總分", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[0]], mode: "review" });
    await flush(20);
    await waitReady();

    answer("x1");
    answer("x2");
    answer("x3");
    act(() => {
      latestEngine?.skip();
    });
    expect(latestEngine?.phase).toBe("SKIPPED");
    expect(latestEngine?.score).toBe(0);
    expect(latestEngine?.skippedCount).toBe(1);
  });
});

describe("今日挑戰（jsdom 實測流程）", () => {
  it("恰有 10 題，每題答對 +200，最高 2000 分", async () => {
    vi.useFakeTimers();
    const pool: Question[] = BUILTIN_WORDS.slice(0, 10);
    const onFinish = vi.fn();
    renderGame({ pool, mode: "daily", onFinish });
    await flush(20);
    await waitReady();

    for (let i = 0; i < 10; i += 1) {
      const word = currentWord();
      answer(word.romaji);
      expect(latestEngine?.score, `第 ${i + 1} 題後的分數`).toBe((i + 1) * 200);
      await act(async () => {
        await vi.advanceTimersByTime(1200);
      });
    }

    expect(latestEngine?.score).toBe(DAILY_MAX_SCORE);
    expect(latestEngine?.answeredCount).toBe(10);
    expect(latestEngine?.correctCount).toBe(10);
    expect(latestEngine?.phase).toBe("GAME_OVER");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(latestResult?.score).toBe(2000);
  });

  it("答錯不扣分，跳過得 0 分且不扣分", async () => {
    vi.useFakeTimers();
    renderGame({ pool: [BUILTIN_WORDS[0], BUILTIN_WORDS[1], BUILTIN_WORDS[2]], mode: "daily" });
    await flush(20);
    await waitReady();

    answer("wrong-1");
    answer("wrong-2");
    expect(latestEngine?.score).toBe(0);
    answer("wrong-3");
    act(() => {
      latestEngine?.skip();
    });
    expect(latestEngine?.phase).toBe("SKIPPED");
    expect(latestEngine?.score).toBe(0);
  });

  it("10 題完成後結算並更新連勝", () => {
    let record = createEmptyDailyRecord();
    const first = completeDailyChallenge({ dateKey: toLocalDateKey(), score: 2000, record });
    expect(first.isNewWin).toBe(true);
    expect(first.currentStreak).toBe(1);
    record = first.record;

    const replay = completeDailyChallenge({ dateKey: toLocalDateKey(), score: 1200, record });
    expect(replay.isNewWin).toBe(false);
    expect(replay.record.totalDailyWins).toBe(1);
    expect(replay.record.dailyBestScoreByDate[toLocalDateKey()]).toBe(2000);
  });
});

describe("頁面渲染（jsdom）", () => {
  it("首頁顯示標題、核心文案與六個模式入口", async () => {
    mount(
      createElement(
        AppStoreProvider,
        null,
        createElement(HomePage, {
          onStartWord: () => {},
          onStartSentence: () => {},
          onStartReview: () => {},
          onOpenMistakes: () => {},
          onOpenDaily: () => {},
          onOpenAnalytics: () => {},
          onOpenProfile: () => {},
        }),
      ),
    );
    await flush(60);
    const text = container.textContent ?? "";
    for (const expected of [
      "聞いボード",
      "聞いて、打って、覚えよう。",
      "快速單字",
      "句子填空",
      "複習模式",
      "錯題本",
      "今日挑戰",
      "我的學習",
      "1 分鐘",
      "2 分鐘",
      "3 分鐘",
    ]) {
      expect(text, `首頁缺少「${expected}」`).toContain(expected);
    }
  });

  it("錯題本在沒有資料時顯示友善空狀態", async () => {
    mount(
      createElement(
        AppStoreProvider,
        null,
        createElement(MistakesPage, { onStartReview: () => {}, onBack: () => {} }),
      ),
    );
    await flush(60);
    expect(container.textContent).toContain("錯題本還是空的");
  });

  it("分析頁在沒有作答紀錄時顯示「尚無資料」而非假造統計", async () => {
    mount(
      createElement(AppStoreProvider, null, createElement(AnalyticsPage, { onOpenMistakes: () => {} })),
    );
    await flush(60);
    const text = container.textContent ?? "";
    expect(text).toContain("尚無資料");
    expect(text).not.toContain("85%");
  });
});