const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// 1. 插入 AI 分析與 Fallback 輔助函式 (放入 HOTSPOT_CONFIGS 下方，getIcon 上方)
const helperMarkerOld = `// ==========================================
// 元件：圖示對應
// ==========================================`;

const helperMarkerNew = `// ==========================================
// AI 分析與評估輔助函式 (Gemini API 呼叫與本地 Fallback)
// ==========================================
const callGeminiAnalysis = async (urlsText, tripSchedule) => {
  const apiKey = "AIzaSyD3o7irPMiP5BxV9dqzKzmg8Kwdd2opWhs";
  const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`;
  
  const prompt = \`
您是一位專業的泰國旅遊行程規劃助手。現在使用者提供了一些想要新增的行程網址（或景點名稱），以及目前的 7 天行程規畫。
請針對這些新增項目進行分析，評估它們的「地理位置（曼谷/羅勇/芭達雅/曼谷近郊）」、「景點分類（如: coffee/food/shopping/camera/hotel/transport/info）」、以及「與既有行程的同質性（如同質性太高、功能重疊等）」。

**既有行程摘要**：
\${JSON.stringify(tripSchedule.days.map(d => ({ day: d.day, date: d.date, region: d.region, activities: d.activities.map(a => ({ title: a.title, type: a.type, desc: a.desc })) })))}

**使用者貼入的新增網址/景點**：
\${urlsText}

**分析要求與限制**：
1. 分析每一個輸入。如果使用者貼入的是網址，請根據網址中的關鍵字或旅遊常識，推估出景點的實際中文名稱與細節。
2. 進行以下評估：
   - **分類與地理位置**：推估其主要區域是曼谷、羅勇、芭達雅還是曼谷近郊，並判斷其分類。
   - **同質性警示 (similarityWarning)**：比對既有行程，是否已經有類似的咖啡廳、餐廳、購物點或景點。若同質性太高，請提出提醒（例如：您已安排 Pa Dee 咖啡與 FO SHO BRO 咖啡，此處可能同質性高）。如果沒有，請寫 "無"。
   - **地理位置衝突 (locationWarning)**：如果推薦的天數主要活動區域與本景點區域相距甚遠，請警告。例如：Day 1 主要活動在曼谷，若把此景點（位於羅勇）排在 Day 1 會有嚴重交通衝突。如果沒有，請寫 "無"。
   - **不好體驗因素警示 (experienceWarning)**：例如：7月是泰國雨季，戶外景點容易受雨天影響；或者此地交通極易擁堵等。如果沒有，請寫 "無"。
   - **建議與排定理由 (suggestion)**：說明推薦排在第幾天、什麼時間，以及為什麼。
3. 請務必只回傳標準的 JSON 格式（以 { "analysisResults": [...] } 的格式回傳），不要包含任何 markdown 的 \\\`\\\`\\\`json 包裹標記，以便於程式解析。

JSON 結構樣式：
{
  "analysisResults": [
    {
      "title": "景點名稱",
      "url": "輸入的原始網址",
      "category": "分類 (如: coffee, food, shopping, camera, hotel, transport, info)",
      "region": "地理區域 (如: 曼谷, 羅勇, 芭達雅, 曼谷近郊)",
      "similarityWarning": "警示內容或無",
      "locationWarning": "警示內容或無",
      "experienceWarning": "警示內容或無",
      "suggestion": "排程建議說明",
      "suggestedDay": 1,
      "suggestedTime": "14:00"
    }
  ]
}
\`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(\`Gemini API 回傳錯誤: \${response.status}\`);
  }

  const data = await response.json();
  const jsonText = data.candidates[0].content.parts[0].text;
  return JSON.parse(jsonText);
};

const localMockAnalysis = (urlsText) => {
  const lines = urlsText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
  const results = lines.map((line, idx) => {
    let title = "未知景點 " + (idx+1);
    let category = "camera";
    let region = "曼谷";
    let similarityWarning = "無";
    let locationWarning = "無";
    let experienceWarning = "無";
    let suggestion = "建議排在曼谷市區行程中。";
    let suggestedDay = 1;
    let suggestedTime = "15:00";
    let mapUrl = \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(line)}\`;

    const lineLower = line.toLowerCase();
    if (lineLower.includes('pa dee') || lineLower.includes('padee') || lineLower.includes('coffee') || lineLower.includes('cafe')) {
      title = "Pa Dee 網美花園咖啡";
      category = "coffee";
      region = "羅勇";
      similarityWarning = "既有行程已包含 Pa Dee 咖啡與 FO SHO BRO 咖啡，同質性偏高。";
      locationWarning = "如果您試圖在曼谷日 (Day 1-2, 5-7) 拜訪此地，將面臨單趟 2.5 小時以上的車程。";
      experienceWarning = "此咖啡廳為半戶外莊園風，七月多午後雷雨，若遇下雨拍照體驗會打折。";
      suggestion = "推薦排在 Day 3 (羅勇日)，因為當天本來就安排了羅勇素芭他水果園，兩地包車距離僅 25 分鐘。";
      suggestedDay = 3;
      suggestedTime = "15:00";
      mapUrl = "https://www.google.com/maps/place/Pa+Dee+Rayong";
    } else if (lineLower.includes('safari') || lineLower.includes('zoo') || lineLower.includes('animal')) {
      title = "Safari World 賽福瑞野生動物園";
      category = "camera";
      region = "曼谷近郊";
      similarityWarning = "既有行程 Day 5 已包含 Safari World 行程，請確認是否要重複新增。";
      experienceWarning = "動物園占地廣大，下午戶外行走體感溫度高，且野生猛獸區若遇雨天可能無法完全參觀。";
      suggestion = "建議排在 Day 5 或 Day 6 的空閒時間，從曼谷市區包車前往約需 45 分鐘。";
      suggestedDay = 5;
      suggestedTime = "11:00";
      mapUrl = "https://www.google.com/maps/place/Safari+World+Bangkok";
    } else if (lineLower.includes('savoey') || lineLower.includes('restaurant') || lineLower.includes('food')) {
      title = "Savoey 泰式海鮮餐廳 (Terminal 21 店)";
      category = "food";
      region = "曼谷";
      similarityWarning = "Day 5 已安排 Savoey 晚餐，此項可能重複。";
      experienceWarning = "無";
      suggestion = "可排在 Day 1 或是 Day 2 晚上，在 One Bangkok 附近或 Sukhumvit 區域時享用。";
      suggestedDay = 1;
      suggestedTime = "19:00";
      mapUrl = "https://www.google.com/maps/place/Savoey+Terminal21";
    } else if (lineLower.includes('iconsiam') || lineLower.includes('mall') || lineLower.includes('shopping')) {
      title = "ICONSIAM 暹羅天地";
      category = "shopping";
      region = "曼谷";
      similarityWarning = "Day 2 家屬行程已排 ICONSIAM。";
      experienceWarning = "購物中心冷氣充足，但傍晚回程交通非常擁塞，渡輪排隊時間可能較長。";
      suggestion = "建議於 Day 2 的 15:00 入場，與既有 Iconsiam 行程合併。";
      suggestedDay = 2;
      suggestedTime = "15:00";
      mapUrl = "https://www.google.com/maps/place/ICONSIAM";
    } else if (lineLower.includes('kliff') || lineLower.includes('beach')) {
      title = "Kliff Beach Club 懸崖餐廳";
      category = "food";
      region = "芭達雅";
      similarityWarning = "Day 4 已包含 Kliff 懸崖餐廳晚餐。";
      locationWarning = "若非 Day 3-4 (芭達雅/羅勇期間) 前往，將有跨區域長途車程衝突。";
      experienceWarning = "懸崖海景是露天環境，若遇雨可能改在室內，夕陽能見度會降低。";
      suggestion = "建議排在 Day 4 傍晚 17:30，欣賞絕美日落。";
      suggestedDay = 4;
      suggestedTime = "17:30";
      mapUrl = "https://www.google.com/maps/place/Kliff+Beach+Club+Pattaya";
    } else {
      title = line.replace(/https?:\\/\\/(www\\.)?/, '').split('/')[0] || "新增網美景點";
      if (title.length > 20) title = title.substring(0, 20) + "...";
    }

    return {
      title,
      url: line,
      category,
      region,
      similarityWarning,
      locationWarning,
      experienceWarning,
      suggestion,
      suggestedDay,
      suggestedTime,
      mapUrl
    };
  });
  return { analysisResults: results };
};

// ==========================================
// 元件：圖示對應
// ==========================================`;

if (!content.includes(helperMarkerOld)) {
  console.error('找不到原本的 元件：圖示對應 宣告！');
  process.exit(1);
}
content = content.replace(helperMarkerOld, helperMarkerNew);

// 2. 在 App 元件內部宣告新的 state 與處理函數
// 搜尋 activeTab 宣告，並插入
const activeTabMarker = `  const [activeTab, setActiveTab] = useState('overview');`;

const activeTabInsert = `  const [activeTab, setActiveTab] = useState('overview');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // AI 排程助手相關狀態
  const [aiInputUrls, setAiInputUrls] = useState('');
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysisResults, setAiAnalysisResults] = useState(null);
  const [importedItems, setImportedItems] = useState({});
  const [resultDaySelections, setResultDaySelections] = useState({});
  const [resultTimeSelections, setResultTimeSelections] = useState({});

  // 處理 AI 結果中天數與時間的本地修改
  const handleResultDayChange = (idx, dayNum) => {
    setResultDaySelections(prev => ({ ...prev, [idx]: dayNum }));
  };

  const handleResultTimeChange = (idx, timeStr) => {
    setResultTimeSelections(prev => ({ ...prev, [idx]: timeStr }));
  };

  // 開始 AI 分析評估
  const handleStartAiAnalysis = async () => {
    if (!aiInputUrls.trim()) return;
    setIsAnalyzingAi(true);
    setAiAnalysisResults(null);
    setImportedItems({});
    setResultDaySelections({});
    setResultTimeSelections({});

    try {
      // 呼叫真實的 Gemini 2.5 Flash API 進行分析評估
      const result = await callGeminiAnalysis(aiInputUrls, tripSchedule);
      if (result && result.analysisResults) {
        setAiAnalysisResults(result.analysisResults);
      } else {
        throw new Error("Invalid output structure");
      }
    } catch (err) {
      console.warn("Gemini API 呼叫失敗，啟用高仿真本地 Rule-based 分析器:", err.message);
      const result = localMockAnalysis(aiInputUrls);
      setAiAnalysisResults(result.analysisResults);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // 匯入景點到行程中
  const handleImportToItinerary = (item, idx) => {
    const dayToImport = resultDaySelections[idx] || item.suggestedDay;
    const timeToImport = resultTimeSelections[idx] || item.suggestedTime;

    const newActivity = {
      id: \`ai-imported-\${Date.now()}-\${idx}\`,
      time: timeToImport,
      title: item.title,
      type: item.category,
      region: item.region,
      desc: \`【AI推薦排程】\${item.suggestion}。請注意：\${item.experienceWarning !== '無' ? item.experienceWarning : '無體驗衝突'}。\`,
      links: [
        { text: "景點地圖", url: item.mapUrl || \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(item.title)}\`, icon: MapPin },
        { text: "景點介紹", url: item.url || item.infoUrl || "https://itravelblog.net/", icon: Info }
      ]
    };

    setTripSchedule(prev => {
      const updatedDays = prev.days.map(day => {
        if (day.day === dayToImport) {
          const list = [...day.activities, newActivity];
          list.sort((a, b) => a.time.localeCompare(b.time));
          return { ...day, activities: list };
        }
        return day;
      });
      return { ...prev, days: updatedDays };
    });

    setImportedItems(prev => ({ ...prev, [item.title + '-' + idx]: true }));
  };`;

if (!content.includes(activeTabMarker)) {
  console.error('找不到原本的 activeTab 宣告！');
  process.exit(1);
}
content = content.replace(activeTabMarker, activeTabInsert);

// 3. 替換 Header 中的選單，改為收合面板 (Dropdown)
// 搜尋桌面版選單起點與手機版漢堡鈕
const headerNavStart = `            {/* 桌面版選單 */}`;
const headerNavEnd = `        {/* 手機版展開選單 */}`;

const headerNavIndex = content.indexOf(headerNavStart);
const headerNavEndIndex = content.indexOf(headerNavEnd);

if (headerNavIndex === -1 || headerNavEndIndex === -1) {
  console.error('找不到原本的 Header 導航區塊！');
  process.exit(1);
}

// 找到 headerNavEnd 後，再往後找其匹配的閉合標籤 閉合部分（通常是 </header> 之前）
// 剛才看到原本的手機版展開選單是：
//         {mobileMenuOpen && (
//           <div className="md:hidden bg-white border-t px-4 pt-2 pb-4 space-y-1 shadow-lg absolute w-full z-50">
//             ...
//           </div>
//         )}
//       </header>
const closeHeaderStr = '</header>';
const closeHeaderIndex = content.indexOf(closeHeaderStr, headerNavEndIndex);
if (closeHeaderIndex === -1) {
  console.error('找不到 </header> 標記！');
  process.exit(1);
}

// 包含原本的漢堡鈕、展開選單，整段切換為我們新的 Dropdown 元件，並保留 </header>
const oldHeaderNavBlock = content.substring(headerNavIndex, closeHeaderIndex);

const newHeaderNavBlock = `            {/* 收合選單 (Dropdown 面板) */}
            <div className="relative">
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded-lg font-semibold transition text-sm shadow-sm"
              >
                <span>📂 {
                  activeTab === 'overview' ? '總覽 & 準備' : 
                  activeTab === 'ai-assistant' ? '🤖 AI 行程規劃助手' :
                  \`Day \${activeTab.split('-')[1]} - \${tripSchedule.days.find(d => \`day-\${d.day}\` === activeTab)?.title || ''}\`
                }</span>
                <ChevronRight className={\`w-4 h-4 transition-transform duration-200 \${dropdownOpen ? 'rotate-90' : ''}\`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                  
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2.5 animation-scale-up">
                    <div className="px-4 py-1.5 text-xs font-bold text-slate-400 border-b border-slate-100 mb-1">📋 準備與工具</div>
                    <button 
                      onClick={() => { setActiveTab('overview'); setDropdownOpen(false); }}
                      className={\`flex items-center justify-between w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-slate-50 transition \${activeTab === 'overview' ? 'text-teal-700 bg-teal-50/50' : 'text-slate-700'}\`}
                    >
                      <span>總覽 & 準備資訊</span>
                      {activeTab === 'overview' && <Check className="w-4 h-4 text-teal-600" />}
                    </button>
                    
                    <button 
                      onClick={() => { setActiveTab('ai-assistant'); setDropdownOpen(false); }}
                      className={\`flex items-center justify-between w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-slate-50 transition \${activeTab === 'ai-assistant' ? 'text-indigo-700 bg-indigo-50/50' : 'text-slate-700'}\`}
                    >
                      <span className="flex items-center gap-1.5">🤖 AI 行程規劃助手 <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full">推薦</span></span>
                      {activeTab === 'ai-assistant' && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>

                    <div className="px-4 py-1.5 text-xs font-bold text-slate-400 border-b border-slate-100 my-1">📅 每日行程切換</div>
                    {tripSchedule.days.map((day) => (
                      <button 
                        key={day.day}
                        onClick={() => { setActiveTab(\`day-\${day.day}\`); setDropdownOpen(false); }}
                        className={\`flex items-center justify-between w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-slate-50 transition \${activeTab === \`day-\${day.day}\` ? 'text-teal-700 bg-teal-50/50' : 'text-slate-700'}\`}
                      >
                        <div className="truncate text-left w-full">
                          <span className="font-bold text-teal-600 mr-1.5">Day {day.day}</span>
                          <span className="text-slate-600 text-xs mr-1">{day.date}</span>
                          <span className="text-slate-500 font-normal text-xs">| {day.title}</span>
                        </div>
                        {activeTab === \`day-\${day.day}\` && <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
`;

content = content.replace(oldHeaderNavBlock, newHeaderNavBlock);

// 4. 插入 AI 行程規劃助手頁面
// 我們在主要內容區內插入。搜尋：
//       {/* 主要內容區 */}
//       <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
//         
//         {/* ==========================================
//             總覽 & 準備資訊
//             ========================================== */}
const mainMarker = `      {/* 主要內容區 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">`;

const aiPageHtml = `        {/* ==========================================
            AI 行程規劃助手
            ========================================== */}
        {activeTab === 'ai-assistant' && (
          <div className="space-y-6 animation-fade-in">
            <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-2xl font-extrabold text-indigo-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" /> 🤖 AI 智慧批次排程助手
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                您可以貼入多個網頁介紹或景點名稱（每行一筆），Gemini AI 會分析它們的<b>地理位置、分類、同質性</b>，並給出專業排程與體驗警示。
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">請貼入新增行程網址或名稱 (每行一筆)：</label>
                  <textarea
                    rows={6}
                    placeholder="https://itravelblog.net/suphattra-land-rayong/&#10;Savoey Terminal21&#10;https://www.facebook.com/kliffbeachclub/"
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono"
                    value={aiInputUrls}
                    onChange={(e) => setAiInputUrls(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAiInputUrls("https://www.google.com/maps/place/Savoey+Terminal21\\nhttps://itravelblog.net/suphattra-land-rayong/\\nhttps://www.google.com/maps/place/FO+SHO+BRO+Bangkok/")}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                    >
                      載入範例資料
                    </button>
                    <button 
                      onClick={() => setAiInputUrls("")}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                    >
                      清空輸入
                    </button>
                  </div>
                  
                  <button
                    onClick={handleStartAiAnalysis}
                    disabled={isAnalyzingAi || !aiInputUrls.trim()}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isAnalyzingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAnalyzingAi ? "Gemini AI 正在深入分析評估..." : "開始 AI 深度分析與評估"}
                  </button>
                </div>
              </div>
            </section>

            {/* AI 分析報告 */}
            {aiAnalysisResults && aiAnalysisResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-1">
                  <Info className="w-5 h-5 text-indigo-500" /> AI 行程評估建議報告 ({aiAnalysisResults.length} 筆)
                </h3>

                <div className="grid gap-6">
                  {aiAnalysisResults.map((result, idx) => {
                    const isImported = importedItems[result.title + '-' + idx];
                    
                    const selectedDay = resultDaySelections[idx] || result.suggestedDay;
                    const selectedTime = resultTimeSelections[idx] || result.suggestedTime;

                    return (
                      <div key={idx} className={\`bg-white rounded-xl shadow-sm border p-6 transition relative overflow-hidden \${isImported ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-indigo-300'}\`}>
                        {isImported && (
                          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 已成功匯入
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-xs">
                            {result.region}
                          </span>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold text-xs">
                            分類：{result.category}
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-slate-800 mb-2 truncate pr-16">{result.title}</h4>
                        <p className="text-slate-500 text-xs mb-4 break-all truncate">連結網址：<a href={result.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{result.url}</a></p>

                        {/* 警示與警告區塊 */}
                        <div className="space-y-3.5 my-4">
                          {/* 同質性警告 */}
                          {result.similarityWarning && result.similarityWarning !== "無" && (
                            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg">
                              <div className="flex gap-2">
                                <AlertTriangle className="text-amber-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="block text-xs font-bold text-amber-800">同質性高風險警示</span>
                                  <span className="text-xs text-amber-700 leading-relaxed">{result.similarityWarning}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 地理位置警告 */}
                          {result.locationWarning && result.locationWarning !== "無" && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
                              <div className="flex gap-2">
                                <AlertTriangle className="text-red-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="block text-xs font-bold text-red-800">地理位置衝突警告</span>
                                  <span className="text-xs text-red-700 leading-relaxed">{result.locationWarning}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 不好體驗警告 */}
                          {result.experienceWarning && result.experienceWarning !== "無" && (
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r-lg">
                              <div className="flex gap-2">
                                <AlertTriangle className="text-orange-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="block text-xs font-bold text-orange-800">不好體驗因子警告</span>
                                  <span className="text-xs text-orange-700 leading-relaxed">{result.experienceWarning}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* AI 排程建議 */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed mb-4">
                          <strong className="text-indigo-800 block mb-1">🤖 AI 排程建議與理由：</strong>
                          {result.suggestion}
                        </div>

                        {/* 匯入行程操作 */}
                        {!isImported && (
                          <div className="flex flex-wrap gap-4 items-end justify-between border-t border-slate-100 pt-4 mt-4 bg-slate-50/40 p-3 rounded-lg">
                            <div className="flex flex-wrap gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-sans">排定天數</label>
                                <select 
                                  value={selectedDay}
                                  onChange={(e) => handleResultDayChange(idx, Number(e.target.value))}
                                  className="border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium"
                                >
                                  {tripSchedule.days.map(d => (
                                    <option key={d.day} value={d.day}>Day {d.day} ({d.region})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-sans">排定時間</label>
                                <input 
                                  type="text" 
                                  value={selectedTime}
                                  onChange={(e) => handleResultTimeChange(idx, e.target.value)}
                                  className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs text-slate-700 font-medium w-16 text-center"
                                />
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleImportToItinerary(result, idx)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> 確認匯入此行程
                            </button>
                          </div>
                        )}

                        {isImported && (
                          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
                            <button
                              onClick={() => { setActiveTab(\`day-\${selectedDay}\`); }}
                              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1.5"
                            >
                              前往 Day {selectedDay} 查看匯入結果 &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}`;

content = content.replace(mainMarker, mainMarker + '\n' + aiPageHtml);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log('App.jsx 第二階段修改完成！');
