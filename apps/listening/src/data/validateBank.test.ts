import { describe, expect, it } from "vitest";
import { BUILTIN_WORDS, SEEDED_WORD_JAPANESE } from "./words";
import { BUILTIN_SENTENCES, SEEDED_SENTENCE_IDS } from "./sentences";
import { formatIssues, validateQuestionBank } from "./validateBank";
import { WORD_SEED_COUNTS } from "./wordSeeds";
import { SENTENCE_SEED_COUNT } from "./sentenceSeeds";

/**
 * 規格書第十一節「資料完整性與品質檢查」。
 *
 * 這支測試等同 `npm run validate:bank`：任何一項檢查失敗都會直接失敗，
 * 不會只是印出警告。
 */
describe("題庫驗證", () => {
  const result = validateQuestionBank({
    words: BUILTIN_WORDS,
    sentences: BUILTIN_SENTENCES,
    seededWords: SEEDED_WORD_JAPANESE,
    seededSentenceIds: SEEDED_SENTENCE_IDS,
  });

  it("全部檢查通過（無任何資料問題）", () => {
    if (!result.ok) {
      throw new Error(`題庫驗證失敗，共 ${result.issues.length} 項：\n${formatIssues(result.issues)}`);
    }
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("統計數量符合規格", () => {
    expect(result.words).toBe(BUILTIN_WORDS.length);
    expect(result.sentences).toBe(BUILTIN_SENTENCES.length);
    expect(result.seededWords).toBe(WORD_SEED_COUNTS.total);
    expect(result.seededSentences).toBe(46);
    expect(SENTENCE_SEED_COUNT).toBe(46);
  });

  it("題庫成長到足以支援各模式（單字 > 100、句子 > 40）", () => {
    expect(result.words).toBeGreaterThan(100);
    expect(result.sentences).toBeGreaterThan(40);
  });

  it("答案不存在於完整句時會被抓出來（反向測試）", () => {
    const broken = [
      {
        ...BUILTIN_SENTENCES[0],
        id: "s-broken",
        sentence: "これはテストの文です。",
        displaySentence: "これは＿＿＿の文です。",
        answer: "存在しない答え",
        kana: "そんざいしないこたえ",
        romaji: "sonzaishinai",
      },
    ];
    const issues = validateQuestionBank({ words: [], sentences: broken });
    expect(issues.issues.some((i) => i.kind === "answer-not-in-sentence")).toBe(true);
  });

  it("挖空句洩漏答案時會被抓出來（反向測試）", () => {
    const leaking = [
      {
        ...BUILTIN_SENTENCES[0],
        id: "s-leak",
        // 挖空句沒有真的挖空，答案直接顯示在畫面上
        displaySentence: "昨日、友達とラーメンを食べました。",
      },
    ];
    const issues = validateQuestionBank({ words: [], sentences: leaking });
    expect(issues.issues.some((i) => i.kind === "answer-leak")).toBe(true);
    expect(issues.issues.some((i) => i.kind === "blank-mismatch")).toBe(true);
  });

  it("只有改 ID 的重複題目會被抓出來（反向測試）", () => {
    const dup = [
      BUILTIN_WORDS[0],
      { ...BUILTIN_WORDS[0], id: `${BUILTIN_WORDS[0].id}-copy` },
    ];
    const issues = validateQuestionBank({ words: dup, sentences: [] });
    expect(issues.issues.some((i) => i.kind === "duplicate-content")).toBe(true);
  });

  it("非法難度與非法分類會被抓出來（反向測試）", () => {
    const bad = [
      { ...BUILTIN_WORDS[0], japanese: "テスト語", difficulty: "N9" as never, category: "不存在分類" },
    ];
    const issues = validateQuestionBank({ words: bad, sentences: [] });
    expect(issues.issues.some((i) => i.kind === "invalid-difficulty")).toBe(true);
    expect(issues.issues.some((i) => i.kind === "invalid-category")).toBe(true);
  });

  it("單字與句子 ID 相撞會被抓出來（會讓錯題本互相覆蓋）", () => {
    const word = { ...BUILTIN_WORDS[0], id: "collision-id" };
    const sentence = { ...BUILTIN_SENTENCES[0], id: "collision-id" };
    const issues = validateQuestionBank({ words: [word], sentences: [sentence] });
    expect(issues.issues.some((i) => i.kind === "duplicate-id")).toBe(true);
  });

  it("句子答案的活用形必須真的在句中（不得只塞字典形）", () => {
    // 每題答案都要能在完整句中找到，驗證用 try 語法例句
    for (const sentence of BUILTIN_SENTENCES) {
      expect(
        sentence.sentence.includes(sentence.answer),
        `${sentence.id} 答案「${sentence.answer}」不在完整句中`,
      ).toBe(true);
    }
  });
});