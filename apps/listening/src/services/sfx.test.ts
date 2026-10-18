import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  playSfx,
  resetSfxState,
  resetWarmup,
  SFX_MIN_INTERVAL_MS,
  SFX_NAMES,
  SFX_SPEECH_GAP_MS,
  warmUpSfx,
  type SfxName,
} from "./sfx";

interface ToneRecord {
  type: string;
  /** start() 當下的起始頻率 */
  startFreq: number;
  startTime: number;
  stopTime: number;
}

interface GainRecord {
  /** exponentialRampToValueAtTime 的峰值參數 */
  peak: number;
  /** 第一個 setValueAtTime 的值（master 會是音量，音符則是 0.0001） */
  initial: number;
}

let tones: ToneRecord[] = [];
let gainRecords: GainRecord[] = [];
let resumeCalls = 0;

class FakeOscillatorNode {
  type = "sine";
  startFreq = 0;
  frequency = {
    value: 0,
    setValueAtTime: vi.fn((value: number) => {
      this.frequency.value = value;
      this.startFreq = value;
    }),
    exponentialRampToValueAtTime: vi.fn((value: number) => {
      this.frequency.value = value;
    }),
  };
  connect() {
    return this;
  }
  start(when: number) {
    tones.push({
      type: this.type,
      startFreq: this.startFreq,
      startTime: when,
      stopTime: when,
    });
  }
  stop(when: number) {
    const last = tones[tones.length - 1];
    if (last) last.stopTime = when;
  }
}

class FakeGainNode {
  record: GainRecord = { peak: 0, initial: 0 };
  gain = {
    value: 0,
    setValueAtTime: vi.fn((value: number) => {
      this.gain.value = value;
      if (this.record.initial === 0) this.record.initial = value;
    }),
    exponentialRampToValueAtTime: vi.fn((value: number) => {
      this.record.peak = Math.max(this.record.peak, value);
      this.gain.value = value;
    }),
  };
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state: AudioContextState = "running";
  createOscillator() {
    return new FakeOscillatorNode();
  }
  createGain() {
    const node = new FakeGainNode();
    gainRecords.push(node.record);
    return node;
  }
  resume() {
    resumeCalls += 1;
    return Promise.resolve();
  }
}

function setAudioContext(value: unknown) {
  Object.defineProperty(window, "AudioContext", { configurable: true, value });
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value });
}

/**
 * 播放一次音效並回傳觀測資料。
 * 每次呼叫前重設記錄：gainRecords[0] 是 master，其餘是各音符。
 */
function playAndObserve(name: SfxName, volume: number) {
  tones = [];
  gainRecords = [];
  const played = playSfx(name, { enabled: true, volume });
  return {
    played,
    tones: tones.slice(),
    masterVolume: gainRecords[0]?.initial ?? -1,
    tonePeaks: gainRecords.slice(1).map((record) => record.peak),
  };
}

beforeEach(() => {
  tones = [];
  gainRecords = [];
  resumeCalls = 0;
  resetSfxState();
  resetWarmup();
  vi.spyOn(performance, "now").mockReturnValue(0);
  setAudioContext(FakeAudioContext);
});

function advance(ms: number) {
  vi.mocked(performance.now).mockReturnValue(ms);
}

describe("playSfx 基本行為", () => {
  it("四種音效都能播放", () => {
    for (const name of SFX_NAMES) {
      advance(10_000);
      expect(playSfx(name, { enabled: true, volume: 0.6 }), name).toBe(true);
    }
  });

  it("答對音效由兩個上行音符組成", () => {
    playSfx("correct", { enabled: true, volume: 0.6 });
    expect(tones).toHaveLength(2);
    expect(tones[1].startFreq).toBeGreaterThan(tones[0].startFreq);
    expect(tones[1].startTime).toBeGreaterThan(tones[0].startTime);
  });

  it("答錯音效為下行音", () => {
    playSfx("wrong", { enabled: true, volume: 0.6 });
    expect(tones).toHaveLength(2);
    expect(tones[1].startFreq).toBeLessThan(tones[0].startFreq);
  });

  it("跳過音效只有一個音符，起始頻率與答對／答錯不同", () => {
    playSfx("skip", { enabled: true, volume: 0.6 });
    expect(tones).toHaveLength(1);
    const skipFreq = tones[0].startFreq;
    advance(10_000);
    playSfx("correct", { enabled: true, volume: 0.6 });
    const correctFreqs = tones.slice(1).map((t) => t.startFreq);
    advance(10_000);
    playSfx("wrong", { enabled: true, volume: 0.6 });
    const wrongFreqs = tones.slice(3).map((t) => t.startFreq);
    expect(correctFreqs).not.toContain(skipFreq);
    expect(wrongFreqs).not.toContain(skipFreq);
  });

  it("結算音效是三音下行", () => {
    playSfx("gameover", { enabled: true, volume: 0.6 });
    expect(tones).toHaveLength(3);
    expect(tones[2].startFreq).toBeLessThan(tones[0].startFreq);
  });

  it("音效長度短（結算音效低於 0.4 秒），不會拖太久", () => {
    playSfx("gameover", { enabled: true, volume: 0.6 });
    const total = Math.max(...tones.map((t) => t.stopTime)) - tones[0].startTime;
    expect(total).toBeLessThan(0.4);
    for (const tone of tones) {
      expect(tone.stopTime - tone.startTime).toBeLessThan(0.25);
    }
  });
});

describe("音效開關與音量", () => {
  it("關閉時完全不播放", () => {
    expect(playSfx("correct", { enabled: false, volume: 0.6 })).toBe(false);
    expect(tones).toHaveLength(0);
  });

  it("音量套用到 master gain", () => {
    const result = playAndObserve("correct", 0.25);
    expect(result.masterVolume).toBe(0.25);
  });

  it("音量夾限在 0～1", () => {
    expect(playAndObserve("correct", 5).masterVolume).toBe(1);
    advance(10_000);
    expect(playAndObserve("correct", -3).masterVolume).toBe(0);
  });

  it("音量 0 時仍可播放（靜音而非中斷流程）", () => {
    expect(playSfx("correct", { enabled: true, volume: 0 })).toBe(true);
  });

  it("答錯音效的峰值音量低於答對音效（柔和不刺耳）", () => {
    const correctPeak = Math.max(...playAndObserve("correct", 1).tonePeaks);
    advance(10_000);
    const wrongPeak = Math.max(...playAndObserve("wrong", 1).tonePeaks);
    expect(wrongPeak).toBeLessThan(correctPeak);
  });
});

describe("去重：避免同一音效連續疊加", () => {
  it("短時間內重複觸發同一音效只會播放一次", () => {
    expect(playSfx("correct", { enabled: true, volume: 0.6 })).toBe(true);
    advance(20);
    expect(playSfx("correct", { enabled: true, volume: 0.6 })).toBe(false);
    expect(tones).toHaveLength(2); // 只有第一次的兩個音符
  });

  it("超過最小間隔後可以再次播放", () => {
    playSfx("correct", { enabled: true, volume: 0.6 });
    advance(SFX_MIN_INTERVAL_MS.correct + 10);
    expect(playSfx("correct", { enabled: true, volume: 0.6 })).toBe(true);
  });

  it("不同音效互不影響", () => {
    playSfx("correct", { enabled: true, volume: 0.6 });
    advance(20);
    expect(playSfx("wrong", { enabled: true, volume: 0.6 })).toBe(true);
    expect(playSfx("skip", { enabled: true, volume: 0.6 })).toBe(true);
  });

  it("結算音效有較長的去重間隔，一次結算不會連續播放", () => {
    expect(SFX_MIN_INTERVAL_MS.gameover).toBeGreaterThan(SFX_MIN_INTERVAL_MS.correct);
    playSfx("gameover", { enabled: true, volume: 0.6 });
    advance(SFX_MIN_INTERVAL_MS.correct + 50);
    expect(playSfx("gameover", { enabled: true, volume: 0.6 })).toBe(false);
  });

  it("關閉音效時不佔用去重紀錄，重新開啟後可正常播放", () => {
    expect(playSfx("correct", { enabled: false, volume: 0.6 })).toBe(false);
    advance(1);
    expect(playSfx("correct", { enabled: true, volume: 0.6 })).toBe(true);
  });
});

describe("瀏覽器自動播放政策與失敗處理", () => {
  it("context 處於 suspended 時會嘗試 resume", () => {
    class SuspendedContext extends FakeAudioContext {
      state: AudioContextState = "suspended";
    }
    setAudioContext(SuspendedContext);
    playSfx("correct", { enabled: true, volume: 0.6 });
    expect(resumeCalls).toBe(1);
  });

  it("warmUpSfx 在第一次互動時 resume", () => {
    class SuspendedContext extends FakeAudioContext {
      state: AudioContextState = "suspended";
    }
    setAudioContext(SuspendedContext);
    warmUpSfx();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(resumeCalls).toBe(1);
  });

  it("不支援 Web Audio 時回傳 false 而不拋出例外", () => {
    setAudioContext(undefined);
    expect(playSfx("correct", { enabled: true, volume: 0.6 })).toBe(false);
    expect(tones).toHaveLength(0);
  });

  it("AudioContext 建構失敗時回傳 false（音效載入失敗不中斷遊戲）", () => {
    setAudioContext(function Broken() {
      throw new Error("blocked by browser");
    });
    expect(() => playSfx("correct", { enabled: true, volume: 0.6 })).not.toThrow();
    expect(playSfx("wrong", { enabled: true, volume: 0.6 })).toBe(false);
  });

  it("節點建立失敗時不影響呼叫端", () => {
    setAudioContext(
      class {
        currentTime = 0;
        destination = {};
        state = "running";
        resume() {
          return Promise.resolve();
        }
        createGain(): never {
          throw new Error("no gain node");
        }
        createOscillator(): never {
          throw new Error("no oscillator");
        }
      },
    );
    expect(() => playSfx("correct", { enabled: true, volume: 0.6 })).not.toThrow();
    expect(playSfx("wrong", { enabled: true, volume: 0.6 })).toBe(false);
  });
});

describe("音效與題目語音的間隔", () => {
  it("答錯音效與題目重播之間有合理間隔", () => {
    expect(SFX_SPEECH_GAP_MS).toBeGreaterThan(0);
    expect(SFX_SPEECH_GAP_MS).toBeLessThan(600);
  });
});

describe("音效名稱", () => {
  it("涵蓋題目要求的三種答題音效與結算音效", () => {
    expect(SFX_NAMES).toEqual<readonly SfxName[]>(["correct", "wrong", "skip", "gameover"]);
  });
});