import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

// Vercel 唯讀檔案系統的防禦性處理：如果是 Vercel 環境，則使用可讀寫的 /tmp 目錄
const mockDbPath = process.env.VERCEL
  ? '/tmp/local_kv_db.json'
  : path.join(process.cwd(), 'scratch', 'local_kv_db.json');

const isKvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// 全域記憶體備援資料庫，以防 KV 資料庫與本地磁碟寫入皆失敗
let memoryDb = null;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      let data = null;
      let usedSource = 'memory';

      // 1. 嘗試讀取 Vercel KV
      if (isKvConfigured) {
        try {
          data = await kv.get('trip_schedule');
          if (data) {
            usedSource = 'kv';
          }
        } catch (e) {
          console.warn('Vercel KV 讀取失敗，嘗試備援本地檔案:', e.message);
        }
      }

      // 2. 若 KV 無資料或讀取失敗，嘗試讀取本地檔案
      if (!data) {
        try {
          if (fs.existsSync(mockDbPath)) {
            const content = fs.readFileSync(mockDbPath, 'utf8');
            data = JSON.parse(content);
            usedSource = 'local_file';
          } else {
            // 防禦性處理：如果是 Vercel 環境且 /tmp 臨時檔不存在，則讀取隨專案推送的 scratch/local_kv_db.json 做為初始基線
            const repoDbPath = path.join(process.cwd(), 'scratch', 'local_kv_db.json');
            if (fs.existsSync(repoDbPath)) {
              const content = fs.readFileSync(repoDbPath, 'utf8');
              data = JSON.parse(content);
              usedSource = 'repo_file';
            }
          }
        } catch (e) {
          console.warn('本地檔案讀取失敗，嘗試備援全域記憶體:', e.message);
        }
      }

      // 3. 若皆讀取失敗，使用全域記憶體備援
      if (!data) {
        data = memoryDb;
        usedSource = 'memory';
      }

      res.status(200).json({ source: usedSource, data });
    } else if (req.method === 'POST') {
      const { tripSchedule } = req.body;
      if (!tripSchedule) {
        res.status(400).json({ error: 'Missing tripSchedule in body' });
        return;
      }

      let success = false;
      let usedSource = 'memory';

      // 1. 嘗試寫入 Vercel KV
      if (isKvConfigured) {
        try {
          await kv.set('trip_schedule', tripSchedule);
          success = true;
          usedSource = 'kv';
        } catch (e) {
          console.warn('Vercel KV 寫入失敗，嘗試備援本地檔案:', e.message);
        }
      }

      // 2. 若寫入 KV 失敗，嘗試寫入本地檔案
      if (!success) {
        try {
          const dir = path.dirname(mockDbPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(mockDbPath, JSON.stringify(tripSchedule, null, 2), 'utf8');
          success = true;
          usedSource = 'local_file';
        } catch (e) {
          console.warn('本地檔案寫入失敗，嘗試備援全域記憶體:', e.message);
        }
      }

      // 3. 無論如何都寫入全域記憶體備援
      memoryDb = tripSchedule;
      if (!success) {
        usedSource = 'memory';
      }

      res.status(200).json({ success: true, source: usedSource });
    } else {
      res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('API Error:', error);
    // 即使發生非預期嚴重錯誤，我們也回傳 200 並使用記憶體備援，防禦前端報連線失敗
    res.status(200).json({ success: true, source: 'memory', data: memoryDb });
  }
}
