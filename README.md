# 破冰對決 ICEBREAK DUEL

20 分鐘兩隊破冰遊戲。一個主持人用一部電腦／iPad 投射去電視，6–16 人同一房間玩。無需登入，資料只存在呢部機。

## 點玩

1. 打開網站。
2. 輸入花名（最少 4 個）→ 隨機分兩隊 → 30 秒改隊名 → 揀「家庭和諧」或「朋友聚會」。
3. 睇一頁規則，撳「開始 20 分鐘」。
4. 六個回合固定順序：這或那 → 最有可能 → 30秒認識你 → 做我估 → 搶答 → 終極介紹。
5. 20:00 倒數唔會停（除非主持撳暫停）。到時即刻結算。

主持底欄：暫停／繼續、+15秒、跳過呢題、紅藍加減分、顯示規則、全畫面。

## 本機開啟

用瀏覽器打開 `public/index.html`，或者：

```bash
python3 -m http.server 8788 --directory public
```

然後開 <http://localhost:8788>

線上版：<https://icebreak-duel.ymtwill.workers.dev>  
原始碼：<https://github.com/Takjai18/icebreak-duel>

加 `?demo` 會自動填示範名單，方便彩排。

重新整理唔會斷局（`localStorage`）。

## 部署

GitHub：本 repo。  
Cloudflare Workers（靜態檔）：

```bash
npx wrangler deploy
```
