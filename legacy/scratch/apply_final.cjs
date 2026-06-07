const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
const applyScriptPath = path.join(__dirname, 'apply_all_changes.cjs');

let appJsx = fs.readFileSync(appJsxPath, 'utf8');
const applyScript = fs.readFileSync(applyScriptPath, 'utf8');

// 1. Locate the correct template string in apply_all_changes.cjs
const startToken = "const initialTripDataNew = `const initialTripData = {";
const endToken = "];`\n;"; // wait, let's check exact end of template string

const startIdx = applyScript.indexOf(startToken);
if (startIdx === -1) {
  console.error("Could not find startToken in apply_all_changes.cjs");
  process.exit(1);
}

// The end of this template string is at index 32752. It ends with ];`
// Let's find the closing backtick starting from startIdx:
const closingBacktickIdx = applyScript.indexOf('`', startIdx + startToken.length);
if (closingBacktickIdx === -1) {
  console.error("Could not find closing backtick in apply_all_changes.cjs");
  process.exit(1);
}

const newBlock = applyScript.substring(
  startIdx + "const initialTripDataNew = `".length,
  closingBacktickIdx
);

console.log("Extracted replacement block length:", newBlock.length);
console.log("First 100 chars of replacement block:\n", newBlock.substring(0, 100));
console.log("Last 100 chars of replacement block:\n", newBlock.substring(newBlock.length - 100));

// 2. Find the original initialTripData block in src/App.jsx
const originalStartToken = "const initialTripData = {";
const originalEndToken = `  emergencyInfo: [
    { name: "泰國旅遊警察", number: "1155", desc: "24小時英語服務，旅遊糾紛首選" },
    { name: "泰國急救", number: "1669", desc: "緊急醫療救援" },
    { name: "泰國報警", number: "191", desc: "一般警察局" },
    { name: "台灣駐泰國代表處", number: "+66-81-8340919", desc: "護照遺失或重大意外" }
  ]
};`;

const origStartIdx = appJsx.indexOf(originalStartToken);
const origEndIdx = appJsx.indexOf(originalEndToken, origStartIdx);

if (origStartIdx === -1 || origEndIdx === -1) {
  console.error("Could not find original initialTripData block in App.jsx");
  process.exit(1);
}

const replaceEndLimit = origEndIdx + originalEndToken.length;

// Replace old block with new block
const finalContent = appJsx.substring(0, origStartIdx) + newBlock + appJsx.substring(replaceEndLimit);

fs.writeFileSync(appJsxPath, finalContent, 'utf8');
console.log("Successfully updated App.jsx with initialTripData and HOTSPOT_CONFIGS!");
