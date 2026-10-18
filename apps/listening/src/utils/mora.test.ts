import { describe, expect, it } from "vitest";
import { containsKana, countMora, countQuestionMora, moraSourceText } from "./mora";

describe("countMora 一般假名", () => {
  it("每個平假名各算 1 拍", () => {
    expect(countMora("ねこ")).toBe(2);
    expect(countMora("あ")).toBe(1);
    expect(countMora("ネコ")).toBe(2);
    expect(countMora("ﾈｺ")).toBe(2);
  });
});

describe("countMora 拗音", () => {
  it("拗音的小書き不獨立成拍", () => {
    expect(countMora("きゃ")).toBe(1);
    expect(countMora("しゅ")).toBe(1);
    expect(countMora("ちょ")).toBe(1);
    expect(countMora("きょう")).toBe(2); // き + ょ(不計) + う
    expect(countMora("しゅじゅつ")).toBe(3);
  });

  it("片假名拗音同樣處理", () => {
    expect(countMora("キャ")).toBe(1);
    expect(countMora("ニュー")).toBe(2); // ニ ュ(不計) ー
  });

  it("其他小書き假名不獨立成拍", () => {
    expect(countMora("ウィ")).toBe(1);
    expect(countMora("ヴァ")).toBe(1);
  });
});

describe("countMora 小促音與撥音", () => {
  it("小促音算 1 拍", () => {
    expect(countMora("きって")).toBe(3); // き っ て
    expect(countMora("ベッド")).toBe(3); // ベ ッ ド
  });

  it("撥音算 1 拍", () => {
    expect(countMora("にほん")).toBe(3); // に ほ ん
  });
});

describe("countMora 長音與濁音", () => {
  it("長音符算 1 拍", () => {
    expect(countMora("ラーメン")).toBe(4);
    expect(countMora("ケーキ")).toBe(3);
    expect(countMora("コーヒー")).toBe(4);
  });

  it("濁音與半濁音本身各算 1 拍", () => {
    expect(countMora("がっこう")).toBe(4); // が っ こ う
    expect(countMora("パンをたべる")).toBe(6);
  });
});

describe("countMora 其他輸入", () => {
  it("空字串與非日文回傳 0", () => {
    expect(countMora("")).toBe(0);
    expect(countMora("hello")).toBe(0);
    expect(countMora("   ")).toBe(0);
  });

  it("混合文字只計假名部分", () => {
    expect(countMora("ねこA")).toBe(2);
  });
});

describe("containsKana", () => {
  it("判斷文字是否含有假名", () => {
    expect(containsKana("ねこ")).toBe(true);
    expect(containsKana("ネコ")).toBe(true);
    expect(containsKana("hello")).toBe(false);
    expect(containsKana("")).toBe(false);
  });
});

describe("countQuestionMora", () => {
  it("優先使用假名讀音計算", () => {
    expect(countQuestionMora({ japanese: "学校", kana: "がっこう" })).toBe(4);
  });

  it("沒有假名時退回日文字串", () => {
    expect(countQuestionMora({ japanese: "ねこ" })).toBe(2);
  });

  it("完全無法判斷時回傳 0", () => {
    expect(countQuestionMora({ japanese: "學校", kana: "" })).toBe(0);
  });
});

describe("moraSourceText", () => {
  it("有假名時回傳假名", () => {
    expect(moraSourceText({ japanese: "学校", kana: "がっこう" })).toBe("がっこう");
  });

  it("假名是空字串時退回日文", () => {
    expect(moraSourceText({ japanese: "ねこ", kana: "" })).toBe("ねこ");
  });

  it("兩者都沒有時回傳空字串", () => {
    expect(moraSourceText({})).toBe("");
  });
});