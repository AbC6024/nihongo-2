import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPEECH_RATE_CONFIG,
  DEFAULT_SPEECH_SPEED,
  SPEED_FAST_LABEL,
  SPEED_SLOW_LABEL,
  SPEECH_SPEED_MULTIPLIERS,
  clampRate,
  describeRate,
  isSpeechSpeed,
  resolveSpeechRate,
  speechRateConfigFrom,
  speechSpeedLabel,
  tryApplyRate,
  type SpeechRateConfig,
} from "./speechRate";
import type { WordQuestion } from "../types/question";

function word(japanese: string, kana: string, extra: Partial<WordQuestion> = {}): WordQuestion {
  return {
    id: japanese,
    japanese,
    kana,
    romaji: "x",
    meaning: "x",
    difficulty: "N5",
    script: "hiragana",
    category: "動物",
    ...extra,
  };
}

const SENTENCE = {
  id: "s1",
  sentence: "昨日、友達とラーメンを食べました。",
  displaySentence: "昨日、友達と＿＿＿を食べました。",
  answer: "ラーメン",
  difficulty: "N5" as const,
  category: "食物",
  answerType: "word" as const,
};

const config = (overrides: Partial<SpeechRateConfig> = {}): SpeechRateConfig => ({
  ...DEFAULT_SPEECH_RATE_CONFIG,
  ...overrides,
});

describe("預設設定", () => {
  it("預設是正常速度 1.0×", () => {
    expect(DEFAULT_SPEECH_SPEED).toBe(1);
    expect(DEFAULT_SPEECH_RATE_CONFIG.speedMultiplier).toBe(1);
    expect(DEFAULT_SPEECH_RATE_CONFIG.shortWordMaxMora).toBe(3);
    expect(DEFAULT_SPEECH_RATE_CONFIG.shortWordRateMultiplier).toBe(0.75);
  });

  it("只有 1 與 0.5 兩個選項", () => {
    expect(SPEECH_SPEED_MULTIPLIERS).toEqual([1, 0.5]);
  });

  it("倍率文字統一為 1.0× 與 0.5×", () => {
    expect(speechSpeedLabel(1)).toBe(SPEED_FAST_LABEL);
    expect(speechSpeedLabel(1)).toBe("1.0×");
    expect(speechSpeedLabel(0.5)).toBe(SPEED_SLOW_LABEL);
    expect(speechSpeedLabel(0.5)).toBe("0.5×");
  });

  it("isSpeechSpeed 只接受 1 與 0.5", () => {
    expect(isSpeechSpeed(1)).toBe(true);
    expect(isSpeechSpeed(0.5)).toBe(true);
    expect(isSpeechSpeed(0.75)).toBe(false);
    expect(isSpeechSpeed("fast")).toBe(false);
    expect(isSpeechSpeed(undefined)).toBe(false);
  });
});

describe("正常速度 1.0×：保留短單字 0.75 倍規則", () => {
  it("短單字（1～3 拍）使用基準語速 × 0.75", () => {
    expect(resolveSpeechRate(word("猫", "ねこ")).rule).toBe("short-word");
    expect(resolveSpeechRate(word("猫", "ねこ")).rate).toBeCloseTo(0.95 * 0.75, 5);
    expect(resolveSpeechRate(word("鳥", "とり")).rate).toBeCloseTo(0.95 * 0.75, 5);
    expect(resolveSpeechRate(word("いぬ", "いぬ")).rate).toBeCloseTo(0.95 * 0.75, 5);
    expect(resolveSpeechRate(word("ようき", "ようき")).rate).toBeCloseTo(0.95 * 0.75, 5);
  });

  it("長單字維持基準語速", () => {
    const resolved = resolveSpeechRate(word("学校", "がっこうきゅう"));
    expect(resolved.rule).toBe("base");
    expect(resolved.rate).toBeCloseTo(0.95, 5);
  });

  it("完整句子維持基準語速", () => {
    const resolved = resolveSpeechRate(SENTENCE);
    expect(resolved.rule).toBe("base");
    expect(resolved.rate).toBeCloseTo(0.95, 5);
  });

  it("關閉短單字規則時全部使用基準語速", () => {
    expect(resolveSpeechRate(word("猫", "ねこ"), config({ shortWordSlowSpeech: false })).rate).toBeCloseTo(
      0.95,
      5,
    );
  });
});

describe("慢速 0.5×：0.5 是最終速度", () => {
  it("短單字、長單字與句子全部都是 0.5", () => {
    const slow = config({ speedMultiplier: 0.5 });
    expect(resolveSpeechRate(word("猫", "ねこ"), slow).rate).toBeCloseTo(0.5, 5);
    expect(resolveSpeechRate(word("学校", "がっこうきゅう"), slow).rate).toBeCloseTo(0.5, 5);
    expect(resolveSpeechRate(SENTENCE, slow).rate).toBeCloseTo(0.5, 5);
  });

  it("不會再疊加短單字的 0.75 倍（不會變成 0.375）", () => {
    const slow = config({ speedMultiplier: 0.5 });
    const rate = resolveSpeechRate(word("猫", "ねこ"), slow).rate;
    expect(rate).not.toBeCloseTo(0.375, 5);
    expect(rate).toBeCloseTo(0.5, 5);
    expect(resolveSpeechRate(word("猫", "ねこ"), slow).rule).toBe("slow-mode");
  });

  it("切回 1.0× 後恢復原本的短單字規則", () => {
    const fast = config({ speedMultiplier: 1 });
    expect(resolveSpeechRate(word("猫", "ねこ"), fast).rate).toBeCloseTo(0.95 * 0.75, 5);
  });

  it("無效的速度值安全回到正常速度", () => {
    const bad = config({ speedMultiplier: 0.25 as never });
    expect(resolveSpeechRate(word("猫", "ねこ"), bad).rate).toBeCloseTo(0.95 * 0.75, 5);
  });

  it("同一題在同一設定下每次解析結果一致", () => {
    const question = word("鳥", "とり");
    const first = resolveSpeechRate(question, config({ speedMultiplier: 0.5 }));
    const second = resolveSpeechRate(question, config({ speedMultiplier: 0.5 }));
    expect(first).toEqual(second);
  });
});

describe("單題覆寫與範圍夾限", () => {
  it("speechRate 覆寫優先，且會乘上總倍率", () => {
    expect(resolveSpeechRate(word("猫", "ねこ", { speechRate: 0.5 })).rate).toBeCloseTo(0.5, 5);
    expect(
      resolveSpeechRate(word("猫", "ねこ", { speechRate: 1 }), config({ speedMultiplier: 0.5 })).rate,
    ).toBeCloseTo(0.5, 5);
  });

  it("clampRate 夾限在語音服務有效範圍", () => {
    expect(clampRate(0)).toBe(0.1);
    expect(clampRate(999)).toBe(10);
    expect(clampRate(Number.NaN)).toBe(1);
  });

  it("describeRate 產生可讀的倍率文字", () => {
    expect(describeRate(0.7125)).toBe("0.71×");
    expect(describeRate(0.5)).toBe("0.5×");
  });

  it("無法判斷音拍時維持基準語速", () => {
    const resolved = resolveSpeechRate(word("學校", ""));
    expect(resolved.rule).toBe("unknown");
    expect(resolved.rate).toBeCloseTo(0.95, 5);
  });
});

describe("speechRateConfigFrom", () => {
  it("從遊戲設定組出設定", () => {
    const result = speechRateConfigFrom({
      speechSpeed: 0.5,
      speechBaseRate: 1.2,
      shortWordSlowSpeech: true,
      shortWordMaxMora: 2,
      shortWordRateMultiplier: 0.6,
    });
    expect(result).toEqual({
      speedMultiplier: 0.5,
      baseRate: 1.2,
      shortWordSlowSpeech: true,
      shortWordMaxMora: 2,
      shortWordRateMultiplier: 0.6,
    });
  });

  it("缺少欄位時使用預設（1.0×）", () => {
    const result = speechRateConfigFrom({});
    expect(result.speedMultiplier).toBe(1);
    expect(result.baseRate).toBe(0.95);
  });

  it("無效的速度值回到 1.0×", () => {
    expect(speechRateConfigFrom({ speechSpeed: 2 }).speedMultiplier).toBe(1);
    expect(speechRateConfigFrom({ speechSpeed: "slow" }).speedMultiplier).toBe(1);
  });

  it("夾限異常值", () => {
    const result = speechRateConfigFrom({
      speechBaseRate: 99,
      shortWordMaxMora: -5,
      shortWordRateMultiplier: 99,
    });
    expect(result.baseRate).toBeLessThanOrEqual(2);
    expect(result.shortWordMaxMora).toBe(0);
    expect(result.shortWordRateMultiplier).toBeLessThanOrEqual(2);
  });
});

describe("tryApplyRate（不支援 rate 時的備援）", () => {
  it("可以設定 rate 時回傳 true", () => {
    const target: { rate?: number } = {};
    expect(tryApplyRate(target, 0.5)).toBe(true);
    expect(target.rate).toBe(0.5);
  });

  it("設定失敗時回傳 false 而不拋出例外", () => {
    const target = {
      set rate(_value: number) {
        throw new Error("not supported");
      },
    };
    expect(tryApplyRate(target, 0.5)).toBe(false);
  });
});
