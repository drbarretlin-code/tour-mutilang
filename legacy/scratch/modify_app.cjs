const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// 1. 替換 state 宣告
const stateOld = `  const [formLinkText, setFormLinkText] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');`;

const stateNew = `  const [formMapUrl, setFormMapUrl] = useState('');
  const [formInfoUrl, setFormInfoUrl] = useState('');`;

if (!content.includes(stateOld)) {
  console.error('找不到原本的 state 宣告！');
  process.exit(1);
}
content = content.replace(stateOld, stateNew);

// 2. 替換 openEditModal 內的連結載入
const openEditOld = `    setFormLinkText(activity.links && activity.links.length > 0 ? activity.links[0].text : '');
    setFormLinkUrl(activity.links && activity.links.length > 0 ? activity.links[0].url : '');`;

const openEditNew = `    const mapLink = activity.links?.find(l => l.text.includes("地圖") || l.text.includes("導航") || l.text.includes("位置"));
    const infoLink = activity.links?.find(l => l.text.includes("介紹") || l.text.includes("攻略") || l.text.includes("遊玩") || l.text.includes("環境") || l.text.includes("食記") || l.text.includes("體驗") || l.text.includes("官網"));
    setFormMapUrl(mapLink ? mapLink.url : '');
    setFormInfoUrl(infoLink ? infoLink.url : '');`;

if (!content.includes(openEditOld)) {
  console.error('找不到原本的 openEditModal 連結載入！');
  process.exit(1);
}
content = content.replace(openEditOld, openEditNew);

// 3. 替換 openAddModal 內的連結清除
const openAddOld = `    setFormLinkText('');
    setFormLinkUrl('');`;

const openAddNew = `    setFormMapUrl('');
    setFormInfoUrl('');`;

if (!content.includes(openAddOld)) {
  console.error('找不到原本的 openAddModal 連結清除！');
  process.exit(1);
}
content = content.replace(openAddOld, openAddNew);

// 4. 替換 handleSaveActivity 中的 links 儲存
const saveOld = `      links: formLinkText && formLinkUrl ? [{ text: formLinkText, url: formLinkUrl, icon: ExternalLink }] : []`;

const saveNew = `      links: (() => {
        const linksArr = [];
        if (formMapUrl.trim()) {
          linksArr.push({ text: "景點地圖", url: formMapUrl, icon: MapPin });
        }
        if (formInfoUrl.trim()) {
          linksArr.push({ text: "景點介紹", url: formInfoUrl, icon: Info });
        }
        return linksArr;
      })()`;

if (!content.includes(saveOld)) {
  console.error('找不到原本的 handleSaveActivity 連結儲存！');
  process.exit(1);
}
content = content.replace(saveOld, saveNew);

// 5. 替換活動卡片的連結渲染 UI
const cardLinksOld = `                        {/* 動作按鈕 / 連結區 */}
                        {act.links && act.links.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {act.links.map((link, idx) => {
                              const Icon = link.icon || ExternalLink;
                              return (
                                <a 
                                  key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-100 transition"
                                >
                                  <Icon className="w-4 h-4" /> {link.text}
                                </a>
                              );
                            })}
                          </div>
                        )}`;

const cardLinksNew = `                        {/* 動作按鈕 / 連結區 */}
                        {act.links && act.links.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {act.links.map((link, idx) => {
                              const isMap = link.text.includes("地圖") || link.text.includes("位置");
                              const isInfo = link.text.includes("介紹") || link.text.includes("攻略") || link.text.includes("食記") || link.text.includes("遊玩");
                              const isRoute = link.text.includes("路線") || link.text.includes("導航");
                              
                              let btnClass = "bg-slate-50 text-slate-700 hover:bg-slate-100";
                              if (isMap) btnClass = "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100";
                              else if (isInfo) btnClass = "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100";
                              else if (isRoute) btnClass = "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100";
                              
                              const Icon = isMap ? MapPin : (isRoute ? Navigation : Info);

                              return (
                                <a 
                                  key={idx} href={link.url} target="_blank" rel="noopener noreferrer"
                                  className={\`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition \${btnClass}\`}
                                >
                                  <Icon className="w-3.5 h-3.5" /> {link.text}
                                </a>
                              );
                            })}
                          </div>
                        )}`;

if (!content.includes(cardLinksOld)) {
  console.error('找不到原本的卡片連結渲染 UI！');
  process.exit(1);
}
content = content.replace(cardLinksOld, cardLinksNew);

// 6. 替換 Modal UI 中的參考連結輸入區
const modalInputOld = `              {/* 參考連結 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">參考網址 / 預訂連結</span>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="連結標題 (如：看食記)" 
                    className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-500"
                    value={formLinkText}
                    onChange={(e) => setFormLinkText(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="URL 網址 (https://...)" 
                    className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-500"
                    value={formLinkUrl}
                    onChange={(e) => setFormLinkUrl(e.target.value)}
                  />
                </div>
              </div>`;

const modalInputNew = `              {/* 參考連結 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">參考網址 (地圖 & 介紹雙連結)</span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-16">🗺️ 地圖連結:</span>
                    <input 
                      type="text" 
                      placeholder="Google 地圖網址 (https://maps.google.com/...)" 
                      className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-500 flex-1"
                      value={formMapUrl}
                      onChange={(e) => setFormMapUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-16">ℹ️ 介紹連結:</span>
                    <input 
                      type="text" 
                      placeholder="部落格或景點介紹網址 (https://...)" 
                      className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-500 flex-1"
                      value={formInfoUrl}
                      onChange={(e) => setFormInfoUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>`;

if (!content.includes(modalInputOld)) {
  console.error('找不到原本的 Modal 參考連結輸入區！');
  process.exit(1);
}
content = content.replace(modalInputOld, modalInputNew);

// 7. 在 App 組件內插入動態比對與路線配置變數
const activeTabOld = `  const [activeTab, setActiveTab] = useState('overview');`;

const activeTabNew = `  const [activeTab, setActiveTab] = useState('overview');
  
  // 收集行程中所有的景點標題（做關鍵字比對用，自動清理無效熱區）
  const allActivityTitles = tripSchedule.days.flatMap(d => d.activities.map(a => a.title.toLowerCase()));

  const isKeywordInItinerary = (keywords) => {
    return keywords.some(kw => 
      allActivityTitles.some(title => title.includes(kw.toLowerCase()))
    );
  };

  const ROUTE_CONFIGS = [
    {
      key: 'bangkok-route',
      name: 'Day 1-2 曼谷路線',
      style: { left: '20%', top: '23%', width: '12%', height: '10%' },
      navUrl: 'https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/One+Bangkok/The+Platinum+Fashion+Mall/ICONSIAM',
      infoUrl: 'https://itravelblog.net/one-bangkok/',
      show: tripSchedule.days.some(d => d.region === '曼谷' && d.activities.length > 0)
    },
    {
      key: 'rayong-route',
      name: 'Day 3-4 羅勇路線',
      style: { left: '30%', top: '42%', width: '10%', height: '22%' },
      navUrl: 'https://www.google.com/maps/dir/Centre+Point+Hotel+Terminal+21/Suphattra+Land/Pa+Dee+Rayong/Cross+Pattaya+Oceanphere',
      infoUrl: 'https://www.crosshotelsandresorts.com/cross-pattaya-oceanphere',
      show: tripSchedule.days.some(d => (d.region === '羅勇' || d.region === '芭達雅') && d.activities.length > 0)
    },
    {
      key: 'return-route',
      name: 'Day 5-7 返程路線',
      style: { left: '48%', top: '56%', width: '8%', height: '15%' },
      navUrl: 'https://www.google.com/maps/dir/Cross+Pattaya+Oceanphere/Safari+World+Bangkok/Centre+Point+Hotel+Terminal+21/FO+SHO+BRO+Bangkok',
      infoUrl: 'https://itravelblog.net/safari-world/',
      show: tripSchedule.days.some(d => [5, 6, 7].includes(d.day) && d.activities.length > 0)
    }
  ];`;

if (!content.includes(activeTabOld)) {
  console.error('找不到原本的 activeTab 宣告！');
  process.exit(1);
}
content = content.replace(activeTabOld, activeTabNew);

// 8. 替換地圖熱區 Overlay 渲染邏輯為動態熱區渲染
const startMarker = '{/* 互動點擊區域 */}';
const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error('找不到 互動點擊區域 的起點！');
  process.exit(1);
}

const errorCheckStr = '!generateError && (';
const errorCheckIndex = content.indexOf(errorCheckStr, startIndex);
if (errorCheckIndex === -1) {
  console.error('找不到 !generateError && ( 關鍵字！');
  process.exit(1);
}

// 尋找結束點的特色，原先內容的最尾端是：
//                         {/* 路線：Day 5-7 返程及近郊路線 */}
// ...
//                               </a>
//                             </div>
//                           </div>
//                         </div>
//                       </>
//                     )}
// 我們可以尋找緊隨在後的 `</div>\n                )}` 或者是其對應
// 原本的程式碼中，最底部的 </div > 應該是：
//                     )}
//                   </div>
//                 )}
//               </div>
// 我們可以用 `// 路線：` 與 `</>` 來做更小更安全的切分

const pathMarker = 'Day 5-7 返程及近郊路線';
const pathIndex = content.indexOf(pathMarker, errorCheckIndex);
if (pathIndex === -1) {
  console.error('找不到 Day 5-7 返程及近郊路線 的標記！');
  process.exit(1);
}

const closeFragmentStr = '</>\n                      )';
let closeIndex = content.indexOf(closeFragmentStr, pathIndex);
let targetCloseLen = closeFragmentStr.length;

if (closeIndex === -1) {
  const altClose = '</>\n                    )';
  closeIndex = content.indexOf(altClose, pathIndex);
  targetCloseLen = altClose.length;
  if (closeIndex === -1) {
    const altClose2 = '</>\n                    )}';
    closeIndex = content.indexOf(altClose2, pathIndex);
    targetCloseLen = altClose2.length;
    if (closeIndex === -1) {
      console.error('找不到 互動點擊區域 fragment 的閉合點！');
      process.exit(1);
    }
  }
}

const overlayOld = content.substring(startIndex, closeIndex + targetCloseLen);

const overlayNew = `{/* 互動點擊區域 */}
                    {!generateError && (
                      <>
                        {/* 動態渲染行程中包含的景點熱區 */}
                        {HOTSPOT_CONFIGS.filter(cfg => isKeywordInItinerary(cfg.keywords)).map(cfg => (
                          <div 
                            key={cfg.key}
                            className="absolute group border-2 border-transparent hover:border-teal-400 hover:bg-teal-500/10 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all duration-300 rounded-xl"
                            style={cfg.style}
                          >
                            <div className="absolute hidden group-hover:flex flex-col gap-1.5 bg-teal-950/95 text-white p-2.5 rounded-lg shadow-xl -top-20 left-1/2 transform -translate-x-1/2 z-30 font-semibold border border-teal-500/50 backdrop-blur-sm min-w-[140px]">
                              <span className="text-xs border-b border-teal-800 pb-1 text-center font-bold">{cfg.name}</span>
                              <div className="flex gap-1.5 justify-center">
                                <a 
                                  href={cfg.mapUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-teal-600 hover:bg-teal-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  🗺️ 地圖
                                </a>
                                <a 
                                  href={cfg.infoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  ℹ️ 介紹
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* 動態渲染路線熱區 */}
                        {ROUTE_CONFIGS.filter(r => r.show).map(r => (
                          <div 
                            key={r.key}
                            className="absolute group border-2 border-transparent hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-300 rounded-full"
                            style={r.style}
                          >
                            <div className="absolute hidden group-hover:flex flex-col gap-1.5 bg-amber-955/95 text-white p-2.5 rounded-lg shadow-xl -top-20 left-1/2 transform -translate-x-1/2 z-30 font-semibold border border-amber-500/50 backdrop-blur-sm min-w-[140px]">
                              <span className="text-xs border-b border-amber-800 pb-1 text-center font-bold">{r.name}</span>
                              <div className="flex gap-1.5 justify-center">
                                <a 
                                  href={r.navUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-amber-600 hover:bg-amber-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  🧭 導航
                                </a>
                                <a 
                                  href={r.infoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-500 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 whitespace-nowrap transition"
                                >
                                  ℹ️ 介紹
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )`;

content = content.replace(overlayOld, overlayNew);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log('App.jsx 修改完成！');
