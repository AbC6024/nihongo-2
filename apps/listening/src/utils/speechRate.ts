import type { AccentType, SentenceQuestion, WordQuestion } from "../types/question";
import { countQuestionMora } from "./mora";

/**
 * 遊戲內語音速度（1.0× / 0.5×）。
 *
 * 這是**玩家在遊戲中切換的總倍率**，會乘在既有的語速規則結果上。
 *
 * 規則：
 * - `1`（正常速度）：完全沿用原本的語速邏輯，
 *   包含「短單字 0.75 倍」的調整。
 * - `0.5`（慢速）：0.5× 是**最終播放速度**。
 *   為了避免短單字變成 0.375×，慢速時**不再套用**短單字規則，
 *   直接以 0.5 輸出；長單字與句子也一樣是 0.5。
 * - 只影響題目語音（TTS）。答對／答錯／跳過／結算的提示音效不受影響。
 */

/** 可選的語音速度倍率。 */
export const SPEECH_SPEED_MULTIPLIERS = [1, 0.5] as const;
export type SpeechSpeedMultiplier = (typeof SPEECH_SPEED_MULTIPLIERS)[number];

export const DEFAULT_SPEECH_SPEED: SpeechSpeedMultiplier = 1;

export function isSpeechSpeed(value: unknown): value is SpeechSpeedMultiplier {
  return value === 1 || value === 0.5;
}

export const SPEED_FAST_LABEL = "1.0×";
export const SPEED_SLOW_LABEL = "0.5×";

/** 顯示用文字，三種語言格式相同（數字倍率統一）。 */
export function speechSpeedLabel(multiplier: SpeechSpeedMultiplier): string {
  return multiplier === 1 ? SPEED_FAST_LABEL : SPEED_SLOW_LABEL;
}

export interface ShortWordRules {
  enabled: boolean;
  shortWordMaxMora: number;
  shortWordMultiplier: number;
}

/** SpeechSynthesisUtterance.rate 的規格有效範圍。 */
export const TTS_RATE_MIN = 0.1;
export const TTS_RATE_MAX = 10;

/** 多數語音引擎實際表現良好的範圍，超出時會夾限。 */
export const TTS_PREFERRED_MIN = 0.5;
export const TTS_PREFERRED_MAX = 2;

export function clampRate(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPEECH_SPEED;
  if (value < TTS_RATE_MIN) return TTS_RATE_MIN;
  if (value > TTS_RATE_MAX) return TTS_RATE_MAX;
  return value;
}

function clampPreferred(value: number): number {
  const clamped = clampRate(value);
  if (clamped < TTS_PREFERRED_MIN) return TTS_PREFERRED_MIN;
  if (clamped > TTS_PREFERRED_MAX) return TTS_PREFERRED_MAX;
  return clamped;
}

export interface SpeechRateConfig {
  /** 題目語音的總倍率（1 或 0.5）。 */
  speedMultiplier: SpeechSpeedMultiplier;
  /** AI 語音基準語速。 */
  baseRate: number;
  /** 是否啟用短單字放慢規則。 */
  shortWordSlowSpeech: boolean;
  shortWordMaxMora: number;
  shortWordRateMultiplier: number;
}

export const DEFAULT_SPEECH_RATE_CONFIG: SpeechRateConfig = {
  speedMultiplier: DEFAULT_SPEECH_SPEED,
  baseRate: 0.95,
  shortWordSlowSpeech: true,
  shortWordMaxMora: 3,
  shortWordRateMultiplier: 0.75,
};

type Speakable = WordQuestion | SentenceQuestion;

function isSentence(question: Speakable): question is SentenceQuestion {
  return "sentence" in question;
}

export interface ResolvedSpeechRate {
  rate: number;
  moraCount: number;
  /** 套用了哪一條規則，僅供除錯與測試。 */
  rule: "override" | "slow-mode" | "short-word" | "base" | "unknown";
}

/**
 * 解析某題實際應使用的 TTS 語速。
 *
 * 優先順序：
 * 1. 題目資料的 `speechRate` 單題覆寫。
 * 2. 慢速模式（0.5×）→ 直接輸出 0.5，不再疊加短單字規則。
 * 3. 完整句子 → 基準語速。
 * 4. 單字 → 依音拍數判斷是否套用短單字倍率（僅 1.0× 模式）。
 * 5. 正常模式的最後一步：乘上總倍率（1.0× 時等同不變）。
 */
export function resolveSpeechRate(
  question: Speakable,
  config: SpeechRateConfig = DEFAULT_SPEECH_RATE_CONFIG,
): ResolvedSpeechRate {
  const speedMultiplier: SpeechSpeedMultiplier = isSpeechSpeed(config.speedMultiplier)
    ? config.speedMultiplier
    : DEFAULT_SPEECH_SPEED;
  const base = clampPreferred(config.baseRate);

  const override = (question as WordQuestion).speechRate;
  if (typeof override === "number" && Number.isFinite(override)) {
    return {
      rate: clampPreferred(override * speedMultiplier),
      moraCount: 0,
      rule: "override",
    };
  }

  // 慢速模式：0.5× 是最終速度，不再套用任何額外倍率。
  if (speedMultiplier !== DEFAULT_SPEECH_SPEED) {
    return { rate: clampPreferred(speedMultiplier), moraCount: 0, rule: "slow-mode" };
  }

  const moraCount = isSentence(question) ? 0 : countQuestionMora(question);
  if (!isSentence(question) && config.shortWordSlowSpeech && moraCount > 0) {
    if (moraCount <= config.shortWordMaxMora) {
      return {
        rate: clampPreferred(base * config.shortWordRateMultiplier * speedMultiplier),
        moraCount,
        rule: "short-word",
      };
    }
  }

  return {
    rate: clampPreferred(base * speedMultiplier),
    moraCount,
    rule: isSentence(question) ? "base" : moraCount > 0 ? "base" : "unknown",
  };
}

/** 由遊戲設定組出題目語音設定。 */
export function speechRateConfigFrom(settings: {
  speechSpeed?: unknown;
  speechBaseRate?: number;
  shortWordSlowSpeech?: boolean;
  shortWordMaxMora?: number;
  shortWordRateMultiplier?: number;
}): SpeechRateConfig {
  return {
    speedMultiplier: isSpeechSpeed(settings.speechSpeed)
      ? settings.speechSpeed
      : DEFAULT_SPEECH_SPEED,
    baseRate:
      typeof settings.speechBaseRate === "number" && Number.isFinite(settings.speechBaseRate)
        ? clampPreferred(settings.speechBaseRate)
        : DEFAULT_SPEECH_RATE_CONFIG.baseRate,
    shortWordSlowSpeech:
      typeof settings.shortWordSlowSpeech === "boolean"
        ? settings.shortWordSlowSpeech
        : DEFAULT_SPEECH_RATE_CONFIG.shortWordSlowSpeech,
    shortWordMaxMora:
      typeof settings.shortWordMaxMora === "number" && Number.isFinite(settings.shortWordMaxMora)
        ? Math.max(0, Math.min(20, Math.round(settings.shortWordMaxMora)))
        : DEFAULT_SPEECH_RATE_CONFIG.shortWordMaxMora,
    shortWordRateMultiplier:
      typeof settings.shortWordRateMultiplier === "number" &&
      Number.isFinite(settings.shortWordRateMultiplier)
        ? Math.max(0.1, Math.min(2, settings.shortWordRateMultiplier))
        : DEFAULT_SPEECH_RATE_CONFIG.shortWordRateMultiplier,
  };
}

/**
 * 語音系統不支援調整 rate 時的備援：
 * 回傳同樣的 rate 設定值，並標記為不支援，交由呼叫端安全忽略。
 */
export function tryApplyRate(target: { rate?: number }, rate: number): boolean {
  try {
    target.rate = rate;
    return true;
  } catch {
    return false;
  }
}

/** 供 UI 顯示：某個題目在目前設定下實際會用多少倍速。 */
export function describeRate(rate: number): string {
  return `${Math.round(rate * 100) / 100}×`;
}

/** 題目 audio 欄位存在時，是否可以使用 playbackRate（外部音檔）。 */
export function supportsPlaybackRate(question: Speakable): boolean {
  return Boolean(question.audio);
}

/** 供除錯：目前的音拍規則常數。 */
export const ACCENT_TYPES: readonly AccentType[] = [
  "atamadaka",
  "nakadaka",
  "odaka",
  "heiban",
  "unknown",
];