# memory.md — 專案工作日誌

本檔案記錄與 Claude Code 協作期間的重要決策、變更摘要與待辦事項，供未來對話快速掌握脈絡（非逐字對話紀錄）。

---

## 2026-06-13

### 專案現況盤點
- **tour-mutilang**：Expo/React Native（Web/iOS/Android）多國語系旅遊行程規劃 App，為舊版 Vite 網頁版（已移除的 `legacy/`）的重寫版本。
- 核心流程：登入 (Firebase Auth) → 問卷 (`SurveyForm`) → 行程生成 → 行程檢視/編輯/PDF 匯出。
- 行程生成已採「規則式引擎 + 免費 OpenTripMap POI」，不依賴 LLM。

### 程式碼清理（不干擾現有邏輯）
1. **移除 Gemini 行程生成路徑**：`src/services/ai.ts` 刪除未使用的 `generateItineraryWithGemini`（約 375 行），同步移除其專用的 `PACEngine`、`AsyncStorage`、`verifyItineraryLinks` import。`generateItinerary` 維持呼叫 `generateRuleBasedItinerary`（規則式引擎），行為不變。
2. **移除 `verifyItineraryLinks`**（`src/utils/linkVerifier.ts`）：僅被已刪除的 Gemini 行程生成使用；`verifyUrlRAG`/`getGoogleSearchFallback` 保留（仍供「重新抽選行程活動」功能使用）。
3. **簡化 `src/services/affiliate.ts`**：移除未串接的 Klook/KKday API Key 邏輯與 TODO，直接回傳 Klook/KKday 搜尋結果頁連結（不實作聯盟 API）。
4. **刪除 `legacy/`**：舊 Vite 專案殘留（含大量 scratch script、舊 API），確認無任何現有程式引用。
5. **刪除根目錄 `scratch/`**：開發暫存腳本（`generate_fallbacks.js`, `test_diff.js`, `test_fallback_guide.js`），確認無引用。

### OpenTripMap API Key 設定
- 已於專案根目錄建立 `.env`（已被 `.gitignore` 排除，不會進版控）：
  ```
  EXPO_PUBLIC_OPENTRIPMAP_KEY=5ae2e3f221c38a28845f05b6e0a00094c3b34ba79432b2304df0f295
  ```
- 已用 `geoname` endpoint 驗證金鑰有效。
- `src/services/poi.ts` 會自動讀取此環境變數，供規則式引擎抓取真實 POI。
- **注意**：若 Expo dev server 已在執行中，需重啟才會載入新的 `.env`。

### tour_plan.md → CLAUDE.md 遷移
- 原 `tour_plan.md`（含 frontmatter 的 skill 格式，定義行程規劃優先序/每日起訖點/時間限制/多語系規範）已**整併進 [CLAUDE.md](CLAUDE.md)**，並移除原檔。

### 協作偏好
- 已於 `CLAUDE.md` 新增「Claude Code 協作規範」章節：與使用者對話請一律使用繁體中文回覆。

---

## 2026-06-13（續）— 移除剩餘 Gemini 功能與 API Key 機制

### 三項功能改為規則式/離線版本
1. **`DestinationGuide` → `getDestinationGuideInfo`**：改為直接回傳 `getFallbackGuideInfo`（既有的日韓越台星泰等內建離線指南範本），並標記 `isFallback: true`。
2. **`app/batch-scheduler` → `analyzeBatchUrls`**：改為規則式解析貼入的網址/文字列表。新增 `extractTitleFromLine`（解析 Google Maps `/place/` 連結、一般網址 slug、純文字）與 `guessCategoryFromText`（關鍵字猜測景點分類），並比對既有行程活動標題以標記重複項目。
3. **`regenerateActivityAlternatives`（行程「重新抽選」）**：改為呼叫 `fetchDestinationPOIs`（OpenTripMap），依 `ACTIVITY_TYPE_TO_POI_CATEGORIES` 對應分類篩選候選 POI，並用 haversine 距離估算與下一活動間的交通方式（步行/大眾運輸/計程車）。找不到候選時拋出 `NO_ALTERNATIVES_FOUND`（取代舊的 `MISSING_API_KEY`），呼叫端 [app/itinerary/index.tsx](app/itinerary/index.tsx) 已同步更新錯誤訊息。

### 移除整套 Gemini API Key 機制
上述三項改完後，`settingsService`/`ApiKeyModal` 已無任何呼叫端，依使用者指示一併移除：
- 刪除 `src/services/settings.ts`、`src/components/settings/ApiKeyModal.tsx`（及空目錄）。
- [app/index.tsx](app/index.tsx)：移除 API Key 設定 UI（`renderApiKeySetup` 與相關 state/effect/styles），並移除 `handleCreateNew` 中已失效的 `if (!hasApiKey)` 阻擋邏輯（此邏輯先前已是 bug，會擋住建立新行程）。
- [src/components/survey/SurveyForm.tsx](src/components/survey/SurveyForm.tsx)：移除 `ApiKeyModal` 相關 state/JSX 與 `MISSING_API_KEY`/`INVALID_API_KEY` 錯誤分支。
- 移除 `expo-secure-store` 依賴（`package.json`）與 Expo plugin（`app.json`），其唯一用途即 `settingsService`。
- 清除 10 個語系檔（`src/i18n/locales/*.json`）中已無用的 `home.apiKeySetup*`／`getFreeApiKey`／`itinerary.apiKeyModal` 等翻譯字串。

### 移除 TOUR_PLAN_RULES 建置同步機制
- `regenerateActivityAlternatives` 改為規則式後，`TOUR_PLAN_RULES`（由 `CLAUDE.md` 經 `scripts/sync-rules.js` 同步至 `src/constants/tourRules.ts`，注入 Gemini prompt）已無任何用途，依使用者指示移除：
  - 刪除 `scripts/sync-rules.js`（及空目錄）、`src/constants/tourRules.ts`。
  - `package.json` 移除 `prestart`/`prebuild`/`preandroid`/`preios`/`preweb`/`prebuild:web` 等同步用 pre-hook。
  - `CLAUDE.md` 標頭移除「建置流程依賴」說明區塊，改為簡述本檔案為規則式行程引擎的設計依據。
- **修改行程規劃業務規則時，直接編輯 `CLAUDE.md` 的「旅遊行程規劃優先級與流程規範」章節即可**，已無自動同步機制（亦無需再同步至任何 `.ts` 檔案）。

### 現況
- 整個 App 已**完全不依賴任何 LLM/Gemini API**，所有功能皆為規則式或內建離線資料。
- `package-lock.json` 已透過 `npm install` 校正，`expo-secure-store` 已從 lockfile 與 `node_modules` 移除。

### 待確認/未完成
- 無新增未完成事項。

---

## 2026-06-13（續）— 目的地指南：涵蓋範圍說明 + 額外國家下載

### 新增 [src/services/guidePacks.ts](src/services/guidePacks.ts)
- `COVERED_GUIDE_COUNTRIES`：內建範本涵蓋的 6 個國家（日本/韓國/越南/台灣/新加坡/泰國）。
- `DOWNLOADABLE_GUIDE_COUNTRIES`：可額外下載的 8 個國家（美國/英國/法國/義大利/澳洲/中國/香港/馬來西亞）。
- `detectGuideCountryKey`：依目的地名稱（中英文/城市名關鍵字）判斷對應 key，原 `getFallbackGuideInfo` 內的 `isJapan`/`isKorea`... 判斷邏輯已改為呼叫此函式。
- `fetchGuidePack(key)`：自 `GUIDE_PACK_BASE_URL/${key}.json` 下載指南範本（呼叫端負責快取）。

### `getDestinationGuideInfo`（[src/services/ai.ts](src/services/ai.ts)）
- 回傳值新增 `isCovered`、`countryKey`、`downloadableCountry` 欄位，供前端判斷是否已涵蓋、是否可下載。

### [DestinationGuide.tsx](src/components/itinerary/DestinationGuide.tsx)
- 新增資訊 Banner：固定顯示「此頁為內建離線指南範本，目前涵蓋：日本／韓國／越南／台灣／新加坡／泰國」。
- 若目的地未涵蓋且在可下載清單中，顯示「下載「OO」專屬指南」按鈕；下載成功後存入本機快取（`@guide_pack_${key}`），離線可用。
- 若目的地不在可下載清單中，僅顯示「目前顯示泰國預設範本」提示，不顯示下載按鈕。

### `GUIDE_PACK_BASE_URL` 部署狀態
- 已於專案根目錄 `guide-packs/` 預先撰寫 8 個國家的範本 JSON（usa/uk/france/italy/australia/china/hongkong/malaysia.json），格式與 `getFallbackGuideInfo` 回傳值相同。
- 使用者已將 `guide-packs/` 內容部署至獨立 GitHub repo `drbarretlin-code/tour-mutilang_guide-packs`（public）。
- [.env](.env) 已設定：
  ```
  EXPO_PUBLIC_GUIDE_PACK_BASE_URL=https://raw.githubusercontent.com/drbarretlin-code/tour-mutilang_guide-packs/refs/heads/main
  ```
- 已用 curl 驗證 `australia.json` 可正常存取（HTTP 200）。

### Node 環境
- 本機已安裝 Homebrew 與 Node（v26.3.0 / npm 11.16.0），路徑為 `/opt/homebrew/bin`。
- `~/.zprofile` 已有 `eval "$(/opt/homebrew/bin/brew shellenv zsh)"`；若新終端機找不到 `node`/`npm`，先執行此 eval 指令載入 PATH。
- `npm install` & `npx tsc --noEmit -p .` 皆已驗證可正常執行且無錯誤。
- `git push` 指令已驗證，專案 repo 為 `https://github.com/drbarretlin-code/tour-mutilang.git`。

---

## 2026-06-13（續）— 日本行程指引修復、移除已取消分頁與叫車平台動態化

### 取消「費用分帳」與「旅遊翻譯」分頁
- 已於 [index.tsx](file:///Users/barretlin/GitProjects/tour-mutilang/app/itinerary/index.tsx) 中移除 `ExpenseSplitter` 與 `TravelTranslator` 元件的 import、JSX 視圖切換區塊，並將其自 ScrollView 分頁導覽列按鈕陣列中刪除，完成了這兩個已取消功能分頁的 UI 移除工作。

### 動態加載機場指引資訊 (解決日本行程顯示泰國 BKK 機場問題)
- 於 [TimelineView.tsx](file:///Users/barretlin/GitProjects/tour-mutilang/src/components/itinerary/TimelineView.tsx) 中新增 `getAirportData(regionName, isArrival, isEn)` 輔助函式。
- 系統現在會根據行程的地區 (`regionName`) 動態偵測所屬國家，並加載對應的機場資訊（如：日本成田 NRT / 羽田 HND、台灣桃園 TPE、泰國 BKK）與對應的國旗 Emoji，以及入境/出境的接駁大眾運輸與報到查驗詳細指引，取代了原先硬編碼泰國 BKK 機場的邏輯。

### 景點名稱中文化翻譯與對齊
- 於 [destinations.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/data/destinations.ts) 中新增了 `findLocalizedName(poiName, lat, lon, locale)` 函式，用於在內建的離線 `destinations.json` 模板庫中，透過經緯度座標（500公尺內）或名稱相似度模糊匹配對應景點/餐廳的翻譯名稱。
- 於 [ai.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/services/ai.ts) 的 `buildDestTemplateFromPOIs` 轉換流程中整合此函式，當系統在線上抓取 OpenTripMap 英文 POI 時，若匹配成功，會自動將其替換/附加為 UI 語系顯示名稱（如繁體中文的「淺草寺與雷門江戶風情」），並將官方當地名稱（如日文的「浅草寺 (雷門)」）作為 `localTitle` 保留，大幅改善了先前日本行程景點沒有中文字的錯誤。

### 動態匹配各國租/包車/叫車平台與 Deep Link
- 於 [TimelineView.tsx](file:///Users/barretlin/GitProjects/tour-mutilang/src/components/itinerary/TimelineView.tsx) 與 [ai.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/services/ai.ts) 中整合 `getRideHailingInfo(regionName, isEn)`，依行程國家動態返回對應的推薦叫車 App：
  - **日本**：推薦 **GO / Uber** (GO App 開啟 Deep Link `taxigo://`)，更新為深色按鈕。
  - **台灣**：推薦 **yoxi / Uber** (yoxi App 開啟 Deep Link `yoxi://`)，按鈕為紅色。
  - **泰國**：推薦 **Grab / Bolt** (開啟 `grab://` / `bolt://`)，按鈕為綠色。
  - **其他**：推薦 **Uber / Google Maps 叫車**。
- [TimelineView.tsx](file:///Users/barretlin/GitProjects/tour-mutilang/src/components/itinerary/TimelineView.tsx) 中同步優化 `handleOpenUrl`，支援 yoxi App 與 GO App 的 Deep Link 跳轉。
---

## 2026-06-13（續）— 機場地圖指引動態化與部落客風格景點名翻譯

### 全球機場指引動態本地化 (不再硬編碼 BKK)
- 重構了 `TimelineView.tsx` 中的 `getAirportData` 函式，其宣告現在接收 `regionName`, `locationName`, `activityTitle`, `isArrival`, `isEn` 五個參數。
- 內建全球主要熱門機場的 Lookup 資料庫（涵蓋日本成田 NRT / 羽田 HND / 關西 KIX、台灣桃園 TPE / 松山 TSA、泰國蘇凡納布 BKK / 廊曼 DMK、韓國仁川 ICN / 金浦 GMP、新加坡樟宜 SIN、英國倫敦希斯洛 LHR、美國紐約甘迺迪 JFK、法國巴黎戴高樂 CDG 等），自動加載正確的機場三字碼、國旗 Emoji 及詳細出入境指引。
- 新增 Generic Fallback 動態解析器，若目的地不在預設庫中，會自動從文字中提取 3 字機場碼（透過 regex），依國家關鍵字判斷國旗，並動態組裝對應 UI 語系（雙語）的抵達/離境指引，徹底解決了先前硬編碼泰國 BKK 的問題。
- 配合更新了 `TimelineView.tsx` 中兩處呼叫 `getAirportData` 的參數傳遞。

### 景點名稱附加 UI 語系顯示名稱 (部落客風格接地氣翻譯)
- 於 `destinations.ts` 中實作了 `translateAndEnhancePoiName` 輔助函式與 `translatePrefix` 首碼字典。
- 當系統透過 OpenTripMap (OTM) 線上 API 抓取 POI，且本地離線 `destinations.json` 查無相符景點時，會自動調用此規則式翻譯器進行美化轉換。
- 針對英文名稱中的常用字根（如 `Museum of Art` 轉為 `市立美術館 (藝術美學巡禮)`、`Cathedral` 轉為 `大教堂 (莊嚴歐風聖地)`、`Castle` 轉為 `歷史古城 (壯麗城堡遺跡)`）以及熱門地標名進行「部落客風格」潤飾，並附加 UI 語系的中文地標名稱（如 `Kyoto Imperial Palace` 翻譯成 `京都御所 古典宮殿 (皇家歷史漫步)`）。
- 在 UI 介面（`TimelineView.tsx`）上維持 `景點美化名稱 [原名/英文名]` 的附加形式，完全避免了生硬的字面音譯，符合觀光指南風格。

### 叫車平台與終點交通指引不一致 Bug 修正
- **問題分析**：截圖中日本行程下方按鈕顯示為日本專屬叫車應用「GO App / Uber App」，但上方交通指引文字與住宿接駁指南卻寫死泰國專屬的「Grab / Bolt」與「Bolt 或 Grab」。此原因為多國語系 json 檔（`en`, `es`, `ja`, `ko`, `ms`, `pt`, `th`, `vi`, `zh-CN`, `zh-TW`）中 `transportAdvice` 與 `shuttleGuideDesc` 欄位將平台名稱硬編碼。
- **解決方案**：
  - 將 `TimelineView.tsx` 中 `hailingInfo` 的定義提升至整個 `isLast` 區塊頂部（讓 JSX 範疇外與 IIFE 範疇皆能存取）。
  - 將多語系呼叫 `t('itinerary.timelineView.endOfDay.transportAdvice')` 與 `t('itinerary.timelineView.endOfDay.shuttleGuideDesc')` 修改為動態傳入變數 `{ platforms: hailingInfo.transitLabel }`。
  - 編寫自動化 Python 腳本對 10 個多國語系 JSON 檔案進行批次修改，將硬寫死「Grab / Bolt」或「Bolt 或 Grab」的句子轉化為動態佔位符 `%{platforms}`，使終點交通指引與下方按鈕叫車平台完全吻合。

### 景點名稱顯示順序修正與餐廳 UI 語系當地名稱補強
- **問題分析**：截圖中景點顯示為 `Shinjuku Niagara Falls [Shinjuku Niagara Falls]` 且午餐顯示為 `Kyubei Sushi... [Kyubei Sushi...]`，此代表：
  1. 顯示順序與使用者要求相反：使用者要求前面顯示當地語系文字，後面顯示 UI 語系當地名稱。
  2. 上游 `ai.ts` 的餐廳資料在產生 `seeds` 時漏掉了呼叫 `findLocalizedName` 進行翻譯美化，導致 `title` 與 `localTitle` 都是英文原名。
  3. `Shinjuku Niagara Falls` 及其詞根沒有在字典中，故落入 default 導致顯示為原名。
- **解決方案**：
  - **順序調整**：重構 [TimelineView.tsx](file:///Users/barretlin/GitProjects/tour-mutilang/src/components/itinerary/TimelineView.tsx) 中活動標題渲染，新增 `renderActivityTitle` 輔助函式，使常規卡片顯示為 `當地語系文字 [UI 語系當地名稱]`。且在 UI 渲染層加上防禦性 UI 語系翻譯自癒（若 `uiName` 不含當地文字且 `locale` 符合時，動態重新嘗試呼叫 `findLocalizedName` 進行補強翻譯）。
  - **餐廳種子翻譯補強**：在 [ai.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/services/ai.ts) 中產生 `foodPois` 的 `seeds` 時，補上 `findLocalizedName` 呼叫，使餐廳也能成功取得符合該 UI 語系之當地名稱。
  - **補全熱門景點與字尾對照**：於 [destinations.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/data/destinations.ts) 中補強了知名景點與飯店（如 `Shinjuku Niagara Falls`、`Kyubei Sushi`、`Keio Plaza Hotel` 等）的精準 blogger 風格之 UI 語系語譯，並在 `suffixMap` 增加 `falls`、`waterfall`、`sushi` 的字尾比對規則。

---

## 2026-06-14 — 返回飯店時間 21:00 限制修正與景點描述個性化

### 返回飯店時間強制遵循 21:00 規則
- **問題分析**：中間天數（非首日、非尾日）的「返回飯店休息」活動節點，其時間是由當日最後一個活動的結束時間動態推算而來。然而原始邏輯僅做 `addMinutesToTime(lastAct.endTime, transportDuration)` 而未檢查是否超過每日活動截止時間 21:00，導致「緊湊步調 (packed)」模式下新增的晚間活動會將回程時間推至 21:30 甚至更晚，違反 CLAUDE.md 規範三（每日活動時間 08:00-21:00）。
- **解決方案**：於 [ai.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/services/ai.ts) 中的「返回飯店」活動生成區段（原 line 1317-1321，現 line 1317-1340）新增 `RETURN_DEADLINE = '21:00'` 常數與回推校正邏輯：
  1. 計算回程後若 `returnEndTime > '21:00'`，則將 `returnEndTime` 鉗制為 `'21:00'`、`returnStartTime` 回推為 `'20:30'`。
  2. 若回推後 `returnStartTime` 仍與上一個活動的結束時間衝突（含交通車程），則自動壓縮上一個活動的 `endTime` 與 `duration`（最低 30 分鐘），確保整段時間鏈合理銜接。
  3. 此修改與 `clampFallbackItineraryTimes` 的全域 08:00-21:00 校正互不衝突（clamp 為事後補網，此處為事前精準生成）。

### 景點描述個性化（解決吃的、逛的介紹大同小異問題）
- **問題分析**：當使用 OpenTripMap API 即時抓取 POI 後，`buildPoiDescription` 函式依「分類 (category)」組裝描述，導致同類型景點（如所有寺廟、所有公園）的介紹內容幾乎雷同，缺乏個別景點的獨特特色，使用者體驗差。然而 `destinations.json` 內建資料庫中每個景點都有量身撰寫的 300 字以上獨特描述（如淺草寺的 628 年創寺傳說、澀谷十字路口的三千人同時通過數據），卻未被 OTM 流程引用。
- **解決方案**：
  1. 於 [destinations.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/data/destinations.ts) 新增 `findLocalizedDescription(poiName, lat, lon, locale)` 匯出函式，採用與 `findLocalizedName` 相同的座標比對（經緯度差值 < 0.005）+ 文字名稱比對兩階段策略，查詢內建資料庫中的 `desc` 欄位。
  2. 於 [ai.ts](file:///Users/barretlin/GitProjects/tour-mutilang/src/services/ai.ts) 的 `buildDestTemplateFromPOIs` 中，新增 `findLocalizedDescription` 優先查詢邏輯：匹配成功時直接使用內建的獨特描述，未匹配時才退回 `buildPoiDescription` 的分類式通用描述。
  3. 餐廳種子 (`restByDest`) 的描述生成同步改用 `findLocalizedDescription || buildPoiDescription` 策略，確保餐廳也能取得個性化介紹。
  4. 此修改與既有的維基百科摘要補強 (`fetchWikipediaSummaries`) 不衝突：維基百科補強在 `buildDestTemplateFromPOIs` 之後執行，僅當維基摘要更長時才覆寫，因此流程為「內建獨特描述 > 分類通用描述 > 維基百科摘要（擇長覆寫）」。


---

## 2026-06-14（續2）— 離線模式誤判與景點重複問題修正

### 修正 Wikipedia 後援誤判觸發離線模式
- **問題分析**：當使用者沒有 OpenTripMap 金鑰，或金鑰被環境變數吃掉時，系統會自動後援到 Wikipedia GeoSearch。但若 Wikipedia 針對該地回傳 0 筆景點，程式會直接拋出 `OTM_NO_KEY` 錯誤。這個錯誤在 `PACEngine` 中被視為致命錯誤，導致行程引擎完全放棄後續處理，直接顯示「離線模式」警告標語。
- **解決方案**：在 `poi.ts` 的 Wikipedia 後援邏輯中，將找不到景點的情境從拋出錯誤改為正常回傳空陣列 `[]`。如此一來，系統會正確認知為「該地查無景點」而非「網路或金鑰連線中斷」，從而繼續使用內建範本或自訂景點，不再隨意跳出離線警告。

### 修正 Rule-Based 引擎生成的景點重複問題與空值列
- **問題分析**：當目的地的景點數量（含 OTM 與內建）少於行程所需數量時，舊版 `selectAttraction` 函式會使用 `usedIndices.size % tpl.titles.length` 進行迴圈取值，導致短時間內產生大量重複景點。且如果範本因故完全為空，此邏輯還會造成空標題的「空值列」出現在 TimelineUI 中。
- **解決方案**：
  1. 修改 `selectAttraction`，當所有獨特景點都用完時不再 wrap around，而是直接回傳 `-1` 標記「無景點可用」。
  2. 在 `generateFallbackItinerary` 中攔截 `-1` 的情況，自動安插通用型的「市區觀光 / 自由活動 (City Sightseeing / Free Time)」時段，並配以適合該時段（上、下午、夜間）的描述文字與預設圖示。徹底解決景點重複與無標題空值列的問題。

### 重新套用 async 修正
- **狀態補網**：重新套用了前一輪的 `generateFallbackItinerary` 轉為 `async` 並使用 `await` 呼叫的修復，確保 Promise 不會因為競態條件而造成後續的錯誤。

### 移除累贅的「探索體驗」後綴
- **問題分析**：前次更新的 `translateAndEnhancePoiName` 函式中，當 OpenTripMap (OTM) 取得真實景點但名稱無法匹配已知的英文後綴字根（如 Museum, Castle）時，會強制加上通用的 UI 語系後綴（如中文的「 探索體驗」）。這導致在 OTM 回傳真實資料（例如當地的夜市 `Khlong Thom Centre` 或餐廳）時，皆被不自然地冠上「探索體驗」，使使用者誤以為系統沒有產生真實景點。
- **解決方案**：在 `destinations.ts` 中，將 Fallback 邏輯改為「直接返回原名」，移除強制附加後綴的行為。現在系統會原汁原味地顯示 OTM 回傳的當地景點真實名稱，不再產生令人困惑的重複字綴。

### 實作動態旅遊指南包 (Guide Pack) 預載機制與簡化問卷
- **問題分析**：使用者反應 OTM 抓取真實景點時，即使移除了預設後綴，但原本單純的機器直譯無法提供如官方地圖或部落客般豐富的在地化說明，且問卷中上傳檔案的功能形同虛設（因後端改為純離線規則引擎，無法用語意分析理解檔案內容）。
- **解決方案**：
  1. 移除了 `StepAttractions.tsx` 中上傳參考檔案與必去景點檔案的按鈕與邏輯，讓填寫介面更為俐落。
  2. 透過子代理 (`guide_pack_agent`) 新增了 `guidePackManager.ts`，負責模擬/實作 OTA (Over-The-Air) 下載機制。當使用者選擇未建檔的目的地時，行程引擎會提前預載該地的專屬 Guide Pack。
  3. 整合至 `ai.ts`：在 `buildDestTemplateFromPOIs` 中，當 OTM 回傳景點時，若在已下載的指南包內有對應的高品質資料（如部落客撰寫的描述、精準的在地名稱與官方相片），會優先取代 OTM 的預設資料。如此一來，即可給出「使用者可理解」的高品質內容，而非冷硬的翻譯。

### 介面優化：問卷欄位排序與最後編修日期
- **問卷欄位排序**：根據行程引擎的處理優先順序（特定地點 > 必去景點 > 參考景點），已將 `StepAttractions.tsx` 中的區塊由上而下重新排序，讓使用者的填寫動線更符合系統設計邏輯。
- **最後編修日期**：在首頁儀表板的行程卡片 (`ItineraryCard.tsx`) 中，已加入顯示行程的最後一次編修日期 (`updatedAt`)，方便使用者識別與管理已完成或修改過的行程。
