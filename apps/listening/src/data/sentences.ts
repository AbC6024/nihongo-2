import type { AnswerType, Difficulty, SentenceQuestion } from "../types/question";
import { canonicalCategory } from "../utils/categories";
import { SENTENCE_SEEDS } from "./sentenceSeeds";

/**
 * 句子填空題庫（自行撰寫的示範句子，非第三方網站原創內容）。
 *
 * 規則：
 * - `sentence` 只用於語音播放與答後揭示，作答前不顯示。
 * - `displaySentence` 使用全形底線 ＿＿＿ 表示挖空位置。
 * - `accentVerified` 一律 false：尚未人工查核。
 */
type SentenceRow = [
  id: string,
  sentence: string,
  display: string,
  answer: string,
  kana: string,
  romaji: string,
  meaning: string,
  difficulty: Difficulty,
  category: string,
  answerType: AnswerType,
  accepted?: string[],
];

const ROWS: SentenceRow[] = [
  [
    "s-ramen-kinou",
    "昨日、友達とラーメンを食べました。",
    "昨日、友達と＿＿＿を食べました。",
    "ラーメン",
    "ラーメン",
    "ramen",
    "昨天和朋友吃了拉麵",
    "N5",
    "食物",
    "word",
  ],
  [
    "s-gakkou-kyou",
    "今日、学校は休みでした。",
    "今日、学校は＿＿＿でした。",
    "休み",
    "やすみ",
    "yasumi",
    "今天學校放假",
    "N5",
    "校園",
    "word",
  ],
  [
    "s-tenki-yoi",
    "今日は天気がいいので、散歩します。",
    "今日は＿＿＿ので、散歩します。",
    "天気",
    "てんき",
    "tenki",
    "因為今天天氣好所以去散步",
    "N5",
    "日常生活",
    "word",
  ],
  [
    "s-densha-kippu",
    "電車に乗る前に切符を買います。",
    "＿＿＿に乗る前に切符を買います。",
    "電車",
    "でんしゃ",
    "densha",
    "上電車之前先買車票",
    "N5",
    "交通",
    "word",
  ],
  [
    "s-neko-mae",
    "あの子の家の前にねこがいます。",
    "あの子の家の前に＿＿＿がいます。",
    "ねこ",
    "ねこ",
    "neko",
    "那個孩子家前面有貓",
    "N5",
    "動物",
    "word",
  ],
  [
    "s-hajimari-photo",
    "旅行のはじまりに写真を取りました。",
    "旅行の＿＿＿に写真を取りました。",
    // 答案必須是句子裡實際出現的字面，不能只塞字典形「はじめ」。
    "はじまり",
    "はじまり",
    "hajimari",
    "在旅行開始的時候拍了照片",
    "N5",
    "慣用語",
    "word",
  ],
  [
    "s-ganbaru",
    "日本語はむずかしいですが、頑張ります。",
    "日本語は＿＿＿ですが、＿＿＿ります。",
    "頑張",
    "がんば",
    "ganbaru",
    "日文雖然很難，但我會努力",
    "N4",
    "慣用語",
    "word",
    ["ganbatta"],
  ],
  [
    "s-kaigi-youbi",
    "来週の月曜日に会議があります。",
    "来週の月曜日に＿＿＿があります。",
    "会議",
    "かいぎ",
    "kaigi",
    "下週一有會議",
    "N4",
    "工作",
    "word",
  ],
  [
    "s-jouhou-kakutei",
    "その情報はまだ確定的ではありません。",
    "その＿＿＿はまだ確定的ではありません。",
    "情報",
    "じょうほう",
    "jouhou",
    "那個情報還不是確定的",
    "N4",
    "新聞・書面語",
    "word",
    ["joho"],
  ],
  [
    "s-douryou-wakare",
    "会議では同僚と意見が分かれました。",
    "会議では＿＿＿と意見が＿＿＿ました。",
    "同僚",
    "どうりょう",
    "douryou",
    "會議上跟同事意見分歧了",
    "N4",
    "工作",
    "word",
    ["wakare"],
  ],
  [
    "s-hajimari-kimono",
    "初対面のときは身振りで表現します。",
    "初対面のときは身振りで＿＿＿します。",
    "表現",
    "ひょうげん",
    "hyougen",
    "初次見面時用肢體語言表達",
    "N4",
    "慣用語",
    "idiom",
    ["hyogen"],
  ],
  [
    "s-gekihin-seisou",
    "民間の工場で半導体が製造されています。",
    "＿＿＿＿の工場で半導体が製造されています。",
    "民間",
    "みんかん",
    "minkan",
    "民營工廠在生產半導體",
    "N4",
    "工作",
    "word",
  ],
  [
    "s-utsuroi-kaede",
    "季節が変わると町の景色も入れ替わります。",
    "季節が変わると町の景色も＿＿＿わります。",
    "入れ替",
    "いれかわ",
    "irekawaru",
    "季節一換，街景也跟著更替",
    "N3",
    "日常生活",
    "word",
  ],
  [
    "s-chousa-sanbu",
    "調査の結果、三割が反対しました。",
    "＿＿＿の結果、三割が反対しました。",
    "調査",
    "ちょうさ",
    "chousa",
    "調查結果顯示三成反對",
    "N3",
    "新聞・書面語",
    "word",
  ],
  [
    "s-sannen-minaoshi",
    "三年ごとに見直しています。",
    "＿＿＿ごとに見直しています。",
    "三年",
    "さんねん",
    "sannen",
    "每三年重新檢視一次",
    "N3",
    "工作",
    "word",
  ],
  [
    "s-taai-taiji",
    "対立する意見と対峙しました。",
    "＿＿＿＿の意見と対峙しました。",
    "対立",
    "たいりつ",
    "tairitsu",
    "與對立意見相持不下",
    "N3",
    "慣用語",
    "idiom",
  ],
  [
    "s-kitsune-sumi",
    "芥末と酢の組み合わせは思ってもみない組み合わせでした。",
    "＿＿＿と酢の組み合わせは思ってもみない組み合わせでした。",
    "芥末",
    "きつね",
    "wasabi",
    "芥末和醋的搭配意外地好",
    "N3",
    "食物",
    "word",
    ["wasabi"],
  ],
  [
    "s-soutei-fushigi",
    "調査を想定すると状況はどうなるのか。",
    "＿＿＿を想定すると状況はどうなるのか。",
    "調査",
    "ちょうさ",
    "chousa",
    "假設調查的話，狀況會如何",
    "N2",
    "新聞・書面語",
    "word",
  ],
  [
    "s-zenrei-teki",
    "残留する可能性があるとします。",
    "＿＿＿＿＿可能性があるとします。",
    "残留",
    "ざんりゅう",
    "zanryuu",
    "假設有殘留的可能",
    "N2",
    "新聞・書面語",
    "word",
  ],
  [
    "s-jibun-hakken",
    "この事例を通じて自分の弱点に気づきました。",
    "＿＿＿＿を通じて自分の弱点に気づきました。",
    "事例",
    "じれい",
    "jirei",
    "透過這個例子察覺到自己的弱點",
    "N2",
    "慣用語",
    "word",
  ],
  [
    "s-gakuteki-so",
    "この対策は画期的だと公式に公表された。",
    "この対策は＿＿＿だと公式に公表された。",
    // 原先寫成「画的」，但完整句是「画期的」，字面不一致；改用句中實際的字面。
    "画期的",
    "がくてき",
    "gakuteki",
    "這個對策被列為劃時代的",
    "N2",
    "新聞・書面語",
    "word",
  ],
];

function toSentence(row: SentenceRow): SentenceQuestion {
  return {
    id: row[0],
    sentence: row[1],
    displaySentence: row[2],
    answer: row[3],
    kana: row[4],
    romaji: row[5],
    meaning: row[6],
    difficulty: row[7],
    category: canonicalCategory(row[8]),
    answerType: row[9],
    acceptedAnswers: row[10],
    audio: null,
    image: null,
    accentVerified: false,
    source: "original-sample",
  };
}

const BASE_SENTENCES: SentenceQuestion[] = ROWS.map(toSentence);

/**
 * 併入種子句子題庫（S001～S046）。
 *
 * - 完整句與挖空句分開儲存：`sentence` 只給語音與答後揭示，
 *   `displaySentence` 才會在作答前顯示。
 * - 以 `id` 為合併鍵；不會覆寫既有句子，也不會複製同一道題。
 */
export const BUILTIN_SENTENCES: SentenceQuestion[] = (() => {
  const byId = new Map<string, SentenceQuestion>();
  for (const sentence of BASE_SENTENCES) byId.set(sentence.id, sentence);

  for (const seed of SENTENCE_SEEDS) {
    const sentence: SentenceQuestion = {
      id: seed.id,
      sentence: seed.sentence,
      displaySentence: seed.displaySentence,
      answer: seed.answer,
      kana: seed.kana,
      romaji: seed.romaji,
      meaning: seed.meaning,
      difficulty: seed.difficulty,
      category: canonicalCategory(seed.category),
      answerType: seed.answerType,
      acceptedAnswers: seed.acceptedAnswers,
      audio: null,
      image: null,
      accentVerified: false,
      source: "seed-expansion",
    };
    if (sentence.acceptedAnswers && sentence.acceptedAnswers.length === 0) {
      delete sentence.acceptedAnswers;
    }
    byId.set(sentence.id, sentence);
  }
  return Array.from(byId.values());
})();

/** 種子句子題的編號（供驗證與文件使用）。 */
export const SEEDED_SENTENCE_IDS: readonly string[] = SENTENCE_SEEDS.map((seed) => seed.id);

export const SENTENCE_CATEGORIES = Array.from(
  new Set(BUILTIN_SENTENCES.map((sentence) => sentence.category)),
);