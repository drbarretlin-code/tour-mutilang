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
