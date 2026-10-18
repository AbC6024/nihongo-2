import type { Difficulty, ScriptType, WordQuestion } from "../types/question";
import { canonicalCategory } from "../utils/categories";
import { WORD_SEEDS } from "./wordSeeds";

/**
 * 內建示範題庫。
 *
 * 資料來源說明見 DATA_SOURCE.md：
 * - 本檔案為本專案自行撰寫的示範詞彙，非任何第三方網站的原創詞彙清單。
 * - `source: "original-sample"`，可自由使用與修改。
 * - `accentVerified` 一律 false：尚未人工查核，不得宣稱符合 OJAD アクセント。
 * - `audio` 留空：播放時使用瀏覽器 Web Speech API（ja-JP）機器語音。
 */

// [japanese, kana, romaji, meaning, difficulty, script, category, partOfSpeech]
type WordRow = [string, string, string, string, Difficulty, ScriptType, string, string];

const ROWS: WordRow[] = [
  // ---- N5：動物 ----
  ["猫", "ねこ", "neko", "貓", "N5", "hiragana", "動物", "名詞"],
  ["犬", "いぬ", "inu", "狗", "N5", "hiragana", "動物", "名詞"],
  ["鳥", "とり", "tori", "鳥", "N5", "hiragana", "動物", "名詞"],
  ["海", "うみ", "umi", "海", "N5", "hiragana", "動物", "名詞"],
  ["卵", "たまご", "tamago", "蛋", "N5", "mixed", "動物", "名詞"],
  ["馬", "うま", "uma", "馬", "N5", "hiragana", "動物", "名詞"],
  // ---- N5：日常生活 ----
  ["水", "みず", "mizu", "水", "N5", "hiragana", "日常生活", "名詞"],
  ["朝", "あさ", "asa", "早上", "N5", "hiragana", "日常生活", "名詞"],
  ["夜", "よる", "yoru", "夜晚", "N5", "hiragana", "日常生活", "名詞"],
  ["天気", "てんき", "tenki", "天氣", "N5", "mixed", "日常生活", "名詞"],
  ["窓", "まど", "mado", "窗戶", "N5", "hiragana", "日常生活", "名詞"],
  ["鏡", "かがみ", "kagami", "鏡子", "N5", "hiragana", "日常生活", "名詞"],
  ["電気", "でんき", "denki", "電", "N5", "mixed", "日常生活", "名詞"],
  ["エレベーター", "エレベーター", "erebata", "電梯", "N5", "katakana", "日常生活", "名詞"],
  // ---- N5：校園 ----
  ["学校", "がっこう", "gakkou", "學校", "N5", "mixed", "校園", "名詞"],
  ["先生", "せんせい", "sensei", "老師", "N5", "mixed", "校園", "名詞"],
  ["絵本", "えほん", "ehon", "繪本", "N5", "mixed", "校園", "名詞"],
  ["試験", "しけん", "shiken", "考試", "N5", "mixed", "校園", "名詞"],
  // ---- N5：食物 ----
  ["ご飯", "ごはん", "gohan", "米飯、飯", "N5", "mixed", "食物", "名詞"],
  ["魚", "さかな", "sakana", "魚", "N5", "hiragana", "食物", "名詞"],
  ["ラーメン", "ラーメン", "ramen", "拉麵", "N5", "katakana", "食物", "名詞"],
  ["食べ物", "たべもの", "tabemono", "食物", "N5", "mixed", "食物", "名詞"],
  ["野菜", "やさい", "yasai", "蔬菜", "N5", "mixed", "食物", "名詞"],
  // ---- N5：交通 ----
  ["電車", "でんしゃ", "densha", "電車", "N5", "mixed", "交通", "名詞"],
  ["駅", "えき", "eki", "車站", "N5", "hiragana", "交通", "名詞"],
  ["飛行機", "ひこうき", "hikouki", "飛機", "N5", "mixed", "交通", "名詞"],
  ["道", "みち", "michi", "路、道路", "N5", "hiragana", "交通", "名詞"],
  ["バス", "バス", "basu", "公車", "N5", "katakana", "交通", "名詞"],
  // ---- N5：慣用語 ----
  ["頑張った", "がんばった", "ganbatta", "努力了、撐過來了", "N5", "mixed", "慣用語", "動詞"],
  ["始まり", "はじまり", "hajimari", "開始、開端", "N5", "mixed", "慣用語", "名詞"],
  ["お疲れ様", "おつかれさま", "otsukaresama", "辛苦了", "N5", "mixed", "慣用語", "挨拶"],

  // ---- N4：日常生活 ----
  ["最初", "さいしょ", "saisho", "最初", "N4", "mixed", "日常生活", "副詞"],
  ["元気", "げんき", "genki", "精神、健康", "N4", "mixed", "日常生活", "名詞・ナ形容詞"],
  ["安全", "あんぜん", "anzen", "安全", "N4", "mixed", "日常生活", "名詞・ナ形容詞"],
  ["冬", "ふゆ", "fuyu", "冬天", "N4", "hiragana", "日常生活", "名詞"],
  ["約束", "やくそく", "yakusoku", "約定、承諾", "N4", "mixed", "日常生活", "名詞・サ変動詞"],
  // ---- N4：校園 ----
  ["本", "ほん", "hon", "書、本子", "N4", "hiragana", "校園", "名詞"],
  ["宿題", "しゅくだい", "shukudai", "作業、回家作業", "N4", "mixed", "校園", "名詞"],
  ["授業", "じゅぎょう", "jugyou", "授課、上課", "N4", "mixed", "校園", "名詞・サ変動詞"],
  // ---- N4：新聞・書面語 ----
  ["記録", "きろく", "kiroku", "記錄", "N4", "mixed", "新聞・書面語", "名詞・サ変動詞"],
  ["注意", "ちゅうい", "chui", "注意", "N4", "mixed", "新聞・書面語", "名詞・サ変動詞"],
  ["用語", "ようご", "yougo", "用語、術語", "N4", "mixed", "新聞・書面語", "名詞"],
  ["情報", "じょうほう", "jouhou", "情報", "N4", "mixed", "新聞・書面語", "名詞"],
  ["結果", "けっか", "kekka", "結果", "N4", "mixed", "新聞・書面語", "名詞"],
  // ---- N4：工作 ----
  ["会議", "かいぎ", "kaigi", "會議", "N4", "mixed", "工作", "名詞"],
  ["戦略", "せんりゃく", "senryaku", "戰略", "N4", "mixed", "工作", "名詞"],
  ["考える", "かんがえる", "kangaeru", "考慮、思考", "N4", "mixed", "工作", "動詞"],
  ["準備", "じゅんび", "junbi", "準備", "N4", "mixed", "工作", "名詞・サ変動詞"],
  // ---- N4：慣用語 ----
  ["根回し", "ねまわし", "nemawashi", "事前打通關係", "N4", "mixed", "慣用語", "名詞"],
  ["型破り", "かたがわり", "katagawari", "變了樣子、走了樣", "N4", "mixed", "慣用語", "名詞"],
  ["いただきます", "いただきます", "itadakimasu", "我開動了（用餐時）", "N4", "hiragana", "慣用語", "挨拶"],
  ["失礼します", "しつれいします", "shitsurei shimasu", "打擾了、不好意思", "N4", "mixed", "慣用語", "挨拶"],

  // ---- N3：新聞・書面語 ----
  ["明確", "めいかく", "meikaku", "明確", "N3", "mixed", "新聞・書面語", "名詞・ナ形容詞"],
  ["報道", "ほうどう", "houdou", "報導", "N3", "mixed", "新聞・書面語", "名詞・サ変動詞"],
  ["調査", "ちょうさ", "chousa", "調查", "N3", "mixed", "新聞・書面語", "名詞"],
  ["政治", "せいじ", "seiji", "政治", "N3", "mixed", "新聞・書面語", "名詞"],
  ["政策", "せいさく", "seisaku", "政策", "N3", "mixed", "新聞・書面語", "名詞"],
  ["撥音", "はつおん", "hatsuon", "撥音、半濁音", "N3", "mixed", "新聞・書面語", "名詞"],
  ["前提", "ぜんてい", "zentei", "前提", "N3", "mixed", "新聞・書面語", "名詞"],
  // ---- N3：工作 ----
  ["構想", "こうそう", "kousou", "構想、藍圖", "N3", "mixed", "工作", "名詞"],
  ["事業", "じぎょう", "jigyou", "事業、經營", "N3", "mixed", "工作", "名詞"],
  ["考慮", "こうりょ", "kouryo", "考慮", "N3", "mixed", "工作", "名詞・サ変動詞"],
  ["改善", "かいぜん", "kaizen", "改善", "N3", "mixed", "工作", "名詞・サ変動詞"],
  // ---- N3：日常生活 / 交通 ----
  ["切符", "きっぷ", "kippu", "車票", "N3", "mixed", "交通", "名詞"],
  ["乗り換え", "のりかえ", "norikae", "轉乘", "N3", "mixed", "交通", "名詞"],
  ["切り紙", "きりがみ", "kirigami", "剪紙", "N3", "mixed", "日常生活", "名詞"],
  // ---- N3：慣用語 ----
  ["手当たり", "てあて", "teate", "觸手摸象、順手", "N3", "mixed", "慣用語", "名詞"],

  // ---- N2：新聞・書面語 ----
  ["想定", "そうてい", "soutei", "預想、假設", "N2", "mixed", "新聞・書面語", "名詞・サ変動詞"],
  ["発生", "はっせい", "hassei", "發生", "N2", "mixed", "新聞・書面語", "名詞・サ変動詞"],
  ["決定的", "けっていてき", "ketteiteki", "決定性的", "N2", "mixed", "新聞・書面語", "形容動詞"],
  ["見出し", "みだしご", "midashigo", "標題", "N2", "mixed", "新聞・書面語", "名詞"],
  ["水準", "すいじゅん", "suijun", "水準、水平", "N2", "mixed", "新聞・書面語", "名詞"],
  // ---- N2：工作 ----
  ["検索", "けんさく", "kensaku", "檢索、查詢", "N2", "mixed", "工作", "名詞"],
  ["相談", "そうだん", "soudan", "商量、諮詢", "N2", "mixed", "工作", "名詞・サ変動詞"],
  ["固まる", "かたまる", "katamaru", "凝固、定型", "N2", "mixed", "工作", "動詞"],
  ["枠", "わく", "waku", "枠、框架、名額", "N2", "hiragana", "工作", "名詞"],
  // ---- N2：校園 / 日常生活 ----
  ["質問", "しつもん", "shitsumon", "提問、質問", "N2", "mixed", "校園", "名詞・サ変動詞"],
  ["単身", "たんしん", "tanshin", "單身", "N2", "mixed", "日常生活", "名詞"],
  // ---- N2：慣用語 ----
  ["申し分け", "もうしわけ", "moushiwake", "辯解、分辨", "N2", "mixed", "慣用語", "名詞"],
  ["偏らなく", "てらえなく", "teraenaku", "不偏不倚", "N2", "mixed", "慣用語", "副詞"],

  // ---- N1：新聞・書面語 ----
  ["奇襲", "きしゅう", "kishuu", "奇襲、出其不意", "N1", "mixed", "新聞・書面語", "名詞"],
  ["画的", "がくてき", "gakuteki", "畫期的", "N1", "mixed", "新聞・書面語", "形容動詞"],
  ["疑義", "ぎぎ", "gigi", "疑義", "N1", "mixed", "新聞・書面語", "名詞"],
  ["自体の", "じたいの", "jitaino", "本身的", "N1", "mixed", "新聞・書面語", "連体詞"],
  ["忌憚", "きごころ", "kigokoro", "顧忌、忌諱", "N1", "mixed", "慣用語", "名詞"],
  ["如く", "ごとく", "gotoku", "如同", "N1", "mixed", "慣用語", "助動詞"],
  ["芒刺", "ぼうし", "boushi", "芒刺在背", "N1", "mixed", "慣用語", "名詞"],
  ["手馳", "てならし", "tenarashi", "老手、熟悉", "N1", "mixed", "慣用語", "名詞"],
];

/** 明確標示的替代拼法，避免使用者輸入正確但被判定錯誤。鍵值為題目的 `kana`。 */
const ACCEPTED_BY_KANA: Record<string, string[]> = {
  がっこう: ["gakko"],
  ごはん: ["meshi"],
  がんばった: ["ganbaru"],
  はじまり: ["hajimaru"],
  おつかれさま: ["otsukare"],
  かたがわり: ["katakawari"],
  じょうほう: ["joho"],
  かたまる: ["katamari"],
  てらえなく: ["terau"],
};

function slugify(japanese: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < japanese.length; i += 1) {
    hash ^= japanese.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `w-${hash.toString(36)}`;
}

/** 由日文文字推導 script，避免種子資料要人工填寫而填錯。 */
function detectScript(japanese: string): ScriptType {
  if (/^[\u30a1-\u30f6\u30fc\u30fb]+$/.test(japanese)) return "katakana";
  if (/^[\u3041-\u3096\u30fc\u30fb]+$/.test(japanese)) return "hiragana";
  return "mixed";
}

function toWord(row: WordRow): WordQuestion {
  const [japanese, kana, romaji, meaning, difficulty, script, category, partOfSpeech] = row;
  const id = slugify(japanese);
  return {
    id,
    japanese,
    kana,
    romaji,
    meaning,
    difficulty,
    script,
    category: canonicalCategory(category),
    partOfSpeech: partOfSpeech || undefined,
    acceptedAnswers: ACCEPTED_BY_KANA[kana],
    accentType: "unknown",
    accentVerified: false,
    audio: null,
    image: null,
    source: "original-sample",
  };
}

const BASE_WORDS: WordQuestion[] = ROWS.map(toWord);

/**
 * 把種子題庫併入既有題庫。
 *
 * 合併規則（重要）：
 * - **以 `japanese` 為合併鍵**，因為既有 ID 是 `slugify(japanese)`，
 *   相同日文一定得到相同 ID。已存在的詞彙（例如「試験」「約束」）會
 *   **沿用原本的 ID**，玩家的錯題本與遊玩紀錄不會因此失效。
 * - 重複詞彙以**種子資料為準**更新讀音、意思、難度與分類，
 *   但保留種子資料未提供的既有欄位（例如 `acceptedAnswers`）。
 * - 種子資料自己產生的替代答案會與既有的合併去重。
 * - 不會為了湊數複製題目：同一個日文只會有一筆。
 */
function mergeSeeds(base: WordQuestion[], seeds: typeof WORD_SEEDS): WordQuestion[] {
  const byJapanese = new Map<string, WordQuestion>();
  for (const word of base) byJapanese.set(word.japanese, word);

  for (const seed of seeds) {
    const existing = byJapanese.get(seed.japanese);
    const accepted = Array.from(
      new Set([...(existing?.acceptedAnswers ?? []), ...(seed.acceptedAnswers ?? [])]),
    );
    const merged: WordQuestion = {
      id: slugify(seed.japanese),
      japanese: seed.japanese,
      kana: seed.kana,
      romaji: seed.romaji,
      meaning: seed.meaning,
      difficulty: seed.difficulty,
      script: detectScript(seed.japanese),
      category: canonicalCategory(seed.category),
      partOfSpeech: seed.partOfSpeech,
      acceptedAnswers: accepted.length > 0 ? accepted : undefined,
      example: seed.example,
      accentType: "unknown",
      accentVerified: false,
      audio: null,
      image: null,
      source: existing ? "original-sample+seed-expansion" : "seed-expansion",
    };
    // 未指定時不要留下空欄位
    if (!merged.acceptedAnswers) delete merged.acceptedAnswers;
    if (!merged.example) delete merged.example;
    byJapanese.set(seed.japanese, merged);
  }

  // 維持原本順序：既有題目在前，新增的依種子順序接在後。
  const ordered: WordQuestion[] = [];
  const used = new Set<string>();
  for (const word of byJapanese.values()) {
    if (used.has(word.id)) continue;
    used.add(word.id);
    ordered.push(word);
  }
  return ordered;
}

export const BUILTIN_WORDS: WordQuestion[] = mergeSeeds(BASE_WORDS, WORD_SEEDS);

/**
 * 原始（v1）示範題庫的日文清單。
 * 供測試確認：併入種子題庫後，既有詞彙的 ID 與資料都還在，
 * 玩家的錯題本／遊玩紀錄不會失效。
 */
export const LEGACY_WORD_JAPANESE: readonly string[] = BASE_WORDS.map((word) => word.japanese);

/** 種子題庫帶入的詞彙（供驗證與文件使用）。 */
export const SEEDED_WORD_JAPANESE: readonly string[] = WORD_SEEDS.map((seed) => seed.japanese);

export const WORD_CATEGORIES = Array.from(new Set(BUILTIN_WORDS.map((word) => word.category)));