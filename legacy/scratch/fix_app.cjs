const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appJsxPath, 'utf8');

// 原本誤放在 initialization 之前的變數定義
const misplacedBlock = `  // 收集行程中所有的景點標題（做關鍵字比對用，自動清理無效熱區）
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

// 移除原有的 misplaced 區塊
if (!content.includes(misplacedBlock)) {
  console.error('找不到原本被誤放的區塊！');
  process.exit(1);
}
content = content.replace(misplacedBlock, '');

// 定位目標：將其放至 state 宣告完畢之後，例如在 const [generateError, setGenerateError] = useState(null); 之後
const targetStateOld = `  const [generateError, setGenerateError] = useState(null);`;

const targetStateNew = `  const [generateError, setGenerateError] = useState(null);

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

if (!content.includes(targetStateOld)) {
  console.error('找不到目標 generateError state！');
  process.exit(1);
}
content = content.replace(targetStateOld, targetStateNew);

fs.writeFileSync(appJsxPath, content, 'utf8');
console.log('App.jsx 變數宣告順序修復完成！');
