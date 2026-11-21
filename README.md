# Veo Affiliate Studio

Pembuat konsep video iklan afiliasi berbasis AI (Gemini). Unggah foto produk, isi nama & link afiliasi, lalu dapatkan:

- Naskah iklan 15 detik (Hook, Body, CTA) dalam Bahasa Indonesia
- Caption siap posting + hashtag + link afiliasi
- Prompt sinematik Image-to-Video untuk Gemini Veo
- Pratinjau animasi iklan & unduh frame PNG 1080x1920

## Menjalankan

### Opsi 1: Dengan backend (disarankan, API key aman di server)

```bash
cp .env.example .env     # isi GEMINI_API_KEY di file .env
node server.js           # buka http://localhost:3000
```

Butuh Node.js 18+. Tidak ada dependensi yang perlu di-install.

### Opsi 2: Deploy ke Vercel

1. Import repo ini di https://vercel.com/new (login dengan GitHub).
2. Di **Settings > Environment Variables** tambahkan `GEMINI_API_KEY` (dan opsional `GEMINI_MODEL`, `ACCESS_CODE`).
3. Deploy. Folder `api/` otomatis menjadi backend di `/api/generate`.

`ACCESS_CODE` opsional: jika diisi, pengguna harus memasukkannya di menu **API Key** supaya kuota Gemini Anda tidak dipakai orang lain.

### Opsi 3: Tanpa backend (key di browser)

```bash
python3 -m http.server 8080
```

Klik **API Key** di header lalu tempel key dari https://aistudio.google.com/apikey (disimpan di localStorage). Jika backend tersedia dan kolom key kosong, aplikasi otomatis memakai backend.

## Struktur

```
index.html        # UI (Tailwind CDN)
js/app.js         # logika frontend, pratinjau, export
lib/gemini.js     # prompt, validasi, panggilan Gemini (dipakai server.js & api/)
server.js         # server lokal
api/generate.js   # fungsi serverless Vercel
```

## Roadmap

- [x] Backend proxy agar API key tidak di browser
- [ ] Render video asli via Veo API (saat ini hanya prompt + simulasi)
- [ ] Ekspor video (MediaRecorder/WebM)
- [ ] Riwayat proyek & multi-foto produk
- [ ] Voiceover (TTS)
