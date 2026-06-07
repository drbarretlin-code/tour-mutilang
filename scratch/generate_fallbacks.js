const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const enPath = path.join(localesDir, 'en.json');

if (!fs.existsSync(enPath)) {
  console.error('en.json not found!');
  process.exit(1);
}

const enContent = fs.readFileSync(enPath, 'utf8');

const targetLocales = ['ko', 'th', 'vi', 'ms', 'es', 'pt'];

targetLocales.forEach((locale) => {
  const targetPath = path.join(localesDir, `${locale}.json`);
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, enContent, 'utf8');
    console.log(`Created fallback for ${locale}.json`);
  } else {
    console.log(`${locale}.json already exists.`);
  }
});
