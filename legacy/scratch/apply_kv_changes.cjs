const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// 1. Insert states and functions after setTripSchedule definition
const targetStateOld = `  // 狀態管理：行程資料
  const [tripSchedule, setTripSchedule] = useState(initialTripData);`;

const targetStateNew = `  // 狀態管理：行程資料
  const [tripSchedule, setTripSchedule] = useState(initialTripData);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [dbSource, setDbSource] = useState('local_file');

  // 從雲端載入行程資料
  const fetchTripFromCloud = async () => {
    setSyncStatus('loading');
    try {
      const response = await fetch('/api/trip');
      if (!response.ok) throw new Error('連線失敗');
      const result = await response.json();
      setDbSource(result.source);
      
      if (result.data && result.data.days && result.data.days.length > 0) {
        setTripSchedule(result.data);
        setSyncStatus('synced');
      } else {
        // 雲端無資料，自動將本地預設資料同步上傳
        setSyncStatus('syncing');
        await saveTripToCloud(initialTripData);
        setTripSchedule(initialTripData);
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('載入雲端資料失敗，使用本地暫存:', err);
      setSyncStatus('error');
    }
  };

  // 保存資料至雲端
  const saveTripToCloud = async (newSchedule) => {
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripSchedule: newSchedule })
      });
      if (!response.ok) throw new Error('存檔失敗');
      const result = await response.json();
      setDbSource(result.source);
      setSyncStatus('synced');
    } catch (err) {
      console.error('儲存雲端失敗:', err);
      setSyncStatus('error');
    }
  };

  const updateTripSchedule = (newScheduleOrFn) => {
    setTripSchedule(prev => {
      const next = typeof newScheduleOrFn === 'function' ? newScheduleOrFn(prev) : newScheduleOrFn;
      saveTripToCloud(next);
      return next;
    });
  };

  React.useEffect(() => {
    fetchTripFromCloud();
  }, []);`;

if (!content.includes(targetStateOld)) {
  console.error("Could not find targetStateOld in App.jsx");
  process.exit(1);
}
content = content.replace(targetStateOld, targetStateNew);

// 2. Insert polling React.useEffect after generateError definition
const pollingTargetOld = `  const [generateError, setGenerateError] = useState(null);`;

const pollingTargetNew = `  const [generateError, setGenerateError] = useState(null);

  // 15 秒背景輪詢，同步其他使用者的變更
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!isEditModalOpen && syncStatus === 'synced') {
        fetch('/api/trip')
          .then(res => res.json())
          .then(result => {
            if (result.data && result.data.days && result.data.days.length > 0) {
              const localStr = JSON.stringify(tripSchedule);
              const remoteStr = JSON.stringify(result.data);
              if (localStr !== remoteStr) {
                setTripSchedule(result.data);
                setDbSource(result.source);
              }
            }
          })
          .catch(err => console.warn('背景輪詢失敗:', err));
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [isEditModalOpen, syncStatus, tripSchedule]);`;

if (!content.includes(pollingTargetOld)) {
  console.error("Could not find pollingTargetOld in App.jsx");
  process.exit(1);
}
content = content.replace(pollingTargetOld, pollingTargetNew);

// 3. Replace state setters with updateTripSchedule in edit/save/delete functions
// For handleImportToItinerary
const importSetterOld = `    setTripSchedule(prev => {
      const updatedDays = prev.days.map(day => {`;
const importSetterNew = `    updateTripSchedule(prev => {
      const updatedDays = prev.days.map(day => {`;
if (!content.includes(importSetterOld)) {
  console.error("Could not find importSetterOld in App.jsx");
  process.exit(1);
}
content = content.replace(importSetterOld, importSetterNew);

// For handleDeleteActivity
const deleteSetterOld = `    setTripSchedule(prevSchedule => {
      const newDays = prevSchedule.days.map(day => {
        if (day.day === sourceDayId) {`;
const deleteSetterNew = `    updateTripSchedule(prevSchedule => {
      const newDays = prevSchedule.days.map(day => {
        if (day.day === sourceDayId) {`;
if (!content.includes(deleteSetterOld)) {
  console.error("Could not find deleteSetterOld in App.jsx");
  process.exit(1);
}
content = content.replace(deleteSetterOld, deleteSetterNew);

// For handleSaveActivity
const saveSetterOld = `    setTripSchedule(prevSchedule => {
      const newDays = prevSchedule.days.map(day => {
        // 處理目標天（新增或更新）
        if (day.day === targetDayId) {`;
const saveSetterNew = `    updateTripSchedule(prevSchedule => {
      const newDays = prevSchedule.days.map(day => {
        // 處理目標天（新增或更新）
        if (day.day === targetDayId) {`;
if (!content.includes(saveSetterOld)) {
  console.error("Could not find saveSetterOld in App.jsx");
  process.exit(1);
}
content = content.replace(saveSetterOld, saveSetterNew);

// 4. Update Header brand and add sync indicator
const headerBrandOld = `            <div className="flex items-center gap-2">
              <MapPin className="text-teal-600 w-6 h-6" />
              <span className="font-bold text-xl text-teal-800">B&B泰國家庭旅遊</span>
            </div>`;

const headerBrandNew = `            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <MapPin className="text-teal-600 w-5 h-5 sm:w-6 h-6" />
              <span className="font-bold text-base sm:text-xl text-teal-800">B&B泰國家庭旅遊</span>
              
              {/* 雲端同步狀態指示器 */}
              <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2 px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-semibold">
                <span className={\`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full \${
                  syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                  syncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' :
                  syncStatus === 'loading' ? 'bg-indigo-500 animate-pulse' :
                  'bg-red-500 animate-ping'
                }\`} />
                <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold whitespace-nowrap">
                  {syncStatus === 'synced' ? (dbSource === 'kv' ? '☁️ 雲端' : '💾 本地') :
                   syncStatus === 'syncing' ? '同步中' :
                   syncStatus === 'loading' ? '載入中' :
                   '連線失敗'}
                </span>
                <button 
                  onClick={fetchTripFromCloud}
                  title="從雲端重新載入資料"
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded transition"
                  disabled={syncStatus === 'loading' || syncStatus === 'syncing'}
                >
                  <RefreshCw className={\`w-2.5 h-2.5 sm:w-3 sm:h-3 \${syncStatus === 'loading' ? 'animate-spin' : ''}\`} />
                </button>
              </div>
            </div>`;

if (!content.includes(headerBrandOld)) {
  console.error("Could not find headerBrandOld in App.jsx");
  process.exit(1);
}
content = content.replace(headerBrandOld, headerBrandNew);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log("App.jsx Vercel KV changes applied successfully!");
