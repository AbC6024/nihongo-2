# 資料來源、授權與限制說明

本文件記錄《聞いボード》目前使用與可以使用的資料來源。
**原則：未確認授權的資料一律不匯入，也不宣稱已取得。**

取得日期：2026-10-12（本專案建立日）

---

## 1. 內建詞彙（`src/data/words.ts`、`src/data/sentences.ts`）

| 項目 | 說明 |
| --- | --- |
| 來源 | 本專案自行撰寫的示範詞彙與示範句子 |
| 授權 | 由本專案作者撰寫，可自由使用與修改 |
| `source` 欄位值 | `original-sample`、`seed-expansion`、`original-sample+seed-expansion` |
| 規模 | **178 個單字**（N5:35／N4:36／N3:51／N2:40／N1:16）、**67 個句子**（N5:8／N4:15／N3:23／N2:19／N1:2） |
| アクセント | **全部未驗證**（`accentVerified: false`，`accentType: "unknown"`） |
| 音檔 | **沒有音檔**（`audio: null`），使用瀏覽器 Web Speech API（`ja-JP`）機器語音 |
| 圖片 | **沒有圖片**（`image: null`） |

### 1.1 種子題庫（本次新增）

| 項目 | 說明 |
| --- | --- |
| 檔案 | `src/data/wordSeeds.ts`（110 筆）、`src/data/sentenceSeeds.ts`（46 筆） |
| 來源 | 由專案需求方提供的詞彙／例句表，由本專案轉成既有型別 |
| 授權 | 與本專案一併撰寫，可自由使用與修改 |
| 單字 | 100 個（10 組主題 × 10） |
| 慣用表現／口語 | 10 個（空気を読む、手を抜く、目が回る、一石二鳥、気がする、話が弾む、しょうがない、やばい、めっちゃ、お疲れ様） |
| 句子 | 46 道（S001～S046） |
| 與既有題庫重疊 | 20 筆單字以 \`japanese\` 合併，**沿用原 ID**，不產生重複題目 |
| 音檔／圖片 | **同樣沒有**：\`audio: null\`、\`image: null\` |

### 1.2 難度分級的性質（重要）

題目上的 \`N5\`～\`N1\` 是**教學用途的建議分級**，用來讓玩家挑戰難度，
**並非官方 JLPT 完整詞彙表，也未經任何官方認證或查核**。

- 不宣稱任何題目符合官方 JLPT 詞彙表。
- \`accentVerified\` 一律 \`false\`：聲調尚未人工查核，
  **不宣稱符合 OJAD アクセント**。
- 分級若與官方標準有出入，應以官方資料為準。

### 1.3 本次修正的既有資料錯誤

題庫驗證（\`npm run validate:bank\`）在既有示範句子中抓到兩處錯誤，已修正：

| 題目 ID | 問題 | 修正 |
| --- | --- | --- |
| \`s-hajimari-photo\` | 答案寫成「はじめ」，但完整句是「旅行の**はじまり**に」 | 答案與假名改為「はじまり」 |
| \`s-gakuteki-so\` | 答案寫成「画的」，但完整句是「この対策は**画期的**だと」 | 答案改為「画期的」 |

這兩處原本會讓玩家輸入「はじまり」或「画期的」時被判定錯誤。

### 為什麼不用 Nihongo to Japan 的詞彙清單？

參考網站：<https://www.nihongotojapan.com/vocab/>

該網站的詞彙列表屬於網站原創內容。本專案**未確認**其授權條款允許批次複製、
改寫後再散布，因此：

- **沒有**批次複製、抓取或硬編碼該網站的詞彙清單。
- **沒有**複製其解說文章、例句或網站 UI。
- 若日後確認可合法使用，應透過下方的 JSON／CSV 匯入器匯入，並在本文件補上來源與授權。

---

## 2. 詞彙匯入流程

實作：`src/services/vocabularyImporter.ts`（`importVocabulary(text, existing)`）

支援格式：

- **JSON**：詞彙陣列，或 `{ "words": [...] }`。
- **CSV**：第一行為標題，支援引號包住含逗號／換行的欄位。

必填欄位：`japanese`、`kana`、`romaji`、`difficulty`（N5／N4／N3／N2／N1）。

選填欄位：`id`、`meaning`、`script`、`category`、`partOfSpeech`、`acceptedAnswers`、
`example`、`audio`、`image`、`imageKeyword`、`imageSource`、`imageLicenseNote`、
`accentType`、`accentPattern`、`accentSource`、`accentVerified`、`audioSource`、
`audioVerified`、`source`。

匯入器會：

- 驗證必填欄位與 difficulty 值。
- 檢查與既有題庫重複的 ID 與詞彙（`japanese` 不分大小寫）。
- 檢查匯入內容內部的重複。
- 產生 `ImportReport`：成功筆數、略過筆數、每筆錯誤的行號與原因、重複清單。

**安全注意：** 匯入的 `accentVerified` / `audioVerified` 只有在資料中明確標記為
true 時才會被信任。預設全部視為未驗證。

示範資料：`public/data/vocabulary.sample.json`（7 筆，確保沒有外部資料也能遊玩）。

### 日後要匯入公開資料時

若要採用 JMdict 等有清楚授權的公開資料：

1. 記錄資料來源名稱、版本、授權條款名稱與網址。
2. 保留原始 attribution；若有 share-alike 要求，需在產品內與本文件標明。
3. 以匯入器匯入，不要硬編碼到 React 元件。
4. 更新本文件的表格並填入匯入日期。

---

## 3. 音檔與アクセント

參考來源：OJAD <https://www.gavo.t.u-tokyo.ac.jp/ojad/zho/pages/home>

| 項目 | 現況 |
| --- | --- |
| 已授權真人錄音 | **無** |
| OJAD 音檔 | **未使用**。沒有批次下載，也沒有鏡像 OJAD 音檔 |
| アクセント資料 | **無**。所有題目 `accentType: "unknown"`、`accentVerified: false` |
| 實際使用的音聲 | 瀏覽器 Web Speech API，`lang = "ja-JP"` 的**機器語音** |
| AI 語音語速 | 音拍 ≤ 3 的短單字使用基準語速 × 0.75；句子與長單字維持基準語速（0.95）。規則可在遊戲設定調整，**只影響 AI 合成語音**，外部／真人音檔不受影響。 |

音聲優先順序（`src/services/speech.ts`）：

1. 題目資料中 `audio` 欄位指定的已授權音檔（需在設定中開啟「使用音檔」）。
2. Web Speech API（`ja-JP`）機器語音作為 fallback。

**重要限制：**

- Web Speech API 是瀏覽器／作業系統的合成語音，**不能宣稱**自動符合 OJAD 的アクセント。
- 在完成實際查核前，UI 一律顯示「机器語音」與「アクセント確認中」。
- 只有人工查核後才能把 `accentVerified` 設為 `true`。
- `audioVerified` 只有在音檔與目標詞彙的發音／アクセント都確認過後才設為 `true`。

播放失敗處理（不中斷遊戲）：

- 遠端音檔載入失敗或播放錯誤 → 自動改用 TTS。
- 瀏覽器不支援 `speechSynthesis` → 顯示提示並允許繼續作答。
- 每題開始播放前先 `cancel()` 上一段語音，避免多個語音重疊。

---

## 4. 圖片

參考網站：いらすとや <https://www.irasutoya.com/>

| 項目 | 現況 |
| --- | --- |
| 已匯入圖片 | **無**。所有題目 `image: null` |
| 圖片來源欄位 | `image`、`imageKeyword`、`imageSource`、`imageLicenseNote`（schema 已支援） |
| 圖片載入策略 | `imageMode`：`local`／`remote`／`disabled`（可在設定切換） |

規則：

- **未**批次爬取或下載整個圖片庫。
- **未**複製 いらすとや 或任何其他網站的圖片到本專案。
- 圖片必須由人工逐筆確認語意是否相符、來源網址與授權備註後，才填入題目資料。
- 確認使用方式符合網站目前條款與商用／再散布限制。
- 沒有明確授權確認前，**假設免費不代表可任意再散布**，因此本專案未使用任何圖片。
- 圖片可能直接洩漏答案，預設 `showImageHintDuringPlay: false`，只在答後／複習／錯題本顯示。
- 圖片載入失敗時隱藏圖片區域，不中斷遊戲流程。

---

## 5. 資料保存

`src/services/storage.ts`，所有 localStorage 存取集中在此。

| Key | 內容 | Schema |
| --- | --- | --- |
| `niiki.meta` | `{ schemaVersion, createdAt }` | 3 |
| `niiki.settings` | 遊戲設定（時間、輸入方式、難度、分類、揭示時間等） | 3 |
| `niiki.mistakes` | 錯題本 `Record<questionId, MistakeEntry>` | 3 |
| `niiki.attempts` | 逐題作答紀錄 `QuestionAttempt[]` | 3 |
| `niiki.games` | 逐局統計 `GameRecord[]` | 3 |
| `niiki.daily` | 每日挑戰紀錄（勝場、連勝、各日最佳分數、各日題目） | 3 |
| `niiki.customWords` | 使用者匯入的詞彙 | 3 |
| `niiki.profile` | 玩家個人檔案（暱稱、頭像） | 3 |

遷移處理：

- `v1 → v2`：錯題本由陣列格式遷移為以 `questionId` 為 key 的物件。
- `v2 → v3`：由 `dailyBestScoreByDate` 的鍵推導 `completedDates`、`bestStreak`。
- 載入時逐 key 驗證；單一 key 內容損毀會被移除並回退預設值，不影響其他資料。
- `localStorage` 無法讀寫時顯示明確提示，遊戲仍可進行但不會保存紀錄。

---

## 6. 介面語言

翻譯文字全部由本專案撰寫（介面用語），存放於 `src/i18n/locales/`：

| 檔案 | 語言 | 鍵值數 |
| --- | --- | --- |
| `zh-TW.ts` | 中文（繁體中文，預設） | 238 |
| `ja.ts` | 日本語 | 238 |
| `en.ts` | English | 238 |

- 翻譯只涵蓋**介面文字**。題目資料本身（`japanese`、`kana`、`meaning`、分類名稱）屬於**學習內容**，維持繁體中文，不隨介面語言改變。
- 語言選擇存於 `localStorage` 的 `niiki.settings.language`（`zh-TW` / `ja` / `en`）。
- 切換語言只會更新介面文字與 `<html lang>`，**不會**清除錯題本、遊玩紀錄、每日挑戰紀錄或其他設定。
- `src/i18n/i18n.test.ts` 會檢查三種語言的鍵值完全一致、沒有空白翻譯，且佔位符沒有拼錯。

---

## 7. 音效素材

| 項目 | 現況 |
| --- | --- |
| 已匯入的第三方音效檔 | **無**。`public/audio/sfx/` 內目前沒有任何音檔 |
| 實際使用的音效 | Web Audio API **即時合成**（`src/services/sfx.ts`），無外部檔案 |
| 授權風險 | 無（由本專案程式產生） |
| 檔案體積增加 | 0 KB |

理由：無法在此環境確認 Pixaday 等免費音效來源的授權條款
（商業用途、再散布、是否需標示作者），在未確認前散布不負責任，
因此**沒有假裝外部音效已匯入**。

來源紀錄與日後換用實體音檔的步驟請見 `public/audio/sfx/README.md`。

---

## 8. 介面翻譯與品牌名稱

| 項目 | 說明 |
| --- | --- |
| 翻譯文字 | 本專案撰寫的介面用語，存放於 `src/i18n/locales/` |
| 題目資料 | `japanese` / `kana` / `meaning` / 分類名稱屬於**學習內容**，維持繁體中文，不隨介面語言改變 |
| 品牌名稱 | 《聞いボード》是固定品牌名稱，定義於 `src/i18n/brand.ts`，**不在翻譯字典中**，三種語言下都不改變 |

---

## 9. 發行檔案與離線內容

桌機版（`release/聞いボード-Setup.exe`、`聞いボード-Portable.exe`）
把下列項目封裝進執行檔：

| 內容 | 授權狀態 |
| --- | --- |
| 內建詞彙與例句 | 自行撰寫（`original-sample`） |
| 介面圖示（PWA / Windows） | 由 `scripts/generate-icons.mjs` 程式產生，無授權負擔 |
| 介面音效 | Web Audio API 即時合成，無外部檔案 |
| PWA manifest 與 Service Worker | 自行撰寫 |
| React / Vite / Electron 等工具 | MIT 等自由授權，只在建置階段使用 |

**下載檔案「未」內含**任何第三方詞彙、音檔、圖片或音效素材。
詳見 `release/THIRD-PARTY-NOTICES.txt`（由 `npm run release:notes` 產生）。

### 離線範圍（不假裝完全離線）

- **可離線**：遊戲程式、題庫、介面、圖示、音效、錯題本與學習分析。
- **需要網路或系統資源**：
  - 題目的日文 AI 語音使用瀏覽器／作業系統的語音引擎（Windows、macOS、
    iOS、Android）。若裝置沒有安裝日文語音，遊戲會顯示明確提示，
    **其他功能不受影響**。
  - 使用者自行匯入、外部來源的詞彙或圖片需要網路。
- 程式碼中沒有任何指向外部網址的請求、遙測或分析功能。

---

## 10. 尚未完成、需要授權資料才能繼續的事項


| 項目 | 需要的東西 |
| --- | --- |
| 正式詞庫 | 使用者自行取得的詞彙 JSON／CSV（含授權），或確認 Nihongo to Japan 的授權條件 |
| 真人音檔 | 已獲授權的日文錄音檔案與對應授權條款 |
| アクセント資料 | 人工查核流程與查核結果（目前全部標記為未驗證） |
| 圖片 | 人工逐筆確認的圖片與來源／授權備註（目前完全沒有使用） |