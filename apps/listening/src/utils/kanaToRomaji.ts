/**
 * 假名 → 羅馬字轉換器。
 *
 * 用途：《みんなの日本語》JSON 題庫沒有 romaji 欄位，此模組從 `reading`
 *（假名）自動產生羅馬字，供羅馬字輸入模式的答案判定使用。
 *
 * 轉換規則：
 * 1. 片假名先轉平假名。
 * 2. 促音（っ）讓下一個子音雙寫（例如 かって → katte）。
 * 3. 拗音（ゃ/ゅ/ょ）與前一個 i 段假名合併（例如 きょう → kyou）。
 * 4. 撥音（ん）輸出 "n"（或 "m" 視下一個字母而定，此處統一為 "n"）。
 * 5. 長音符（ー）延長前一個母音（例如 とうきょう → toukyou）。
 * 6. 反覆記號（ゝ、ゞ、々）不轉換，保留原字。
 *
 * 注意：此為教材用簡易轉換，可能無法覆蓋所有邊緣案例，但涵蓋題庫中
 * 絕大部分常見讀音。
 */

const KATAKANA_TO_HIRAGANA: Record<string, string> = {};
for (let i = 0; i < 46; i += 1) {
  const kata = String.fromCharCode(0x30a1 + i);
  const hira = String.fromCharCode(0x3041 + i);
  KATAKANA_TO_HIRAGANA[kata] = hira;
}
KATAKANA_TO_HIRAGANA["ー"] = "ー";
KATAKANA_TO_HIRAGANA["ヮ"] = "ゎ";

/** 片假名轉平假名。 */
function katakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    out += KATAKANA_TO_HIRAGANA[ch] ?? ch;
  }
  return out;
}

/** 單一平假名的羅馬字。 */
const SINGLE_KANA: Record<string, string> = {
  // あ行
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  // か行
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  // さ行
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  // た行
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  // な行
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  // は行
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  // ま行
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  // や行
  や: "ya", ゆ: "yu", よ: "yo",
  // ら行
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  // わ行
  わ: "wa", を: "o", ん: "n",
  // が行
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  // ざ行
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  // だ行
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  // ば行
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  // ぱ行
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  // 小假名
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
  っ: "t",
  ゃ: "ya", ゅ: "yu", ょ: "yo",
  ゎ: "wa",
};

/** i 段假名＋拗音的合併對照。 */
const YOON: Record<string, Record<string, string>> = {
  き: { ゃ: "kya", ゅ: "kyu", ょ: "kyo" },
  ぎ: { ゃ: "gya", ゅ: "gyu", ょ: "gyo" },
  し: { ゃ: "sha", ゅ: "shu", ょ: "sho" },
  じ: { ゃ: "ja", ゅ: "ju", ょ: "jo" },
  ち: { ゃ: "cha", ゅ: "chu", ょ: "cho" },
  に: { ゃ: "nya", ゅ: "nyu", ょ: "nyo" },
  ひ: { ゃ: "hya", ゅ: "hyu", ょ: "hyo" },
  び: { ゃ: "bya", ゅ: "byu", ょ: "byo" },
  ぴ: { ゃ: "pya", ゅ: "pyu", ょ: "pyo" },
  み: { ゃ: "mya", ゅ: "myu", ょ: "myo" },
  り: { ゃ: "rya", ゅ: "ryu", ょ: "ryo" },
};

/** 母音延長對照。 */
const LONG_VOWEL: Record<string, string> = {
  a: "ā", i: "ī", u: "ū", e: "ē", o: "ō",
};

/** 輸出用的羅馬字字元（去掉長音符號，轉為雙寫母音）。 */
function toOutputRomaji(key: string): string {
  return key.replace(/ā/g, "aa").replace(/ī/g, "ii").replace(/ū/g, "uu").replace(/ē/g, "ei").replace(/ō/g, "oo");
}

/**
 * 將假名字串轉為羅馬字。
 * @param kana 假名讀音（平假名或片假名）
 * @returns 羅馬字（小寫，無空格）
 */
export function kanaToRomaji(kana: string): string {
  if (!kana) return "";
  const hira = katakanaToHiragana(kana);
  let out = "";
  let i = 0;
  let prevVowel: string | null = null;
  let pendingDouble = false; // 促音導致下一個子音雙寫

  while (i < hira.length) {
    const ch = hira[i];
    const next = hira[i + 1];

    // 反覆記號：保留原字，不轉換
    if (ch === "ゝ" || ch === "ゞ" || ch === "々") {
      out += ch;
      i += 1;
      continue;
    }

    // 長音符：延長前一個母音
    if (ch === "ー") {
      if (prevVowel) {
        out += LONG_VOWEL[prevVowel] ?? prevVowel;
      } else {
        out += "-";
      }
      i += 1;
      continue;
    }

    // 促音：下一個子音雙寫
    if (ch === "っ") {
      pendingDouble = true;
      i += 1;
      continue;
    }

    // 撥音
    if (ch === "ん") {
      out += "n";
      prevVowel = null;
      pendingDouble = false;
      i += 1;
      continue;
    }

    // 拗音：與前一個 i 段假名合併
    if (next && (next === "ゃ" || next === "ゅ" || next === "ょ")) {
      const yoonMap = YOON[ch];
      if (yoonMap) {
        const combined = yoonMap[next];
        if (combined) {
          if (pendingDouble) {
            out += combined[0] + combined; // 雙寫首字母
            pendingDouble = false;
          } else {
            out += combined;
          }
          prevVowel = combined.charAt(combined.length - 1);
          i += 2;
          continue;
        }
      }
    }

    const romaji = SINGLE_KANA[ch];
    if (romaji) {
      // 應用俭音雙寫
      const segment = pendingDouble ? romaji.charAt(0) + romaji : romaji;
      pendingDouble = false;
      out += segment;
      // 記錄最後一個母音（用於長音符）
      const last = segment.charAt(segment.length - 1);
      if ("aeiou".includes(last)) prevVowel = last;
      else prevVowel = null;
      i += 1;
      continue;
    }

    // 未知字符：原樣保留
    out += ch;
    prevVowel = null;
    pendingDouble = false;
    i += 1;
  }

  return toOutputRomaji(out);
}