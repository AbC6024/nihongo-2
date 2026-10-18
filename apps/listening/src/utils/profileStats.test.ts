import { describe, expect, it } from "vitest";
import {
  computeProfileStats,
  EMPTY_PROFILE_STATS,
  formatScore,
  gameModeLabelKey,
  recentGames,
} from "./profileStats";
import { createEmptyDailyRecord } from "./dailyChallenge";
import type { GameRecord, QuestionAttempt } from "../types/game";

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: "g1",
    startedAt: "2026-01-01T10:00:00.000Z",
    endedAt: "2026-01-01T10:02:00.000Z",
    localDate: "2026-01-01",
    gameMode: "word",
    durationSeconds: 120,
    score: 1000,
    answered: 10,
    correct: 10,
    wrong: 0,
    skipped: 0,
    accuracy: 100,
    ...overrides,
  };
}

function attempt(overrides: Partial<QuestionAttempt> = {}): QuestionAttempt {
  return {
    timestamp: "2026-01-01T10:00:00.000Z",
    localDate: "2026-01-01",
    gameMode: "word",
    questionId: "q1",
    difficulty: "N5",
    category: "動物",
    correct: true,
    wrongAttempts: 0,
    skipped: false,
    score: 100,
    responseTimeMs: 2000,
    inputMethod: "romaji",
    ...overrides,
  };
}

describe("computeProfileStats 分數紀錄", () => {
  it("沒有紀錄時回傳空統計", () => {
    const stats = computeProfileStats([], [], createEmptyDailyRecord());
    expect(stats).toEqual(EMPTY_PROFILE_STATS);
    expect(stats.totalScore).toBe(0);
    expect(stats.lastScore).toBeNull();
  });

  it("累積獲得分數 = 各局最終分數加總", () => {
    const stats = computeProfileStats(
      [game({ score: 1000 }), game({ id: "g2", score: 600 }), game({ id: "g3", score: 800 })],
      [],
      createEmptyDailyRecord(),
    );
    expect(stats.totalGames).toBe(3);
    expect(stats.totalScore).toBe(2400);
  });

  it("最高單局分數取自歷史紀錄", () => {
    const stats = computeProfileStats(
      [game({ score: 500 }), game({ id: "g2", score: 1800 }), game({ id: "g3", score: 900 })],
      [],
      createEmptyDailyRecord(),
    );
    expect(stats.bestScore).toBe(1800);
  });

  it("最近一次分數取開始時間上最新的一局", () => {
    const stats = computeProfileStats(
      [
        game({ id: "g1", score: 1000, startedAt: "2026-01-01T10:00:00.000Z", endedAt: "2026-01-01T10:02:00.000Z" }),
        game({ id: "g3", score: 1500, startedAt: "2026-02-01T10:00:00.000Z", endedAt: "2026-02-01T10:02:00.000Z" }),
        game({ id: "g2", score: 700, startedAt: "2026-03-05T10:00:00.000Z", endedAt: "2026-03-05T10:02:00.000Z" }),
      ],
      [],
      createEmptyDailyRecord(),
    );
    // 最新的一局是 g2（2026-03-05），不是分數最高的 g3
    expect(stats.lastScore).toBe(700);
    expect(stats.bestScore).toBe(1500);
    expect(stats.lastGameAt).toBe("2026-03-05T10:02:00.000Z");
  });

  it("累積答題與答對數取自作答紀錄", () => {
    const stats = computeProfileStats(
      [game()],
      [
        attempt({ questionId: "a", correct: true }),
        attempt({ questionId: "b", correct: false }),
        attempt({ questionId: "c", correct: true }),
      ],
      createEmptyDailyRecord(),
    );
    expect(stats.totalAnswered).toBe(3);
    expect(stats.totalCorrect).toBe(2);
    expect(stats.accuracy).toBeCloseTo(66.7, 1);
  });

  it("連勝資料取自每日挑戰紀錄", () => {
    const stats = computeProfileStats(
      [],
      [],
      { ...createEmptyDailyRecord(), currentStreak: 5, bestStreak: 9, totalDailyWins: 12 },
    );
    expect(stats.currentStreak).toBe(5);
    expect(stats.bestStreak).toBe(9);
    expect(stats.totalDailyWins).toBe(12);
  });

  it("異常分數不會讓統計崩潰", () => {
    const stats = computeProfileStats(
      [game({ score: Number.NaN }), game({ id: "g2", score: -50 })],
      [],
      createEmptyDailyRecord(),
    );
    expect(Number.isFinite(stats.totalScore)).toBe(true);
    expect(stats.totalScore).toBe(0);
    expect(stats.bestScore).toBe(0);
  });

  it("重複的同一局不會被重複計算（取決於資料本身）", () => {
    const single = game({ id: "same", score: 1200 });
    const stats = computeProfileStats([single], [], createEmptyDailyRecord());
    expect(stats.totalGames).toBe(1);
    expect(stats.totalScore).toBe(1200);
    expect(stats.lastScore).toBe(1200);
  });

  it("空陣列參數安全處理", () => {
    const stats = computeProfileStats(
      undefined as unknown as GameRecord[],
      undefined as unknown as QuestionAttempt[],
      createEmptyDailyRecord(),
    );
    expect(stats.totalGames).toBe(0);
    expect(stats.totalScore).toBe(0);
  });
});

describe("recentGames", () => {
  it("依時間由新到舊排序並限制筆數", () => {
    const list = [
      game({ id: "a", startedAt: "2026-01-01T00:00:00.000Z" }),
      game({ id: "b", startedAt: "2026-03-01T00:00:00.000Z" }),
      game({ id: "c", startedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(recentGames(list, 2).map((g) => g.id)).toEqual(["b", "c"]);
  });

  it("不修改原始陣列", () => {
    const list = [
      game({ id: "a", startedAt: "2026-01-01T00:00:00.000Z" }),
      game({ id: "b", startedAt: "2026-03-01T00:00:00.000Z" }),
    ];
    const before = list.map((g) => g.id);
    recentGames(list);
    expect(list.map((g) => g.id)).toEqual(before);
  });
});

describe("formatScore", () => {
  it("使用千分位", () => {
    expect(formatScore(18600)).toBe("18,600");
    expect(formatScore(0)).toBe("0");
    expect(formatScore(-5)).toBe("0");
  });
});

describe("gameModeLabelKey", () => {
  it("對應到翻譯鍵值", () => {
    expect(gameModeLabelKey("word")).toBe("modeWord");
    expect(gameModeLabelKey("sentence")).toBe("modeSentence");
    expect(gameModeLabelKey("review")).toBe("modeReview");
    expect(gameModeLabelKey("daily")).toBe("modeDaily");
  });

  it("未知模式安全退回", () => {
    expect(gameModeLabelKey("unknown")).toBe("modeWord");
  });
});