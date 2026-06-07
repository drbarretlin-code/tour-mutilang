const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// 1. Insert history sync useEffect and changeTab function
const stateOld = `  const [activeTab, setActiveTab] = useState('overview');
  const [dropdownOpen, setDropdownOpen] = useState(false);`;

const stateNew = `  const [activeTab, setActiveTab] = useState('overview');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 同步 URL Hash 與 activeTab，支援瀏覽器「上一頁/下一頁」歷史紀錄導航
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash);
      } else {
        setActiveTab('overview');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const changeTab = (tab) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };`;

if (!content.includes(stateOld)) {
  console.error("Could not find activeTab state declaration in App.jsx");
  process.exit(1);
}
content = content.replace(stateOld, stateNew);

// 2. Replace all setActiveTab calls with changeTab
// Let's replace the occurrences one by one to ensure accuracy
content = content.replace(
  `onClick={() => { setActiveTab('overview'); setDropdownOpen(false); }}`,
  `onClick={() => { changeTab('overview'); setDropdownOpen(false); }}`
);

content = content.replace(
  `onClick={() => { setActiveTab('ai-assistant'); setDropdownOpen(false); }}`,
  `onClick={() => { changeTab('ai-assistant'); setDropdownOpen(false); }}`
);

content = content.replace(
  `onClick={() => { setActiveTab(\`day-\${day.day}\`); setDropdownOpen(false); }}`,
  `onClick={() => { changeTab(\`day-\${day.day}\`); setDropdownOpen(false); }}`
);

content = content.replace(
  `onClick={() => { setActiveTab(\`day-\${selectedDay}\`); }}`,
  `onClick={() => { changeTab(\`day-\${selectedDay}\`); }}`
);

content = content.replace(
  `onClick={() => setActiveTab(\`day-\${day.day - 1}\`)}`,
  `onClick={() => changeTab(\`day-\${day.day - 1}\`)}`
);

content = content.replace(
  `onClick={() => setActiveTab(\`day-\${day.day + 1}\`)}`,
  `onClick={() => changeTab(\`day-\${day.day + 1}\`)}`
);

// 3. Add the "返回上一頁" button on the bottom left next to "清空輸入"
const buttonGroupOld = `                    <button 
                      onClick={() => setAiInputUrls("")}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                    >
                      清空輸入
                    </button>`;

const buttonGroupNew = `                    <button 
                      onClick={() => setAiInputUrls("")}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                    >
                      清空輸入
                    </button>
                    <button 
                      onClick={() => {
                        if (window.history.length > 1) {
                          window.history.back();
                        } else {
                          changeTab('overview');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition"
                    >
                      返回上一頁
                    </button>`;

if (!content.includes(buttonGroupOld)) {
  console.error("Could not find button group pattern in App.jsx");
  process.exit(1);
}
content = content.replace(buttonGroupOld, buttonGroupNew);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log("Successfully updated App.jsx with navigation improvements!");
