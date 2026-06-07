const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of ", icon: ComponentName"
// We use a regex that matches a comma, optional spaces, "icon:", optional spaces, and a capitalized identifier.
const regex = /,\s*icon:\s*[A-Z][A-Za-z0-9]*/g;
const newContent = content.replace(regex, '');

if (newContent !== content) {
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully cleaned icon fields from src/App.jsx!');
} else {
  console.log('No icon fields found or replacement did not change anything.');
}
