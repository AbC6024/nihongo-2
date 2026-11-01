import { describe, expect, it } from "vitest";
import {
  buildReviewPool,
  buildWeightedReviewSequence,
  filterQuestions,
  pickAvoidingRecent,
  pickWeightedReview,
} from "./randomQuestion";
import { createSeededRandom } from "./date";
import type { MistakeEntry } from "../types/game";
import type { Question } from "../types/question";

function word(id: string, category = "第1課"): Question {
  return {
    id,
    japanese: id,
    kana: id,
    romaji: id,
    meaning: id,
    script: "hiragana",
    category,
  } as Question;
}

function mistake(questionId: string, starred = false): MistakeEntry {
  return {
    questionId,
    mode: "word",
    wrongCount: 1,
    skipCount: 0,
    reviewCount: 0,
    starred,
    firstWrongAt: "2026-01-01T00:00:00.000Z",
    lastWrongAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("filterQuestions", () => {
  const pool: Question[] = [
    word("a", "第1課"),
    word("b", "第1課"),
    word("c", "第2課"),
    word("d", "第2課"),
    word("e", "第3課"),
  ];

  it("第1課 篩選只回傳第1課題目", () => {
    const result = filterQuestions(pool, { lessons: [1] });
    expect(result.map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("第3課 篩選只回傳第3課題目", () => {
    const result = filterQuestions(pool, { lessons: [3] });
    expect(result.map((q) => q.id)).toEqual(["e"]);
  });

  it("多選課次取聯集", () => {
    const result = filterQuestions(pool, { lessons: [1, 3] });
    expect(result.map((q) => q.id)).toEqual(["a", "b", "e"]);
  });

  it("未提供篩選時回傳全部", () => {
    expect(filterQuestions(pool)).toHaveLength(5);
    expect(filterQuestions(pool, { lessons: [] })).toHaveLength(5);
  });

  it("分類與課次可同時篩選", () => {
    const result = filterQuestions(pool, { lessons: [1], categories: ["第1課"] });
    expect(result.map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("篩選後沒有題目時回傳空陣列而不報錯", () => {
    expect(filterQuestions(pool, { categories: ["不存在的分類"] })).toEqual([]);
    expect(filterQuestions(pool, { lessons: [99] })).toEqual([]);
  });
});

describe("pickAvoidingRecent", () => {
  const pool = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));

  it("抽題不回傳 null 且 id 存在於題庫", () => {
    const result = pickAvoidingRecent(pool, (q) => q.id, []);
    expect(result.item).not.toBeNull();
    expect(pool.some((q) => q.id === result.item!.id)).toBe(true);
  });

  it("盡量避開最近使用過的題目", () => {
    const recent = ["q0", "q1", "q2", "q3", "q4"];
    const result = pickAvoidingRecent(pool, (q) => q.id, recent);
    expect(result.item?.id).not.toMatch(/^q[0-4]$/);
  });

  it("題庫太小時放寬限制（relaxed = true）", () => {
    const tiny = [{ id: "only" }];
    const result = pickAvoidingRecent(tiny, (q) => q.id, ["only"]);
    expect(result.item?.id).toBe("only");
    expect(result.relaxed).toBe(true);
  });

  it("空題庫回傳 null", () => {
    const result = pickAvoidingRecent<Question>([], (q) => q.id, []);
    expect(result.item).toBeNull();
    expect(result.relaxed).toBe(false);
  });
});

describe("pickWeightedReview", () => {
  const starred = [word("s1", "第1課"), word("s2", "第2課")];
  const otherMistakes = [word("m1", "第1課")];
  const general = [word("g1", "第1課"), word("g2", "第2課"), word("g3", "第3課")];

  it("星號題目權重最高", () => {
    const random = createSeededRandom(42);
    const counts = { s1: 0, s2: 0, m1: 0, g1: 0, g2: 0, g3: 0 };
    const trials = 1000;
    for (let i = 0; i < trials; i += 1) {
      const picked = pickWeightedReview(
        { starred, otherMistakes, general },
        (q) => q.id,
        random,
      );
      if (picked.item) counts[picked.item.id as keyof typeof counts] += 1;
    }
    expect(counts.s1 + counts.s2).toBeGreaterThan(counts.m1);
    expect(counts.m1).toBeGreaterThan(counts.g1 + counts.g2 + counts.g3);
  });

  it("所有類別都為空時回傳 null", () => {
    const result = pickWeightedReview(
      { starred: [], otherMistakes: [], general: [] as Question[] },
      (q) => q.id,
      createSeededRandom(1),
    );
    expect(result.item).toBeNull();
  });

  it("同一題以最高權重計算", () => {
    const overlappingStarred = [word("x", "第1課")];
    const overlappingGeneral = [word("x", "第1課")];
    const result = pickWeightedReview(
      { starred: overlappingStarred, otherMistakes: [], general: overlappingGeneral },
      (q) => q.id,
      createSeededRandom(1),
    );
    expect(result.item?.id).toBe("x");
  });
});

describe("buildReviewPool", () => {
  const questions: Question[] = [
    word("a", "第1課"),
    word("b", "第2課"),
    word("c", "第3課"),
  ];
  const mistakes: MistakeEntry[] = [
    mistake("a", true),
    mistake("b", false),
  ];

  it("將 starred 與 otherMistakes 正確分類", () => {
    const pool = buildReviewPool(questions, mistakes, (q) => q.id);
    expect(pool.starred.map((q) => q.id)).toEqual(["a"]);
    expect(pool.otherMistakes.map((q) => q.id)).toEqual(["b"]);
    expect(pool.general.map((q) => q.id)).toEqual(["c"]);
  });

  it("過濾掉不在題庫中的錯題", () => {
    const pool = buildReviewPool(
      questions,
      [...mistakes, mistake("nonexistent", false)],
      (q) => q.id,
    );
    expect(pool.starred.map((q) => q.id)).toEqual(["a"]);
    expect(pool.otherMistakes.map((q) => q.id)).toEqual(["b"]);
    expect(pool.general.map((q) => q.id)).toEqual(["c"]);
  });
});

describe("buildWeightedReviewSequence", () => {
  const pool = {
    starred: [word("s1", "第1課")],
    otherMistakes: [word("m1", "第1課")],
    general: [word("g1", "第1課"), word("g2", "第2課"), word("g3", "第3課")],
  };

  it("產生不重複的題目順序", () => {
    const sequence = buildWeightedReviewSequence(pool, (q) => q.id, createSeededRandom(7));
    const ids = sequence.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(5);
  });

  it("空池回傳空陣列", () => {
    const sequence = buildWeightedReviewSequence<Question>(
      { starred: [], otherMistakes: [], general: [] },
      (q) => q.id,
      createSeededRandom(1),
    );
    expect(sequence).toEqual([]);
  });
});