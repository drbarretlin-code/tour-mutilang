const fs = require('fs');
const path = require('path');

function findChinese(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findChinese(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/[\u4e00-\u9fa5]/.test(lines[i]) && !lines[i].trim().startsWith('//')) {
          console.log(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
}

findChinese('./app');
findChinese('./src/services');
