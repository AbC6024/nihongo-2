# 遊戲學日語 · Nihongo 2

免費的日語學習小遊戲網站。純前端（HTML / CSS / 原生 JavaScript），沒有框架、沒有建置步驟、沒有依賴套件。

## 遊戲

| 遊戲 | 說明 |
| --- | --- |
| 助詞大冒險 | 練助詞（は／が／を／に／で…），情境選擇題 |
| 五十音圖 | 平假名 / 片假名 對照與發音練習 |
| 單字閃卡 | N5 基礎單字翻卡 |
| 數字日期練習 | 數字、電話號碼、日期 |
| 打翻重組 | 句子打亂重排 |
| 配對 / 測驗 / 限時挑戰 | 其他練習模式 |

進度存在瀏覽器的 `localStorage`，不會上傳到任何地方。

## 本機執行

需要 [Node.js](https://nodejs.org) 18 以上（其實任何版本都行）：

```bash
npm start          # 或 node server.js
node server.js 9000   # 指定埠號，預設 8000
```

啟動後開 <http://localhost:8000>。伺服器也會列出區域網路網址，手機、平板在同一個 Wi-Fi 下可以直接連進來玩。

也可以直接打開 `index.html` 用瀏覽器看，但用伺服器比較接近正式環境。

## 專案結構

```
.
├── index.html        首頁（遊戲總覽）
├── gojuon.html       五十音圖
├── particles.html    粒子 / 動效頁
├── server.js         零依賴的靜態檔案伺服器
├── css/
│   ├── style.css     共用樣式
│   └── home.css      首頁專用樣式
└── js/
    ├── core.js       工具函式、儲存、特效
    ├── data.js       題庫與單字資料
    ├── kana-data.js  五十音資料
    ├── catalog.js    遊戲清單
    ├── site.js       頁首 / 頁尾 / 工具列
    ├── boot.js       共用啟動流程
    └── home.js quiz.js match.js scramble.js speed.js gojuon.js
```

## 授權

MIT