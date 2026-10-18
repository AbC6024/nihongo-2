/**
 * 以「裝置本地日期」為基準的日期工具。
 * 全部使用 YYYY-MM-DD 字串 key，避免 UTC 跨日造成統計錯誤。
 */

export type DateKey = string;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 取得 Date 對應的本地日期 key。 */
export function toLocalDateKey(date: Date = new Date()): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: DateKey): Date {
  const [year, month, day] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

/** 以本地日期做加法，跨月跨年都正確。 */
export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

export function previousDateKey(key: DateKey): DateKey {
  return addDays(key, -1);
}

/** b - a 的天數差（以本地日期計算）。 */
export function diffDays(a: DateKey, b: DateKey): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / MS_PER_DAY);
}

/** 簡單穩定的字串 hash（FNV-1a 32bit）。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 PRNG：同 seed 產生同序列。 */
export function createSeededRandom(seed: string | number): () => number {
  let state = (typeof seed === "number" ? seed : hashString(seed)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithRandom<T>(items: T[], random: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}