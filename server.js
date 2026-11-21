// Server tanpa dependensi (Node.js 18+). Menyimpan API key di sisi server.
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

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Anda adalah sutradara iklan video afiliasi (TikTok/Reels/Shorts) dan ahli prompt engineering untuk model generasi video AI "Gemini Veo".
Tugas Anda adalah menganalisis gambar produk yang diberikan beserta nama produknya, lalu menghasilkan:
1. Naskah iklan video singkat (15 detik) dalam Bahasa Indonesia yang sangat persuasif, natural, dan memicu klik (FOMO/solutif) terdiri dari Hook, Body, dan CTA.
2. Caption media sosial menarik lengkap dengan hashtag relevan dan menyertakan link afiliasi.
3. Prompt teknis dalam Bahasa Inggris yang sangat detail untuk model generasi video "Gemini Veo" (Image-to-Video) agar gambar produk tersebut bergerak sinematik sesuai gaya iklan yang dipilih.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    hook: { type: 'STRING' },
    body: { type: 'STRING' },
    cta: { type: 'STRING' },
    socialCaption: { type: 'STRING' },
    veoPrompt: { type: 'STRING' },
  },
  required: ['hook', 'body', 'cta', 'socialCaption', 'veoPrompt'],
};

function send(res, status, data, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Payload terlalu besar')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleGenerate(req, res) {
  if (!API_KEY) {
    return send(res, 500, { error: 'GEMINI_API_KEY belum diatur. Salin .env.example menjadi .env lalu isi key Anda.' });
  }
  try {
    const { productName, affiliateLink, style, ratio, image, mimeType } = JSON.parse(await readBody(req));
    if (!productName || !affiliateLink || !image) {
      return send(res, 400, { error: 'Data produk, link, dan gambar wajib diisi.' });
    }
    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { text: `Produk: ${productName}\nLink Afiliasi: ${affiliateLink}\nGaya Iklan: ${style}\nRasio Aspek: ${ratio}\n\nBuatkan konsep video iklan afiliasi dan prompt Gemini Veo berdasarkan gambar produk ini.` },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) {
      return send(res, r.status, { error: j.error?.message || `Gemini error ${r.status}` });
    }
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return send(res, 502, { error: 'Respon kosong dari Gemini.' });
    send(res, 200, JSON.parse(text));
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'index.html'), (err, buf) =>
      err ? send(res, 500, 'index.html tidak ditemukan', 'text/plain') : send(res, 200, buf, 'text/html; charset=utf-8'));
  }
  send(res, 404, 'Not found', 'text/plain');
}).listen(PORT, () => {
  console.log(`Veo Affiliate Studio jalan di http://localhost:${PORT}`);
  if (!API_KEY) console.warn('PERINGATAN: GEMINI_API_KEY belum diatur (lihat .env.example).');
});
