import { describe, expect, it } from "vitest";
import {
  BRAND_TITLE,
  BRAND_TITLE_DECORATED,
  DEFAULT_LOCALE,
  en,
  formatTranslation,
  isLocaleCode,
  ja,
  LOCALES,
  LOCALE_DURATION,
  LOCALE_INPUT_METHOD,
  LOCALE_NAMES,
  TRANSLATIONS,
  zhTW,
  type TranslationKey,
  type Translations,
} from "./index";
import { brandDocumentTitle } from "./brand";

const ALL_LOCALES = ["zh-TW", "ja", "en"] as const;

describe("語言清單", () => {
  it("提供三種語言", () => {
    expect(LOCALES.map((locale) => locale.code)).toEqual(["zh-TW", "ja", "en"]);
  });

  it("預設語言是繁體中文", () => {
    expect(DEFAULT_LOCALE).toBe("zh-TW");
  });

  it("isLocaleCode 正確判斷", () => {
    expect(isLocaleCode("zh-TW")).toBe(true);
    expect(isLocaleCode("ja")).toBe(true);
    expect(isLocaleCode("en")).toBe(true);
    expect(isLocaleCode("fr")).toBe(false);
    expect(isLocaleCode(null)).toBe(false);
  });
});

describe("翻譯完整性", () => {
  const zhKeys = Object.keys(zhTW) as TranslationKey[];

  it("繁中翻譯鍵值數量合理", () => {
    expect(zhKeys.length).toBeGreaterThan(150);
  });

  for (const locale of ALL_LOCALES) {
    it(`${locale} 具備與繁中完全相同的鍵值`, () => {
      const dictionary = TRANSLATIONS[locale];
      expect(Object.keys(dictionary).sort()).toEqual([...zhKeys].sort());
    });

    it(`${locale} 沒有空白翻譯`, () => {
      const dictionary = TRANSLATIONS[locale];
      const empty = zhKeys.filter((key) => {
        const value = dictionary[key];
        return typeof value !== "string" || value.trim().length === 0;
      });
      expect(empty, `${locale} 有空白翻譯：${empty.join(", ")}`).toEqual([]);
    });

    it(`${locale} 的翻譯不會殘留未替換的佔位符`, () => {
      const dictionary = TRANSLATIONS[locale];
      const allowed = ["{n}", "{score}", "{label}", "{percent}", "{attempts}", "{needed}",
        "{current}", "{best}", "{correct}", "{accuracy}", "{level}", "{category}",
        "{wrong}", "{version}", "{size}", "{source}", "{text}", "{max}",
        "{words}", "{sentences}", "{status}", "{skipped}",
        "{name}", "{mistakes}", "{games}", "{days}", "{error}"];
      const bad = zhKeys.filter((key) => {
        const value = dictionary[key];
        const matches = value.match(/\{[a-zA-Z]+\}/g) ?? [];
        return matches.some((token) => !allowed.includes(token));
      });
      expect(bad, `${locale} 有未知佔位符：${bad.join(", ")}`).toEqual([]);
    });
  }

  it("型別上三種語言已被約束為相同鍵值", () => {
    const typedJa: Translations = ja;
    const typedEn: Translations = en;
    expect(Object.keys(typedJa)).toHaveLength(Object.keys(zhTW).length);
    expect(Object.keys(typedEn)).toHaveLength(Object.keys(zhTW).length);
  });
});

describe("輸入方式翻譯", () => {
  it("繁中使用「羅馬字」與「假名」", () => {
    expect(LOCALE_INPUT_METHOD["zh-TW"].romaji).toBe("羅馬字");
    expect(LOCALE_INPUT_METHOD["zh-TW"].kana).toBe("假名");
  });

  it("日文使用「ローマ字」與「かな」", () => {
    expect(LOCALE_INPUT_METHOD.ja.romaji).toBe("ローマ字");
    expect(LOCALE_INPUT_METHOD.ja.kana).toBe("かな");
  });

  it("英文使用「Romaji」與「Kana」", () => {
    expect(LOCALE_INPUT_METHOD.en.romaji).toBe("Romaji");
    expect(LOCALE_INPUT_METHOD.en.kana).toBe("Kana");
  });

  it("三種語言都提供兩個輸入方式", () => {
    for (const locale of ALL_LOCALES) {
      expect(LOCALE_INPUT_METHOD[locale].romaji).toBeTruthy();
      expect(LOCALE_INPUT_METHOD[locale].kana).toBeTruthy();
    }
  });
});

describe("語言名稱與時間", () => {
  it("語言選項使用自己的語言名稱", () => {
    expect(LOCALE_NAMES["zh-TW"]).toBe("中文");
    expect(LOCALE_NAMES.ja).toBe("日本語");
    expect(LOCALE_NAMES.en).toBe("English");
  });

  it("時間選項依語言輸出", () => {
    expect(LOCALE_DURATION["zh-TW"](1)).toBe("1 分鐘");
    expect(LOCALE_DURATION.ja(1)).toBe("1 分");
    expect(LOCALE_DURATION.en(1)).toBe("1 min");
  });
});

describe("formatTranslation", () => {
  it("替換 {name} 佔位符", () => {
    expect(formatTranslation("答錯 {n} 次", { n: 3 })).toBe("答錯 3 次");
  });

  it("可替換多個佔位符", () => {
    expect(formatTranslation("{label} 是 {percent}%", { label: "N2", percent: 70 })).toBe(
      "N2 是 70%",
    );
  });

  it("沒有參數時原樣輸出", () => {
    expect(formatTranslation("純文字")).toBe("純文字");
  });
});

describe("關鍵介面文字", () => {
  it("繁中的輸入方式標籤完全符合需求", () => {
    expect(zhTW.romaji).toBe("羅馬字");
    expect(zhTW.kana).toBe("假名");
  });

  it("提示字串涵蓋需求中列出的項目", () => {
    const required: TranslationKey[] = [
      "tagline",
      "modeWord",
      "modeSentence",
      "modeReview",
      "modeMistakes",
      "modeDaily",
      "modeAnalytics",
      "labelGameLanguage",
      "labelInputMethod",
      "labelDuration",
      "labelDifficulty",
      "labelCategory",
      "startWordMode",
      "cardWordHint",
      "submit",
      "correct",
      "retry",
      "playAudio",
      "skip",
      "nextQuestion",
      "labelRemaining",
      "labelScore",
      "labelCorrect",
      "labelWrong",
      "starredBadge",
      "correct",
      "statCurrentStreak",
      "statBestStreak",
      "statTotalGames",
      "statOverallAccuracy",
      "statAvgResponse",
      "strongLabel",
      "weakLabel",
      "insufficientLabel",
      "resultTimeUp",
      "playAgain",
      "reviewMistakesNow",
      "goHome",
      "imageLoadFailed",
      "emptyReviewTitle",
    ];
    for (const key of required) {
      expect(zhTW[key], `缺少 ${key}`).toBeTruthy();
    }
  });
});
describe("品牌標題（固定，不隨語言切換）", () => {
  it("appTitle 已從三個翻譯字典移除", () => {
    for (const dictionary of [zhTW, ja, en]) {
      expect(Object.keys(dictionary), "翻譯字典不應再含有 appTitle").not.toContain("appTitle");
    }
  });

  it("BRAND_TITLE 是固定的日文品牌名稱", () => {
    expect(BRAND_TITLE).toBe("聞いボード");
    expect(BRAND_TITLE_DECORATED).toBe("《聞いボード》");
  });

  it("英文字典沒有任何 Niiki Board 之類的替代名稱", () => {
    const values = Object.values(en) as string[];
    expect(values.some((value) => /Niiki Board|Listen Board|Listening Board/.test(value))).toBe(
      false,
    );
  });

  it("分頁標題在任一語言下都保留品牌名稱", () => {
    for (const dictionary of [zhTW, ja, en]) {
      expect(brandDocumentTitle(dictionary.tagline)).toBe(
        `聞いボード｜${dictionary.tagline}`,
      );
    }
  });
});

describe("音效翻譯", () => {
  it("三種語言的音效區塊名稱符合需求", () => {
    expect(zhTW.sfxSection).toBe("音效");
    expect(ja.sfxSection).toBe("効果音");
    expect(en.sfxSection).toBe("Sound Effects");
  });

  it("音效開關與音量提示皆有翻譯", () => {
    for (const key of ["sfxToggle", "sfxToggleHint", "sfxVolume"] as const) {
      expect(zhTW[key], `zh-TW 缺少 ${key}`).toBeTruthy();
      expect(ja[key], `ja 缺少 ${key}`).toBeTruthy();
      expect(en[key], `en 缺少 ${key}`).toBeTruthy();
    }
  });
});

describe("語言選項名稱", () => {
  it("維持各語言的慣用寫法", () => {
    expect(LOCALE_NAMES["zh-TW"]).toBe("中文");
    expect(LOCALE_NAMES.ja).toBe("日本語");
    expect(LOCALE_NAMES.en).toBe("English");
  });
});
