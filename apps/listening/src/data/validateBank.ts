import type { SentenceQuestion, WordQuestion } from "../types/question";
import { CATEGORY_ORDER, canonicalCategory } from "../utils/categories";
import { isAnswerCorrect } from "../utils/answerMatcher";

/**
 * 題庫資料驗證。
 *
 * 這是規格書第十一節「資料完整性與品質檢查」的可測試實作，
 * 純邏輯、不依賴 UI，可直接在單元測試或 `npm run validate:bank` 中執行。
 *
 * 檢查項目：
 * 1. 所有題目 ID 唯一。
 * 2. 日文、讀音、羅馬字、中文意思、分類均有內容。
 * 3. 難度只使用 N5／N4／N3／N2／N1。
 * 4. 分類符合已定義的分類（含別名轉換後）。
 * 5. 句子完整版與挖空版內容一致。
 * 6. 每道句子題的目標答案確實存在於完整句子中。
 * 7. 讀音與羅馬字互相可判定（自我可答）。
 * 8. 替代答案都真的能通過比對，且不等同於主要答案。
 * 9. 挖空句不得洩漏答案。
 * 10. 不得出現換掉 ID 的重複題目。
 */

export type IssueKind =
  | "duplicate-id"
  | "duplicate-content"
  | "empty-field"
  | "invalid-difficulty"
  | "invalid-category"
  | "invalid-answer-type"
  | "answer-not-in-sentence"
  | "blank-mismatch"
  | "answer-leak"
  | "unmatchable-answer"
  | "redundant-accepted-answer"
  | "missing-source";

export interface BankIssue {
  kind: IssueKind;
  /** 題目 ID 或「單字／句子」層級標記。 */
  target: string;
  message: string;
}

const VALID_DIFFICULTIES = new Set(["N5", "N4", "N3", "N2", "N1"]);
const VALID_ANSWER_TYPES = new Set(["word", "phrase", "idiom", "slang"]);
const KNOWN_CATEGORIES: ReadonlySet<string> = new Set(CATEGORY_ORDER);

export interface ValidationCounts {
  words: number;
  sentences: number;
  /** 種子（本次新增）的單字數。 */
  seededWords: number;
  seededSentences: number;
}

function push(issues: BankIssue[], kind: IssueKind, target: string, message: string): void {
  issues.push({ kind, target, message });
}

/**
 * @param seededWords 種子題庫帶入的日文（用來統計，不影響驗證結果）。
 */
export function validateWordBank(words: readonly WordQuestion[], seededWords: readonly string[] = []): BankIssue[] {
  const issues: BankIssue[] = [];
  const ids = new Set<string>();
  const contents = new Set<string>();
  const seeded = new Set(seededWords);

  for (const word of words) {
    const label = word.japanese || word.id || "(無名稱)";

    if (ids.has(word.id)) {
      push(issues, "duplicate-id", word.id, `題目 ID 重複：${label}`);
    }
    ids.add(word.id);

    // 同一個日文出現兩次就是「換掉 ID 的重複題目」
    if (contents.has(word.japanese)) {
      push(issues, "duplicate-content", label, "詞彙重複：只換 ID 會讓玩家重複看到同一題");
    }
    contents.add(word.japanese);

    for (const [field, value] of [
      ["japanese", word.japanese],
      ["kana", word.kana],
      ["romaji", word.romaji],
      ["meaning", word.meaning],
      ["category", word.category],
      ["partOfSpeech", word.partOfSpeech ?? ""],
      ["source", word.source ?? ""],
    ] as const) {
      if (typeof value !== "string" || value.trim().length === 0) {
        push(issues, "empty-field", label, `缺少必要欄位 ${field}`);
      }
    }

    if (!VALID_DIFFICULTIES.has(word.difficulty)) {
      push(issues, "invalid-difficulty", label, `難度不合法：${word.difficulty}`);
    }
    if (!KNOWN_CATEGORIES.has(canonicalCategory(word.category))) {
      push(issues, "invalid-category", label, `分類不在已定義清單：${word.category}`);
    }

    // 讀音、羅馬字、日文寫法都必須能自我判定
    for (const [field, input] of [
      ["romaji", word.romaji],
      ["japanese", word.japanese],
      ["kana", word.kana],
    ] as const) {
      if (!isAnswerCorrect(input, word)) {
        push(issues, "unmatchable-answer", label, `${field}「${input}」無法通過比對`);
      }
    }

    for (const accepted of word.acceptedAnswers ?? []) {
      if (accepted.trim().length === 0) {
        push(issues, "empty-field", label, "acceptedAnswers 有空白字串");
        continue;
      }
      if (!isAnswerCorrect(accepted, word)) {
        push(issues, "unmatchable-answer", label, `替代答案「${accepted}」無法通過比對`);
      }
      if (accepted.trim().toLowerCase() === word.romaji.trim().toLowerCase()) {
        push(issues, "redundant-accepted-answer", label, `替代答案「${accepted}」與 romaji 相同`);
      }
    }

    // 種子題庫一律不得宣稱已查核
    if (seeded.has(word.japanese)) {
      if (word.accentVerified === true) {
        push(issues, "missing-source", label, "種子題庫不得標記 accentVerified");
      }
      if (word.audio) {
        push(issues, "missing-source", label, "種子題庫沒有已確認授權的音檔，audio 必須為 null");
      }
    }
  }

  return issues;
}

export function validateSentenceBank(sentences: readonly SentenceQuestion[]): BankIssue[] {
  const issues: BankIssue[] = [];
  const ids = new Set<string>();
  const contents = new Set<string>();

  for (const sentence of sentences) {
    const label = sentence.id;

    if (ids.has(sentence.id)) {
      push(issues, "duplicate-id", label, "句子題目 ID 重複");
    }
    ids.add(sentence.id);
    if (contents.has(sentence.sentence)) {
      push(issues, "duplicate-content", label, "完整句子重複");
    }
    contents.add(sentence.sentence);

    for (const [field, value] of [
      ["sentence", sentence.sentence],
      ["displaySentence", sentence.displaySentence],
      ["answer", sentence.answer],
      ["kana", sentence.kana ?? ""],
      ["romaji", sentence.romaji ?? ""],
      ["meaning", sentence.meaning ?? ""],
      ["category", sentence.category],
      ["source", sentence.source ?? ""],
    ] as const) {
      if (typeof value !== "string" || value.trim().length === 0) {
        push(issues, "empty-field", label, `缺少必要欄位 ${field}`);
      }
    }

    if (!VALID_DIFFICULTIES.has(sentence.difficulty)) {
      push(issues, "invalid-difficulty", label, `難度不合法：${sentence.difficulty}`);
    }
    if (!VALID_ANSWER_TYPES.has(sentence.answerType)) {
      push(issues, "invalid-answer-type", label, `answerType 不合法：${sentence.answerType}`);
    }
    if (!KNOWN_CATEGORIES.has(canonicalCategory(sentence.category))) {
      push(issues, "invalid-category", label, `分類不在已定義清單：${sentence.category}`);
    }

    // 挖空句必須真的挖了空
    const blanks = sentence.displaySentence.match(/＿/g)?.length ?? 0;
    if (blanks === 0) {
      push(issues, "blank-mismatch", label, "挖空句沒有底線 ＿，無法作答");
    }

    // 答案必須真的出現在完整句裡（供語音與揭示使用）
    if (blanks > 0 && sentence.sentence && !sentence.sentence.includes(sentence.answer)) {
      push(issues, "answer-not-in-sentence", label, `答案「${sentence.answer}」不存在於完整句子`);
    }

    // 挖空句不得洩漏答案
    if (sentence.displaySentence.includes(sentence.answer)) {
      push(issues, "answer-leak", label, `挖空句洩漏了答案「${sentence.answer}」`);
    }
    // 挖空句的其他片段也不能含答案的假名或羅馬字
    if (sentence.kana && sentence.displaySentence.includes(sentence.kana)) {
      push(issues, "answer-leak", label, `挖空句洩漏了答案讀音「${sentence.kana}」`);
    }
    if (sentence.romaji && sentence.displaySentence.toLowerCase().includes(sentence.romaji.toLowerCase())) {
      push(issues, "answer-leak", label, `挖空句洩漏了答案羅馬字「${sentence.romaji}」`);
    }
    // 完整句也不能直接等於挖空句
    if (sentence.sentence === sentence.displaySentence) {
      push(issues, "answer-leak", label, "完整句與挖空句相同，答案會直接顯示");
    }

    const matchable = {
      japanese: sentence.answer,
      kana: sentence.kana,
      romaji: sentence.romaji,
      acceptedAnswers: sentence.acceptedAnswers,
    };
    if (!isAnswerCorrect(sentence.answer, matchable)) {
      push(issues, "unmatchable-answer", label, "答案無法通過比對");
    }
    if (sentence.kana && !isAnswerCorrect(sentence.kana, matchable)) {
      push(issues, "unmatchable-answer", label, `讀音「${sentence.kana}」無法通過比對`);
    }
    if (sentence.romaji && !isAnswerCorrect(sentence.romaji, matchable)) {
      push(issues, "unmatchable-answer", label, `羅馬字「${sentence.romaji}」無法通過比對`);
    }

    for (const accepted of sentence.acceptedAnswers ?? []) {
      if (accepted.trim().length === 0) {
        push(issues, "empty-field", label, "acceptedAnswers 有空白字串");
        continue;
      }
      if (!isAnswerCorrect(accepted, matchable)) {
        push(issues, "unmatchable-answer", label, `替代答案「${accepted}」無法通過比對`);
      }
      if (accepted.trim() === sentence.answer.trim()) {
        push(issues, "redundant-accepted-answer", label, `替代答案「${accepted}」與答案相同`);
      }
    }
  }

  return issues;
}

export interface BankValidationResult extends ValidationCounts {
  issues: BankIssue[];
  ok: boolean;
}

export function validateQuestionBank(input: {
  words: readonly WordQuestion[];
  sentences: readonly SentenceQuestion[];
  seededWords?: readonly string[];
  seededSentenceIds?: readonly string[];
}): BankValidationResult {
  const issues = [
    ...validateWordBank(input.words, input.seededWords ?? []),
    ...validateSentenceBank(input.sentences),
  ];

  // 交叉檢查：單字與句子的 ID 不可撞號（錯題本以 ID 當鍵）
  const wordIds = new Set(input.words.map((word) => word.id));
  for (const sentence of input.sentences) {
    if (wordIds.has(sentence.id)) {
      push(issues, "duplicate-id", sentence.id, "句子 ID 與單字 ID 相撞，錯題本會互相覆蓋");
    }
  }

  const seededWords = input.seededWords ?? [];
  const seededSentenceIds = input.seededSentenceIds ?? [];
  const sentenceIds = new Set(input.sentences.map((s) => s.id));

  return {
    ok: issues.length === 0,
    issues,
    words: input.words.length,
    sentences: input.sentences.length,
    seededWords: seededWords.length,
    seededSentences: seededSentenceIds.filter((id) => sentenceIds.has(id)).length,
  };
}

export function formatIssues(issues: readonly BankIssue[]): string {
  return issues.map((issue) => `[${issue.kind}] ${issue.target}: ${issue.message}`).join("\n");
}