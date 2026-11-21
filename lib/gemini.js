// Logika Gemini bersama: dipakai oleh server.js (lokal) dan api/generate.js (Vercel).
const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_STYLES = ['TikTok Viral / UGC', 'Sinematik Mewah', 'Review Jujur & Cepat', 'Estetik Minimalis'];
const ALLOWED_RATIOS = ['9:16', '16:9', '1:1'];
const MAX_IMAGE_B64 = 4 * 1024 * 1024; // ~3MB gambar; batas body Vercel 4.5MB

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

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Validasi input dari klien; lempar HttpError(400) bila tidak valid.
function validate(input) {
  const b = input && typeof input === 'object' ? input : {};
  const productName = String(b.productName || '').trim().slice(0, 200);
  const affiliateLink = String(b.affiliateLink || '').trim().slice(0, 500);
  const image = String(b.image || '');
  const mimeType = b.mimeType || 'image/jpeg';
  if (!productName || !affiliateLink || !image) throw new HttpError(400, 'Data produk, link, dan gambar wajib diisi.');
  if (!/^https?:\/\//i.test(affiliateLink)) throw new HttpError(400, 'Link afiliasi harus diawali http:// atau https://');
  if (!ALLOWED_MIME.includes(mimeType)) throw new HttpError(400, 'Format gambar harus JPG, PNG, atau WEBP.');
  if (image.length > MAX_IMAGE_B64) throw new HttpError(413, 'Gambar terlalu besar (maks ~3MB setelah dikompres).');
  const style = ALLOWED_STYLES.includes(b.style) ? b.style : ALLOWED_STYLES[0];
  const ratio = ALLOWED_RATIOS.includes(b.ratio) ? b.ratio : '9:16';
  return { productName, affiliateLink, image, mimeType, style, ratio };
}

function buildPayload({ productName, affiliateLink, style, ratio, image, mimeType }) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [
        { text: `Produk: ${productName}\nLink Afiliasi: ${affiliateLink}\nGaya Iklan: ${style}\nRasio Aspek: ${ratio}\n\nBuatkan konsep video iklan afiliasi dan prompt Gemini Veo berdasarkan gambar produk ini.` },
        { inlineData: { mimeType, data: image } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
  };
}

// Pemeriksaan kode akses opsional (env ACCESS_CODE) agar kuota API tidak dipakai orang lain.
function checkAccess(headerValue, env = process.env) {
  if (env.ACCESS_CODE && headerValue !== env.ACCESS_CODE) throw new HttpError(401, 'Kode akses salah atau belum diisi.');
}

// Proses lengkap: validasi -> panggil Gemini -> kembalikan objek hasil.
async function generate(body, env = process.env, fetchImpl = fetch) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'GEMINI_API_KEY belum diatur di server.');
  const input = validate(body);
  const model = ALLOWED_MODELS.includes(env.GEMINI_MODEL) ? env.GEMINI_MODEL : ALLOWED_MODELS[0];
  const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildPayload(input)),
  });
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) throw new HttpError(r.status, j.error?.message || `Gemini error ${r.status}`);
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new HttpError(502, 'Respon kosong dari Gemini.');
  try { return JSON.parse(text); } catch (_) { throw new HttpError(502, 'Respon Gemini bukan JSON valid.'); }
}

module.exports = { generate, validate, buildPayload, checkAccess, HttpError, ALLOWED_MODELS };
