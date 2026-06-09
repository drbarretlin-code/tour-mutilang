const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '../tour_plan.md');
const tsPath = path.join(__dirname, '../src/constants/tourRules.ts');

try {
  if (!fs.existsSync(mdPath)) {
    console.error(`[sync-rules] Error: tour_plan.md not found at ${mdPath}`);
    process.exit(1);
  }

  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const fileContent = `// Automatically generated from tour_plan.md. Do not edit directly.\nexport const TOUR_PLAN_RULES = ${JSON.stringify(mdContent)};\n`;

  const dir = path.dirname(tsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(tsPath, fileContent, 'utf8');
  console.log('[sync-rules] Successfully synchronized tour_plan.md to src/constants/tourRules.ts');
} catch (error) {
  console.error('[sync-rules] Failed to sync rules:', error);
  process.exit(1);
}
