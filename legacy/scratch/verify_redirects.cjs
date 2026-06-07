const https = require('https');
const http = require('http');

const urlsToVerify = {
  "機場交通介紹 (Klook)": "https://www.klook.com/zh-TW/blog/bangkok-airport-transfer/",
  "Centre Point Hotel 介紹 (Klook)": "https://www.klook.com/zh-TW/hotels/detail/139366-grande-centre-point-hotel-terminal-21/",
  "One Bangkok 介紹 (Klook)": "https://www.klook.com/zh-TW/blog/one-bangkok-thailand/",
  "Pier 21 美食街介紹 (Viviyu)": "https://www.viviyu.com/archives/26978",
  "水門市場介紹 (Klook)": "https://www.klook.com/zh-TW/blog/platinum-fashion-mall-bangkok/",
  "ICONSIAM 介紹 (Klook)": "https://www.klook.com/zh-TW/blog/iconsiam-bangkok/",
  "昭披耶河遊船介紹 (Klook)": "https://www.klook.com/zh-TW/blog/chao-phraya-river-cruises-bangkok/",
  "素芭他水果園活動 (Klook)": "https://www.klook.com/zh-TW/activity/95015-suphattra-land-orchard-rayong/",
  "Pa Dee 咖啡館介紹 (Trip.com)": "https://tw.trip.com/travel-guide/attraction/rayong/pa-dee-55694248/",
  "Kliff 懸崖餐廳位置 (Google Maps)": "https://www.google.com/maps/place/Kliff+Beach+Club+Pattaya",
  "Safari World 動物園介紹 (Klook)": "https://www.klook.com/zh-TW/blog/safari-world-bangkok/",
  "Savoey 餐館活動 (Klook)": "https://www.klook.com/zh-TW/activity/9880-savoey-seafood-co-bangkok/",
  "美功鐵道市場介紹 (Klook)": "https://www.klook.com/zh-TW/blog/maeklong-railway-market-bangkok/",
  "Big C 採購介紹 (Klook)": "https://www.klook.com/zh-TW/blog/bangkok-big-c-supercenter/",
  "Let's Relax SPA 活動 (Klook)": "https://www.klook.com/zh-TW/activity/1659-lets-relax-spa-treatments-bangkok/",
  "FO SHO BRO 介紹 (Mimihan)": "https://mimihan.tw/fo-sho-bro/",
  "桃園機場官網": "https://www.taoyuan-airport.com/",
  "Centre Point Hotel 訂房 (Agoda)": "https://www.agoda.com/zh-tw/grande-centre-point-hotel-terminal-21/hotel/bangkok-th.html",
  "Cross Pattaya 訂房 (Agoda)": "https://www.agoda.com/zh-tw/cross-pattaya-oceanphere_2/hotel/pattaya-th.html"
};

function getFinalUrl(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    let currentUrl = url;
    let redirectCount = 0;

    function doRequest(targetUrl) {
      if (redirectCount >= maxRedirects) {
        resolve({ original: url, final: targetUrl, status: 'TOO_MANY_REDIRECTS', title: '' });
        return;
      }

      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 5000
      };

      const req = client.request(targetUrl, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          let nextUrl = res.headers.location;
          if (!nextUrl.startsWith('http')) {
            const origin = parsedUrl.origin;
            nextUrl = new URL(nextUrl, origin).toString();
          }
          doRequest(nextUrl);
        } else {
          // Read chunk to find title
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
            // truncate data if we have title
            if (data.includes('</title>')) {
              req.destroy();
            }
          });

          res.on('end', () => {
            const titleMatch = data.match(/<title>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : 'NO_TITLE';
            resolve({ original: url, final: targetUrl, status: res.statusCode, title });
          });
        }
      });

      req.on('error', (err) => {
        resolve({ original: url, final: targetUrl, status: 'ERROR', error: err.message, title: '' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ original: url, final: targetUrl, status: 'TIMEOUT', title: '' });
      });

      req.end();
    }

    doRequest(currentUrl);
  });
}

async function run() {
  console.log(`Starting in-depth validation for ${Object.keys(urlsToVerify).length} URLs...\n`);
  const results = [];
  
  for (const [name, url] of Object.entries(urlsToVerify)) {
    console.log(`Verifying: ${name}...`);
    const res = await getFinalUrl(url);
    results.push({ name, ...res });
  }

  console.log('\n--- In-depth Link Verification Report ---');
  let failures = 0;
  
  results.forEach(res => {
    const isOk = (res.status === 200 || res.status === 403 || res.status === 999);
    // 403 / 999 are fine because cloudflare blocks curl/node requests but real browser visits work.
    
    // Check if redirect points to main domain (like "/" or index)
    const parsedFinal = new URL(res.final);
    const isRedirectedToHome = parsedFinal.pathname === '/' || parsedFinal.pathname === '/zh-tw/' || parsedFinal.pathname === '/zh-TW/';
    const isOriginalHome = new URL(res.original).pathname === '/' || new URL(res.original).pathname === '/zh-tw/' || new URL(res.original).pathname === '/zh-TW/';
    
    const failedToDestination = !isOriginalHome && isRedirectedToHome;
    
    if (isOk && !failedToDestination) {
      console.log(`[PASS] ${res.name}`);
      console.log(`  - Original: ${res.original}`);
      console.log(`  - Final   : ${res.final}`);
      console.log(`  - Title   : ${res.title}`);
      console.log(`  - Status  : ${res.status}\n`);
    } else {
      failures++;
      console.warn(`[FAIL] ${res.name}`);
      console.warn(`  - Original: ${res.original}`);
      console.warn(`  - Final   : ${res.final}`);
      console.warn(`  - Title   : ${res.title}`);
      console.warn(`  - Status  : ${res.status}`);
      if (failedToDestination) {
        console.warn(`  - Warning : Redirected to site homepage! (Potential broken deep link)\n`);
      } else {
        console.warn(`  - Warning : Return status is ${res.status}\n`);
      }
    }
  });

  console.log(`Validation finished. Failures detected: ${failures}/${results.length}`);
}

run().catch(console.error);
