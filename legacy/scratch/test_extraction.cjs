const fs = require('fs');
const path = require('path');

const applyScriptPath = path.join(__dirname, 'apply_all_changes.cjs');
const applyScript = fs.readFileSync(applyScriptPath, 'utf8');

const startToken = "const initialTripDataNew = `const initialTripData = {";
const endToken = "};`;";

const startIdx = applyScript.indexOf(startToken);
const endIdx = applyScript.indexOf(endToken, startIdx);

console.log("startIdx:", startIdx, "endIdx:", endIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const initialTripDataCode = applyScript.substring(
    startIdx + "const initialTripDataNew = `".length,
    endIdx + "};".length
  );
  console.log("Extracted initialTripData length:", initialTripDataCode.length);
  console.log("Start of initialTripDataCode:\n", initialTripDataCode.substring(0, 200));
  console.log("End of initialTripDataCode:\n", initialTripDataCode.substring(initialTripDataCode.length - 200));
}

const hotspotStartToken = "const HOTSPOT_CONFIGS = [";
const hotspotEndToken = "];`;";

const hotspotStartIdx = applyScript.indexOf(hotspotStartToken);
const hotspotEndIdx = applyScript.indexOf(hotspotEndToken, hotspotStartIdx);

console.log("hotspotStartIdx:", hotspotStartIdx, "hotspotEndIdx:", hotspotEndIdx);

if (hotspotStartIdx !== -1 && hotspotEndIdx !== -1) {
  const hotspotCode = applyScript.substring(
    hotspotStartIdx,
    hotspotEndIdx + "];".length
  );
  console.log("Extracted hotspotCode length:", hotspotCode.length);
  console.log("Start of hotspotCode:\n", hotspotCode.substring(0, 200));
  console.log("End of hotspotCode:\n", hotspotCode.substring(hotspotCode.length - 200));
}
