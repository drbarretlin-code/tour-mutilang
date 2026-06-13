import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('wiki');

/**
 * 景點介紹動態補強服務 —— 使用維基百科免費的 REST Summary API（無金鑰、無配額限制）。
 *
 * 設計目標：為真實 POI 或內建景點動態取得約一段落的權威介紹，補強行程中景點的引言，
 * 使全球任意目的地都能獲得足夠長度且可信的描述，而不需在程式中硬編大量文字。
 * 取得失敗（無對應條目／網路問題）時回傳 null，呼叫端應沿用既有的內建描述。
 */

const WIKI_CACHE_PREFIX = '@wiki_summary_';
const WIKI_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 天

/** 將 App 語系對應到維基百科的子網域語言代碼 */
function localeToWikiLang(locale: string): string {
  if (locale.startsWith('zh')) return 'zh';
  if (locale.startsWith('ja')) return 'ja';
  if (locale.startsWith('ko')) return 'ko';
  if (locale.startsWith('th')) return 'th';
  if (locale.startsWith('vi')) return 'vi';
  return 'en';
}

/** zh 維基的字形變體（繁體 zh-tw / 簡體 zh-cn），供 Accept-Language 標頭使用 */
function zhVariant(locale: string): string | null {
  if (locale === 'zh-TW' || locale === 'zh-Hant') return 'zh-tw';
  if (locale === 'zh-CN' || locale === 'zh-Hans') return 'zh-cn';
  if (locale.startsWith('zh')) return 'zh-tw';
  return null;
}

/**
 * 超時機制：激進策略，4 秒。
 * 原因：配合 PAC 的指數退避重試（1s → 2s → 4s），快速失敗更有效率。
 */
async function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(id);
  }
}

/**
 * 取得指定標題在維基百科的摘要文字（extract）。
 * @param title 查詢標題（建議使用景點的當地或國際通用名稱以提高命中率）
 * @param locale App 語系，用以決定維基子網域與字形變體
 * @param minLength 低於此長度視為過短而捨棄（預設 80）
 */
export async function fetchWikipediaSummary(
  title: string,
  locale: string,
  minLength = 80
): Promise<string | null> {
  if (!title || !title.trim()) return null;
  const lang = localeToWikiLang(locale);
  const cacheKey = `${WIKI_CACHE_PREFIX}${lang}__${title.trim()}`;

  // 讀取快取
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.ts && Date.now() - cached.ts < WIKI_CACHE_TTL_MS) {
        return cached.text || null;
      }
    }
  } catch { /* ignore cache errors */ }

  const variant = zhVariant(locale);
  const headers: Record<string, string> = variant ? { 'Accept-Language': variant } : {};

  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.trim())}`;
    const res = await fetchWithTimeout(url, 4000, headers);
    if (!res.ok) {
      // 找不到條目時亦寫入空快取，避免重複查詢
      try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), text: null })); } catch { /* ignore */ }
      return null;
    }
    const data = await res.json();
    // type 為 disambiguation（消歧義頁）時內容無意義，捨棄
    const text: string | undefined = data?.type === 'disambiguation' ? undefined : data?.extract;
    const result = text && text.trim().length >= minLength ? text.trim() : null;
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), text: result })); } catch { /* ignore */ }
    return result;
  } catch {
    return null;
  }
}

/**
 * 批次補強多個標題的介紹（限制並行數，避免瞬間發出過多請求）。
 * 回傳一個以標題為鍵、摘要文字為值的對照表（無命中者不納入）。
 */
export async function fetchWikipediaSummaries(
  titles: string[],
  locale: string,
  concurrency = 4
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(new Set(titles.filter(Boolean)));
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const idx = cursor++;
      const title = unique[idx];
      const summary = await fetchWikipediaSummary(title, locale);
      if (summary) result[title] = summary;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(workers);
  return result;
}
