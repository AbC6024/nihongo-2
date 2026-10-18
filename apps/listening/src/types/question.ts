export type Difficulty = "N5" | "N4" | "N3" | "N2" | "N1";

export type ScriptType = "hiragana" | "katakana" | "mixed";

export type AnswerType = "word" | "phrase" | "slang" | "idiom";

export type AccentType = "atamadaka" | "nakadaka" | "odaka" | "heiban" | "unknown";

export type ImageMode = "local" | "remote" | "disabled";

export interface WordQuestion {
  id: string;
  japanese: string;
  kana: string;
  romaji: string;
  meaning: string;
  difficulty: Difficulty;
  script: ScriptType;
  category: string;
  partOfSpeech?: string;
  acceptedAnswers?: string[];
  example?: string;
  audio?: string | null;
  image?: string | null;
  imageKeyword?: string;
  imageSource?: string;
  imageLicenseNote?: string;
  accentType?: AccentType;
  accentPattern?: string | number[] | null;
  accentSource?: string | null;
  accentVerified?: boolean;
  audioSource?: string | null;
  audioVerified?: boolean;
  /**
   * 單題 TTS 語速覆寫（0.1～10）。
   * 設定後會優先於「短單字慢速」規則；不影響真人／外部音檔。
   */
  speechRate?: number;
  source?: string;
}

export interface SentenceQuestion {
  id: string;
  sentence: string;
  displaySentence: string;
  answer: string;
  kana?: string;
  romaji?: string;
  acceptedAnswers?: string[];
  meaning?: string;
  difficulty: Difficulty;
  category: string;
  answerType: AnswerType;
  audio?: string | null;
  image?: string | null;
  accentVerified?: boolean;
  source?: string;
}

export type Question = WordQuestion | SentenceQuestion;

export function isSentenceQuestion(question: Question): question is SentenceQuestion {
  return "displaySentence" in question;
}