import type { GameDuration, GameSettings, InputMethod, LocaleCode } from "../types/game";
import type { Difficulty, ImageMode } from "../types/question";
import type { SpeechSpeedMultiplier } from "./speechRate";

export const DEFAULT_SETTINGS: GameSettings = {
  duration: 180,
  inputMethod: "romaji",
  language: "zh-TW" as LocaleCode,
  difficulties: ["N5", "N4", "N3", "N2", "N1"],
  categories: [],
  revealCorrectMs: 1000,
  revealSkipMs: 900,
  reviewRevealMs: 10_000,
  showImageHintDuringPlay: false,
  imageMode: "local",
  useAudioFiles: false,
  shortWordSlowSpeech: true,
  speechBaseRate: 0.95,
  shortWordMaxMora: 3,
  shortWordRateMultiplier: 0.75,
  sfxEnabled: true,
  sfxVolume: 0.6,
  speechSpeed: 1 as SpeechSpeedMultiplier,
};

export const DURATION_VALUES: GameDuration[] = [60, 120, 180];

export const REVIEW_REVEAL_SECONDS = 10;

export const DIFFICULTY_ORDER: Difficulty[] = ["N5", "N4", "N3", "N2", "N1"];

/**
 * 輸入方式與其他選項的顯示文字改由 i18n 集中管理，
 * 這裡只保留純值型別的對應，供程式內部（非 React 元件）使用。
 */
export const IMAGE_MODE_VALUES: ImageMode[] = ["local", "remote", "disabled"];

export const INPUT_METHOD_VALUES: InputMethod[] = ["romaji", "kana"];