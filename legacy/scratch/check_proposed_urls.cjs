const https = require('https');
const http = require('http');

const proposedUrls = [
  "https://www.klook.com/zh-TW/blog/bangkok-airport-transfer/",
  "https://www.klook.com/zh-TW/blog/one-bangkok-thailand/",
  "https://www.klook.com/zh-TW/blog/platinum-fashion-mall-bangkok/",
  "https://www.klook.com/zh-TW/blog/iconsiam-bangkok/",
  "https://www.klook.com/zh-TW/blog/chao-phraya-river-cruises-bangkok/",
  "https://www.klook.com/zh-TW/activity/95015-suphattra-land-orchard-rayong/",
  "https://www.facebook.com/padierayong/",
  "https://www.klook.com/zh-TW/hotels/detail/491953-cross-pattaya-oceanphere/",
  "https://www.klook.com/zh-TW/activity/71542-columbia-pictures-aquaverse-water-park-ticket-pattaya/",
  "https://www.facebook.com/kliffbeachclub/",
  "https://www.klook.com/zh-TW/blog/safari-world-bangkok/",
  "https://www.klook.com/zh-TW/activity/9880-savoey-seafood-co-bangkok/",
  "https://www.klook.com/zh-TW/blog/maeklong-railway-market-bangkok/",
  "https://www.klook.com/zh-TW/blog/damnoen-saduak-floating-market-bangkok/",
  "https://www.klook.com/zh-TW/blog/bangkok-big-c-supercenter/",
  "https://www.klook.com/zh-TW/activity/1659-lets-relax-spa-treatments-bangkok/",
  "https://mimihan.tw/fo-sho-bro/",
  "https://www.taoyuan-airport.com/",
  "https://www.agoda.com/zh-tw/grande-centre-point-hotel-terminal-21/hotel/bangkok-th.html",
  "https://www.agoda.com/zh-tw/cross-pattaya-oceanphere_2/hotel/pattaya-th.html"
];

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
      resolve({ url, status: res.statusCode });
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
  console.log(`Testing ${proposedUrls.length} proposed stable URLs...\n`);
  const results = [];
  const batchSize = 5;
  for (let i = 0; i < proposedUrls.length; i += batchSize) {
    const batch = proposedUrls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(testUrl));
    results.push(...batchResults);
  }

  results.forEach(res => {
    if (res.status === 200 || res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308 || res.status === 403 || res.status === 999) {
      // 403 / 999 are fine for large sites like Klook, Agoda or Facebook if they block simple scraping requests, as long as it's not a 404!
      console.log(`[PASS] ${res.status}: ${res.url}`);
    } else {
      console.warn(`[FAIL] ${res.status}: ${res.url} ${res.error ? '(' + res.error + ')' : ''}`);
    }
  });
}

run().catch(console.error);
