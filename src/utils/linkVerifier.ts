export const SAFE_DOMAINS = [
  'google.com', 'klook.com', 'kkday.com', 'tripadvisor.com', 
  'agoda.com', 'booking.com', 'expedia.com', 'hotels.com',
  'tabelog.com', 'yelp.com'
];

/**
 * 檢查網址是否為白名單內的安全網域
 */
function isSafeDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SAFE_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * 逆向三步驟（URL -> 原文 -> 分析）：核心 RAG 網址檢驗引擎
 * @param url 待檢驗網址
 * @param contextKeywords 景點名稱或地區關鍵字，用於比對原文
 * @returns 驗證結果與修正後的網址
 */
export async function verifyUrlRAG(url: string, contextKeywords: string[]): Promise<{ isValid: boolean, verifiedUrl: string }> {
  // 如果是空白或無效格式
  if (!url || !url.startsWith('http')) {
    return { isValid: false, verifiedUrl: '' };
  }

  // 若為白名單網域，直接放行 (節省效能與避免誤擋)
  if (isSafeDomain(url)) {
    return { isValid: true, verifiedUrl: url };
  }

  try {
    // 透過 public CORS proxy 取得目標網頁 HTML 原始碼 (Bypass browser CORS)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    // 設定 5 秒 Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { isValid: false, verifiedUrl: getGoogleSearchFallback(contextKeywords) };
    }

    const data = await response.json();
    
    // 如果代理伺服器也抓不到內容 (例如 404, DNS Error)
    if (!data.contents || data.status?.http_code >= 400) {
      return { isValid: false, verifiedUrl: getGoogleSearchFallback(contextKeywords) };
    }

    // Step 2: 原文萃取 (抽取 Title 與 Body 前 2000 字元)
    const html = data.contents.toLowerCase();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].toLowerCase() : '';
    
    // 粗略擷取 body 文字，移除標籤
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    let bodyText = bodyMatch ? bodyMatch[1] : html;
    bodyText = bodyText.replace(/<[^>]+>/g, ' ').substring(0, 2000).toLowerCase();

    // Step 3: 交叉分析 (確認原文是否包含至少一個關鍵字)
    // 只要有任何一個關鍵字出現在標題或內文中，就視為相關
    const isRelevant = contextKeywords.some(keyword => {
      const kw = keyword.toLowerCase().trim();
      if (!kw) return false;
      return title.includes(kw) || bodyText.includes(kw);
    });

    if (isRelevant) {
      return { isValid: true, verifiedUrl: url };
    } else {
      // 完全不相關，判定為 AI 幻覺或停放網域
      console.warn(`[RAG Validator] Hallucination detected for URL: ${url}. Keywords: ${contextKeywords.join(', ')}`);
      return { isValid: false, verifiedUrl: getGoogleSearchFallback(contextKeywords) };
    }

  } catch (error) {
    // 發生 Timeout 或網路錯誤，為求安全直接判定無效
    console.warn(`[RAG Validator] Error validating URL: ${url}`, error);
    return { isValid: false, verifiedUrl: getGoogleSearchFallback(contextKeywords) };
  }
}

/**
 * Fallback 到 Google 搜尋
 */
export function getGoogleSearchFallback(keywords: string[]): string {
  const query = keywords.filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * 批次檢驗整份 AI 產出的行程 JSON
 */
export async function verifyItineraryLinks(itineraryJson: any): Promise<any> {
  if (!itineraryJson || !itineraryJson.days) return itineraryJson;

  const result = JSON.parse(JSON.stringify(itineraryJson)); // Deep copy

  // 為了避免瞬間發出上百個請求被 CORS Proxy 封鎖，我們使用循序或小批次處理
  for (const day of result.days) {
    if (!day.activities) continue;
    
    for (const activity of day.activities) {
      if (!activity.links || !Array.isArray(activity.links)) continue;
      
      const validLinks = [];
      for (const link of activity.links) {
        // 準備交叉分析用的關鍵字：景點名稱、地區
        const contextKeywords = [activity.title];
        if (day.region) contextKeywords.push(day.region);

        const verification = await verifyUrlRAG(link.url, contextKeywords);
        
        if (verification.isValid) {
          validLinks.push(link);
        } else if (verification.verifiedUrl) {
          // 如果失效，自動替換為 Google 搜尋
          validLinks.push({ ...link, url: verification.verifiedUrl, label: `Search: ${activity.title}` });
        }
      }
      
      // 去除重複的 Google Search 連結 (避免多個失效連結都變成同一個搜尋)
      const uniqueLinks = [];
      const seenUrls = new Set();
      for (const l of validLinks) {
        if (!seenUrls.has(l.url)) {
          seenUrls.add(l.url);
          uniqueLinks.push(l);
        }
      }
      
      activity.links = uniqueLinks;
    }
  }

  return result;
}
