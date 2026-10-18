import type { Difficulty } from "../types/question";

/**
 * 新增種子題庫：100 個日文單字 + 10 個慣用表現／口語表達。
 *
 * 重要聲明：
 * - 這是**教學用途的建議難度分級**，由本專案自行整理，
 *   **並非**官方 JLPT 完整詞彙表，也**未經**任何官方認證。
 * - 不複製第三方網站的原創詞彙清單；內容由本專案撰寫，可自由修改。
 * - `audio` / `image` 一律留 null：沒有已確認授權的素材，
 *   播放時使用瀏覽器 Web Speech API（ja-JP）機器語音作為備援。
 * - `accentVerified` 一律 false：尚未人工查核，不宣稱符合 OJAD アクセント。
 *
 * 欄位對應到既有 `WordQuestion`（`src/types/question.ts`），
 * 沒有重複建立型別。`script` 由 `japanese` 自動推導，不需手填。
 */

export interface WordSeed {
  japanese: string;
  kana: string;
  romaji: string;
  meaning: string;
  difficulty: Difficulty;
  /** 原始分類；載入時會用 `canonicalCategory()` 轉成正式分類表。 */
  category: string;
  partOfSpeech: string;
  /** 明列的替代拼法，避免玩家輸入正確卻被判定錯誤。 */
  acceptedAnswers?: string[];
  /** 答對後才顯示的用例；多用於多重語意的口語表現。 */
  example?: string;
}

export const WORD_SEEDS: WordSeed[] = [
  // ==================== A. 日常生活（10）====================
  { japanese: "朝", kana: "あさ", romaji: "asa", meaning: "早晨", difficulty: "N5", category: "日常生活", partOfSpeech: "名詞" },
  { japanese: "洗濯", kana: "せんたく", romaji: "sentaku", meaning: "洗衣服、洗滌", difficulty: "N4", category: "日常生活", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "掃除", kana: "そうじ", romaji: "souji", meaning: "打掃、清潔", difficulty: "N4", category: "日常生活", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "約束", kana: "やくそく", romaji: "yakusoku", meaning: "約定、約會", difficulty: "N4", category: "日常生活", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "予定", kana: "よてい", romaji: "yotei", meaning: "預定、計畫", difficulty: "N4", category: "日常生活", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "準備", kana: "じゅんび", romaji: "junbi", meaning: "準備", difficulty: "N4", category: "日常生活", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "忘れ物", kana: "わすれもの", romaji: "wasuremono", meaning: "遺忘的物品", difficulty: "N3", category: "日常生活", partOfSpeech: "名詞" },
  { japanese: "片付ける", kana: "かたづける", romaji: "katazukeru", meaning: "整理、收拾", difficulty: "N4", category: "日常生活", partOfSpeech: "動詞" },
  { japanese: "間に合う", kana: "まにあう", romaji: "maniau", meaning: "來得及、趕得上", difficulty: "N3", category: "日常生活", partOfSpeech: "動詞" },
  { japanese: "節約", kana: "せつやく", romaji: "setsuyaku", meaning: "節約", difficulty: "N3", category: "日常生活", partOfSpeech: "名詞・サ変動詞" },

  // ==================== B. 交通與旅行（10）====================
  { japanese: "駅", kana: "えき", romaji: "eki", meaning: "車站", difficulty: "N5", category: "交通", partOfSpeech: "名詞" },
  { japanese: "切符", kana: "きっぷ", romaji: "kippu", meaning: "車票", difficulty: "N5", category: "交通", partOfSpeech: "名詞" },
  { japanese: "電車", kana: "でんしゃ", romaji: "densha", meaning: "電車", difficulty: "N5", category: "交通", partOfSpeech: "名詞" },
  { japanese: "乗り換え", kana: "のりかえ", romaji: "norikae", meaning: "轉乘", difficulty: "N4", category: "交通", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "改札口", kana: "かいさつぐち", romaji: "kaisatsuguchi", meaning: "驗票口、閘口", difficulty: "N3", category: "交通", partOfSpeech: "名詞" },
  { japanese: "片道", kana: "かたみち", romaji: "katamichi", meaning: "單程", difficulty: "N3", category: "交通", partOfSpeech: "名詞" },
  { japanese: "終電", kana: "しゅうでん", romaji: "shuuden", meaning: "末班電車", difficulty: "N3", category: "交通", partOfSpeech: "名詞" },
  { japanese: "遅延", kana: "ちえん", romaji: "chien", meaning: "延誤、延遲", difficulty: "N2", category: "交通", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "渋滞", kana: "じゅうたい", romaji: "juutai", meaning: "塞車、交通堵塞", difficulty: "N3", category: "交通", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "迂回", kana: "うかい", romaji: "ukai", meaning: "繞道、迂迴", difficulty: "N2", category: "交通", partOfSpeech: "名詞・サ変動詞" },

  // ==================== C. 食物與飲食（10）====================
  { japanese: "水", kana: "みず", romaji: "mizu", meaning: "水", difficulty: "N5", category: "食物", partOfSpeech: "名詞" },
  { japanese: "野菜", kana: "やさい", romaji: "yasai", meaning: "蔬菜", difficulty: "N5", category: "食物", partOfSpeech: "名詞" },
  { japanese: "果物", kana: "くだもの", romaji: "kudamono", meaning: "水果", difficulty: "N5", category: "食物", partOfSpeech: "名詞" },
  { japanese: "注文", kana: "ちゅうもん", romaji: "chuumon", meaning: "點餐、訂購", difficulty: "N4", category: "食物", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "弁当", kana: "べんとう", romaji: "bentou", meaning: "便當", difficulty: "N4", category: "食物", partOfSpeech: "名詞" },
  { japanese: "食べ放題", kana: "たべほうだい", romaji: "tabehoudai", meaning: "吃到飽", difficulty: "N3", category: "食物", partOfSpeech: "名詞" },
  { japanese: "賞味期限", kana: "しょうみきげん", romaji: "shoumikigen", meaning: "最佳賞味期限", difficulty: "N2", category: "食物", partOfSpeech: "名詞" },
  { japanese: "食欲", kana: "しょくよく", romaji: "shokuyoku", meaning: "食慾", difficulty: "N3", category: "食物", partOfSpeech: "名詞" },
  { japanese: "香ばしい", kana: "こうばしい", romaji: "koubashii", meaning: "香氣濃郁、烘烤香", difficulty: "N2", category: "食物", partOfSpeech: "形容詞", acceptedAnswers: ["kobashii"] },
  { japanese: "栄養", kana: "えいよう", romaji: "eiyou", meaning: "營養", difficulty: "N3", category: "食物", partOfSpeech: "名詞・サ変動詞" },

  // ==================== D. 動物與自然生態（10）====================
  { japanese: "猫", kana: "ねこ", romaji: "neko", meaning: "貓", difficulty: "N5", category: "動物", partOfSpeech: "名詞" },
  { japanese: "犬", kana: "いぬ", romaji: "inu", meaning: "狗", difficulty: "N5", category: "動物", partOfSpeech: "名詞" },
  { japanese: "鳥", kana: "とり", romaji: "tori", meaning: "鳥", difficulty: "N5", category: "動物", partOfSpeech: "名詞" },
  { japanese: "魚", kana: "さかな", romaji: "sakana", meaning: "魚", difficulty: "N5", category: "動物", partOfSpeech: "名詞" },
  { japanese: "飼い主", kana: "かいぬし", romaji: "kainushi", meaning: "飼主", difficulty: "N3", category: "動物", partOfSpeech: "名詞" },
  { japanese: "野生", kana: "やせい", romaji: "yasei", meaning: "野生", difficulty: "N3", category: "動物", partOfSpeech: "名詞・ナ形容詞" },
  { japanese: "群れ", kana: "むれ", romaji: "mure", meaning: "群體、獸群", difficulty: "N2", category: "動物", partOfSpeech: "名詞" },
  { japanese: "絶滅", kana: "ぜつめつ", romaji: "zetsumetsu", meaning: "滅絕", difficulty: "N2", category: "動物", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "生態系", kana: "せいたいけい", romaji: "seitaikei", meaning: "生態系統", difficulty: "N1", category: "動物", partOfSpeech: "名詞" },
  { japanese: "保護", kana: "ほご", romaji: "hogo", meaning: "保護", difficulty: "N3", category: "動物", partOfSpeech: "名詞・サ変動詞" },

  // ==================== E. 學校與工作（10）====================
  { japanese: "授業", kana: "じゅぎょう", romaji: "jugyou", meaning: "課程、上課", difficulty: "N5", category: "學校", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "宿題", kana: "しゅくだい", romaji: "shukudai", meaning: "作業、家庭作業", difficulty: "N5", category: "學校", partOfSpeech: "名詞" },
  { japanese: "試験", kana: "しけん", romaji: "shiken", meaning: "考試", difficulty: "N4", category: "學校", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "復習", kana: "ふくしゅう", romaji: "fukushuu", meaning: "複習", difficulty: "N4", category: "學校", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "課題", kana: "かだい", romaji: "kadai", meaning: "課題、作業", difficulty: "N3", category: "學校", partOfSpeech: "名詞" },
  { japanese: "提出", kana: "ていしゅつ", romaji: "teishutsu", meaning: "提交、繳交", difficulty: "N3", category: "學校", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "締め切り", kana: "しめきり", romaji: "shimekiri", meaning: "截止期限", difficulty: "N2", category: "學校", partOfSpeech: "名詞" },
  { japanese: "会議", kana: "かいぎ", romaji: "kaigi", meaning: "會議", difficulty: "N4", category: "學校", partOfSpeech: "名詞" },
  { japanese: "報告", kana: "ほうこく", romaji: "houkoku", meaning: "報告", difficulty: "N3", category: "學校", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "効率", kana: "こうりつ", romaji: "kouritsu", meaning: "效率", difficulty: "N2", category: "學校", partOfSpeech: "名詞" },

  // ==================== F. 居家與健康（10）====================
  { japanese: "部屋", kana: "へや", romaji: "heya", meaning: "房間", difficulty: "N5", category: "居家與健康", partOfSpeech: "名詞" },
  { japanese: "台所", kana: "だいどころ", romaji: "daidokoro", meaning: "廚房", difficulty: "N4", category: "居家與健康", partOfSpeech: "名詞" },
  { japanese: "冷蔵庫", kana: "れいぞうこ", romaji: "reizouko", meaning: "冰箱", difficulty: "N4", category: "居家與健康", partOfSpeech: "名詞" },
  { japanese: "充電", kana: "じゅうでん", romaji: "juuden", meaning: "充電", difficulty: "N4", category: "居家與健康", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "体調", kana: "たいちょう", romaji: "taichou", meaning: "身體狀況", difficulty: "N3", category: "居家與健康", partOfSpeech: "名詞" },
  { japanese: "睡眠", kana: "すいみん", romaji: "suimin", meaning: "睡眠", difficulty: "N3", category: "居家與健康", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "症状", kana: "しょうじょう", romaji: "shoujou", meaning: "症狀", difficulty: "N3", category: "居家與健康", partOfSpeech: "名詞" },
  { japanese: "診察", kana: "しんさつ", romaji: "shinsatsu", meaning: "診察", difficulty: "N3", category: "居家與健康", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "予防", kana: "よぼう", romaji: "yobou", meaning: "預防", difficulty: "N3", category: "居家與健康", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "回復", kana: "かいふく", romaji: "kaifuku", meaning: "恢復、康復", difficulty: "N2", category: "居家與健康", partOfSpeech: "名詞・サ変動詞" },

  // ==================== G. 情緒與溝通（10）====================
  { japanese: "安心", kana: "あんしん", romaji: "anshin", meaning: "放心、安心", difficulty: "N4", category: "情緒", partOfSpeech: "名詞・ナ形容詞" },
  { japanese: "緊張", kana: "きんちょう", romaji: "kinchou", meaning: "緊張", difficulty: "N3", category: "情緒", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "悔しい", kana: "くやしい", romaji: "kuyashii", meaning: "不甘心、懊悔", difficulty: "N3", category: "情緒", partOfSpeech: "形容詞" },
  { japanese: "懐かしい", kana: "なつかしい", romaji: "natsukashii", meaning: "懷念、令人感到熟悉", difficulty: "N3", category: "情緒", partOfSpeech: "形容詞" },
  { japanese: "気まずい", kana: "きまずい", romaji: "kimazui", meaning: "尷尬、難為情", difficulty: "N2", category: "情緒", partOfSpeech: "形容詞" },
  { japanese: "戸惑う", kana: "とまどう", romaji: "tomadou", meaning: "困惑、不知所措", difficulty: "N2", category: "情緒", partOfSpeech: "動詞" },
  { japanese: "落ち着く", kana: "おちつく", romaji: "ochitsuku", meaning: "冷靜、平靜下來", difficulty: "N3", category: "情緒", partOfSpeech: "動詞" },
  { japanese: "納得", kana: "なっとく", romaji: "nattoku", meaning: "理解並接受、信服", difficulty: "N3", category: "情緒", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "配慮", kana: "はいりょ", romaji: "hairyo", meaning: "顧慮、體貼、考量", difficulty: "N2", category: "情緒", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "ためらう", kana: "ためらう", romaji: "tamerau", meaning: "猶豫", difficulty: "N2", category: "情緒", partOfSpeech: "動詞" },

  // ==================== H. 科技與數位生活（10）====================
  { japanese: "携帯", kana: "けいたい", romaji: "keitai", meaning: "手機、行動電話", difficulty: "N4", category: "科技", partOfSpeech: "名詞" },
  { japanese: "設定", kana: "せってい", romaji: "settei", meaning: "設定", difficulty: "N3", category: "科技", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "通知", kana: "つうち", romaji: "tsuuchi", meaning: "通知", difficulty: "N3", category: "科技", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "保存", kana: "ほぞん", romaji: "hozon", meaning: "儲存、保存", difficulty: "N3", category: "科技", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "再起動", kana: "さいきどう", romaji: "saikidou", meaning: "重新啟動", difficulty: "N2", category: "科技", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "不具合", kana: "ふぐあい", romaji: "fugiai", meaning: "故障、異常、不正常狀況", difficulty: "N2", category: "科技", partOfSpeech: "名詞" },
  { japanese: "互換性", kana: "ごかんせい", romaji: "gokansei", meaning: "相容性", difficulty: "N1", category: "科技", partOfSpeech: "名詞" },
  { japanese: "更新", kana: "こうしん", romaji: "koushin", meaning: "更新", difficulty: "N3", category: "科技", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "接続", kana: "せつぞく", romaji: "setsuzoku", meaning: "連接、連線", difficulty: "N3", category: "科技", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "効率化", kana: "こうりつか", romaji: "kouritsuka", meaning: "提升效率、效率化", difficulty: "N1", category: "科技", partOfSpeech: "名詞" },

  // ==================== I. 天氣與環境（10）====================
  { japanese: "天気", kana: "てんき", romaji: "tenki", meaning: "天氣", difficulty: "N5", category: "天氣", partOfSpeech: "名詞" },
  { japanese: "雨", kana: "あめ", romaji: "ame", meaning: "雨", difficulty: "N5", category: "天氣", partOfSpeech: "名詞" },
  { japanese: "台風", kana: "たいふう", romaji: "taifuu", meaning: "颱風", difficulty: "N4", category: "天氣", partOfSpeech: "名詞" },
  { japanese: "気温", kana: "きおん", romaji: "kion", meaning: "氣溫", difficulty: "N3", category: "天氣", partOfSpeech: "名詞" },
  { japanese: "湿度", kana: "しつど", romaji: "shitsudo", meaning: "濕度", difficulty: "N3", category: "天氣", partOfSpeech: "名詞" },
  { japanese: "降水確率", kana: "こうすいかくりつ", romaji: "kousui kakuritsu", meaning: "降雨機率", difficulty: "N2", category: "天氣", partOfSpeech: "名詞", acceptedAnswers: ["kousuikakuritsu"] },
  { japanese: "洪水", kana: "こうずい", romaji: "kouzui", meaning: "洪水", difficulty: "N2", category: "天氣", partOfSpeech: "名詞" },
  { japanese: "避難", kana: "ひなん", romaji: "hinan", meaning: "避難", difficulty: "N2", category: "天氣", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "自然災害", kana: "しぜんさいがい", romaji: "shizen saigai", meaning: "自然災害", difficulty: "N2", category: "天氣", partOfSpeech: "名詞", acceptedAnswers: ["shizensaigai"] },
  { japanese: "再生可能エネルギー", kana: "さいせいかのうえねるぎー", romaji: "saisei kanou enerugii", meaning: "再生能源", difficulty: "N1", category: "環境", partOfSpeech: "名詞", acceptedAnswers: ["renewable energy"] },

  // ==================== J. 抽象詞彙與進階表現（10）====================
  { japanese: "矛盾", kana: "むじゅん", romaji: "mujun", meaning: "矛盾", difficulty: "N2", category: "抽象詞彙", partOfSpeech: "名詞" },
  { japanese: "懸念", kana: "けねん", romaji: "kenen", meaning: "憂慮、擔憂", difficulty: "N1", category: "抽象詞彙", partOfSpeech: "名詞" },
  { japanese: "促進", kana: "そくしん", romaji: "sokushin", meaning: "促進", difficulty: "N2", category: "抽象詞彙", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "妥協", kana: "だきょう", romaji: "dakyou", meaning: "妥協", difficulty: "N1", category: "抽象詞彙", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "踏まえる", kana: "ふまえる", romaji: "fumaeru", meaning: "依據、考量、立足於", difficulty: "N1", category: "抽象詞彙", partOfSpeech: "動詞" },
  { japanese: "見落とす", kana: "みおとす", romaji: "miotosu", meaning: "遺漏、忽略、看漏", difficulty: "N2", category: "抽象詞彙", partOfSpeech: "動詞" },
  { japanese: "取り組む", kana: "とりくむ", romaji: "torikumu", meaning: "致力於、著手處理", difficulty: "N3", category: "抽象詞彙", partOfSpeech: "動詞" },
  { japanese: "考慮", kana: "こうりょ", romaji: "kouryo", meaning: "考量", difficulty: "N2", category: "抽象詞彙", partOfSpeech: "名詞・サ変動詞" },
  { japanese: "見直す", kana: "みなおす", romaji: "minaosu", meaning: "重新檢視、重新評估", difficulty: "N3", category: "抽象詞彙", partOfSpeech: "動詞" },
  { japanese: "打開策", kana: "だかいさく", romaji: "dakaisaku", meaning: "突破困境的對策", difficulty: "N1", category: "抽象詞彙", partOfSpeech: "名詞" },

  // ==================== 慣用表現與口語（10）====================
  {
    japanese: "空気を読む",
    kana: "くうきをよむ",
    romaji: "kuuki o yomu",
    meaning: "察言觀色、讀懂現場氣氛（不把話講明白而配合場合）",
    difficulty: "N2",
    category: "慣用表現",
    partOfSpeech: "慣用句・動詞",
    example: "新人はまだ慣れないので、会議ではよく空気を読む。",
    acceptedAnswers: ["くうきよむ"],
  },
  {
    japanese: "手を抜く",
    kana: "てをぬく",
    romaji: "te o nuku",
    meaning: "偷懶、敷衍了事、偷工減料",
    difficulty: "N2",
    category: "慣用表現",
    partOfSpeech: "慣用句・動詞",
  },
  {
    japanese: "目が回る",
    kana: "めがまわる",
    romaji: "me ga mawaru",
    meaning: "忙得暈頭轉向、忙不過來",
    difficulty: "N3",
    category: "慣用表現",
    partOfSpeech: "慣用句・表現",
    example: "締め切りが近くて、目が回るほど忙しい。",
    
  },
  {
    japanese: "一石二鳥",
    kana: "いっせきにちょう",
    romaji: "isseki nichou",
    meaning: "一石二鳥、一舉兩得",
    difficulty: "N2",
    category: "四字熟語",
    partOfSpeech: "名詞",
    acceptedAnswers: ["いっせきに鳥", "issekinichou"],
  },
  {
    japanese: "気がする",
    kana: "きがする",
    romaji: "ki ga suru",
    meaning: "覺得、感覺好像（不確定的推斷）",
    difficulty: "N4",
    category: "慣用表現",
    partOfSpeech: "慣用句・表現",
    example: "今日は何となくいいことがありそうな気がする。",
    
  },
  {
    japanese: "話が弾む",
    kana: "はなしがはずむ",
    romaji: "hanashi ga hazumu",
    meaning: "聊得起勁、談話熱絡起來",
    difficulty: "N2",
    category: "慣用表現",
    partOfSpeech: "慣用句・表現",
    example: "共通の趣味が見つかると、自然に話が弾みます。",
    acceptedAnswers: ["はなしが弾む"],
  },
  {
    japanese: "しょうがない",
    kana: "しょうがない",
    romaji: "shouganai",
    meaning: "沒辦法、只好如此（口語的放棄、認了）",
    difficulty: "N3",
    category: "口語",
    partOfSpeech: "副詞・慣用句",
    example: "雨で試合が中止になったけど、天気のことだからしょうがない。",
  },
  {
    // 多重語意：不提供單一翻譯，改以使用情境說明。
    japanese: "やばい",
    kana: "やばい",
    romaji: "yabai",
    meaning: "依語境而異：情況很糟、不得了、靠不住；也可指非常厲害、很棒",
    difficulty: "N3",
    category: "口語／俚語",
    partOfSpeech: "形容詞（口語）",
    example: "もう終電が出たの？それはやばい！（情況糟糕）／この店のラーメン、やばい！（超好吃）",
  },
  {
    japanese: "めっちゃ",
    kana: "めっちゃ",
    romaji: "meccha",
    meaning: "非常、超級（大阪等關西地區的口語強化詞）",
    difficulty: "N3",
    category: "口語／俚語",
    partOfSpeech: "副詞（口語）",
    example: "この店のラーメン、めっちゃおいしい！",
  },
  {
    japanese: "お疲れ様",
    kana: "おつかれさま",
    romaji: "otsukaresama",
    meaning: "辛苦了（慰勞或日常打招呼）",
    difficulty: "N4",
    category: "慣用表現",
    partOfSpeech: "挨拶",
    example: "仕事を終えた同僚に「お疲れ様です」と声をかけました。",
    acceptedAnswers: ["otsukare", "お疲れ様です"],
  },
];

/** 種子題庫自我描述：100 個單字 + 10 個慣用表現／口語。 */
export const WORD_SEED_COUNTS = {
  words: 100,
  expressions: 10,
  total: WORD_SEEDS.length,
} as const;