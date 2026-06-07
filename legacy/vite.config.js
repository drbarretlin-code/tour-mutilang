import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// 本地開發與預覽用 Mock API 中間件
const apiMockMiddleware = async (req, res, next) => {
  if (req.url && req.url.startsWith('/api/trip')) {
    const method = req.method;
    const mockDbPath = path.join(process.cwd(), 'scratch', 'local_kv_db.json');

    // Setup CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    try {
      if (method === 'GET') {
        let data = null;
        if (fs.existsSync(mockDbPath)) {
          const content = fs.readFileSync(mockDbPath, 'utf8');
          try {
            data = JSON.parse(content);
          } catch (e) {
            console.error('Failed to parse local DB JSON:', e);
          }
        }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ source: 'local_file', data }));
      } else if (method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => {
          bodyStr += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(bodyStr);
            const { tripSchedule } = parsed;
            if (!tripSchedule) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing tripSchedule in body' }));
              return;
            }
            const dir = path.dirname(mockDbPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(mockDbPath, JSON.stringify(tripSchedule, null, 2), 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, source: 'local_file' }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      } else {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Method ${method} Not Allowed` }));
      }
    } catch (error) {
      console.error('Local API Error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  next();
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'api-mock-server',
      configureServer(server) {
        server.middlewares.use(apiMockMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(apiMockMiddleware);
      }
    }
  ],
})
