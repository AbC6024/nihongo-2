/**
 * 遊戲提示音效（Correct / Wrong / Skip / Game Over）。
 *
 * 素材說明（詳見 public/audio/sfx/README.md）：
 * 本專案**沒有匯入任何第三方音效檔案**。因為無法確認免費音效素材的
 * 授權條款是否允許再散布，改以 Web Audio API 即時合成簡短提示音：
 * 完全無外部依賴、無授權風險、檔案體積為 0，且可以日後無縫換成實體音檔。
 *
 * 設計原則：
 * - 只播放提示音效，**完全不影響**題目的日文語音（TTS 與音檔）。
 * - 音效失敗（不支援 Web Audio、節點建立失敗、播放被瀏覽器阻擋）一律
 *   安靜忽略，絕不中斷答題流程。
 * - 同一音效在極短時間內重複觸發會被抑制，避免刺耳疊加。
 * - fire-and-forget，不 await，不阻塞計分／計時／自動跳題。
 */

export type SfxName = "correct" | "wrong" | "skip" | "gameover";

export const SFX_NAMES: SfxName[] = ["correct", "wrong", "skip", "gameover"];

interface ToneSpec {
  /** 起始頻率（Hz） */
  freq: number;
  /** 結束頻率（Hz）；與 freq 相同表示不滑音 */
  endFreq?: number;
  /** 起始時間偏移（秒） */
  offset: number;
  /** 長度（秒） */
  duration: number;
  /** 峰值音量（0～1） */
  gain: number;
  type: OscillatorType;
}

/**
 * 各音效的音符序列。總長度皆低於 0.4 秒，避免干擾作答節奏。
 */
const SFX_SPECS: Record<SfxName, ToneSpec[]> = {
  // 清脆的兩段上行提示音
  correct: [
    { freq: 880, offset: 0, duration: 0.075, gain: 0.55, type: "triangle" },
    { freq: 1320, offset: 0.07, duration: 0.11, gain: 0.5, type: "triangle" },
  ],
  // 柔和的兩段下行音，音量刻意壓低
  wrong: [
    { freq: 330, endFreq: 300, offset: 0, duration: 0.1, gain: 0.32, type: "sine" },
    { freq: 262, endFreq: 240, offset: 0.09, duration: 0.13, gain: 0.28, type: "sine" },
  ],
  // 中性的單音跳過提示，與答對／答錯可區分
  skip: [
    { freq: 520, endFreq: 440, offset: 0, duration: 0.13, gain: 0.34, type: "sine" },
  ],
  // 短促的三音結算提示
  gameover: [
    { freq: 784, offset: 0, duration: 0.09, gain: 0.4, type: "triangle" },
    { freq: 587, offset: 0.085, duration: 0.09, gain: 0.36, type: "triangle" },
    { freq: 440, offset: 0.17, duration: 0.16, gain: 0.34, type: "triangle" },
  ],
};

/**
 * 同一音效的最小間隔（毫秒）。用於抑制重複點擊或重複渲染造成的疊加。
 * 答對／答錯可能被快速連按，間隔設得比音符長度稍大。
 */
const MIN_INTERVAL_MS: Record<SfxName, number> = {
  correct: 150,
  wrong: 220,
  skip: 220,
  gameover: 2000,
};

/**
 * 答錯音效之後，題目語音延遲多少毫秒再播放，避免兩者重疊。
 */
export const SFX_SPEECH_GAP_MS = 260;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;
let ctxFailed = false;
const lastPlayedAt: Partial<Record<SfxName, number>> = {};

/** 供測試重設模組狀態。 */
export function resetSfxState(): void {
  ctx = null;
  ctxFailed = false;
  for (const key of Object.keys(lastPlayedAt) as SfxName[]) delete lastPlayedAt[key];
}

/** 取得（必要時建立）AudioContext。失敗時回傳 null。 */
function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (ctxFailed) return null;
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    ctxFailed = true;
    return null;
  }
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    ctxFailed = true;
    return null;
  }
}

export interface SfxOptions {
  enabled: boolean;
  /** 0～1；只影響提示音效，不影響題目語音。 */
  volume: number;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.6;
  return Math.min(1, Math.max(0, value));
}

function scheduleTone(context: AudioContext, spec: ToneSpec, master: GainNode, startAt: number) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, startAt);
  if (spec.endFreq && spec.endFreq !== spec.freq) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, spec.endFreq),
      startAt + spec.duration,
    );
  }

  // 快速起音 + 指數衰減，避免爆音（click）。
  const peak = Math.max(0.0001, spec.gain);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + spec.duration);

  osc.connect(gain);
  gain.connect(master);
  osc.start(startAt);
  osc.stop(startAt + spec.duration + 0.02);
}

/**
 * 播放提示音效。回傳是否真的播放（供測試與除錯使用）。
 * 任何失敗都安靜回傳 false。
 */
export function playSfx(name: SfxName, options: SfxOptions): boolean {
  if (!options.enabled) return false;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const previous = lastPlayedAt[name];
  if (previous !== undefined && now - previous < MIN_INTERVAL_MS[name]) return false;
  lastPlayedAt[name] = now;

  const context = ensureContext();
  if (!context) return false;

  try {
    // 瀏覽器自動播放政策：context 可能處於 suspended。
    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    const master = context.createGain();
    const volume = clampVolume(options.volume);
    master.gain.setValueAtTime(volume, context.currentTime);
    master.connect(context.destination);

    const specs = SFX_SPECS[name];
    const startAt = context.currentTime + 0.001;
    for (const spec of specs) {
      scheduleTone(context, spec, master, startAt + spec.offset);
    }

    const totalMs =
      Math.max(...specs.map((spec) => (spec.offset + spec.duration) * 1000)) + 40;
    // 播放結束後釋放節點，避免累積。
    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        /* ignore */
      }
    }, totalMs);
    return true;
  } catch {
    return false;
  }
}

/**
 * 在使用者第一次互動時「暖機」AudioContext，降低首次答題的延遲與被阻擋的機率。
 * 只註冊一次。
 */
let warmupBound = false;
export function warmUpSfx(): void {
  if (warmupBound) return;
  warmupBound = true;
  if (typeof window === "undefined") return;
  const handler = () => {
    const context = ensureContext();
    if (context && context.state === "suspended") void context.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", handler, { once: true, passive: true });
  window.addEventListener("keydown", handler, { once: true });
}

/** 重新允許暖機（測試用）。 */
export function resetWarmup(): void {
  warmupBound = false;
}

export const SFX_MIN_INTERVAL_MS = MIN_INTERVAL_MS;