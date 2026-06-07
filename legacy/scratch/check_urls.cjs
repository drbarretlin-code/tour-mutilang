const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const appJsxPath = path.join(__dirname, '..', 'src', 'App.jsx');
const content = fs.readFileSync(appJsxPath, 'utf8');

// Regex to find all urls
const urlRegex = /https?:\/\/[^\s"',`(){}#]+[^\s"',`(){}#.]/g;
const urls = Array.from(new Set(content.match(urlRegex) || []));

console.log(`Found ${urls.length} unique URLs in App.jsx. Testing them now...\n`);

function testUrl(url) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 5000
    };

    const req = client.request(url, options, (res) => {
      resolve({ url, status: res.statusCode, location: res.headers.location });
    });

    req.on('error', (err) => {
      resolve({ url, status: 'ERROR', error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 'TIMEOUT' });
    });

    req.end();
  });
}

async function run() {
  const results = [];
  // Run tests in batches of 5 to avoid overloading
  const batchSize = 5;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(testUrl));
    results.push(...batchResults);
  }

  console.log('\n--- Link Check Results ---');
  results.forEach(res => {
    if (res.status === 200 || res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      console.log(`[PASS] ${res.status}: ${res.url}`);
    } else {
      console.warn(`[FAIL] ${res.status}: ${res.url} ${res.error ? '(' + res.error + ')' : ''}`);
    }
  });
}

run().catch(console.error);
