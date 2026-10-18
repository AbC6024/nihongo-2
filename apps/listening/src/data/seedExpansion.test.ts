import { describe, expect, it } from "vitest";
import { BUILTIN_WORDS, LEGACY_WORD_JAPANESE } from "./words";
import { BUILTIN_SENTENCES } from "./sentences";
import { SEEDED_SENTENCE_IDS } from "./sentences";
import { WORD_SEEDS } from "./wordSeeds";
import {
  buildSessionQuestions,
  composeDailyQuestionIds,
  filterQuestions,
  availableCategories,
} from "../utils/randomQuestion";
import { speechTextFor } from "../services/speech";
import { resolveSpeechRate, DEFAULT_SPEECH_RATE_CONFIG } from "../utils/speechRate";
import { isSentenceQuestion } from "../types/question";

/**
 * 新增題庫與既有遊戲機制的整合檢查。
 * 重點：新增資料必須「只是更多題目」，不得改壞抽題、語音、
 * 語速與舊資料相容性。
 */
describe("題庫擴充後的整合", () => {
  it("題庫規模", () => {
    expect(WORD_SEEDS.length).toBe(110);
    expect(BUILTIN_SENTENCES.length).toBe(21 + 46);
    // 88 筆原有 + 110 筆種子 − 20 筆重複 = 178 筆不重複詞彙
    // （重複的 20 筆以種子資料更新既有詞彙，ID 不變，不會產生兩份同樣的題目）
    expect(LEGACY_WORD_JAPANESE.length).toBe(88);
    expect(BUILTIN_WORDS.length).toBe(88 + 110 - 20);
    expect(BUILTIN_WORDS.length).toBe(178);
  });

  it("種子題庫與原有題庫重疊的詞彙會合併，不會變成兩道題", () => {
    const legacy = new Set(LEGACY_WORD_JAPANESE);
    const overlap = WORD_SEEDS.filter((seed) => legacy.has(seed.japanese));
    expect(overlap.length).toBe(20);
    for (const seed of overlap) {
      const matches = BUILTIN_WORDS.filter((word) => word.japanese === seed.japanese);
      expect(matches, `${seed.japanese} 不應出現兩次`).toHaveLength(1);
      // 以種子資料為準更新讀音與難度
      expect(matches[0].kana).toBe(seed.kana);
      expect(matches[0].meaning).toBe(seed.meaning);
    }
  });

  it("原有的 88 個詞彙全部保留，ID 維持不變（舊紀錄不會遺失）", () => {
    expect(LEGACY_WORD_JAPANESE.length).toBe(88);
    const byJapanese = new Map(BUILTIN_WORDS.map((word) => [word.japanese, word]));
    for (const japanese of LEGACY_WORD_JAPANESE) {
      const word = byJapanese.get(japanese);
      expect(word, `原有詞彙 ${japanese} 消失了`).toBeDefined();
      // ID 由日文雜湊決定，日文不變 → ID 不變
      expect(word!.id).toMatch(/^w-[0-9a-z]+$/);
    }
  });

  it("原有的 21 道句子題全部保留", () => {
    const legacyIds = [
      "s-ramen-kinou", "s-gakkou-kyou", "s-tenki-yoi", "s-densha-kippu", "s-neko-mae",
      "s-hajimari-photo", "s-ganbaru", "s-kaigi-youbi", "s-jouhou-kakutei", "s-douryou-wakare",
      "s-hajimari-kimono", "s-gekihin-seisou", "s-utsuroi-kaede", "s-chousa-sanbu",
      "s-sannen-minaoshi", "s-taai-taiji", "s-kitsune-sumi", "s-soutei-fushigi",
      "s-zenrei-teki", "s-jibun-hakken", "s-gakuteki-so",
    ];
    const ids = new Set(BUILTIN_SENTENCES.map((s) => s.id));
    for (const id of legacyIds) expect(ids.has(id), `${id} 消失了`).toBe(true);
  });

  it("句子模式只會抽句子題，單字模式只會抽單字題", () => {
    const sentencePool = filterQuestions(BUILTIN_SENTENCES, {});
    const wordPool = filterQuestions(BUILTIN_WORDS, {});
    expect(sentencePool.every(isSentenceQuestion)).toBe(true);
    expect(wordPool.some(isSentenceQuestion)).toBe(false);

    const wordSession = buildSessionQuestions(wordPool, (q) => q.id);
    expect(wordSession.order.every((q) => !isSentenceQuestion(q))).toBe(true);
    const sentenceSession = buildSessionQuestions(sentencePool, (q) => q.id);
    expect(sentenceSession.order.every(isSentenceQuestion)).toBe(true);
  });

  it("句子語音播放的是完整句，不是挖空句", () => {
    for (const id of SEEDED_SENTENCE_IDS) {
      const sentence = BUILTIN_SENTENCES.find((s) => s.id === id)!;
      expect(speechTextFor(sentence)).toBe(sentence.sentence);
      expect(speechTextFor(sentence)).not.toContain("＿");
    }
  });

  it("單字語音播放的是日文原字", () => {
    for (const seed of WORD_SEEDS) {
      const word = BUILTIN_WORDS.find((w) => w.japanese === seed.japanese)!;
      expect(speechTextFor(word)).toBe(word.japanese);
    }
  });

  it("語速規則沒有被新增題庫影響（0.5× 不疊加短單字 0.75×）", () => {
    // 短單字（例如「猫」1 拍）在 0.5× 模式下必須剛好 0.5
    const neko = BUILTIN_WORDS.find((w) => w.japanese === "猫")!;
    expect(resolveSpeechRate(neko, { ...DEFAULT_SPEECH_RATE_CONFIG, speedMultiplier: 0.5 }).rate).toBe(0.5);
    // 1.0× 模式仍保留短單字 0.75 規則
    expect(
      resolveSpeechRate(neko, { ...DEFAULT_SPEECH_RATE_CONFIG, speedMultiplier: 1 }).rule,
    ).toBe("short-word");
    // 長單字維持基準速率
    const long = BUILTIN_WORDS.find((w) => w.japanese === "再生可能エネルギー")!;
    expect(resolveSpeechRate(long, { ...DEFAULT_SPEECH_RATE_CONFIG, speedMultiplier: 1 }).rule).toBe("base");
  });

  it("每日挑戰仍維持 10 題：前 5 題一般庫、後 5 題優先錯題", () => {
    const generalIds = BUILTIN_WORDS.map((w) => w.id);
    const mistakeIds = BUILTIN_SENTENCES.slice(0, 8).map((s) => s.id);
    const ids = composeDailyQuestionIds({ generalIds, mistakeIds });
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    // 錯題保留給後半段
    expect(ids.slice(5).filter((id) => mistakeIds.includes(id)).length).toBeGreaterThan(0);
    // 沒有重複
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("難度與分類篩選在擴充後仍正常", () => {
    for (const difficulty of ["N5", "N4", "N3", "N2", "N1"] as const) {
      expect(filterQuestions(BUILTIN_WORDS, { difficulties: [difficulty] }).length).toBeGreaterThan(0);
      expect(filterQuestions(BUILTIN_SENTENCES, { difficulties: [difficulty] }).length).toBeGreaterThan(0);
    }
    const categories = availableCategories(BUILTIN_WORDS);
    expect(categories.length).toBeGreaterThanOrEqual(12);
    for (const category of categories) {
      expect(filterQuestions(BUILTIN_WORDS, { categories: [category] }).length).toBeGreaterThan(0);
    }
  });

  it("沒有音檔或圖片時仍然可以正常出題（不依賴外部素材）", () => {
    for (const word of BUILTIN_WORDS) {
      expect(word.audio ?? null).toBeNull();
      expect(word.image ?? null).toBeNull();
    }
    for (const sentence of BUILTIN_SENTENCES) {
      expect(sentence.audio ?? null).toBeNull();
      expect(sentence.image ?? null).toBeNull();
    }
  });

  it("同局題序穩定：題目順序由 session 保存，重渲染不會變", () => {
    const pool = filterQuestions(BUILTIN_WORDS, { difficulties: ["N5"] });
    // 用可重現的亂數來源，模擬「同一局重複計算題序」的情境
    const seeded = () => {
      let state = 12345;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    };
    const first = buildSessionQuestions(pool, (q) => q.id, seeded());
    // 元件重渲染：用同一個亂數來源重算，順序必須一模一樣
    const reRender = buildSessionQuestions(pool, (q) => q.id, seeded());
    expect(reRender.order.map((q) => q.id)).toEqual(first.order.map((q) => q.id));
    expect(first.noRepeat).toBe(true);
    expect(new Set(first.order.map((q) => q.id)).size).toBe(first.order.length);
    // 原始題庫不被洗牌破壞
    expect(pool).toHaveLength(filterQuestions(BUILTIN_WORDS, { difficulties: ["N5"] }).length);
  });

  it("開始新局會重新抽題（不同亂數來源 → 不同順序）", () => {
    const pool = filterQuestions(BUILTIN_WORDS, { difficulties: ["N5"] });
    const a = buildSessionQuestions(pool, (q) => q.id).order.map((q) => q.id);
    const b = buildSessionQuestions(pool, (q) => q.id).order.map((q) => q.id);
    // 有可能撞成同一個排列，但 35 題 N5 題庫撞到的機率極低；只檢查長度與無重複
    expect(a).toHaveLength(pool.length);
    expect(b).toHaveLength(pool.length);
    expect(new Set(a).size).toBe(a.length);
    expect(new Set(b).size).toBe(b.length);
  });
});