import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playQuestionAudio, playText, speechTextFor, stopAllAudio } from "./speech";
import { DEFAULT_SPEECH_RATE_CONFIG, resolveSpeechRate } from "../utils/speechRate";
import type { WordQuestion } from "../types/question";

const spoken: { text: string; rate: number }[] = [];
let speakSpy: ReturnType<typeof vi.fn>;

class FakeUtterance {
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  constructor(public text: string) {}
  addEventListener(_: string, handler: () => void) {
    if (_ === "end") handler();
  }
}

beforeEach(() => {
  spoken.length = 0;
  speakSpy = vi.fn((utterance: FakeUtterance) => {
    spoken.push({ text: utterance.text, rate: utterance.rate });
  });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      cancel: vi.fn(),
      speak: speakSpy,
      getVoices: () => [{ lang: "ja-JP", name: "test" }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeUtterance,
  });
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: class FakeAudio {
      preload = "";
      src = "";
      currentTime = 0;
      listeners: Record<string, () => void> = {};
      play = vi.fn(async () => {
        this.listeners.ended?.();
        return undefined;
      });
      pause = vi.fn();
      addEventListener(type: string, handler: () => void) {
        this.listeners[type] = handler;
      }
    },
  });
  Object.defineProperty(window, "Audio", {
    configurable: true,
    value: globalThis.Audio,
  });
});

afterEach(() => {
  stopAllAudio();
});

function word(kana: string, extra: Partial<WordQuestion> = {}): WordQuestion {
  return {
    id: kana,
    japanese: kana,
    kana,
    romaji: "x",
    meaning: "x",
    difficulty: "N5",
    script: "hiragana",
    category: "動物",
    ...extra,
  };
}

describe("playQuestionAudio 語速", () => {
  it("短單字使用 75% 基準語速", async () => {
    await playQuestionAudio(word("ねこ"), { useAudioFiles: false });
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("ねこ");
    expect(spoken[0].rate).toBeCloseTo(DEFAULT_SPEECH_RATE_CONFIG.baseRate * 0.75, 5);
  });

  it("長單字使用基準語速", async () => {
    await playQuestionAudio(word("がっこう"), { useAudioFiles: false });
    expect(spoken[0].rate).toBeCloseTo(DEFAULT_SPEECH_RATE_CONFIG.baseRate, 5);
  });

  it("完整句子使用基準語速，不會整體變慢", async () => {
    await playQuestionAudio(
      {
        id: "s1",
        sentence: "昨日、友達とラーメンを食べました。",
        displaySentence: "昨日、友達と＿＿＿を食べました。",
        answer: "ラーメン",
        difficulty: "N5",
        category: "食物",
        answerType: "word",
      },
      { useAudioFiles: false },
    );
    expect(spoken[0].rate).toBeCloseTo(DEFAULT_SPEECH_RATE_CONFIG.baseRate, 5);
  });

  it("重播同一題時語速一致", async () => {
    const question = word("とり");
    await playQuestionAudio(question, { useAudioFiles: false });
    await playQuestionAudio(question, { useAudioFiles: false });
    expect(spoken).toHaveLength(2);
    expect(spoken[0].rate).toBe(spoken[1].rate);
  });

  it("自訂規則會改變實際語速", async () => {
    await playQuestionAudio(word("ねこ"), {
      useAudioFiles: false,
      speechRateConfig: {
        ...DEFAULT_SPEECH_RATE_CONFIG,
        baseRate: 1,
        shortWordMaxMora: 5,
        shortWordRateMultiplier: 0.5,
      },
    });
    expect(spoken[0].rate).toBeCloseTo(0.5, 5);
  });

  it("停用規則時全部使用基準語速", async () => {
    await playQuestionAudio(word("ねこ"), {
      useAudioFiles: false,
      speechRateConfig: { ...DEFAULT_SPEECH_RATE_CONFIG, shortWordSlowSpeech: false },
    });
    expect(spoken[0].rate).toBeCloseTo(DEFAULT_SPEECH_RATE_CONFIG.baseRate, 5);
  });

  it("語速一定在語音服務的有效範圍內", async () => {
    await playQuestionAudio(word("ねこ"), {
      useAudioFiles: false,
      speechRateConfig: { ...DEFAULT_SPEECH_RATE_CONFIG, baseRate: 10 },
    });
    expect(spoken[0].rate).toBeGreaterThan(0);
    expect(spoken[0].rate).toBeLessThanOrEqual(10);
  });

  it("音檔存在時不套用 TTS 語速（不會產生 TTS 播放）", async () => {
    const quality = await playQuestionAudio(
      word("ねこ", { audio: "https://example.invalid/a.mp3" }),
      { useAudioFiles: true },
    );
    expect(quality).toBe("audio-file");
    // 音檔流程不會呼叫 speechSynthesis.speak
    expect(speakSpy).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(0);
  });

  it("playText 對短文字套用慢速", async () => {
    await playText("ねこ");
    expect(spoken[0].rate).toBeCloseTo(DEFAULT_SPEECH_RATE_CONFIG.baseRate * 0.75, 5);
  });
});

describe("語音服務穩定性", () => {
  it("瀏覽器不支援 TTS 時回傳 unavailable 而不拋出例外", async () => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
    const result = await playQuestionAudio(word("ねこ"), { useAudioFiles: false });
    expect(result).toBe("unavailable");
  });

  it("引擎不允許設定 rate 時仍可播放", async () => {
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        lang = "";
        voice: SpeechSynthesisVoice | null = null;
        pitch = 1;
        constructor(public text: string) {
          Object.defineProperty(this, "rate", {
            get() {
              throw new Error("rate not supported");
            },
            set() {
              throw new Error("rate not supported");
            },
          });
        }
        addEventListener(_: string, handler: () => void) {
          if (_ === "end") handler();
        }
      },
    });
    const result = await playQuestionAudio(word("ねこ"), { useAudioFiles: false });
    expect(result).toBe("tts");
  });

  it("朗讀文字：句子讀完整句、單字讀日文詞彙", () => {
    expect(speechTextFor(word("ねこ"))).toBe("ねこ");
    expect(
      speechTextFor({
        id: "s1",
        sentence: "全文",
        displaySentence: "＿＿＿",
        answer: "a",
        difficulty: "N5",
        category: "c",
        answerType: "word",
      }),
    ).toBe("全文");
  });
});

describe("與規則函式一致", () => {
  it("實際播放的語速與 resolveSpeechRate 相同", async () => {
    const question = word("ねこ");
    await playQuestionAudio(question, { useAudioFiles: false });
    expect(spoken[0].rate).toBeCloseTo(resolveSpeechRate(question).rate, 6);
  });
});