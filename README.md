# 遊戲學日語 · Games to Learn Japanese

用一款款小遊戲練日語。目前有三款：

- **助詞大冒險**（`particles.html`）— は・が・の・を・に・で・と・も 八大主題助詞，四種玩法
- **動詞活用大冒險**（`conjugation.html`）— 五段・一段・サ変・カ変 與可能受身使役，四種玩法
- **五十音圖**（`gojuon.html`）— 五十音順序、平假名⇄片假名、聽音選字

## 本機執行

```powershell
node server.js          # 預設 8000
node server.js 8080     # 換埠號
```

開啟 <http://localhost:8000>。同一個 Wi-Fi 的手機／平板可以用啟動畫面顯示的區網網址連進來。

需要 Node.js 18 以上，不需要安裝任何 npm 套件。

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
server.js             靜態伺服器 + 排行榜 API
css/home.css          總覽頁樣式
css/style.css         遊戲介面樣式
js/site.js            全站殼層（header / footer / 縮圖）
js/catalog.js         遊戲目錄 ← 加新遊戲改這裡
js/leaderboard.js     排行榜客戶端
js/core.js            共用核心（路由 / 進度 / 音效 / 語音）
js/data.js            助詞題庫（可加注音：東京[とうきょう]）
js/kana-data.js       五十音資料
js/{quiz,speed,scramble,match,gojuon}.js   遊戲邏輯
js/verb-data.js       動詞活用規則引擎 + 動詞資料
js/verb-levels.js     動詞玩法的關卡與出題
js/verb-{quiz,speed,scramble,match}.js     動詞四種玩法
js/verb-sheet.js      動詞活用速查表
js/verb-boot.js       動詞專頁啟動
```

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

## 加新遊戲

1. 在 `js/catalog.js` 加一筆，`status` 設為 `live`（縮圖樣式記得在 `js/site.js` 的 `THUMBS` 補上）
2. 寫一個 `xxx.html`（複製 `particles.html` 或 `conjugation.html` 當範本）
3. 寫 `js/xxx.js`，用 `JPQ.registerGame()` 註冊玩法
4. 需要排行的話，**兩個地方都要加**，少一個玩家按下去會收到 400：
   - `js/leaderboard.js` 的 `JPQ.LB_GAMES`
   - `server.js` 的 `ALLOWED_GAMES`

   `npm test` 會檢查這兩邊有沒有對不起來。
