import type { SentenceQuestion, WordQuestion } from "../types/question";
import {
  DEFAULT_SPEECH_RATE_CONFIG,
  resolveSpeechRate,
  tryApplyRate,
  type SpeechRateConfig,
} from "../utils/speechRate";

export type SpeechQuality = "audio-file" | "tts" | "unavailable";

export interface SpeechAvailability {
  ttsSupported: boolean;
  jaVoiceAvailable: boolean;
}

type SpeakableQuestion = WordQuestion | SentenceQuestion;

function isSentence(question: SpeakableQuestion): question is SentenceQuestion {
  return "sentence" in question;
}

/** 取得要朗讀的文字：句子題讀完整句，單字題讀日文詞彙。 */
export function speechTextFor(question: SpeakableQuestion): string {
  return isSentence(question) ? question.sentence : question.japanese;
}

/** 取得錯題本／複習模式要朗讀的文字。 */
export function reviewSpeechText(question: SpeakableQuestion): string {
  return speechTextFor(question);
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return typeof window.speechSynthesis !== "undefined" ? window.speechSynthesis : null;
}

export function getSpeechAvailability(): SpeechAvailability {
  const synth = getSynth();
  if (!synth) return { ttsSupported: false, jaVoiceAvailable: false };
  const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
  const jaVoice = voices.some((voice) => voice.lang?.toLowerCase().startsWith("ja"));
  return { ttsSupported: true, jaVoiceAvailable: jaVoice };
}

function pickJapaneseVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (typeof synth.getVoices !== "function") return null;
  const voices = synth.getVoices();
  return (
    voices.find((voice) => voice.lang === "ja-JP") ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("ja")) ??
    null
  );
}

/**
 * 停止目前正在播放的語音。
 * 每題開始播放前都必須呼叫，避免多個語音重疊或競態。
 */
export function stopSpeech(): void {
  const synth = getSynth();
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    /* ignore */
  }
}

let currentAudio: HTMLAudioElement | null = null;

function stopAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
}

/** 同時停止音檔與 TTS，確保不會重疊播放。 */
export function stopAllAudio(): void {
  stopAudio();
  stopSpeech();
}

function playAudioFile(url: string): Promise<SpeechQuality> {
  return new Promise((resolve) => {
    stopAllAudio();
    const audio = new Audio();
    audio.preload = "auto";
    currentAudio = audio;
    let settled = false;
    const finish = (quality: SpeechQuality) => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      resolve(quality);
    };
    audio.addEventListener("ended", () => finish("audio-file"), { once: true });
    audio.addEventListener("error", () => finish("tts"), { once: true });
    audio.src = url;
    audio.play().catch(() => finish("tts"));
    // 保險：8 秒後視為未成功，轉為 TTS fallback。
    window.setTimeout(() => finish(currentAudio === audio ? "tts" : "audio-file"), 8000);
  });
}

function playTts(text: string, rate: number): Promise<SpeechQuality> {
  return new Promise((resolve) => {
    const synth = getSynth();
    if (!synth || !text) {
      resolve("unavailable");
      return;
    }
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      const voice = pickJapaneseVoice(synth);
      if (voice) utterance.voice = voice;
      // 只有 AI 合成語音套用語速規則；真人／外部音檔不受提示音效影響。
      // 若語音引擎不支援 rate，tryApplyRate 會安全忽略，遊戲仍可正常運作。
      tryApplyRate(utterance, rate);
      utterance.pitch = 1;
      let settled = false;
      const finish = (quality: SpeechQuality) => {
        if (settled) return;
        settled = true;
        resolve(quality);
      };
      utterance.addEventListener("end", () => finish("tts"), { once: true });
      utterance.addEventListener("error", () => finish("unavailable"), { once: true });
      synth.speak(utterance);
      // 保險：語音引擎無回應時也不要卡住流程。
      window.setTimeout(() => finish("tts"), 10_000);
    } catch {
      resolve("unavailable");
    }
  });
}

export interface PlayOptions {
  useAudioFiles: boolean;
  /**
   * 題目語音設定（含 1.0× / 0.5× 總倍率與短單字規則）。
   * 不傳時使用 DEFAULT_SPEECH_RATE_CONFIG。
   */
  speechRateConfig?: SpeechRateConfig;
}

/**
 * 播放題目音聲。
 * 優先順序：已授權音檔 → Web Speech API（ja-JP）機器語音。
 * 播放失敗不會拋出例外，遊戲流程不中斷。
 */
export async function playQuestionAudio(
  question: SpeakableQuestion,
  options: PlayOptions,
): Promise<SpeechQuality> {
  const text = speechTextFor(question);
  const audioUrl = options.useAudioFiles ? question.audio : null;
  if (audioUrl) {
    // 真人／外部音檔：不套用 TTS 語速設定。
    const result = await playAudioFile(audioUrl);
    if (result === "audio-file") return result;
  }
  const config = options.speechRateConfig ?? DEFAULT_SPEECH_RATE_CONFIG;
  const { rate } = resolveSpeechRate(question, config);
  return playTts(text, rate);
}

/**
 * 只播放指定文字（例如錯題本的朗讀按鈕）。
 * 單字文字也會套用短單字慢速規則，句子則維持基準語速。
 */
export async function playText(
  text: string,
  options: { speechRateConfig?: SpeechRateConfig } = {},
): Promise<SpeechQuality> {
  stopAllAudio();
  const config = options.speechRateConfig ?? DEFAULT_SPEECH_RATE_CONFIG;
  const rate = resolveSpeechRate({ japanese: text, kana: text } as WordQuestion, config).rate;
  return playTts(text, rate);
}