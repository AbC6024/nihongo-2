import { describe, expect, it } from "vitest";
import { buildAnalytics, formatVerdictMessage, verdictLabel, verdictLabelKey } from "./analytics";
import { zhTW, formatTranslation, type TranslationKey } from "../i18n";
import { createEmptyDailyRecord } from "./dailyChallenge";
import type { QuestionAttempt } from "../types/game";

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
    responseTimeMs: 3000,
    inputMethod: "romaji",
    ...overrides,
  };
}

function summary(attempts: QuestionAttempt[]) {
  return buildAnalytics({
    attempts,
    games: [],
    mistakes: {},
    daily: createEmptyDailyRecord(),
    todayKey: "2026-01-01",
  });
}

describe("buildAnalytics", () => {
  it("沒有資料時 hasData 為 false", () => {
    expect(summary([]).hasData).toBe(false);
    expect(summary([]).overallAccuracy).toBe(0);
    expect(summary([]).totalAttempts).toBe(0);
  });

  it("計算總作答、正確率與平均作答時間", () => {
    const result = summary([
      attempt({ correct: true, responseTimeMs: 2000 }),
      attempt({ correct: true, responseTimeMs: 4000 }),
      attempt({ questionId: "q2", correct: false, responseTimeMs: 6000 }),
    ]);
    expect(result.hasData).toBe(true);
    expect(result.totalAttempts).toBe(3);
    expect(result.totalCorrect).toBe(2);
    expect(result.overallAccuracy).toBeCloseTo(2 / 3, 3);
    expect(result.avgResponseTimeMs).toBe(4000);
  });

  it("統計平均答錯次數與跳過題數", () => {
    const result = summary([
      attempt({ wrongAttempts: 1 }),
      attempt({ questionId: "q2", wrongAttempts: 2, skipped: true, correct: false }),
    ]);
    expect(result.avgWrongAttempts).toBe(1.5);
    expect(result.totalSkipped).toBe(1);
  });

  it("作答不足 5 次時判定為資料不足", () => {
    const result = summary([
      attempt({ difficulty: "N5", category: "動物" }),
      attempt({ difficulty: "N5", category: "動物" }),
      attempt({ difficulty: "N5", category: "動物" }),
      attempt({ difficulty: "N5", category: "動物" }),
    ]);
    expect(result.levelStats.find((s) => s.difficulty === "N5")?.verdict).toBe("insufficient");
    expect(result.categoryStats[0].verdict).toBe("insufficient");
  });

  it("正確率 >= 85% 且平均答錯 < 1 判定為強項", () => {
    // 8 次作答、7 次正確（87.5%）、平均答錯 0 次 → 強項
    const result = summary(
      Array.from({ length: 8 }, (_, i) =>
        attempt({ questionId: `q${i}`, category: "動物", correct: i !== 0 }),
      ),
    );
    const stat = result.categoryStats[0];
    expect(stat.attempts).toBe(8);
    expect(stat.accuracy).toBeCloseTo(7 / 8, 3);
    expect(stat.avgWrong).toBe(0);
    expect(stat.verdict).toBe("strong");
  });

  it("正確率 < 70% 判定為待加強", () => {
    const result = summary(
      Array.from({ length: 6 }, (_, i) =>
        attempt({ questionId: `q${i}`, category: "動物", correct: i < 2 }),
      ),
    );
    expect(result.categoryStats[0].verdict).toBe("weak");
  });

  it("平均答錯 >= 1.5 也判定為待加強", () => {
    // 6 次作答全部答對，但其中 5 次都有 2 次答錯（平均 10/6 ≈ 1.67）→ 待加強
    const result = summary(
      Array.from({ length: 6 }, (_, i) =>
        attempt({ questionId: `q${i}`, category: "動物", correct: true, wrongAttempts: i < 5 ? 2 : 0 }),
      ),
    );
    expect(result.categoryStats[0].accuracy).toBe(1);
    expect(result.categoryStats[0].avgWrong).toBeCloseTo(10 / 6, 2);
    expect(result.categoryStats[0].verdict).toBe("weak");
  });

  it("介於兩者之間判定為持續練習", () => {
    // 6 次作答、5 次正確（83.3%）、平均答錯 0 次 → 持續練習
    const result = summary(
      Array.from({ length: 6 }, (_, i) =>
        attempt({ questionId: `q${i}`, category: "動物", correct: i !== 0 }),
      ),
    );
    expect(result.categoryStats[0].verdict).toBe("practice");
  });

  it("統計常錯與常跳過題目", () => {
    const result = summary([
      attempt({ questionId: "hard", correct: false, wrongAttempts: 2 }),
      attempt({ questionId: "hard", correct: false, wrongAttempts: 1, skipped: true }),
      attempt({ questionId: "easy", correct: true }),
    ]);
    expect(result.frequentWrong[0].questionId).toBe("hard");
    expect(result.frequentSkipped[0].questionId).toBe("hard");
  });

  it("統計今日答題概況", () => {
    const result = summary([
      attempt({ localDate: "2026-01-01", correct: true }),
      attempt({ localDate: "2026-01-01", questionId: "q2", correct: false }),
      attempt({ localDate: "2026-01-02", questionId: "q3", correct: true }),
    ]);
    expect(result.today.dateKey).toBe("2026-01-01");
    expect(result.today.attempts).toBe(2);
    expect(result.today.correct).toBe(1);
  });

  it("統計各模式表現", () => {
    const result = summary([
      attempt({ gameMode: "word" }),
      attempt({ gameMode: "word", questionId: "q2", correct: false }),
      attempt({ gameMode: "daily", questionId: "q3" }),
    ]);
    expect(result.modeStats.map((m) => m.mode).sort()).toEqual(["daily", "word"]);
  });
});

describe("verdictLabel", () => {
  it("有對應的中文標籤", () => {
    expect(verdictLabel("strong")).toBe("強項");
    expect(verdictLabel("weak")).toBe("待加強");
    expect(verdictLabel("practice")).toBe("持續練習");
    expect(verdictLabel("insufficient")).toBe("資料不足");
  });

  it("提供對應的翻譯鍵值", () => {
    expect(verdictLabelKey("strong")).toBe("strongLabel");
    expect(verdictLabelKey("weak")).toBe("weakLabel");
    expect(verdictLabelKey("practice")).toBe("practiceLabel");
    expect(verdictLabelKey("insufficient")).toBe("insufficientLabel");
  });
});

describe("formatVerdictMessage", () => {
  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    formatTranslation(zhTW[key], params);

  it("資料不足時不判定強弱", () => {
    const message = formatVerdictMessage("N2", { accuracy: 0.2, avgWrong: 3, attempts: 2, t });
    expect(message).toContain("資料不足");
    expect(message).toContain("N2");
  });

  it("強項給予鼓勵訊息", () => {
    const message = formatVerdictMessage("N4", { accuracy: 0.9, avgWrong: 0.4, attempts: 10, t });
    expect(message).toContain("N4");
    expect(message).toContain("強項");
  });

  it("待加強給予具體建議", () => {
    const message = formatVerdictMessage("N2", { accuracy: 0.5, avgWrong: 2, attempts: 10, t });
    expect(message).toContain("N2");
    expect(message).toContain("練習");
  });

  it("介於兩者之間持續練習", () => {
    const message = formatVerdictMessage("N3", { accuracy: 0.8, avgWrong: 0.5, attempts: 10, t });
    expect(message).toContain("N3");
    expect(message).toContain("80%");
  });
});