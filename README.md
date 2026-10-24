# 遊戲學日語 · Games to Learn Japanese

用一款款小遊戲練日語。目前有五款：

- **助詞大冒險**（`particles.html`）— は・が・の・を・に・で・と・も 八大主題助詞，四種玩法
- **動詞變化練習**（`conjugation.html`）— 台灣版《大家的日本語》初級Ⅰ、Ⅱ第 1～25 課，從 132 個收錄動詞每輪抽 10 題，可選冊別、綜合或單一變化，不計時、3 選 1
- **五十音圖**（`gojuon.html`）— 看字選音、看音選字、聽音辨識、配對記憶，每款都能切換字集
- **日語聽打・聞いボード**（`listening/`）— N5～N1 單字與句子聽打，包含錯題本、重點複習、每日挑戰與練習分析
- **五十音大冒險**（`hiragana/`）— 六關平假名連連看、五種網格翻牌記憶、由單字到整句的 15 題填空

## 本機執行

```powershell
node server.js          # 預設 8000
node server.js 8080     # 換埠號
```

開啟 <http://localhost:8000>。同一個 Wi-Fi 的手機／平板可以用啟動畫面顯示的區網網址連進來。

根目錄遊戲、`hiragana/` 與已建置的 `listening/` 可直接用 Node.js 18 以上執行。修改、測試或重新建置整合專案請使用 Node.js 24.15 以上，並先安裝依賴：

```powershell
npm install
npm run build:games     # 將 apps/listening 的原始碼建置至 listening/
npm run build           # 重新建置聽打，再產生完整靜態網站 dist/
npm run build:static    # 將已保存的發佈版本打包成 dist/（雲端部署使用）
```

`listening/` 是會隨專案保存的發佈版本，請勿直接修改其中的產物；遊戲原始碼位於 `apps/listening/`。修改原始碼後執行 `npm run build` 並一併提交產物，讓 Render 與 GitHub Pages 使用相同版本；雲端的靜態打包流程不需要安裝聽打開發套件。

靜態打包時也會依內容更新根目錄四個入口頁面與 `hiragana/index.html` 的 JavaScript／CSS 版本網址，避免快取的舊目錄漏掉新遊戲。這些 HTML 變更應一併提交；更新不會清除玩家進度。

## 五十音大冒險整合

使用者提供的 `hiragana kihon` 遊戲整合於 `hiragana/`，保留連連看、翻牌記憶與句子填空三款玩法；主站首頁、選單及聽打遊戲皆可前往。與原有 `gojuon.html` 的「五十音圖」分開，避免取代既有練習。直接修改 `hiragana/` 的 HTML、JS 與 CSS，執行 `npm run build:static` 後即可測試、部署。

關卡解鎖沿用 `jpk.matching.unlock`，只記錄此遊戲的解鎖進度，不會清除原網站或聽打紀錄，也不會將暫時分數送到排行榜。發音使用裝置提供的機器語音；未新增第三方題庫、錄音、圖片或外部字型。原始下載資料夾保留不動。

## 日語聽打整合

首頁、主選單及頁尾都提供「日語聽打」入口；遊戲以 `/listening/` 為獨立路徑，保留原有單字／句子模式、錯題本、每日挑戰、分析及設定。返回首頁可繼續使用助詞、動詞與五十音遊戲。

聽打遊戲的設定、錯題和遊玩紀錄使用自己的 `niiki.*` 儲存鍵，既有遊戲的星星與紀錄各自保留。首頁的學習紀錄與排行榜仍顯示原有遊戲；聽打紀錄可在日語聽打內查看。

目前題庫以瀏覽器 Web Speech API 的日文機器語音播放；這不是已驗證的真人錄音或 OJAD 聲調音檔。實際聲音取決於裝置上的日文語音支援。題庫來源與授權說明保留在 `apps/listening/DATA_SOURCE.md`，匯入外部題目或音檔時仍須自行確認授權。

## 檢查遊戲

執行 `npm test` 會檢查題庫、動詞變化、靜態建置與排行榜 API，並測試離開遊戲時的清理、配對逾時結算、五十音不重複出題、星星分開計算、鍵盤操作與排行榜斷線重試。

新增句子重排題目時，請同時填入 `particles` 陣列，列出句子真正使用的助詞，避免把單字內的假名誤算為助詞。

## 排行榜

| 端點 | 用途 |
|---|---|
| `GET /api/leaderboard` | 取得所有排行榜 |
| `POST /api/leaderboard` | 登記成績（`{game, name, score, detail}`） |
| `GET /api/health` | 健康檢查，順便回報儲存狀態 |

規則：

- 同一個暱稱在同一款遊戲只保留**最高分**
- 每款遊戲最多 30 筆，全部最多 400 筆
- 暱稱最長 16 字，伺服器會過濾控制字元與 `< > " ' \`

遊戲進度（星星、最高分）存在玩家自己的瀏覽器 localStorage，排行榜則存在伺服器，兩者互不影響。

## 正式部署（免費方案）

排行榜需要一個能跑 Node 的環境。設定檔都準備好了，用 Render 的免費方案即可。

### 免費方案要知道的三件事

1. **網站和所有遊戲完全正常** — 這部分不受影響
2. **服務閒置一陣子會休眠**，重新打開時前幾秒會比較慢
3. **排行榜成績在服務重啟後會被清空** — 雲端免費空間的磁碟是暫存的

第 3 點網站會**主動在排行榜上方顯示提醒**，不會讓玩家以為成績還在。
玩家自己的遊戲進度和最高分存在瀏覽器裡（`localStorage`），完全不受影響。

### 部署步驟

1. 把整個資料夾推到 GitHub
2. 到 [dashboard.render.com](https://dashboard.render.com) 選 **New + → Blueprint**
3. 指向剛才那個儲存庫，Render 會自動讀取 `render.yaml`
4. 部署完成後會給你一個 `https://nihongo-2.onrender.com` 的網址

`render.yaml` 裡已經設定好：

- `plan: free`
- `startCommand: node server.js`
- `healthCheckPath: /api/health`
- `region: singapore`

### 讓排行榜永久保存（免費）

用 Upstash Redis 的免費額度，**不用花錢**。
在 Render 後台加兩個環境變數就完成了：

| Key | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 提供的 Token |

詳細說明見下面〈排行榜永久保存（免費）〉。

### 或者掛持久磁碟（付費）

如果不介意花一點錢，在 `render.yaml` 加上：

```yaml
    envVars:
      - key: DATA_DIR
        value: /var/data
    disks:
      - name: leaderboard-data
        mountPath: /var/data
        sizeGB: 1
```

### 其他平台

| 平台 | 起始指令 | 備註 |
|---|---|---|
| Fly.io | `node server.js` | `fly.toml` 已準備好 |
| Railway | `node server.js` | `Procfile` 已準備好 |
| 任何容器平台 | `node server.js` | 平台會自動設定 `PORT` |

`DATA_DIR`（選用）— 指向持久磁碟路徑。沒設定時預設用專案資料夾底下的 `data/`。

## 排行榜永久保存（免費）

用 [Upstash Redis](https://console.upstash.com/) 的免費額度把成績存到雲端，
這樣網站可以放在免費主機上，重啟後成績也不會消失。

免費額度：**500,000 指令 / 月**、256 MB 資料、10 GB 頻寬。
讀一次排行榜大約 15 個指令，教室規模使用綽綽有餘。

### 設定步驟

1. 到 [console.upstash.com](https://console.upstash.com/) → 點 **Redis** 建立資料庫
   （免費，不需要信用卡。Usage 顯示 $0.00 就是免費額度）
2. 建立後在 Database 頁面找到 **REST API** 的 **URL** 和 **Token**
3. 到 Render，點進 **Nihongo** 服務（左側導覽選 **Environment**，不是 `dashboard.render.com/env`），
   按 **Add Environment Variable** 新增兩個變數：

   | Key | Value |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` |
   | `UPSTASH_REDIS_REST_TOKEN` | 你的 Token |

4. 按 **Save Changes**，Render 會自動重新部署

設好之後 `/api/health` 的 `storage.kind` 會顯示 `redis`，
網站上的「排行榜是暫時的」提醒也會自動消失。

### 資料結構

| Key | 型態 | 內容 |
|---|---|---|
| `jpq:z:<game>` | Sorted Set | member = 暱稱，score = 分數 |
| `jpq:m:<game>` | Hash | 暱稱 → `{d: 詳情, t: 時間}` |
| `jpq:games` | Set | 有成績的遊戲清單 |

用 sorted set 的好處是「同名保留最高分」可以用 `ZADD GT` 一個原子指令完成，
兩個人同時登記不會互相覆蓋。不需要安裝任何 npm 套件，直接用內建的 `fetch` 打 REST API。

沒有設定這兩個變數時，會自動退回用本機的 JSON 檔案（`data/leaderboard.json`），
本機使用完全不受影響。

## 如果只想放靜態空間

GitHub Pages、Netlify 這類純靜態空間可以放，但**沒有 Node 伺服器，排行榜會顯示「需要啟動伺服器」的提示**，
遊戲本身和個人進度都照常運作（存在訪客的瀏覽器裡）。

## 檔案結構

```
index.html            遊戲總覽
particles.html        助詞大冒險
conjugation.html      動詞活用大冒險
gojuon.html           五十音圖
listening/            日語聽打的已建置發佈版本
apps/listening/       聞いボード原始碼、測試及資料來源說明
server.js             靜態伺服器 + 排行榜 API
css/home.css          總覽頁樣式
css/style.css         遊戲介面樣式
js/site.js            全站殼層（header / footer / 縮圖）
js/catalog.js         遊戲目錄 ← 加新遊戲改這裡
js/leaderboard.js     排行榜客戶端
js/core.js            共用核心（路由 / 進度 / 音效 / 語音）
js/data.js            助詞題庫（可加注音：東京[とうきょう]）
js/kana-data.js       五十音資料
js/vocab-data.js      題庫字集（平假名／片假名／單字）
js/{quiz,speed,scramble,match,gojuon}.js   遊戲邏輯
js/verb-data.js       動詞活用規則引擎 + 動詞資料
js/verb-vocab.js      台灣版初級Ⅰ、Ⅱ第 1～25 課的核對字彙與來源
js/verb-levels.js     動詞玩法的關卡與出題
js/verb-quiz.js       動詞變化練習（目前網站採單一玩法）
js/verb-beginner.js   初級Ⅰ、Ⅱ主題與簡單中文說明
js/verb-sheet.js      動詞活用速查表
js/verb-boot.js       動詞專頁啟動
```

## 初級動詞練習

動詞字彙限定台灣大新版《大家的日本語》初級Ⅰ（第 1～12 課）、初級Ⅱ（第 13～25 課），不是日本原版第 26～50 課的「初級Ⅱ」。練習與對照表僅提供ます形、辞書形、て形、ない形、た形，共五種基本變化；不將其他禮貌體、邀請或條件句型列成練習項目。

題庫 `js/verb-vocab.js` 收錄 132 個已核對動詞（初級Ⅰ 33 個、Ⅱ 99 個），可選單冊或兩冊，預設綜合五種基本變化。每輪先洗牌字彙，再抽出 10 個不同識別字的動詞；混合模式輪替形式，不以重複抽樣湊題數。每題顯示字彙冊別與課次，從ます形出題（練ます形時從辞書形出題），結果顯示正確率、錯題說明，並可重新抽 10 題。同音詞如切る／着る、撮る／取る分開識別。

字彙課次、讀音與分類依[日學舍自製動詞練習表](https://www.nichigakusha.co.jp/course/minnano_nihongo/download/)核對；該作者明示教材著作權自由，短中文釋義由本站撰寫。冊別對應參考[大新出版社初級Ⅱ資料](https://www.dahhsin.com.tw/bookIntro.php?lv01_type=Japan-c06&prd_id=E164)，變化範圍核對 [3A 官方課綱](https://www.3anet.co.jp/np/resrcs/240000/)。此題庫是可可靠活用的已核對選集，不宣稱教材用語全收錄，也不重製教材例句。

舊有搶答、拼圖、配對程式與完整規則引擎保留在原始碼中，公開題庫僅使用上述五種形式。保留主題 1～4、12 的進度鍵，其他舊題型連結回到練習設定；舊學習資料不清除。混合模式以冊別使用獨立星星鍵，學習紀錄的可練入口同步限五種基本變化。

## 助詞與動詞的點擊朗讀

助詞四種玩法、作答說明與速查例句省略日期、時刻、每天等時間詞，中文題意同步簡化。原先依時間詞作答的題目改用目的地、存在場所或對象，保留原有關卡題數與句子重排題數。這是依使用者偏好簡化題目，不能視為 Google 語音全部音高重音皆經人工校對。

助詞四種玩法及動詞練習載入 `js/google-tts.js`、`css/tts.css`。點題目日文或喇叭可朗讀題目；選答案、重排單字、點配對卡片時也會朗讀實際所選內容，答題後可以重聽正確答案。助詞題的空格只停頓，動詞題只讀題幹，作答前不讀出隱藏答案。獨立助詞「は／へ／を」按「わ／え／お」發音，配對的中文解說使用中文聲線。

音訊來自 Google Translate 的朗讀服務，由現有 Node 服務的 `GET /api/tts?text=...&lang=ja` 代取；瀏覽器直接播放網站的 MP3。靜態 Render／GitHub Pages 前端連到 `https://nihongo-2.onrender.com/api/tts`，本機及 Node 網址使用同源路徑。這項朗讀需要網路；不會將裝置 Web Speech API 冒稱 Google 語音，也不會自動播放。

這是 Google Translate 的公開朗讀端點，並非需專案與驗證的 [Google Cloud Text-to-Speech API](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize)，未使用金鑰或啟用付費帳務。端點沒有正式 API 穩定性承諾，失敗會顯示可重試訊息，仍可照常答題。伺服器僅向固定 Google 網域取音訊，限制文字 200 字與語言，加入有上限的快取、重複請求合併及並發限制，避免整份題庫預先產生大量請求。

重複點擊會停止上一段，換頁、切到背景或關閉右上角聲音也會停止。快速搶答仍按原計時換題，短選項語音可延續到下一題，下一次點擊會立即取代。語音控制、錯誤與計分回歸測試：`node tests/click-tts.mjs`。

## 動詞活用的規則引擎

動詞題目不是一條一條手寫的，而是用 `js/verb-data.js` 裡的 `conjugate(動詞, 活用形)`
即時算出來。所以加動詞只要加一行資料，加活用形只要加一筆表。

整份活用表其實只有兩條路：

| 詞幹 | 接什麼 | 例子 |
|---|---|---|
| 未然形 | ない／う・よう／れる・られる／せる・させる | 書か＋ない → 書かない |
| 連用形 | て・た／ます／ません | 書き＋ます → 書きます |

一段和サ変・カ変只有一列；**五段才會跳行，而跳法完全由最後一個假名（段）決定**：

| 段 | 未然 | 連用 | て・た | 例 |
|---|---|---|---|---|
| う | わ | い → っ | て・た | 買う → 買**って** |
| く | か | き → い | て・た | 書く → 書**いて** |
| ぐ | が | ぎ → い | で・だ | 泳ぐ → 泳**いで** |
| す | さ | し | て・た | 話す → 話**して** |
| つ | た | ち → っ | て・た | 待つ → 待**って** |
| ぬ | な | に → ん | で・だ | 死ぬ → 死**んで** |
| ぶ | ば | び → ん | で・だ | 飛ぶ → 飛**んで** |
| む | ま | み → ん | で・だ | 読む → 読**んで** |
| る | ら | り → っ | て・た | 知る → 知**って** |

規則引擎裡有幾個「推不出來、只能記」的例外，都集中在 `EXCEPTION` 跟每個動詞自己的 `skip`：

- `行く` → `行って`（不是 `行いて`）
- `ある` 的否定是 `ない`；`あって` 符合五段規則，本題庫不出其可能、受身與使役形
- `作る` 是五段動詞，依規則變成 `作って`、`作ります`、`作らない`；`着る` 則是一段動詞
- `帰る` 的可能形是 `帰れる`；`知る` 的可能表現涉及語境，本題庫採初級教材範圍而略過

改規則之後跑 `npm test`，測試裡的答案全部寫死不從引擎推，
所以規則寫錯會立刻被抓出來。

## 五十音的玩法與字集

`gojuon.html` 的四款玩法共用 `js/vocab-data.js` 的三個字集：

| 字集 | 來源 | 題目數 |
|---|---|---|
| 平假名 | `JPQ.kana.list()` 展開 | 46 |
| 片假名 | 同上換成片假名 | 46 |
| 單字 | `JPQ.VOCAB` | 16 |

要看字集切換器請到 `js/gojuon.js` 的 `ui` 物件；
要看單字資料請改 `js/vocab-data.js`（欄位：`char` `roman` `zh` `tag` `speak`）。

## 加新遊戲

1. 在 `js/catalog.js` 加一筆，`status` 設為 `live`（縮圖樣式記得在 `js/site.js` 的 `THUMBS` 補上）
2. 寫一個 `xxx.html`（複製 `particles.html` 或 `conjugation.html` 當範本）
3. 寫 `js/xxx.js`，用 `JPQ.registerGame()` 註冊玩法
4. 需要排行的話，**兩個地方都要加**，少一個玩家按下去會收到 400：
   - `js/leaderboard.js` 的 `JPQ.LB_GAMES`
   - `server.js` 的 `ALLOWED_GAMES`

   `npm test` 會檢查這兩邊有沒有對不起來。
