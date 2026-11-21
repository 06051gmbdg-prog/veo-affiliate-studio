# Veo Affiliate Studio

Pembuat konsep video iklan afiliasi berbasis AI (Gemini). Unggah foto produk, isi nama & link afiliasi, lalu dapatkan:

- Naskah iklan 15 detik (Hook, Body, CTA) dalam Bahasa Indonesia
- Caption siap posting + hashtag + link afiliasi
- Prompt sinematik Image-to-Video untuk Gemini Veo
- Pratinjau animasi iklan & unduh frame PNG 1080x1920

## Menjalankan

Aplikasi statis, tanpa build.

```bash
python3 -m http.server 8080   # lalu buka http://localhost:8080
```

Klik tombol **API Key** di header, tempel Gemini API Key dari https://aistudio.google.com/apikey. Key disimpan hanya di localStorage browser.

> Catatan: versi awal gagal berjalan karena `apiKey` kosong (hanya terisi otomatis di lingkungan khusus) dan model `gemini-3-flash-preview`. Sekarang key diisi pengguna dan model bisa dipilih.

## Struktur

```
index.html   # UI (Tailwind CDN)
js/app.js    # logika, panggilan Gemini, pratinjau, export
```

## Roadmap

- [ ] Backend proxy agar API key tidak di browser
- [ ] Render video asli via Veo API (saat ini hanya prompt + simulasi)
- [ ] Ekspor video (MediaRecorder/WebM)
- [ ] Riwayat proyek & multi-foto produk
- [ ] Voiceover (TTS)
