// Local dev server: static files + the same /api handlers Vercel runs.
// Usage: GEMINI_API_KEY=... npm start  or  ANTHROPIC_API_KEY=... npm start
// (works without any key using offline rules)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import analyze from './api/analyze.js';
import complaint from './api/complaint.js';
import { aiProvider } from './lib/assistant.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
const API = { '/api/analyze': analyze, '/api/complaint': complaint };

function vercelish(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = API[url.pathname];
  if (api) {
    let raw = '';
    // Same 4.5 MB request cap as Vercel functions (screenshots are downsized in the browser).
    for await (const chunk of req) { raw += chunk; if (raw.length > 4_500_000) return vercelish(res).status(413).json({ error: 'too large' }); }
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { return vercelish(res).status(400).json({ error: 'invalid JSON' }); }
    return api(req, vercelish(res));
  }
  const path = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT) || /[\\/](node_modules[\\/]|\.)/.test(path.slice(ROOT.length - 1))) { res.statusCode = 404; return res.end('Not found'); }
  try {
    const body = await readFile(path);
    res.setHeader('content-type', TYPES[extname(path)] || 'application/octet-stream');
    res.setHeader('cache-control', 'no-cache');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`RakshaNet on http://localhost:${PORT} (AI: ${aiProvider() || 'off, offline rules only'})`));
