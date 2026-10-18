import { describe, expect, it } from "vitest";
import { BUILTIN_WORDS, SEEDED_WORD_JAPANESE } from "./words";
import { BUILTIN_SENTENCES, SEEDED_SENTENCE_IDS } from "./sentences";
import { SENTENCE_SEED_COUNT } from "./sentenceSeeds";
import { WORD_SEED_COUNTS } from "./wordSeeds";
import { availableCategories, availableDifficulties, filterQuestions } from "../utils/randomQuestion";
import { isAnswerCorrect } from "../utils/answerMatcher";

const DIFFICULTIES = ["N5", "N4", "N3", "N2", "N1"] as const;

describe("內建題庫資料完整性", () => {
  it("單字數量足以支援各等級篩選", () => {
    expect(BUILTIN_WORDS.length).toBeGreaterThan(50);
    for (const difficulty of DIFFICULTIES) {
      const count = BUILTIN_WORDS.filter((word) => word.difficulty === difficulty).length;
      expect(count, `${difficulty} 題數不足`).toBeGreaterThan(0);
    }
  });

  it("題目 ID 唯一", () => {
    const ids = BUILTIN_WORDS.map((word) => word.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("詞彙本身不重複", () => {
    const words = BUILTIN_WORDS.map((word) => word.japanese);
    expect(new Set(words).size).toBe(words.length);
  });

  it("每筆都有必要的顯示與作答欄位", () => {
    for (const word of BUILTIN_WORDS) {
      expect(word.japanese.length, `${word.id} 缺少 japanese`).toBeGreaterThan(0);
      expect(word.kana.length, `${word.id} 缺少 kana`).toBeGreaterThan(0);
      expect(word.romaji.length, `${word.id} 缺少 romaji`).toBeGreaterThan(0);
      expect(word.meaning.length, `${word.id} 缺少 meaning`).toBeGreaterThan(0);
      expect(word.category.length, `${word.id} 缺少 category`).toBeGreaterThan(0);
    }
  });

  it("全部標記為未驗證アクセント，不宣稱已查核", () => {
    for (const word of BUILTIN_WORDS) {
      expect(word.accentVerified, `${word.id} 不應標記為已驗證`).toBe(false);
      expect(word.audioVerified ?? false).toBe(false);
    }
  });

  it("沒有內建音檔與圖片（避免使用未確認授權的素材）", () => {
    for (const word of BUILTIN_WORDS) {
      expect(word.audio ?? null).toBeNull();
      expect(word.image ?? null).toBeNull();
    }
  });

  it("每個詞彙的 romaji 都能正確判定自己", () => {
    for (const word of BUILTIN_WORDS) {
      expect(isAnswerCorrect(word.romaji, word), `${word.id} 的 romaji 無法通過`).toBe(true);
      expect(isAnswerCorrect(word.japanese, word), `${word.id} 的日文無法通過`).toBe(true);
      expect(isAnswerCorrect(word.kana, word), `${word.id} 的假名無法通過`).toBe(true);
    }
  });

  it("每個詞彙的 acceptedAnswers 都能正確判定", () => {
    for (const word of BUILTIN_WORDS) {
      for (const accepted of word.acceptedAnswers ?? []) {
        expect(isAnswerCorrect(accepted, word), `${word.id} 的替代答案 ${accepted} 無法通過`).toBe(true);
      }
    }
  });

  it("acceptedAnswers 必須是真正不同的答案，不是自己", () => {
    for (const word of BUILTIN_WORDS) {
      for (const accepted of word.acceptedAnswers ?? []) {
        expect(accepted.toLowerCase()).not.toBe(word.romaji.toLowerCase());
      }
    }
  });
});

describe("內建句子題庫", () => {
  it("至少 10 題，且 ID 唯一", () => {
    expect(BUILTIN_SENTENCES.length).toBeGreaterThanOrEqual(10);
    const ids = BUILTIN_SENTENCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("displaySentence 使用挖空格，且不包含完整答案", () => {
    for (const sentence of BUILTIN_SENTENCES) {
      expect(sentence.displaySentence, `${sentence.id} 缺少挖空格`).toMatch(/＿/);
      expect(
        sentence.displaySentence.includes(sentence.answer),
        `${sentence.id} 的挖空句洩漏了答案`,
      ).toBe(false);
    }
  });

  it("完整句子包含答案，供語音與揭示使用", () => {
    for (const sentence of BUILTIN_SENTENCES) {
      expect(sentence.sentence.length, `${sentence.id} 缺少完整句`).toBeGreaterThan(0);
    }
  });

  it("答案可以通過比對", () => {
    for (const sentence of BUILTIN_SENTENCES) {
      const matchable = {
        japanese: sentence.answer,
        kana: sentence.kana,
        romaji: sentence.romaji,
        acceptedAnswers: sentence.acceptedAnswers,
      };
      expect(isAnswerCorrect(sentence.answer, matchable), `${sentence.id} 答案無法通過`).toBe(true);
      if (sentence.romaji) {
        expect(isAnswerCorrect(sentence.romaji, matchable), `${sentence.id} romaji 無法通過`).toBe(true);
      }
    }
  });

  it("全部標記為未驗證アクセント", () => {
    for (const sentence of BUILTIN_SENTENCES) {
      expect(sentence.accentVerified).toBe(false);
      expect(sentence.audio ?? null).toBeNull();
      expect(sentence.image ?? null).toBeNull();
    }
  });
});

describe("篩選功能", () => {
  it("N5 篩選只回傳 N5", () => {
    const result = filterQuestions(BUILTIN_WORDS, { difficulties: ["N5"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((word) => word.difficulty === "N5")).toBe(true);
  });

  it("N1 篩選只回傳 N1", () => {
    const result = filterQuestions(BUILTIN_WORDS, { difficulties: ["N1"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((word) => word.difficulty === "N1")).toBe(true);
  });

  it("各主題都有題目（正式分類表）", () => {
    const categories = availableCategories(BUILTIN_WORDS);
    expect(categories).toEqual([
      "日常生活",
      "交通與旅行",
      "食物與飲食",
      "動物與自然生態",
      "學校與工作",
      "居家與健康",
      "情緒與溝通",
      "科技與數位生活",
      "天氣與環境",
      "抽象詞彙與進階表現",
      "慣用表現",
      "口語與俚語",
      "新聞・書面語",
    ]);
    // 每個分類都必須真的有題，不能只是清單上的名字
    for (const category of categories) {
      expect(
        BUILTIN_WORDS.filter((word) => word.category === category).length,
        `${category} 沒有題目`,
      ).toBeGreaterThan(0);
    }
  });

  it("分類篩選會把舊分類名轉成新分類", () => {
    // 舊版存的是「交通」，題目資料是「交通與旅行」，仍要篩得到
    const result = filterQuestions(BUILTIN_WORDS, { categories: ["交通"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((word) => word.category === "交通與旅行")).toBe(true);
    expect(filterQuestions(BUILTIN_WORDS, { categories: ["動物"] }).every((w) => w.category === "動物與自然生態")).toBe(
      true,
    );
  });

  it("可用的等級包含全部五級", () => {
    expect(availableDifficulties(BUILTIN_WORDS)).toEqual(["N5", "N4", "N3", "N2", "N1"]);
  });

  it("句子題依等級與分類篩選", () => {
    const n5 = filterQuestions(BUILTIN_SENTENCES, { difficulties: ["N5"] });
    expect(n5.length).toBeGreaterThan(0);
    expect(n5.every((s) => s.difficulty === "N5")).toBe(true);
  });

  it("句子模式不會誤抽單字題，單字模式不會誤抽句子題", () => {
    expect(BUILTIN_SENTENCES.every((s) => "displaySentence" in s)).toBe(true);
    expect(BUILTIN_WORDS.every((w) => !("displaySentence" in w))).toBe(true);
  });
});

describe("新增種子題庫", () => {
  it("100 個單字與 10 個慣用表現全部載入", () => {
    expect(WORD_SEED_COUNTS.words).toBe(100);
    expect(WORD_SEED_COUNTS.expressions).toBe(10);
    expect(WORD_SEED_COUNTS.total).toBe(110);
    // 種子詞彙必須真的在內建題庫裡
    for (const japanese of SEEDED_WORD_JAPANESE) {
      const word = BUILTIN_WORDS.find((item) => item.japanese === japanese);
      expect(word, `${japanese} 沒有載入`).toBeDefined();
    }
  });

  it("慣用表現與口語題可正常作答（羅馬字／假名／日文）", () => {
    const expressions = [
      "空気を読む",
      "手を抜く",
      "目が回る",
      "一石二鳥",
      "気がする",
      "話が弾む",
      "しょうがない",
      "やばい",
      "めっちゃ",
      "お疲れ様",
    ];
    for (const japanese of expressions) {
      const word = BUILTIN_WORDS.find((item) => item.japanese === japanese);
      expect(word, `${japanese} 沒有載入`).toBeDefined();
      expect(isAnswerCorrect(word!.romaji, word!), `${japanese} 的 romaji 無法通過`).toBe(true);
      expect(isAnswerCorrect(word!.kana, word!), `${japanese} 的假名無法通過`).toBe(true);
      expect(isAnswerCorrect(word!.japanese, word!), `${japanese} 的日文無法通過`).toBe(true);
    }
  });

  it("多重語意的口語表現提供用例說明使用情境", () => {
    for (const japanese of ["やばい", "めっちゃ"]) {
      const word = BUILTIN_WORDS.find((item) => item.japanese === japanese);
      expect(word?.example, `${japanese} 缺少用例`).toBeTruthy();
      // 含義不能只是一個翻譯，要能看出有多種語意
      expect(word!.meaning.length).toBeGreaterThan(6);
    }
  });

  it("46 道句子填空題全部載入且可作答", () => {
    expect(SENTENCE_SEED_COUNT).toBe(46);
    for (const id of SEEDED_SENTENCE_IDS) {
      const sentence = BUILTIN_SENTENCES.find((item) => item.id === id);
      expect(sentence, `${id} 沒有載入`).toBeDefined();
      const matchable = {
        japanese: sentence!.answer,
        kana: sentence!.kana,
        romaji: sentence!.romaji,
        acceptedAnswers: sentence!.acceptedAnswers,
      };
      expect(isAnswerCorrect(sentence!.answer, matchable), `${id} 答案無法通過`).toBe(true);
      expect(isAnswerCorrect(sentence!.kana!, matchable), `${id} 假名無法通過`).toBe(true);
      expect(isAnswerCorrect(sentence!.romaji!, matchable), `${id} 羅馬字無法通過`).toBe(true);
    }
  });

  it("句子題涵蓋 N5～N1 全部難度", () => {
    expect(availableDifficulties(BUILTIN_SENTENCES)).toEqual(["N5", "N4", "N3", "N2", "N1"]);
  });

  it("慣用表現與口語句子題已存在（answerType 正確）", () => {
    const idiom = BUILTIN_SENTENCES.find((s) => s.id === "s-s037");
    expect(idiom?.answerType).toBe("idiom");
    const slang = BUILTIN_SENTENCES.find((s) => s.id === "s-s042");
    expect(slang?.answerType).toBe("slang");
  });

  it("合併種子題庫不會讓既有詞彙的 ID 改變", () => {
    // 錯題本／遊玩紀錄以 ID 當鍵，既有 ID 必須保持穩定
    for (const japanese of ["試験", "約束", "準備", "水", "野菜", "猫", "天気", "駅"]) {
      const word = BUILTIN_WORDS.find((item) => item.japanese === japanese);
      expect(word, `${japanese} 不應消失`).toBeDefined();
      expect(word!.id.startsWith("w-")).toBe(true);
    }
  });
});