# 網站整合版本（2026-11-02）

本目錄已套用使用者提供的 `nihonngogame (2).zip` 更新包，使用第 1～12 課單字題庫與新版課次選擇介面，發布在 `/listening/`。原主站導覽、設定入口、進度儲存鍵和各遊戲的快取範圍保留。此版另提供 0.25× 語音速度、答後 Enter 換題，以及每輪最多 10 題的錯題複習；每輪題目固定，避免更新複習次數時重新洗牌。舊題目只供既有錯題本查找，不加入新課次抽題。

在儲存庫根目錄執行 `npm run build:games`，發布檔會輸出至 `listening/`；`npm test --workspace @nihongo/listening` 執行網頁功能測試。這個整合專案不建立 Electron 安裝程式，原更新包中的桌面發布測試不適用；以下保留更新包原說明供參考，較早的模式介紹不代表目前主選單。題庫來源及未驗證的重音標記見 `DATA_SOURCE.md`。

---

# 聞いボード

**聞いて、打って、覚えよう。**

以「聽日文 → 打字 → 得分 → 錯題複習」為核心的響應式日文聽打學習遊戲。
目標是讓玩家利用 1～3 分鐘練習日文聽力、打字與詞彙記憶。

---

## 快速開始

需要 Node.js 18 以上（本專案在 Node 24 上開發）。

```bash
npm install       # 安裝依賴
npm run dev       # 啟動開發伺服器（預設 http://localhost:5173）
npm test          # 執行單元測試與流程煙霧測試
npm run typecheck # TypeScript 型別檢查
npm run build     # 型別檢查 + 正式建置到 dist/
npm run preview   # 預覽正式建置結果
```

Windows PowerShell 若出現 `npm.ps1` 執行原則錯誤，改用 `npm.cmd`：

```bash
npm.cmd install
npm.cmd run dev
```

手機與同一區網的行動裝置：`npm run dev` 啟動後，用手機開啟終端機顯示的
Network 位址即可遊玩。

---

## 遊戲模式

| 模式 | 說明 |
| --- | --- |
| **快速單字** | 限時 1／2／3 分鐘（預設 3 分鐘）聽打單字 |
| **句子填空** | 聽完整句子，輸入挖空的部分 |
| **複習模式** | 依權重優先練習錯題，答案揭示後 10 秒倒數自動下一題 |
| **錯題本** | 播放發音、星號標記重點、單筆刪除、清空（需確認） |
| **今日挑戰** | 固定 10 題、每題 200 分、最高 2000 分、每日勝場與連勝 |
| **我的學習** | 遊玩歷史、正確率、各等級／分類／模式強弱項 |

### 計分規則

- 一般／句子／複習模式：`本題得分 = max(0, 100 - 本題答錯次數 × 10)`
  - 答錯不扣總分，只降低該題之後能取得的分數。
- 一般／句子模式跳過：總分扣 50（最低 0），本題 0 分，`skipCount` +1，加入錯題本。
- 複習模式跳過：**不扣**總分，只記錄 `skipped`（避免懲罰式複習）。
- 今日挑戰：答對 `+200`、答錯不扣分、跳過 `+0`，10 題最高 2000。
  - 前 5 題來自一般題庫，後 5 題優先來自錯題庫，不足時以一般題庫補足。
- 答錯 3 次後才出現「跳過」按鈕；同一題只會結算一次。

### 操作

| 按鍵 | 行為 |
| --- | --- |
| Enter | 送出答案 |
| Space | 重播音聲（**焦點在輸入框時不會觸發**） |
| Esc | 離開本局（需確認） |

行動裝置優先：輸入框與按鈕尺寸適合觸控，送出按鈕與跳過按鈕分開排列以避免誤觸。

---

## AI 語音語速（短單字放慢）

較短、容易被快速唸過的日文單字會自動放慢，讓玩家聽清楚。

- **判定方式**：計算假名的音拍數（モーラ）。
  拗音的小書き（きゃ→1 拍）、小促音（っ＝1 拍）、撥音（ん＝1 拍）、
  長音符（ー＝1 拍）都有正確處理；純漢字算不出音拍時維持基準語速。
- **規則**：音拍 ≤ 3 的單字使用 **基準語速 × 0.75**；4 拍以上維持基準語速。
- **句子不變慢**：完整句子一律使用基準語速。
- **只影響 AI 合成語音**：外部／真人音檔完全不受語速規則影響。
- **可重播一致**：同一題每次重播都使用相同規則，因此語速相同。
- **不支援 rate 時**：忽略設定值，遊戲照常運作。

可在「遊戲設定 → AI 語音語速」調整開關、音拍門檻、慢速倍率與基準語速，
也可以在單一題目資料上用 `speechRate` 覆寫。

---

## 介面語言

支援三種介面語言，語言選單位於**介面右上角**（共用 Header 的最右側），
所有頁面共用同一個 `src/components/LanguageSwitcher.tsx` 元件：

| 語言 | 輸入方式 |
| --- | --- |
| 中文（繁體中文） | 羅馬字 / 假名 |
| 日本語 | ローマ字 / かな |
| English | Romaji / Kana |

- 新使用者預設繁體中文；下拉選單的按鈕文字就是目前選擇的語言名稱。
- 切換後介面**立即更新**，不需要重新整理。
- 選擇會存進 `localStorage`（`niiki.settings.language`），重新整理後沿用。
- 切換語言**不會**清除錯題本、遊玩紀錄、每日挑戰紀錄或其他設定。
- 翻譯文字集中在 `src/i18n/locales/`，元件透過 `useI18n()` 的 `t()` 取得。

---

## 音效

答題時會播放簡短提示音效，協助玩家判斷結果。

| 音效 | 觸發時機 | 長度 |
| --- | --- | --- |
| 答對 `correct` | 答案**確定判定正確**後立即播放 | 約 180 ms |
| 答錯 `wrong` | 判定錯誤時（音量刻意偏低，柔和不刺耳） | 約 220 ms |
| 跳過 `skip` | 跳過**成功結算**後 | 約 130 ms |
| 結算 `gameover` | 限時歸零或今日挑戰完成，一次結算只播一次 | 約 330 ms |

實作重點：

- 音效觸發點在 **`useQuizEngine` 的狀態判定之後**，不是畫面渲染邏輯，
  因此不會因 React 重複渲染或重複送出而連播。
- 音效是 **fire-and-forget**（不 await），不會延遲計分、答案揭示、
  自動跳題或計時器。
- 答錯音效與題目語音之間有 260 ms 間隔，避免兩者重疊刺耳。
- 同一音效有最小播放間隔（`correct` 150 ms、`skip` 220 ms、
  `gameover` 2000 ms），抑制快速連按造成的疊加。
- 音效是 **Web Audio API 即時合成**，沒有任何外部音檔，
  載入失敗機率為 0；不支援 Web Audio 時安靜忽略，不影響答題。
- 音效與題目的日文語音 **完全獨立**：關閉音效不會關閉題目語音。

可在「遊戲設定 → 音效」開關提示音效並調整音量，
設定保存在 `localStorage` 的 `niiki.settings`（`sfxEnabled` / `sfxVolume`）。

> **素材授權**：本專案**沒有匯入任何第三方音效檔案**。
> 原因是無法確認免費音效素材的授權條款是否允許再散布。
> 目前音效為程式即時合成，詳見 `public/audio/sfx/README.md`。

---

## 遊戲標題固定顯示

《聞いボード》是遊戲的**品牌名稱**，不隨介面語言改變：

- 定義於 `src/i18n/brand.ts` 的 `BRAND_TITLE`，**不在 i18n 翻譯字典中**。
- 三個翻譯字典都已移除 `appTitle` 鍵值，日後不會被誤翻譯成
  `Niiki Board` 之類的名稱。
- 分頁標題為 `聞いボード｜<核心文案>`，核心文案隨語言切換，品牌不變。

---

## 個人檔案

首頁**左上角**有個人檔案入口，顯示頭像與暱稱。點擊後進入個人檔案頁，
內含三個分頁：**個人檔案／設定與資料／匯入詞彙**。

### 資料保存

| 項目 | 儲存位置 |
| --- | --- |
| 暱稱 | `localStorage` 的 `niiki.profile` |
| 頭像 | 同上；內建頭像存 ID，自訂圖片存 data URL |
| 自訂圖片上限 | 縮圖到 192×192 JPEG，約 160 KB 以內 |

- 新玩家預設暱稱「玩家」，可自行修改。
- 暱稱會去除前後空白、合併連續空白、移除控制字元與角括號（防止破壞版面）、
  上限 20 字元；**空白暱稱會自動回到預設值**，不會造成介面錯誤。
- 暱稱只作為顯示用途，React 會自動跳脫，不會被當成程式碼執行。
- 上傳圖片限制 PNG／JPEG／WebP／GIF 且不超過 2 MB，會先縮圖再存入，
  避免撐爆 localStorage。**圖片載入失敗時自動退回預設頭像。**
- 自訂頭像若在還原資料時發現損壞或不是 data URL，會自動退回內建頭像。

### 分數紀錄計算規則

全部由**既有的** `GameRecord[]` / `QuestionAttempt[]` / `DailyRecord` 計算，
**不另建第二套資料系統**，避免與學習分析衝突：

| 欄位 | 計算方式 |
| --- | --- |
| 累積遊玩 | `GameRecord` 的筆數 |
| 累積獲得分數 | 各局 `GameRecord.score`（即該局最終分數）加總 |
| 最高單局分數 | 所有 `GameRecord.score` 的最大值 |
| 最近一次分數 | `startedAt` 最新的一局的分數 |
| 累積答題／答對 | `QuestionAttempt` 的筆數統計 |
| 連勝 | 取自 `DailyRecord.currentStreak` / `bestStreak` |

**一局只會有一筆紀錄**，由三層保護：

1. 引擎的 `finishedRef`：`onGameFinished` 每次 session 只觸發一次。
2. 各頁面的 `recordedRef`：結算後立刻鎖定。
3. `AppStore.recordGame` 以 `id` 去重，重複寫入直接忽略。

重新開始遊戲會建立新的 `id`，因此是「新的一局」，不會覆蓋舊紀錄。

### 「設定與資料」已移入個人檔案

首頁底部的「設定與資料」區塊**已移除**，原功能完整保留在
個人檔案 → **設定與資料** 分頁（語言、語速、音效、資料備份、清除資料）。
首頁只把語音提示（SpeechNotice）留在練習設定下方。

---

## 遊戲內語音速度

進入遊戲後，**快捷鍵提示下方**有語音速度選項：

| 選項 | 倍率 | 行為 |
| --- | --- | --- |
| 正常速度 | `1.0×` | 沿用原本語速邏輯，**保留短單字 0.75 倍規則** |
| 慢速 | `0.5×` | 題目語音固定 0.5 倍 |

- **0.5× 是最終播放速度**，不會再乘上短單字的 0.75 倍，
  因此短單字不會變成 0.375×。
- 套用於單字模式、句子模式、複習模式與每日挑戰。
- 只改 `utterance.rate`，**不修改題目文字或答案判斷**。
- 提示音效（答對／答錯／跳過／結算）**不受影響**。
- 切換只影響**下一次播放**；正在播放中的語音不會被強制中斷，避免誤操作。
- 不會重設計時器、不會清除輸入框、不會改變分數。
- 儲存在 `settings.speechSpeed`（`1` 或 `0.5`），
  離開遊戲頁或重新開啟後都會還原；資料損壞或舊版缺漏時安全回到 1.0×。

三種介面語言的翻譯：

| | 中文 | 日文 | English |
| --- | --- | --- | --- |
| 標籤 | 語音速度 | 音声速度 | Speech Speed |
| 正常 | 正常速度 | 通常速度 | Normal Speed |
| 慢速 | 慢速 | 低速 | Slow |

---

## 隨機出題

**所有遊戲模式都採用隨機出題。** 核心邏輯集中在
`src/utils/randomQuestion.ts`，各元件不自行實作隨機。

| 模式 | 做法 |
| --- | --- |
| 單字／句子 | `buildSessionQuestions()`：篩選後整庫洗牌，題目數足夠時整局不重複，數量不足時以洗牌後順序循環 |
| 複習 | `buildWeightedReviewSequence()`：星號 50%／其他錯題 30%／一般題目 20%，缺漏比例自動重分配 |
| 每日挑戰 | `composeDailyQuestionIds()`：前 5 題來自一般題庫（排除錯題以保留給後半），後 5 題優先錯題，不足由一般題庫補足 |

設計約束：

- **不修改原始題庫**：`shuffleQuestions()` 一律回傳新陣本。
- **不在 render 期間抽題**：抽題結果由 `sessionIndex` memo 成一局的題目順序；
  元件重新渲染不會改變。
- **只有開始新局才重抽**：`restart()` 讓 `sessionIndex + 1`。
- **每日挑戰不再由日期鎖定**：同一天重新開始可以重新抽題，
  但仍維持 10 題、每題 200 分、一天最多一次勝場、當日最佳成績與連勝規則。
- 同一局內不重複題目；題庫為空時顯示友善提示而不是崩潰。

---

## 題庫內容

### 目前的題庫規模

| 題型 | 數量 | 說明 |
| --- | --- | --- |
| 單字 | **178** | 88 筆原始示範 + 110 筆種子題庫 − 20 筆重複合併 |
| 句子填空 | **67** | 21 筆原始示範 + 46 筆種子題庫 |
| 分類 | **13** | 見下表 |

題庫檔案：

| 檔案 | 內容 |
| --- | --- |
| `src/data/words.ts` | 88 筆原始示範詞彙（`ROWS`）＋ 種子題庫合併邏輯 |
| `src/data/wordSeeds.ts` | **本次新增**：100 個單字 + 10 個慣用表現／口語 |
| `src/data/sentences.ts` | 21 筆原始示範句子 + 種子題庫合併邏輯 |
| `src/data/sentenceSeeds.ts` | **本次新增**：46 道句子填空題（S001～S046） |
| `src/data/validateBank.ts` | 題庫驗證邏輯（規格書第十一節） |
| `src/utils/categories.ts` | 分類單一來源與別名對照 |

### 難度分級聲明

題目上的 `N5`～`N1` 是**教學用途的建議分級**，由本專案自行整理，
**不是官方 JLPT 完整詞彙表，也未經任何官方認證**。
資料欄位 `accentVerified` 一律為 `false`：尚未人工查核聲調，
不宣稱符合 OJAD アクセント。

難度分布（實際統計）：

| 難度 | 單字 | 句子 |
| --- | --- | --- |
| N5 | 35 | 8 |
| N4 | 36 | 15 |
| N3 | 51 | 23 |
| N2 | 40 | 19 |
| N1 | 16 | 2 |

### 分類

全專案只有一份分類清單（`src/utils/categories.ts`）：

| 分類 | 單字數 | 分類 | 單字數 |
| --- | --- | --- | --- |
| 日常生活 | 21 | 天氣與環境 | 10 |
| 交通與旅行 | 13 | 抽象詞彙與進階表現 | 10 |
| 食物與飲食 | 13 | 慣用表現 | 20 |
| 動物與自然生態 | 13 | 口語與俚語 | 3 |
| 學校與工作 | 24 | 新聞・書面語 | 21 |
| 居家與健康 | 10 | 情緒與溝通 | 10 |
| 科技與數位生活 | 10 | | |

**舊分類會自動轉換**，因此舊資料不會失效：

| 舊名稱 | 新名稱 |
| --- | --- |
| 交通 | 交通與旅行 |
| 食物 | 食物與飲食 |
| 動物 | 動物與自然生態 |
| 校園／工作／學校 | 學校與工作 |
| 慣用語／四字熟語 | 慣用表現 |
| 口語／口語／俚語 | 口語與俚語 |
| 健康 | 居家與健康 |
| 情緒／溝通 | 情緒與溝通 |
| 科技 | 科技與數位生活 |
| 天氣／天災／環境 | 天氣與環境 |
| 進階詞彙／抽象詞彙／未分類 | 抽象詞彙與進階表現 |

轉換發生在三處：`filterQuestions` 篩選時、`availableCategories` 顯示時、
以及 `sanitizeSettings` 讀取舊的 localStorage 設定時。

### 種子題庫如何併入既有題庫

- 單字以 **`japanese` 為合併鍵**。既有 ID 是 `slugify(japanese)`，
  因此相同日文一定得到相同 ID，**舊詞彙的 ID 完全不變**，
  玩家的錯題本與遊玩紀錄不會失效。
- 重複的 20 筆（朝、約束、準備、駅、切符、電車、乗り換え、水、野菜、猫、犬、鳥、魚、
  授業、宿題、試験、会議、天気、考慮、お疲れ様）以**種子資料為準**更新
  讀音、意思、難度與分類，但保留既有資料未指定的欄位（例如 `acceptedAnswers`）。
- **不會為了湊數複製題目**：同一個日文在題庫裡只會有一筆。
  這是 `validateBank` 的 `duplicate-content` 檢查所保證的。
- 句子題以 `id` 合併（`s-s001` ～ `s-s046`），既有 21 筆的 ID 不變。

### 句子填空題規則

1. `sentence`（完整句）只供**語音播放**與**答後揭示**，作答前不顯示。
2. `displaySentence`（挖空句）用全形底線 ＿＿＿ 表示空格，
   **不得包含完整答案**，否則直接洩漏。
3. `answer` 必須是**句子中實際出現的活用形**。
   例如 S001 的答案是「洗います」（ます形）而不是字典形「洗う」；
   S020 是「落ち着きました」而不是「落ち着く」。
   `validateBank` 會檢查答案確實出現在完整句中。
4. `kana` 與 `romaji` 必須和該活用形一致。
5. 多詞答案（`空気を読む`、`一石二鳥`）在比對時會忽略空白，
   羅馬字輸入 `kuuki o yomu`、`kuukioyomu` 都可以。

### 慣用表現與口語

10 個慣用表現以 `WordQuestion` 的 `partOfSpeech` 標示為「慣用句」／「副詞」，
並非當成一般單字。分類落在「慣用表現」或「口語與俚語」。

具有多重語意的詞彙以**使用情境**說明，而非只給一個翻譯：

| 詞彙 | 意思欄位 | 答後顯示的用例 |
| --- | --- | --- |
| やばい | 依語境而異：情況很糟、不得了、靠不住；也可指非常厲害、很棒 | もう終電が出たの？それはやばい！／この店のラーメン、やばい！ |
| めっちゃ | 非常、超級（關西地區的口語強化詞） | この店のラーメン、めっちゃおいしい！ |

### 題庫驗證

```bash
npm run validate:bank
```

檢查規格書第十一節的 10 項：

1. 所有題目 ID 唯一（並檢查單字與句子的 ID 不會相撞）。
2. 日文、讀音、羅馬字、中文意思、詞性、來源都有內容。
3. 難度只使用 N5／N4／N3／N2／N1。
4. 分類符合已定義的分類（別名轉換後）。
5. 挖空句真的有挖空格，句型一致。
6. 每道句子題的答案確實存在於完整句子中。
7. 讀音、羅馬字、日文寫法都能自我判定。
8. 替代答案都能通過比對，且不等於主要答案或 romaji。
9. 挖空句不洩漏答案（日文／假名／羅馬字都檢查）。
10. 沒有「換掉 ID 的重複題目」。

另有反向測試（刻意塞入壞資料，確認驗證器抓得到），
避免驗證器本身失效。

### 音聲與圖片來源

- **沒有內建音檔**：全部 `audio: null`，播放時用瀏覽器 Web Speech API
  （ja-JP）機器語音。句子題播放的是**完整句**。
- **沒有內建圖片**：全部 `image: null`。本次沒有抓取任何第三方圖片。
  圖片對應機制（`imageMatcher`）維持不變，未來可人工逐筆填入
  `image` / `imageKeyword` / `imageSource` / `imageLicenseNote`。
- 語速規則未受影響：0.5× 仍是**最終 0.5 倍**，不會再乘短單字 0.75×；
  1.0× 保留短單字 0.75× 規則；不支援 rate 的引擎安全忽略。

## 下載與發行

遊戲只有**一套程式碼**（src/），桌機版與手機版共用。
桌機版把正式建置結果封裝成 Windows 執行檔，手機版是同一份靜態網站。

### 指令一覽

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 本機開發伺服器 |
| `npm run build:web` | 正式網站建置（含 PWA：manifest + Service Worker） |
| `npm run build:icons` | 產生 PWA / Windows 圖示 |
| `npm test` / `npm run typecheck` | 測試與型別檢查 |
| `npm run verify` | 型別檢查 + 測試 + 建置 |
| `npm run preview` | 預覽正式建置 |
| `npm run electron:dev` | Electron 開發模式（載入已建置的 dist） |
| `npm run electron:build` | **產生 Windows 安裝程式 + 可攜式版本** |
| `npm run electron:build:dir` | 只產生未壓縮的資料夾（快速驗證用） |
| `npm run release:notes` | 產生 release/ 的說明與授權聲明 |

### 桌機版輸出

`npm run electron:build` 會把檔案放到 `release/`：

| 檔案 | 說明 |
| --- | --- |
| `聞いボード-Setup.exe` | NSIS 安裝程式（約 107 MB） |
| `聞いボード-Portable.exe` | 免安裝可攜式版本（約 106 MB） |
| `聞いボード-README.txt` | 給玩家的使用說明 |
| `THIRD-PARTY-NOTICES.txt` | 第三方素材與授權聲明 |
| `win-unpacked/` | 未壓縮版本（除錯用） |

技術重點：

- 主程式 `electron/main.cjs` 以 **自訂 `app://` 協定**載入 `dist/`。
  Chromium 對 `file://` 的 ES module 有 CORS 限制，直接雙擊 `dist/index.html`
  會失敗；使用 standard + secure 的自訂協定可正確載入模組與各類資源。
- 玩家**不需要**安裝 Node.js，也**不需要**執行任何指令。
- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- 完全離線：沒有任何外部網路請求。
- 本機資料由 Electron 的 userData 目錄持久化，關閉再開會保留。

驗證產出的執行檔真的能跑：

```powershell
$env:NIIKI_SELFTEST_OUT = "$PWD\release\selftest.txt"
$env:NIIKI_SELFTEST_SEED = "1"
Start-Process -FilePath "release\win-unpacked\聞いボード.exe" -ArgumentList "--selftest" -Wait
Get-Content release\selftest.txt
```

應用程式會自己載入頁面、檢查 12 項（協定、根元素、React 掛載、品牌標題、
右上角語言選單、樣式表、模式卡、localStorage 可寫入…）並寫出結果檔。
把 `NIIKI_SELFTEST_SEED` 設成 `1` 執行一次、再去讀一次，
即可驗證關閉後重新開啟資料仍保留。

### 手機網頁版（PWA）

`npm run build:web` 產生的 `dist/` 就是可部署的靜態網站：

- `manifest.webmanifest`：名稱 `聞いボード`、三種尺寸圖示（含 maskable）、
  主畫面捷徑（快速單字／句子填空／今日挑戰）。
- `sw.js`：由 `scripts/build-sw.mjs` 依實際檔案產生，
  內含預快取清單與內容雜湊版本號。
  - 導覽請求用 network-first（線上永遠是最新版）。
  - 其他同源資源用 cache-first。
  - 版本號改變時會自動清掉舊快取，不會長期卡在舊版本。
- 圖示與 `apple-touch-icon.png` 支援 iOS「加入主畫面」。
- 所有路徑都是相對路徑（`./`），可直接部署在根目錄或 GitHub Pages 子路徑。

**離線範圍（不假裝完全離線）**：程式外殼、題庫、介面與音效可離線使用；
題目的日文 AI 語音取決於裝置的語音引擎；外部來源的自訂詞彙需要網路。

### 部署（需要你的帳號，這一步尚未執行）

專案已備妥三種平台的設定檔：

| 平台 | 設定檔 | 設定方式 |
| --- | --- | --- |
| GitHub Pages | `.github/workflows/deploy-pages.yml` | 推上 GitHub → Settings → Pages → Source 選 **GitHub Actions** |
| Netlify | `netlify.toml` | 連接倉庫，Build = `npm run build:web`，Publish = `dist` |
| Vercel | `vercel.json` | `npx vercel --prod` |

三者的 Build command 都是 `npm run build:web`，發布目錄都是 `dist`。
由於本專案使用 **hash 路由**（`#/word`），重新整理任何頁面都不會 404，
設定檔仍保留 SPA fallback 作為保險。

> **本專案尚未實際部署，因此沒有公開網址。**
> 部署需要你的 GitHub / Netlify / Vercel 帳號授權，
> 請依上表設定後，倉庫的 Actions 或託管後台就會給出網址。

---

## 資料備份與跨裝置轉移

桌機版與手機瀏覽器的 **localStorage 不會自動同步**，本專案也**沒有**雲端同步功能。
為了讓資料可以在裝置之間搬移，設定頁提供 JSON 備份：

- **匯出**：產生 `niiki-board-backup-YYYY-MM-DD.json`。
- **匯入**：支援「合併」（保留現有資料，推取較新的紀錄，
  錯題取次數較高者與星號聯集，作答紀錄以時間戳去重）
  與「覆蓋」（以備份檔完全取代）。
- **驗證**：匯入前檢查 `format` 與版本號，逐欄位清理損壞的資料，
  格式不符的檔案會被拒絕而不是寫壞現有資料。

位置：遊戲設定 → 資料備份與轉移。

## 專案結構

```text
src/
  components/       AudioButton / AnswerInput / AnswerReveal / GameShell /
                    ImageHint / QuestionProgress / ResultView / ReviewCountdown / StarButton
  data/             words.ts（單字示範題庫）、sentences.ts（句子示範題庫）
  hooks/            useQuizEngine.ts（四種模式共用的遊戲引擎）
  pages/            HomePage / PlayPage / ReviewPage / DailyPage /
                    MistakesPage / AnalyticsPage / SettingsPage / ImportPage
  services/         storage.ts / speech.ts / vocabularyImporter.ts / imageMatcher.ts
  store/            AppStore.tsx（localStorage 資料與動作）
  types/            question.ts / game.ts / analytics.ts
  utils/            scoring / answerMatcher / date / randomQuestion /
                    dailyChallenge / analytics / settings / mora / speechRate
  i18n/              index.tsx + brand.ts + locales/{zh-TW,ja,en}.ts
  services/           storage / speech / sfx / backup / profile / avatars /
                    vocabularyImporter / imageMatcher
  utils/              ... / profileStats / speechRate / randomQuestion
electron/              main.cjs（主行程）+ preload.cjs
pwa/                  sw.js（Service Worker 來源）
public/               manifest.webmanifest、icons/、favicon.svg、示範詞彙
scripts/              generate-icons / build-sw / write-release-notes
  i18n/              index.tsx + locales/{zh-TW,ja,en}.ts
  smoke/            gameFlow.smoke.test.tsx（jsdom 實測遊戲流程）
                    profileSpeed.smoke.test.tsx（個人檔案與語音速度）
                    language.smoke.test.tsx（語言選單位置與品牌標題）
                    sfxFlow.smoke.test.tsx（音效觸發與去重）
public/data/        vocabulary.sample.json（示範匯入資料）
```

核心規則集中在 `src/utils/` 的純函式，UI 元件只負責呈現，
因此計分、連勝、每日抽題與答案正規化都可獨立測試。

---

## 測試

```bash
npm test
```

涵蓋範圍：

- **計分**：100 / 90 / 80 / 70、下限 0、跳過扣 50、每日 +200、最高 2000、答錯 3 次可跳過。
- **答案正規化**：大小寫、空白、全形／半形、片假名／平假名、`acceptedAnswers`；
  確認不同單字不會被誤判為正確。
- **日期與連勝**：本地日期、跨月跨年、連勝累加／重設、最高連勝、同日不重複計勝場。
- **每日挑戰組成**：固定 10 題、前 5 題來自一般題庫、後 5 題優先錯題、
  沒有錯題也能填滿、同日題目固定、隔日新題組。
- **抽題**：最近 5 題不重複、題目不足時放寬、複習權重 50/30/20 與比例重分配。
- **分析**：作答 < 5 次顯示「資料不足」、強項／待加強／持續練習門檻。
- **匯入器**：JSON／CSV、重複檢測、欄位缺漏報告、格式錯誤不拋例外。
- **音拍計算**：拗音、小促音、撥音、長音、濁音／半濁音、漢字與標點。
- **語速規則**：短單字 75%、長單字維持原速、句子不變慢、單題覆寫、範圍夾限。
- **語音服務**：實際播放時的 `utterance.rate` 與規則一致；音檔不受影響；
  瀏覽器不支援 TTS 或不允許設定 rate 時不會中斷。
- **i18n**：三種語言鍵值完全一致、無空白翻譯、佔位符檢查、輸入方式名稱。
- **語言 UI**：語言選單位於 Header 最右側、六個主要頁面皆可使用、
  切換即時更新、`<html lang>` 與分頁標題同步、寫入 localStorage、
  重新載入後沿用、且不影響錯題本／遊玩紀錄／其他設定。
- **品牌標題**：三種語言下都顯示「聞いボード」，翻譯字典已無 `appTitle`。
- **音效**：四種音效的節點排程、波形長度、峰值音量、開關與音量夾限、
  去重間隔、suspended 自動播放恢復、不支援 Web Audio 時的失敗處理。
- **音效觸發流程**：correct／wrong／skip／gameover 各在正確的狀態轉移點
  觸發一次，重複送出、連點跳過、重複渲染都不會重播。
- **資料備份**：格式／版本驗證、損壞欄位清理、合併去重、跨裝置轉移情境。
- **隨機出題**：洗牌不改原陣列、同時呼叫會得到不同順序、整局不重複、
  可重現亂數、每日挑戰前後半來源規則與錯題保留。
- **語音速度**：0.5× 不疊加 0.75×、句子／長單字不變慢、單題覆寫、範圍夾限、
  不支援 rate 時的備援。
- **個人檔案**：暱稱清理與長度上限、空白回復預設、頭像選取／上傳／移除、
  損壞資料退回預設、重載後保留、統計計算正確。
- **發行資產**：PWA manifest／圖示／Service Worker 內容、Electron 設定。
- **題庫驗證**：ID／詞彙唯一、欄位非空、難度與分類合法、答案存在於完整句、
  挖空句不洩漏、讀音與羅馬字可自我判定、替代答案可用、單字與句子 ID 不相撞。
- **題庫整合**：舊詞彙 ID 穩定、單字與句子分流出題、句子播放完整句、
  語速規則不受影響、每日挑戰仍為前 5／後 5。
- **頭像上傳**：格式驗證、2 MB 上限、正方裁切參數、Canvas 不可用／解碼失敗／
  `toDataURL` 拋錯時的安全退路、data URL 容量邊界。
- **發行資產**：PWA manifest／圖示／Service Worker 內容、Electron 設定
  （自訂協定、安全選項、路徑穿越防護、無外部請求）、部署設定檔、
  `.gitignore` 是否排除打包輸出與憑證、專案是否含有 token。
- **流程煙霧測試（jsdom）**：實際 render 元件並模擬作答，驗證 READY 倒數、
  計時歸零鎖定、答對自動跳題、跳過只結算一次、複習 10 秒倒數、
  今日挑戰 10 題 × 200 分。

---

## 驗證指令

| 指令 | 用途 |
| --- | --- |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm test` | Vitest 單元與整合測試 |
| `npm run validate:bank` | 題庫資料完整性驗證（規格書第十一節） |
| `npm run build:web` | 型別檢查 + Vite 建置 + Service Worker |
| `npm run verify:browser` | **真實瀏覽器**驗證（headless Chrome/Edge） |
| `npm run verify` | typecheck + validate:bank + test + build:web |

### `npm run verify:browser`

用 headless Chrome／Edge 實際渲染 `dist`，檢查首頁個人檔案入口、個人檔案頁
（暱稱欄位、8 種頭像、上傳選擇器）、四種遊戲模式的語音速度控制，以及
複習模式的空狀態，總共 33 項。

- 需先執行 `npm run build:web`。
- 腳本內建靜態伺服器，不需要另外啟動 dev server。
- **找不到瀏覽器時會明確輸出 `[skip]` 並以 0 結束**，不會假裝通過。
- 這是為了補上 jsdom 測不到的部分（真實排版、無障礙屬性、`<input type="file">` 的 accept）。

## 資料來源與授權限制

**請先閱讀 [`DATA_SOURCE.md`](./DATA_SOURCE.md)。** 摘要：

- 內建題庫（88 單字 + 21 句子）為**本專案自行撰寫的示範資料**（`source: "original-sample"`）。
- **沒有**匯入 Nihongo to Japan 的詞彙清單、OJAD 音檔，或 いらすとや 的圖片——
  這些來源的授權條件未確認，因此不複製、不鏡像、不抓取。
- 音聲使用瀏覽器 Web Speech API（`ja-JP`）**機器語音**，
  不宣稱符合 OJAD アクセント；所有題目 `accentVerified: false`。
- 題目**沒有任何音檔與圖片**（`audio: null`、`image: null`）。
- 詞彙擴充請使用 `src/services/vocabularyImporter.ts` 的 JSON／CSV 匯入器
  （首頁 →「匯入詞彙」），匯入器會驗證欄位並產生匯入報告。

---

## 已知限制

- 未在實體手機或瀏覽器中進行人工操作測試；所有驗證都是單元測試與 jsdom 流程測試。
- 未使用真人錄音與圖片，題庫規模有限（避免短時間內重複出題）。
- 資料保存在瀏覽器 localStorage，換瀏覽器或清除網站資料會遺失紀錄。
- Web Speech API 的日文語音品質取決於瀏覽器／作業系統，部分裝置可能沒有 `ja-JP` 語音。