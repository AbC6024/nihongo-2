import { describe, expect, it } from "vitest";
import { detectFormat, importVocabulary, normalizeWordRecord, parseCsv } from "./vocabularyImporter";

const validJson = JSON.stringify([
  {
    id: "x-1",
    japanese: "猫",
    kana: "ねこ",
    romaji: "neko",
    meaning: "貓",
    difficulty: "N5",
    category: "動物",
  },
  {
    japanese: "犬",
    kana: "いぬ",
    romaji: "inu",
    meaning: "狗",
    difficulty: "n5",
  },
]);

describe("detectFormat", () => {
  it("以開頭判斷 JSON 或 CSV", () => {
    expect(detectFormat('[{"a":1}]')).toBe("json");
    expect(detectFormat('{"words":[]}')).toBe("json");
    expect(detectFormat("a,b\n1,2")).toBe("csv");
  });
});

describe("parseCsv", () => {
  it("解析標題與資料列", () => {
    const rows = parseCsv("id,japanese,kana\n1,猫,ねこ\n2,犬,いぬ");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: "1", japanese: "猫", kana: "ねこ" });
  });

  it("支援引號包住含逗號的欄位", () => {
    const rows = parseCsv('japanese,meaning\n猫,"貓, 動物"');
    expect(rows[0].meaning).toBe("貓, 動物");
  });

  it("跳過空白行", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toHaveLength(1);
  });
});

describe("normalizeWordRecord", () => {
  const base = {
    japanese: "猫",
    kana: "ねこ",
    romaji: "neko",
    difficulty: "N5",
  };

  it("通過驗證時回傳標準化題目", () => {
    const { word, issue } = normalizeWordRecord(base, 1);
    expect(issue).toBeNull();
    expect(word?.id).toBeTruthy();
    expect(word?.accentVerified).toBe(false);
    expect(word?.source).toBe("imported");
  });

  it("缺少 japanese 時回報錯誤", () => {
    const { word, issue } = normalizeWordRecord({ kana: "ねこ", romaji: "neko", difficulty: "N5" }, 3);
    expect(word).toBeNull();
    expect(issue?.line).toBe(3);
    expect(issue?.reason).toContain("japanese");
  });

  it("缺少 romaji 時回報錯誤", () => {
    const { word, issue } = normalizeWordRecord({ japanese: "猫", kana: "ねこ", difficulty: "N5" }, 2);
    expect(word).toBeNull();
    expect(issue?.reason).toContain("romaji");
  });

  it("difficulty 非法時回報錯誤", () => {
    const { word, issue } = normalizeWordRecord({ ...base, difficulty: "N9" }, 4);
    expect(word).toBeNull();
    expect(issue?.reason).toContain("difficulty");
  });

  it("偵測與既有題庫重複的 ID 與詞彙", () => {
    const existingIds = new Set(["x-1"]);
    const existingWords = new Set(["犬"]);
    const dupId = normalizeWordRecord({ ...base, id: "x-1" }, 5, { existingIds });
    expect(dupId.word).toBeNull();
    expect(dupId.issue?.reason).toContain("ID 重複");

    const dupWord = normalizeWordRecord(
      { ...base, japanese: "犬", kana: "いぬ", romaji: "inu" },
      6,
      { existingWords },
    );
    expect(dupWord.word).toBeNull();
    expect(dupWord.issue?.reason).toContain("詞彙重複");
  });

  it("沒有 script 時依字形推斷", () => {
    expect(normalizeWordRecord(base, 7).word?.script).toBe("hiragana");
    expect(
      normalizeWordRecord({ ...base, japanese: "ラーメン", kana: "ラーメン" }, 8).word?.script,
    ).toBe("katakana");
  });

  it("accentVerified 預設為 false", () => {
    expect(normalizeWordRecord(base, 9).word?.accentVerified).toBe(false);
    expect(
      normalizeWordRecord({ ...base, accentVerified: "true" }, 10).word?.accentVerified,
    ).toBe(true);
  });
});

describe("importVocabulary", () => {
  it("成功匯入全部資料", () => {
    const report = importVocabulary(validJson);
    expect(report.sourceFormat).toBe("json");
    expect(report.total).toBe(2);
    expect(report.imported).toBe(2);
    expect(report.skipped).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it("支援 words 包裝物件", () => {
    const report = importVocabulary(JSON.stringify({ words: JSON.parse(validJson) }));
    expect(report.imported).toBe(2);
  });

  it("CSV 匯入：標題列不計入筆數", () => {
    const csv = `japanese,kana,romaji,difficulty
猫,ねこ,neko,N5
犬,いぬ,inu,N5`;
    const report = importVocabulary(csv);
    expect(report.sourceFormat).toBe("csv");
    expect(report.total).toBe(2);
    expect(report.imported).toBe(2);
  });

  it("略過無效資料並回報行號", () => {
    const report = importVocabulary(
      JSON.stringify([
        { japanese: "猫", kana: "ねこ", romaji: "neko", difficulty: "N5" },
        { japanese: "犬", kana: "いぬ", romaji: "inu", difficulty: "X9" },
      ]),
    );
    expect(report.imported).toBe(1);
    expect(report.skipped).toBe(1);
    expect(report.issues[0].line).toBe(2);
  });

  it("偵測匯入內容內部的重複", () => {
    const report = importVocabulary(
      JSON.stringify([
        { japanese: "猫", kana: "ねこ", romaji: "neko", difficulty: "N5" },
        { japanese: "猫", kana: "ねこ", romaji: "neko2", difficulty: "N5" },
      ]),
    );
    expect(report.imported).toBe(1);
    expect(report.duplicates).toEqual(["猫"]);
  });

  it("格式錯誤時回報解析失敗而不是拋出例外", () => {
    const report = importVocabulary("{ not json");
    expect(report.imported).toBe(0);
    expect(report.issues[0].reason).toContain("解析失敗");
  });

  it("CSV 欄位缺漏時逐筆回報", () => {
    const csv = `japanese,kana,romaji,difficulty
猫,ねこ,neko,N5
犬,,inu,N5
,いぬ,inu,N5`;
    const report = importVocabulary(csv);
    expect(report.imported).toBe(1);
    expect(report.skipped).toBe(2);
    expect(report.issues).toHaveLength(2);
  });

  it("支援內建示範資料檔的格式", () => {
    const report = importVocabulary(
      JSON.stringify({ words: [{ id: "s1", japanese: "猫", kana: "ねこ", romaji: "neko", difficulty: "N5" }] }),
    );
    expect(report.imported).toBe(1);
  });
});