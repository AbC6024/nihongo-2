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
import type { Difficulty, Question } from "../types/question";

function word(id: string, difficulty: Difficulty = "N5", category = "動物"): Question {
  return {
    id,
    japanese: id,
    kana: id,
    romaji: id,
    meaning: id,
    difficulty,
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
    word("a", "N5", "動物"),
    word("b", "N5", "動物"),
    word("c", "N5", "食物"),
    word("d", "N4", "動物"),
    word("e", "N1", "動物"),
  ];

  it("N5 篩選只回傳 N5 題目", () => {
    const result = filterQuestions(pool, { difficulties: ["N5"] });
    expect(result.map((q) => q.id)).toEqual(["a", "b", "c"]);
  });

  it("N1 篩選只回傳 N1 題目", () => {
    const result = filterQuestions(pool, { difficulties: ["N1"] });
    expect(result.map((q) => q.id)).toEqual(["e"]);
  });

  it("多選等級取聯集", () => {
    const result = filterQuestions(pool, { difficulties: ["N5", "N1"] });
    expect(result.map((q) => q.id)).toEqual(["a", "b", "c", "e"]);
  });

  it("未提供篩選時回傳全部", () => {
    expect(filterQuestions(pool)).toHaveLength(5);
    expect(filterQuestions(pool, { difficulties: [] })).toHaveLength(5);
  });

  it("分類與等級可同時篩選", () => {
    const result = filterQuestions(pool, { difficulties: ["N5"], categories: ["動物"] });
    expect(result.map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("篩選後沒有題目時回傳空陣列而不報錯", () => {
    expect(filterQuestions(pool, { categories: ["不存在的分類"] })).toEqual([]);
  });
});

describe("pickAvoidingRecent", () => {
  const pool = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));

  it("避免最近使用過的題目", () => {
    const recent = pool.slice(0, 5).map((item) => item.id);
    for (let i = 0; i < 50; i += 1) {
      const result = pickAvoidingRecent(pool, (item) => item.id, recent);
      expect(recent).not.toContain(result.item?.id);
      expect(result.relaxed).toBe(false);
    }
  });

  it("題目不足時放寬限制而不報錯", () => {
    // 題庫只有 3 題，而且最近 3 題就是全部 → 必須放寬限制
    const small = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const result = pickAvoidingRecent(small, (item) => item.id, small.map((item) => item.id));
    expect(result.item).not.toBeNull();
    expect(result.relaxed).toBe(true);
  });

  it("空題庫回傳 null", () => {
    expect(pickAvoidingRecent([], () => "", []).item).toBeNull();
  });

  it("只記錄最近 5 題", () => {
    const recent = ["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
    const result = pickAvoidingRecent(pool, (item) => item.id, recent, () => 0);
    // 最近 5 題 = q4..q8，所以應該抽到 q0..q3 其中之一
    expect(["q0", "q1", "q2", "q3"]).toContain(result.item?.id);
  });
});

describe("pickWeightedReview", () => {
  it("沒有任何題目時回傳 null", () => {
    const empty: { id: string }[] = [];
    expect(
      pickWeightedReview(
        { starred: empty, otherMistakes: empty, general: empty },
        (item) => item.id,
      ).item,
    ).toBeNull();
  });

  it("只有一般題目時也能抽到", () => {
    const result = pickWeightedReview(
      { starred: [], otherMistakes: [], general: [word("a"), word("b")] },
      (item) => item.id,
    );
    expect(result.item).not.toBeNull();
  });

  it("星號題目出現頻率明顯較高", () => {
    const starred = Array.from({ length: 1 }, (_, i) => ({ id: `s${i}` }));
    const others = Array.from({ length: 20 }, (_, i) => ({ id: `o${i}` }));
    const general = Array.from({ length: 50 }, (_, i) => ({ id: `g${i}` }));
    const random = createSeededRandom("weighted-review");
    let starHits = 0;
    for (let i = 0; i < 2000; i += 1) {
      const picked = pickWeightedReview({ starred, otherMistakes: others, general }, (item) => item.id, random);
      if (picked.item?.id.startsWith("s")) starHits += 1;
    }
    // 權重 50% / (50+30+20) ≈ 50%
    expect(starHits).toBeGreaterThan(800);
    expect(starHits).toBeLessThan(1200);
  });

  it("缺少的類別，其比例分配給其他類別", () => {
    const general = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}` }));
    const random = createSeededRandom("fallback");
    let pickedId = "";
    for (let i = 0; i < 200; i += 1) {
      const picked = pickWeightedReview(
        { starred: [], otherMistakes: [], general },
        (item) => item.id,
        random,
      ).item;
      if (picked) pickedId = picked.id;
    }
    expect(pickedId).toMatch(/^g/);
  });
});

describe("buildReviewPool", () => {
  const questions = [word("a"), word("b"), word("c"), word("d")];
  const mistakes = [mistake("a", true), mistake("b")];

  it("把題目分成星號、其他錯題與一般題目", () => {
    const pool = buildReviewPool(questions, mistakes, (item) => item.id);
    expect(pool.starred.map((q) => q.id)).toEqual(["a"]);
    expect(pool.otherMistakes.map((q) => q.id)).toEqual(["b"]);
    expect(pool.general.map((q) => q.id)).toEqual(["c", "d"]);
  });

  it("錯題本中不存在於題庫的題目會被忽略", () => {
    const pool = buildReviewPool(questions, [mistake("zzz")], (item) => item.id);
    expect(pool.starred).toHaveLength(0);
    expect(pool.otherMistakes).toHaveLength(0);
    expect(pool.general).toHaveLength(4);
  });
});

describe("buildWeightedReviewSequence", () => {
  it("每輪把可用題目都抽到且不重複", () => {
    const questions = [
      word("s1"),
      word("s2"),
      word("m1"),
      word("m2"),
      word("g1"),
      word("g2"),
      word("g3"),
    ];
    const mistakes = [mistake("s1", true), mistake("s2", true), mistake("m1")];
    const pool = buildReviewPool(questions, mistakes, (item) => item.id);
    const sequence = buildWeightedReviewSequence(pool, (item) => item.id, createSeededRandom("seq"));
    expect(new Set(sequence.map((q) => q.id)).size).toBe(sequence.length);
    expect(sequence).toHaveLength(7);
  });

  it("星號題目排在比較前面", () => {
    const questions = [word("m1"), word("g1"), word("g2"), word("s1")];
    const mistakes = [mistake("s1", true), mistake("m1")];
    const pool = buildReviewPool(questions, mistakes, (item) => item.id);
    const sequence = buildWeightedReviewSequence(pool, (item) => item.id, createSeededRandom("order"));
    expect(sequence[0].id).toBe("s1");
  });

  it("沒有錯題時仍能產生題目順序", () => {
    const questions = [word("g1"), word("g2")];
    const pool = buildReviewPool(questions, [], (item) => item.id);
    const sequence = buildWeightedReviewSequence(pool, (item) => item.id);
    expect(sequence).toHaveLength(2);
  });
});