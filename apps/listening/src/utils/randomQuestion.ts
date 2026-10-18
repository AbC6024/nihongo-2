import type { Difficulty, Question } from "../types/question";
import type { MistakeEntry } from "../types/game";
import { canonicalCategory, sortCategories } from "./categories";
import { shuffleWithRandom } from "./date";

/**
 * 集中管理的抽題邏輯。
 *
 * 所有遊戲模式（單字／句子／複習／今日挑戰）都必須透過這裡取題，
 * 不可以在各元件裡各自實作隨機。
 *
 * 三個關鍵規則：
 * 1. **不修改原始題庫**：`shuffleQuestions` 一律回傳新陣本。
 * 2. **不在 render 期間抽題**：抽題結果由呼叫端保存成一局的題目順序，
 *    元件重新渲染不會改變。
 * 3. **新局才重抽**：`buildSessionQuestions` 只在開始新局時呼叫一次。
 */

export const RECENT_HISTORY_SIZE = 5;

export interface FilterOptions {
  difficulties?: Difficulty[];
  categories?: string[];
}

/**
 * 分類排序的單一來源在 `./categories`，這裡只保留轉出，
 * 讓舊的 import 路徑 `randomQuestion.CATEGORY_ORDER` 仍然可用。
 */
export { CATEGORY_ORDER } from "./categories";

export function filterQuestions(
  questions: Question[],
  options: FilterOptions = {},
): Question[] {
  const difficulties =
    options.difficulties && options.difficulties.length > 0 ? new Set(options.difficulties) : null;
  const categories =
    options.categories && options.categories.length > 0
      ? new Set(options.categories.map((category) => canonicalCategory(category)))
      : null;

  return questions.filter((question) => {
    if (difficulties && !difficulties.has(question.difficulty)) return false;
    // 題目分類也正規化，讓舊題庫與玩家匯入的自訂分類跟新分類表一致。
    if (categories && !categories.has(canonicalCategory(question.category))) return false;
    return true;
  });
}

export function availableCategories(questions: Question[]): string[] {
  return sortCategories(questions.map((question) => question.category));
}

export function availableDifficulties(questions: Question[]): Difficulty[] {
  const order: Difficulty[] = ["N5", "N4", "N3", "N2", "N1"];
  return order.filter((difficulty) => questions.some((question) => question.difficulty === difficulty));
}

export interface PickResult<T> {
  item: T | null;
  relaxed: boolean;
}

/**
 * 抽題：盡量避開最近使用過的題目。
 * 若題庫太小而無法避免重複，則放寬限制（relaxed = true），不應拋錯。
 */
export function pickAvoidingRecent<T>(
  pool: T[],
  getId: (item: T) => string,
  recentIds: string[],
  random: () => number = Math.random,
): PickResult<T> {
  if (pool.length === 0) return { item: null, relaxed: false };
  const recent = new Set(recentIds.slice(-RECENT_HISTORY_SIZE));
  const fresh = pool.filter((item) => !recent.has(getId(item)));
  if (fresh.length > 0) {
    return { item: fresh[Math.floor(random() * fresh.length)], relaxed: false };
  }
  return { item: pool[Math.floor(random() * pool.length)], relaxed: true };
}

export interface WeightedPickResult<T> {
  item: T | null;
  relaxed: boolean;
}

/**
 * 複習模式抽題權重：星號重點 50%、其他錯題 30%、一般題目 20%。
 * 某類沒有可用題目時，其比例重新分配給其他可用類別。
 * 同一題若同時出現在錯題與一般題庫，只算一次（以最高權重計）。
 */
export function pickWeightedReview<T>(
  input: {
    starred: T[];
    otherMistakes: T[];
    general: T[];
  },
  getId: (item: T) => string,
  random: () => number = Math.random,
): WeightedPickResult<T> {
  const starredIds = new Set(input.starred.map(getId));
  const mistakeIds = new Set([...starredIds, ...input.otherMistakes.map(getId)]);

  const buckets: { weight: number; items: T[] }[] = [
    { weight: 0.5, items: input.starred.filter((item) => input.starred.includes(item)) },
    {
      weight: 0.3,
      items: input.otherMistakes.filter((item) => !starredIds.has(getId(item))),
    },
    {
      weight: 0.2,
      items: input.general.filter((item) => !mistakeIds.has(getId(item))),
    },
  ].filter((bucket) => bucket.items.length > 0);

  if (buckets.length === 0) {
    return { item: null, relaxed: false };
  }

  const totalWeight = buckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  let roll = random() * totalWeight;
  for (const bucket of buckets) {
    roll -= bucket.weight;
    if (roll <= 0) {
      return { item: bucket.items[Math.floor(random() * bucket.items.length)], relaxed: false };
    }
  }
  const fallback = buckets[buckets.length - 1];
  return { item: fallback.items[Math.floor(random() * fallback.items.length)], relaxed: true };
}

export interface ReviewPool<T> {
  starred: T[];
  otherMistakes: T[];
  general: T[];
}

/** 由錯題本建立複習抽題池，並過濾掉已從題庫移除的題目。 */
export function buildReviewPool<T>(
  questions: T[],
  mistakes: MistakeEntry[],
  getId: (item: T) => string,
): ReviewPool<T> {
  const byId = new Map(questions.map((item) => [getId(item), item]));
  const starred: T[] = [];
  const otherMistakes: T[] = [];
  for (const entry of mistakes) {
    const question = byId.get(entry.questionId);
    if (!question) continue;
    if (entry.starred) starred.push(question);
    else otherMistakes.push(question);
  }
  const mistakeIds = new Set(mistakes.map((entry) => entry.questionId));
  const general = questions.filter((item) => !mistakeIds.has(getId(item)));
  return { starred, otherMistakes, general };
}

/**
 * 洗牌（Fisher–Yates）。
 * **不會修改傳入的陣列**，回傳全新陣本。
 */
export function shuffleQuestions<T>(questions: T[], random: () => number = Math.random): T[] {
  return shuffleWithRandom(questions, random);
}

/**
 * 依複習抽題權重產生一整輪的題目順序。
 * 星號重點 50%、其他錯題 30%、一般題目 20%；缺少的類別，其比例會自動分配給其他類別。
 * 每次抽題後從對應集合移除，避免同一輪重複。
 */
export function buildWeightedReviewSequence<T>(
  pool: ReviewPool<T>,
  getId: (item: T) => string,
  random: () => number = Math.random,
): T[] {
  const starred = pool.starred.slice();
  const otherMistakes = pool.otherMistakes.slice();
  const general = pool.general.slice();
  const sequence: T[] = [];

  while (starred.length + otherMistakes.length + general.length > 0) {
    const picked = pickWeightedReview({ starred, otherMistakes, general }, getId, random);
    if (!picked.item) break;
    sequence.push(picked.item);
    const id = getId(picked.item);
    const removeFrom = (list: T[]) => {
      const index = list.findIndex((item) => getId(item) === id);
      if (index >= 0) list.splice(index, 1);
    };
    removeFrom(starred);
    removeFrom(otherMistakes);
    removeFrom(general);
  }

  return sequence;
}

export interface SessionQuestions<T> {
  /** 這一局的完整題目順序（已隨機洗牌）。 */
  order: T[];
  /** 題庫是否足以讓整局不重複；false 表示題目會循環重用。 */
  noRepeat: boolean;
  /** 洗牌是否真的改變了順序（測試與除錯用）。 */
  reshuffled: boolean;
}

/**
 * 一般模式（單字／句子）的一局題目順序。
 *
 * - 從完整題庫隨機洗牌，題目數足夠時整局不重複。
 * - 題庫不足時會在洗牌後循環補足（與原本的循環行為一致），
 *   但順序仍然是隨機的。
 * - 只在開始新局時呼叫一次，結果由呼叫端保存。
 */
export function buildSessionQuestions<T>(
  pool: T[],
  getId: (item: T) => string,
  random: () => number = Math.random,
): SessionQuestions<T> {
  if (pool.length === 0) {
    return { order: [], noRepeat: false, reshuffled: false };
  }
  const shuffled = shuffleQuestions(pool, random);
  const order = shuffled.slice();
  const shuffledIds = new Set(shuffled.map(getId));
  return {
    order,
    noRepeat: shuffledIds.size === shuffled.length,
    reshuffled: shuffled.some((item, index) => getId(item) !== getId(pool[index])),
  };
}

export interface DailyCompositionInput {
  /** 一般題庫（已套用難度／分類篩選）。 */
  generalIds: string[];
  /** 錯題／複習題庫 ID。 */
  mistakeIds: string[];
}

/**
 * 今日挑戰的 10 題 ID：
 * - 第 1～5 題來自一般題庫（隨機）
 * - 第 6～10 題優先來自錯題／複習題庫（隨機），不足時用一般題庫補足
 * - 整體隨機：每次開始新局都重新抽取，不再由日期鎖定
 */
export function composeDailyQuestionIds(
  input: DailyCompositionInput,
  random: () => number = Math.random,
): string[] {
  const mistakeSet = new Set(input.mistakeIds);

  // 「也在一般題庫中的錯題」必須保留給後半段，
  // 否則前 5 題可能先把錯題抽走，導致後半段沒有錯題可抽。
  const mistakeOnly = shuffleQuestions(
    input.mistakeIds.filter((id) => !input.generalIds.includes(id)),
    random,
  );
  const mistakeInGeneral = shuffleQuestions(
    input.mistakeIds.filter((id) => input.generalIds.includes(id)),
    random,
  );
  const mistakePriority = [...mistakeOnly, ...mistakeInGeneral];

  const generalOnly = shuffleQuestions(
    input.generalIds.filter((id) => !mistakeSet.has(id)),
    random,
  );
  const generalAll = shuffleQuestions(input.generalIds, random);

  const picked: string[] = [];
  const used = new Set<string>();

  const takeFrom = (sources: string[][], limit: number) => {
    for (const source of sources) {
      for (const id of source) {
        if (picked.length >= limit) return;
        if (used.has(id)) continue;
        used.add(id);
        picked.push(id);
      }
    }
  };

  // 前半：優先用「非錯題」的一般題庫，確保錯題能留給後半段
  takeFrom([generalOnly, generalAll], DAILY_FIRST_HALF_COUNT);
  // 後半：優先錯題，不足時由一般題庫補足
  takeFrom([mistakePriority, generalAll], DAILY_TOTAL_QUESTIONS_COUNT);

  return picked;
}

/** 每日挑戰題數（集中在此避免循環相依）。 */
export const DAILY_TOTAL_QUESTIONS_COUNT = 10;
/** 前半段來自一般題庫的題數。 */
export const DAILY_FIRST_HALF_COUNT = DAILY_TOTAL_QUESTIONS_COUNT / 2;