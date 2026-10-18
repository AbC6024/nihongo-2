import { describe, expect, it } from "vitest";
import {
  applySkipPenalty,
  calculateAccuracy,
  calculateDailyScore,
  calculateNormalScore,
  canSkip,
  DAILY_MAX_SCORE,
  DAILY_TOTAL_QUESTIONS,
} from "./scoring";

describe("calculateNormalScore", () => {
  it("第一次答對得 100 分", () => {
    expect(calculateNormalScore(0)).toBe(100);
  });

  it("答錯一次後答對得 90 分", () => {
    expect(calculateNormalScore(1)).toBe(90);
  });

  it("答錯兩次後答對得 80 分", () => {
    expect(calculateNormalScore(2)).toBe(80);
  });

  it("答錯三次後答對得 70 分", () => {
    expect(calculateNormalScore(3)).toBe(70);
  });

  it("答錯十次後不會變成負分", () => {
    expect(calculateNormalScore(10)).toBe(0);
    expect(calculateNormalScore(100)).toBe(0);
  });

  it("負數或 NaN 視為 0 次答錯", () => {
    expect(calculateNormalScore(-3)).toBe(100);
    expect(calculateNormalScore(Number.NaN)).toBe(100);
  });
});

describe("applySkipPenalty", () => {
  it("總分扣 50", () => {
    expect(applySkipPenalty(300)).toBe(250);
    expect(applySkipPenalty(50)).toBe(0);
  });

  it("總分最低為 0，不會變負數", () => {
    expect(applySkipPenalty(20)).toBe(0);
    expect(applySkipPenalty(0)).toBe(0);
  });
});

describe("calculateDailyScore", () => {
  it("答對 +200，答錯與跳過都是 0", () => {
    expect(calculateDailyScore(true)).toBe(200);
    expect(calculateDailyScore(false)).toBe(0);
    expect(calculateDailyScore(false, true)).toBe(0);
  });

  it("10 題最高 2000 分", () => {
    expect(DAILY_TOTAL_QUESTIONS).toBe(10);
    expect(DAILY_QUESTION_SCORE_TOTAL()).toBe(DAILY_MAX_SCORE);
    expect(DAILY_MAX_SCORE).toBe(2000);
  });
});

function DAILY_QUESTION_SCORE_TOTAL(): number {
  return Array.from({ length: DAILY_TOTAL_QUESTIONS }, () => calculateDailyScore(true)).reduce(
    (sum, value) => sum + value,
    0,
  );
}

describe("canSkip", () => {
  it("答錯 3 次（含）之後才出現跳過按鈕", () => {
    expect(canSkip(0)).toBe(false);
    expect(canSkip(1)).toBe(false);
    expect(canSkip(2)).toBe(false);
    expect(canSkip(3)).toBe(true);
    expect(canSkip(4)).toBe(true);
  });
});

describe("calculateAccuracy", () => {
  it("沒有作答時為 0", () => {
    expect(calculateAccuracy({ correct: 0, answered: 0 })).toBe(0);
  });

  it("計算百分比並保留一位小數", () => {
    expect(calculateAccuracy({ correct: 7, answered: 10 })).toBe(70);
    expect(calculateAccuracy({ correct: 1, answered: 3 })).toBe(33.3);
  });
});