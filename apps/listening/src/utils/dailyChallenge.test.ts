import { describe, expect, it } from "vitest";
import {
  completeDailyChallenge,
  createEmptyDailyRecord,
  getDailyQuestionIds,
  isDailyCompleted,
  saveDailyQuestionIds,
} from "./dailyChallenge";
import { composeDailyQuestionIds } from "./randomQuestion";
import { DAILY_TOTAL_QUESTIONS } from "./scoring";

const generalIds: string[] = Array.from({ length: 40 }, (_, i) => `g${i}`);
const mistakeIds: string[] = ["g3", "g7", "m1", "m2", "m3", "m4", "m5"];

describe("composeDailyQuestionIds 組成規則", () => {
  it("固定產生 10 題", () => {
    const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
    expect(ids).toHaveLength(DAILY_TOTAL_QUESTIONS);
  });

  it("同一局內不重複", () => {
    for (let i = 0; i < 30; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("前 5 題來自一般題庫", () => {
    for (let i = 0; i < 30; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
      for (const id of ids.slice(0, 5)) {
        expect(generalIds).toContain(id);
      }
    }
  });

  it("後 5 題優先來自錯題", () => {
    const withMistakes = composeDailyQuestionIds({ generalIds, mistakeIds });
    const secondHalf = withMistakes.slice(5);
    expect(secondHalf.filter((id) => mistakeIds.includes(id)).length).toBeGreaterThan(0);

    // 錯題夠多時，後 5 題全部都來自錯題
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
      for (const id of ids.slice(5)) {
        expect(mistakeIds).toContain(id);
      }
    }
  });

  it("沒有錯題時也能填滿 10 題", () => {
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds: [] });
      expect(ids).toHaveLength(DAILY_TOTAL_QUESTIONS);
      expect(new Set(ids).size).toBe(DAILY_TOTAL_QUESTIONS);
    }
  });

  it("錯題不足時由一般題庫補足", () => {
    const fewMistakes = ["m1", "m2"];
    const ids = composeDailyQuestionIds({ generalIds, mistakeIds: fewMistakes });
    expect(ids).toHaveLength(DAILY_TOTAL_QUESTIONS);
    const secondHalf = ids.slice(5);
    expect(secondHalf.filter((id) => fewMistakes.includes(id)).length).toBe(2);
    // 其餘 3 題由一般題庫補足
    expect(secondHalf.filter((id) => !fewMistakes.includes(id)).length).toBe(3);
  });

  it("題庫很小時不崩潰", () => {
    const ids = composeDailyQuestionIds({ generalIds: ["a", "b", "c"], mistakeIds: [] });
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => ["a", "b", "c"].includes(id))).toBe(true);
  });
});

describe("composeDailyQuestionIds 隨機化", () => {
  it("同一組輸入多次抽題會得到不同順序", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      orders.add(composeDailyQuestionIds({ generalIds, mistakeIds }).join(","));
    }
    // 40 選 5、錯題 5 選 5，25 次全部相同的機率極低
    expect(orders.size).toBeGreaterThan(1);
  });

  it("相同的亂數來源會得到相同順序（可重現）", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const a = composeDailyQuestionIds({ generalIds, mistakeIds }, random);
    seed = 42;
    const b = composeDailyQuestionIds({ generalIds, mistakeIds }, random);
    expect(b).toEqual(a);
  });
});

describe("getDailyQuestionIds", () => {
  it("預設每次都重新隨機抽取（不再由日期鎖定）", () => {
    const record = createEmptyDailyRecord();
    const orders = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      orders.add(
        getDailyQuestionIds(record, "2026-01-01", generalIds, mistakeIds).join(","),
      );
    }
    expect(orders.size).toBeGreaterThan(1);
    for (const order of orders) {
      expect(order.split(",")).toHaveLength(DAILY_TOTAL_QUESTIONS);
    }
  });

  it("reuseExisting = true 時沿用已保存的題目", () => {
    let record = createEmptyDailyRecord();
    record = saveDailyQuestionIds(record, "2026-01-01", ["x", "y"]);
    const ids = getDailyQuestionIds(record, "2026-01-01", generalIds, mistakeIds, true);
    expect(ids).toEqual(["x", "y"]);
  });

  it("reuseExisting = false 時忽略保存結果", () => {
    let record = createEmptyDailyRecord();
    record = saveDailyQuestionIds(record, "2026-01-01", ["x", "y"]);
    const ids = getDailyQuestionIds(record, "2026-01-01", generalIds, mistakeIds, false);
    expect(ids).not.toEqual(["x", "y"]);
    expect(ids).toHaveLength(DAILY_TOTAL_QUESTIONS);
  });

  it("不同日期各自獨立", () => {
    const record = createEmptyDailyRecord();
    expect(getDailyQuestionIds(record, "2026-01-01", generalIds, mistakeIds)).toHaveLength(
      DAILY_TOTAL_QUESTIONS,
    );
    expect(getDailyQuestionIds(record, "2026-01-02", generalIds, mistakeIds)).toHaveLength(
      DAILY_TOTAL_QUESTIONS,
    );
  });
});

describe("completeDailyChallenge 連勝", () => {
  it("第一次完成：勝場 +1、連勝 = 1", () => {
    const result = completeDailyChallenge({
      dateKey: "2026-01-01",
      score: 1600,
      record: createEmptyDailyRecord(),
    });
    expect(result.isNewWin).toBe(true);
    expect(result.record.totalDailyWins).toBe(1);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(1);
    expect(result.record.lastCompletedDate).toBe("2026-01-01");
  });

  it("連續兩天完成：連勝 +1、最高連勝更新", () => {
    let record = createEmptyDailyRecord();
    const first = completeDailyChallenge({ dateKey: "2026-01-01", score: 2000, record });
    record = first.record;
    const second = completeDailyChallenge({ dateKey: "2026-01-02", score: 1800, record });
    expect(second.currentStreak).toBe(2);
    expect(second.bestStreak).toBe(2);
    expect(second.record.totalDailyWins).toBe(2);
  });

  it("同一天重玩：不重複增加勝場，只更新最佳分數", () => {
    let record = createEmptyDailyRecord();
    record = completeDailyChallenge({ dateKey: "2026-01-01", score: 1000, record }).record;
    const replay = completeDailyChallenge({ dateKey: "2026-01-01", score: 1800, record });
    expect(replay.isNewWin).toBe(false);
    expect(replay.record.totalDailyWins).toBe(1);
    expect(replay.currentStreak).toBe(1);
    expect(replay.record.dailyBestScoreByDate["2026-01-01"]).toBe(1800);
  });

  it("同一天重玩多次也只會有一個勝場", () => {
    let record = createEmptyDailyRecord();
    for (let i = 0; i < 5; i += 1) {
      record = completeDailyChallenge({
        dateKey: "2026-01-01",
        score: 1000 + i * 100,
        record,
      }).record;
    }
    expect(record.totalDailyWins).toBe(1);
    expect(record.currentStreak).toBe(1);
    expect(record.dailyBestScoreByDate["2026-01-01"]).toBe(1400);
  });

  it("重玩較低分不會覆蓋最佳分數", () => {
    let record = createEmptyDailyRecord();
    record = completeDailyChallenge({ dateKey: "2026-01-01", score: 1800, record }).record;
    const replay = completeDailyChallenge({ dateKey: "2026-01-01", score: 600, record });
    expect(replay.record.dailyBestScoreByDate["2026-01-01"]).toBe(1800);
  });

  it("錯過一天後再完成：連勝重設為 1，最高連勝保留", () => {
    let record = createEmptyDailyRecord();
    record = completeDailyChallenge({ dateKey: "2026-01-01", score: 2000, record }).record;
    record = completeDailyChallenge({ dateKey: "2026-01-02", score: 2000, record }).record;
    record = completeDailyChallenge({ dateKey: "2026-01-03", score: 2000, record }).record;
    expect(record.bestStreak).toBe(3);

    // 跳過 01-04，01-05 再完成
    const later = completeDailyChallenge({ dateKey: "2026-01-05", score: 1400, record });
    expect(later.currentStreak).toBe(1);
    expect(later.bestStreak).toBe(3);
    expect(later.record.totalDailyWins).toBe(4);
  });

  it("分數上限為 2000", () => {
    const result = completeDailyChallenge({
      dateKey: "2026-01-01",
      score: 9999,
      record: createEmptyDailyRecord(),
    });
    expect(result.record.dailyBestScoreByDate["2026-01-01"]).toBe(2000);
  });

  it("isDailyCompleted 判斷當日是否已完成", () => {
    const record = completeDailyChallenge({
      dateKey: "2026-01-01",
      score: 100,
      record: createEmptyDailyRecord(),
    }).record;
    expect(isDailyCompleted(record, "2026-01-01")).toBe(true);
    expect(isDailyCompleted(record, "2026-01-02")).toBe(false);
  });
});