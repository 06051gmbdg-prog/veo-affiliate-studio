// Server lokal tanpa dependensi (Node.js 18+). Menyimpan API key di sisi server.
// Untuk produksi gunakan api/generate.js di Vercel (logika sama lewat lib/gemini.js).
const http = require('http');
const fs = require('fs');
const path = require('path');

// Muat .env sederhana
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (_) {}

const { generate, checkAccess, HttpError } = require('./lib/gemini');
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/js/app.js': 'js/app.js' };

function send(res, status, data, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

function readBody(req, limit = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Payload terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleGenerate(req, res) {
  try {
    checkAccess(req.headers['x-access-code']);
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { throw e instanceof HttpError ? e : new HttpError(400, 'JSON tidak valid.'); }
    send(res, 200, await generate(body));
  } catch (e) {
    send(res, e instanceof HttpError ? e.status : 500, { error: e.message });
  }
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/generate') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Gunakan metode POST.' });
    return handleGenerate(req, res);
  }
  if (req.method === 'GET' && STATIC[url]) {
    return fs.readFile(path.join(__dirname, STATIC[url]), (err, buf) =>
      err ? send(res, 500, 'File tidak ditemukan', 'text/plain') : send(res, 200, buf, TYPES[path.extname(STATIC[url])]));
  }
  send(res, 404, 'Not found', 'text/plain');
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Veo Affiliate Studio jalan di http://localhost:${PORT}`);
    if (!process.env.GEMINI_API_KEY) console.warn('PERINGATAN: GEMINI_API_KEY belum diatur (lihat .env.example).');
  });
}
module.exports = server;
