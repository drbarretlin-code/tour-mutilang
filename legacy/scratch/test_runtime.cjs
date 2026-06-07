const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');

// 簡易 Mock
global.React = {
  useState: (init) => [init, () => {}],
};
global.useState = global.React.useState;

// 把 import 語句替換掉
let jsCode = code.replace(/import[\s\S]*?from[\s\S]*?;/g, '// import removed\n');

// 剝離或 Mock JSX
const appStartIdx = jsCode.indexOf('export default function App()');
if (appStartIdx === -1) {
  console.error('找不到 App 元件！');
  process.exit(1);
}

// 找到 return 語句
const returnIdx = jsCode.indexOf('return (', appStartIdx);
if (returnIdx === -1) {
  console.error('找不到 return (！');
  process.exit(1);
}

// 截取 App 內部從起點到 return 之前的程式碼，並在最後呼叫 App()
const testCode = `
const initialTripData = { days: [] };
const HOTSPOT_CONFIGS = [];
const getIcon = () => null;
const MapPin = {};
const Info = {};
const Navigation = {};
const Car = {};
const ExternalLink = {};
const Hotel = {};
const ShoppingBag = {};
const Coffee = {};
const Camera = {};
const Clock = {};
const Moon = {};
const ChevronRight = {};
const Check = {};

function App() {
${jsCode.substring(appStartIdx + 'export default function App() {'.length, returnIdx)}
  console.log("App initialization successful, no runtime initialization errors!");
}
App();
`;

try {
  eval(testCode);
} catch (err) {
  console.error("捕獲到 Runtime 錯誤：", err);
}
