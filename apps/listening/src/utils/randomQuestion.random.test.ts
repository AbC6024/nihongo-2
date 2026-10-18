import { describe, expect, it } from "vitest";
import {
  buildSessionQuestions,
  composeDailyQuestionIds,
  filterQuestions,
  shuffleQuestions,
  DAILY_FIRST_HALF_COUNT,
  DAILY_TOTAL_QUESTIONS_COUNT,
} from "./randomQuestion";
import type { Question } from "../types/question";

function word(id: string, difficulty: Question["difficulty"] = "N5"): Question {
  return {
    id,
    japanese: id,
    kana: id,
    romaji: "x",
    meaning: "x",
    difficulty,
    script: "hiragana",
    category: "動物",
  } as Question;
}

const pool: Question[] = Array.from({ length: 20 }, (_, i) => word(`q${i}`));
const getId = (item: Question) => item.id;

/** 可重現的偽亂數 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("shuffleQuestions 不修改原始陣列", () => {
  it("回傳新陣本", () => {
    const original = pool.slice();
    const result = shuffleQuestions(original, seeded(1));
    expect(result).not.toBe(original);
    expect(original.map(getId)).toEqual(pool.map(getId));
  });

  it("元素集合不變", () => {
    const result = shuffleQuestions(pool, seeded(7));
    expect(result.map(getId).sort()).toEqual(pool.map(getId).slice().sort());
  });

  it("空陣列安全處理", () => {
    expect(shuffleQuestions([], seeded(1))).toEqual([]);
  });
});

describe("buildSessionQuestions（一般模式隨機出題）", () => {
  it("每次呼叫都重新隨機，順序不同", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      orders.add(buildSessionQuestions(pool, getId).order.map(getId).join(","));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("不修改傳入的題庫", () => {
    const original = pool.slice();
    buildSessionQuestions(original, getId);
    expect(original.map(getId)).toEqual(pool.map(getId));
  });

  it("題目數足夠時整局不重複", () => {
    const result = buildSessionQuestions(pool, getId);
    expect(result.order).toHaveLength(pool.length);
    expect(new Set(result.order.map(getId)).size).toBe(pool.length);
    expect(result.noRepeat).toBe(true);
  });

  it("題庫很小時這一局仍然不重複（引擎會在用完後才循環）", () => {
    const result = buildSessionQuestions(pool.slice(0, 3), getId);
    expect(result.order).toHaveLength(3);
    expect(new Set(result.order.map(getId)).size).toBe(3);
    expect(result.noRepeat).toBe(true);
  });

  it("只包含篩選後的題目", () => {
    const filtered = filterQuestions(pool, { difficulties: ["N5"] });
    const result = buildSessionQuestions(filtered, getId);
    expect(result.order.every((q) => q.difficulty === "N5")).toBe(true);
  });

  it("單一題目的題庫也能正常產生一局", () => {
    const result = buildSessionQuestions(pool.slice(0, 1), getId);
    expect(result.order).toHaveLength(1);
  });

  it("空題庫回傳空順序", () => {
    const result = buildSessionQuestions([], getId);
    expect(result.order).toEqual([]);
    expect(result.noRepeat).toBe(false);
  });

  it("相同的亂數來源可重現同一局", () => {
    const a = buildSessionQuestions(pool, getId, seeded(99)).order.map(getId);
    const b = buildSessionQuestions(pool, getId, seeded(99)).order.map(getId);
    expect(b).toEqual(a);
  });

  it("一定包含題庫中全部的題目（只是順序不同）", () => {
    const result = buildSessionQuestions(pool, getId);
    expect(result.order.map(getId).sort()).toEqual(pool.map(getId).slice().sort());
  });
});

describe("composeDailyQuestionIds 隨機化", () => {
  const generalIds = Array.from({ length: 30 }, (_, i) => `g${i}`);
  const mistakeIds = ["m1", "m2", "m3"];

  it("固定 10 題，前 5 題來自一般題庫", () => {
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
      expect(ids).toHaveLength(DAILY_TOTAL_QUESTIONS_COUNT);
      expect(DAILY_FIRST_HALF_COUNT).toBe(5);
      for (const id of ids.slice(0, 5)) expect(generalIds).toContain(id);
    }
  });

  it("錯題有 5 筆以上時，後 5 題全部來自錯題", () => {
    const manyMistakes = ["m1", "m2", "m3", "m4", "m5", "m6"];
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds: manyMistakes });
      expect(ids.slice(5).every((id) => manyMistakes.includes(id))).toBe(true);
    }
  });

  it("錯題不足 5 筆時，後 5 題的部分由一般題庫補足", () => {
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
      const secondHalf = ids.slice(5);
      expect(secondHalf.filter((id) => mistakeIds.includes(id)).length).toBe(3);
      expect(secondHalf.filter((id) => generalIds.includes(id)).length).toBe(2);
    }
  });

  it("沒有錯題時後 5 題也來自一般題庫", () => {
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds: [] });
      expect(ids).toHaveLength(DAILY_TOTAL_QUESTIONS_COUNT);
      for (const id of ids.slice(5)) expect(generalIds).toContain(id);
    }
  });

  it("每次呼叫都重新隨機", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      orders.add(composeDailyQuestionIds({ generalIds, mistakeIds }).join(","));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("同一局內不重複", () => {
    for (let i = 0; i < 20; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("錯題也在一般題庫中時，會被保留給後半段（前 5 題不會占用）", () => {
    const general = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const mistakes = ["a", "b"];
    for (let i = 0; i < 30; i += 1) {
      const ids = composeDailyQuestionIds({ generalIds: general, mistakeIds: mistakes });
      const firstHalf = ids.slice(0, 5);
      const secondHalf = ids.slice(5);
      // 前 5 題不會包含錯題（一般題庫還有足夠的非錯題）
      expect(firstHalf.some((id) => mistakes.includes(id))).toBe(false);
      // 後半段一定包含這 2 題錯題
      expect(secondHalf.filter((id) => mistakes.includes(id)).length).toBe(2);
    }
  });
});