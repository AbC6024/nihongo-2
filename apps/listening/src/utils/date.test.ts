import { describe, expect, it } from "vitest";
import {
  addDays,
  createSeededRandom,
  diffDays,
  hashString,
  previousDateKey,
  toLocalDateKey,
} from "./date";

describe("toLocalDateKey", () => {
  it("使用本地日期而不是 UTC", () => {
    // 2026-01-01 00:30 local → 2025-12-31T15:30Z。UTC 會算成前一天。
    const lateNight = new Date(2026, 0, 1, 0, 30, 0);
    expect(toLocalDateKey(lateNight)).toBe("2026-01-01");
    const earlyMorning = new Date(2026, 0, 1, 23, 30, 0);
    expect(toLocalDateKey(earlyMorning)).toBe("2026-01-01");
  });

  it("月份與日期補零", () => {
    expect(toLocalDateKey(new Date(2026, 8, 5))).toBe("2026-09-05");
  });
});

describe("addDays / previousDateKey", () => {
  it("跨月計算正確", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("跨年計算正確", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(previousDateKey("2026-01-01")).toBe("2025-12-31");
  });
});

describe("diffDays", () => {
  it("計算日期差", () => {
    expect(diffDays("2026-01-01", "2026-01-02")).toBe(1);
    expect(diffDays("2026-01-02", "2026-01-01")).toBe(-1);
    expect(diffDays("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("createSeededRandom", () => {
  it("相同 seed 產生相同序列", () => {
    const a = createSeededRandom("daily:2026-01-01");
    const b = createSeededRandom("daily:2026-01-01");
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("不同 seed 產生不同序列", () => {
    const a = Array.from({ length: 5 }, createSeededRandom("2026-01-01"));
    const b = Array.from({ length: 5 }, createSeededRandom("2026-01-02"));
    expect(a).not.toEqual(b);
  });

  it("產生的值在 0 到 1 之間", () => {
    const random = createSeededRandom("range-check");
    for (let i = 0; i < 200; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("相同字串得到相同 hash，不同字串通常不同", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });
});