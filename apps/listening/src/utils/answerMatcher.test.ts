import { describe, expect, it } from "vitest";
import {
  buildAcceptedSet,
  canonicalKey,
  isAnswerCorrect,
  isRomajiLike,
  katakanaToHiragana,
  normalizeBase,
  normalizeUnicode,
} from "./answerMatcher";

describe("normalizeBase", () => {
  it("去除前後空白與合併連續空白", () => {
    expect(normalizeBase("  neko  ")).toBe("neko");
    expect(normalizeBase("a   b")).toBe("a b");
    expect(normalizeBase("　ねこ　")).toBe("ねこ");
  });

  it("統一 Unicode 表示差異（全形英數 → 半形）", () => {
    expect(normalizeUnicode("ＮＥＫＯ")).toBe("NEKO");
    expect(normalizeUnicode("ﾈｺ")).toBe("ネコ");
  });
});

describe("katakanaToHiragana", () => {
  it("片假名轉平假名，長音符保留", () => {
    expect(katakanaToHiragana("ラーメン")).toBe("らーめん");
    expect(katakanaToHiragana("ネコ")).toBe("ねこ");
  });
});

describe("canonicalKey", () => {
  it("拉丁字母忽略大小寫與空白", () => {
    expect(canonicalKey("NEKO")).toBe("neko");
    expect(canonicalKey("  ne ko ")).toBe("neko");
    expect(canonicalKey("N e k o")).toBe("neko");
  });

  it("日文忽略片假名／平假名差異", () => {
    expect(canonicalKey("ラーメン")).toBe(canonicalKey("らーめん"));
    expect(canonicalKey("ﾈｺ")).toBe(canonicalKey("ねこ"));
  });
});

describe("isAnswerCorrect", () => {
  const neko = {
    japanese: "猫",
    kana: "ねこ",
    romaji: "neko",
    meaning: "貓",
  };

  it("接受正確的 romaji（不分大小寫與空白）", () => {
    expect(isAnswerCorrect("neko", neko)).toBe(true);
    expect(isAnswerCorrect("NEKO", neko)).toBe(true);
    expect(isAnswerCorrect(" neko ", neko)).toBe(true);
  });

  it("接受正確的日文與假名", () => {
    expect(isAnswerCorrect("猫", neko)).toBe(true);
    expect(isAnswerCorrect("ねこ", neko)).toBe(true);
    expect(isAnswerCorrect("ネコ", neko)).toBe(true);
  });

  it("拒絕不同單字，不做模糊比對", () => {
    expect(isAnswerCorrect("inu", neko)).toBe(false);
    expect(isAnswerCorrect("ねこ犬", neko)).toBe(false);
    expect(isAnswerCorrect("nek", neko)).toBe(false);
    expect(isAnswerCorrect("neko2", neko)).toBe(false);
  });

  it("只接受明確列出的 acceptedAnswers", () => {
    const gakkou = {
      japanese: "学校",
      kana: "がっこう",
      romaji: "gakkou",
      acceptedAnswers: ["gakko"],
    };
    expect(isAnswerCorrect("gakko", gakkou)).toBe(true);
    expect(isAnswerCorrect("gakkyou", gakkou)).toBe(false);
  });

  it("空白輸入不算正確", () => {
    expect(isAnswerCorrect("", neko)).toBe(false);
    expect(isAnswerCorrect("   ", neko)).toBe(false);
  });

  it("句子題：只接受答案與明確列出的替代答案", () => {
    const sentence = { japanese: "ラーメン", kana: "ラーメン", romaji: "ramen" };
    expect(isAnswerCorrect("ramen", sentence)).toBe(true);
    expect(isAnswerCorrect("ラーメン", sentence)).toBe(true);
    expect(isAnswerCorrect("sushi", sentence)).toBe(false);
    // 完整句子不能當成答案
    expect(isAnswerCorrect("昨日、友達とラーメンを食べました。", sentence)).toBe(false);
  });
});

describe("buildAcceptedSet", () => {
  it("收集所有明確答案並去除空白", () => {
    expect(
      buildAcceptedSet({ japanese: "猫", kana: "ねこ", romaji: "neko", acceptedAnswers: [" neko "] }),
    ).toEqual(["猫", "ねこ", "neko", "neko"]);
  });

  it("沒有資料時回傳空陣列", () => {
    expect(buildAcceptedSet({})).toEqual([]);
  });
});

describe("isRomajiLike", () => {
  it("判斷輸入是否為拉丁字母", () => {
    expect(isRomajiLike("neko")).toBe(true);
    expect(isRomajiLike("gakkou")).toBe(true);
    expect(isRomajiLike("ねこ")).toBe(false);
    expect(isRomajiLike("")).toBe(false);
  });
});