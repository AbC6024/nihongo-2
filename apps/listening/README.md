# 日語聽打・聞いボード

此目錄保留匯入遊戲的 React／TypeScript 原始碼、題庫與測試。原始遊戲位於使用者提供的 `nihonngogame` 資料夾，網頁版已整合至「遊戲學日語」，保留原有單字、句子、複習、錯題本、每日挑戰、分析、個人檔案及資料備份功能。

請在整個網站根目錄使用 Node.js 24.15 以上執行：

- `npm install`：安裝整合專案依賴。
- `npm run build`：型別檢查、建置聽打至根目錄 `listening/`，再打包完整網站。
- `npm test`：執行原網站及聽打遊戲全部測試。
- `npm run dev --workspace @nihongo/listening`：僅開發聽打遊戲。
- `node server.js`：開啟整合後網站，前往 `/listening/` 遊玩。

來源與授權見 [DATA_SOURCE.md](DATA_SOURCE.md)。題目使用裝置提供的日文機器語音，並無已驗證的真人音檔。聽打進度保留 `niiki.*` 儲存鍵；既有網站使用 `jpq.*`，兩者不互相清除。從其他網域或桌面版搬移紀錄時，請使用遊戲內的備份匯出／匯入功能。

網頁整合不包含原桌面安裝程式與 Electron 打包工具；使用者提供的原始資料夾不會被修改。
