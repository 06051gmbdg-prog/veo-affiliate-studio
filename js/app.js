// --- State Aplikasi ---
        let uploadedImageBase64 = null;
        let uploadedImageMimeType = 'image/jpeg';
        let subtitleInterval = null;
        let currentAdData = null;

        // --- Elemen DOM ---
        const imageInput = document.getElementById('product-image');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const imagePreviewContainer = document.getElementById('image-preview-container');
        const imagePreview = document.getElementById('image-preview');
        const adForm = document.getElementById('ad-form');
        const generateBtn = document.getElementById('generate-btn');

        const emptyState = document.getElementById('empty-state');
        const loadingState = document.getElementById('loading-state');
        const resultState = document.getElementById('result-state');

        // --- Pengaturan (API key & model) disimpan di localStorage ---
        function getSetting(k) { try { return localStorage.getItem('veo_' + k) || ''; } catch (_) { return ''; } }
        function setSetting(k, v) { try { localStorage.setItem('veo_' + k, v); } catch (_) {} }
        function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

        const settingsModal = document.getElementById('settings-modal');
        let proxyAvailable = false;
        function refreshKeyDot() {
            document.getElementById('key-dot').className = 'w-2 h-2 rounded-full ' + ((getSetting('apiKey') || proxyAvailable) ? 'bg-emerald-400' : 'bg-rose-500');
            document.getElementById('proxy-note').classList.toggle('hidden', !proxyAvailable);
        }
        function openSettings() {
            document.getElementById('api-key-input').value = getSetting('apiKey');
            document.getElementById('access-input').value = getSetting('accessCode');
            document.getElementById('model-input').value = getSetting('model') || 'gemini-2.5-flash';
            settingsModal.classList.remove('hidden'); settingsModal.classList.add('flex');
        }
        function closeSettings() { settingsModal.classList.add('hidden'); settingsModal.classList.remove('flex'); }
        document.getElementById('settings-btn').addEventListener('click', openSettings);
        document.getElementById('settings-cancel').addEventListener('click', closeSettings);
        document.getElementById('settings-save').addEventListener('click', () => {
            setSetting('apiKey', document.getElementById('api-key-input').value.trim());
            setSetting('accessCode', document.getElementById('access-input').value.trim());
            setSetting('model', document.getElementById('model-input').value);
            refreshKeyDot(); closeSettings(); showToast('Pengaturan tersimpan.', 'success');
        });
        refreshKeyDot();
        // Deteksi backend proxy: GET ke /api/generate dijawab 405 jika proxy ada.
        fetch('/api/generate').then(r => { proxyAvailable = r.status === 405; refreshKeyDot(); }).catch(() => {});

        // --- Fungsi Notifikasi Toast (Pengganti alert) ---
        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            
            const colors = {
                success: 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100',
                error: 'bg-rose-900/90 border-rose-500/50 text-rose-100',
                info: 'bg-slate-800/95 border-brand-500/50 text-white'
            };
            const icons = {
                success: 'fa-circle-check text-emerald-400',
                error: 'fa-circle-exclamation text-rose-400',
                info: 'fa-circle-info text-brand-400'
            };

            toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-medium transition-all duration-300 transform translate-y-0 opacity-100 ${colors[type]}`;
            toast.innerHTML = `
                <i class="fa-solid ${icons[type]} text-base"></i>
                <span class="flex-1">${message}</span>
            `;

            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }

        // --- Fungsi Salin Teks ke Clipboard (Kompatibel IFrame) ---
        function copyText(elementId, label) {
            const el = document.getElementById(elementId);
            const textToCopy = el.value !== undefined ? el.value : el.innerText;
            
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = textToCopy;
            document.body.appendChild(tempTextarea);
            tempTextarea.select();
            try {
                document.execCommand('copy');
                showToast(`${label} berhasil disalin!`, 'success');
            } catch (err) {
                showToast('Gagal menyalin teks.', 'error');
            }
            document.body.removeChild(tempTextarea);
        }

        function downscaleImage(dataUrl, maxSide, quality) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
                    const c = document.createElement('canvas');
                    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
                    const ctx = c.getContext('2d');
                    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
                    ctx.drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = dataUrl;
            });
        }

        // --- Panggilan lewat backend proxy (API key tersimpan di server) ---
        async function generateViaProxy(productName, affiliateLink, style, ratio, base64Img, mimeType) {
            let response;
            try {
                response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-access-code': getSetting('accessCode') },
                    body: JSON.stringify({ productName, affiliateLink, style, ratio, image: base64Img, mimeType })
                });
            } catch (_) { throw new Error('NO_API_KEY'); }
            if (response.status === 404 || response.status === 405) throw new Error('NO_API_KEY'); // tidak ada backend
            let data = {};
            try { data = await response.json(); } catch (_) {}
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            return data;
        }

        // --- Handler Upload Gambar ---
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showToast('Harap pilih file gambar yang valid (JPG, PNG, WEBP).', 'error');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showToast('Ukuran gambar maksimal 5MB.', 'error');
                return;
            }

            uploadedImageMimeType = file.type;
            const reader = new FileReader();
            reader.onload = function(event) {
                const fullDataUrl = event.target.result;
                imagePreview.src = fullDataUrl;
                // Simpan base64 murni tanpa prefix data:image/...;base64,
                uploadedImageBase64 = null;
                // Perkecil & kompres agar muat di batas body server (Vercel 4,5MB) dan hemat token
                downscaleImage(fullDataUrl, 1280, 0.85).then(small => {
                    uploadedImageBase64 = small.split(',')[1];
                    uploadedImageMimeType = 'image/jpeg';
                    uploadPlaceholder.classList.add('hidden');
                    imagePreviewContainer.classList.remove('hidden');
                    showToast('Foto produk berhasil dimuat!', 'success');
                }).catch(() => showToast('Gagal membaca gambar.', 'error'));
            };
            reader.readAsDataURL(file);
        });

        // --- Panggilan Gemini API (Multimodal + Structured JSON Output) ---
        async function generateAdConceptWithGemini(productName, affiliateLink, style, ratio, base64Img, mimeType) {
            const apiKey = getSetting('apiKey');
            if (!apiKey) return generateViaProxy(productName, affiliateLink, style, ratio, base64Img, mimeType);
            const model = getSetting('model') || 'gemini-2.5-flash';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

            const systemPrompt = `Anda adalah sutradara iklan video afiliasi (TikTok/Reels/Shorts) dan ahli prompt engineering untuk model generasi video AI "Gemini Veo".
Tugas Anda adalah menganalisis gambar produk yang diberikan beserta nama produknya, lalu menghasilkan:
1. Naskah iklan video singkat (15 detik) dalam Bahasa Indonesia yang sangat persuasif, natural, dan memicu klik (FOMO/solutif) terdiri dari Hook, Body, dan CTA.
2. Caption media sosial menarik lengkap dengan hashtag relevan dan menyertakan link afiliasi.
3. Prompt teknis dalam Bahasa Inggris yang sangat detail untuk model generasi video "Gemini Veo" (Image-to-Video) agar gambar produk tersebut bergerak sinematik sesuai gaya iklan yang dipilih.`;

            const userQuery = `Produk: ${productName}
Link Afiliasi: ${affiliateLink}
Gaya Iklan: ${style}
Rasio Aspek: ${ratio}

Buatkan konsep video iklan afiliasi dan prompt Gemini Veo berdasarkan gambar produk ini.`;

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: userQuery },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Img
                                }
                            }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            hook: { type: "STRING", description: "Kalimat pembuka 3 detik pertama yang menarik perhatian (Bahasa Indonesia)" },
                            body: { type: "STRING", description: "Penjelasan manfaat utama produk secara singkat dan padat (Bahasa Indonesia)" },
                            cta: { type: "STRING", description: "Ajakan klik keranjang/link afiliasi sekarang (Bahasa Indonesia)" },
                            socialCaption: { type: "STRING", description: "Caption siap posting untuk TikTok/IG beserta link afiliasi dan hashtag" },
                            veoPrompt: { type: "STRING", description: "Detailed cinematic video generation prompt in English for Gemini Veo describing camera movement, lighting, background motion, and product focus" }
                        },
                        required: ["hook", "body", "cta", "socialCaption", "veoPrompt"]
                    }
                }
            };

            // Exponential Backoff Retry
            const delays = [1000, 2000, 4000];
            for (let attempt = 0; attempt <= delays.length; attempt++) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        let detail = '';
                        try { detail = (await response.json()).error?.message || ''; } catch (_) {}
                        const err = new Error(detail || `HTTP ${response.status}`);
                        err.status = response.status;
                        throw err;
                    }

                    const result = await response.json();
                    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!textResponse) {
                        throw new Error("Respon kosong dari Gemini API");
                    }
                    return JSON.parse(textResponse);
                } catch (error) {
                    const fatal = error.status && error.status >= 400 && error.status < 500 && error.status !== 429;
                    if (fatal || attempt === delays.length) {
                        throw error;
                    }
                    await new Promise(res => setTimeout(res, delays[attempt]));
                }
            }
        }

        // --- Animasi Progress Loading ---
        function updateLoadingSteps(step) {
            const s1 = document.getElementById('step-1');
            const s2 = document.getElementById('step-2');
            const s3 = document.getElementById('step-3');

            if (step === 1) {
                s1.className = "flex items-center gap-2.5 text-xs text-brand-400 font-medium";
                s1.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analisis Visual Gambar Produk`;
                s2.className = "flex items-center gap-2.5 text-xs text-slate-500";
                s2.innerHTML = `<i class="fa-regular fa-circle"></i> Penulisan Naskah Iklan & Hook`;
                s3.className = "flex items-center gap-2.5 text-xs text-slate-500";
                s3.innerHTML = `<i class="fa-regular fa-circle"></i> Rendering Simulasi Video Gemini Veo`;
            } else if (step === 2) {
                s1.className = "flex items-center gap-2.5 text-xs text-emerald-400 font-medium";
                s1.innerHTML = `<i class="fa-solid fa-circle-check"></i> Analisis Visual Gambar Produk`;
                s2.className = "flex items-center gap-2.5 text-xs text-brand-400 font-medium";
                s2.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Penulisan Naskah Iklan & Hook`;
            } else if (step === 3) {
                s2.className = "flex items-center gap-2.5 text-xs text-emerald-400 font-medium";
                s2.innerHTML = `<i class="fa-solid fa-circle-check"></i> Penulisan Naskah Iklan & Hook`;
                s3.className = "flex items-center gap-2.5 text-xs text-brand-400 font-medium";
                s3.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Rendering Simulasi Video Gemini Veo`;
            }
        }

        // --- Pemutar Simulasi Video & Subtitle Dinamis ---
        function startVideoSimulation(adData, productName, affiliateLink, ratio) {
            if (subtitleInterval) clearInterval(subtitleInterval);

            const wrapper = document.getElementById('video-canvas-wrapper');
            const badgeRatio = document.getElementById('badge-ratio');
            const bgBlur = document.getElementById('video-bg-blur');
            const prodImg = document.getElementById('video-product-img');
            const subtitleText = document.getElementById('video-subtitle-text');
            const cardTitle = document.getElementById('video-card-title');
            const ctaLink = document.getElementById('video-cta-link');
            const progressBar = document.getElementById('video-progress-bar');

            // Atur Rasio Aspek Container
            badgeRatio.textContent = ratio;
            wrapper.classList.remove('aspect-[9/16]', 'aspect-video', 'aspect-square', 'max-w-[300px]', 'max-w-full');
            if (ratio === '9:16') {
                wrapper.classList.add('aspect-[9/16]', 'max-w-[300px]');
            } else if (ratio === '16:9') {
                wrapper.classList.add('aspect-video', 'max-w-full');
            } else {
                wrapper.classList.add('aspect-square', 'max-w-[340px]');
            }

            // Set Gambar & Info Link
            const fullImgSrc = imagePreview.src;
            bgBlur.src = fullImgSrc;
            prodImg.src = fullImgSrc;
            cardTitle.textContent = productName;
            ctaLink.href = affiliateLink;

            // Siklus Subtitle (Hook -> Body -> CTA) selama 12 detik
            const scenes = [
                { text: `"${adData.hook}"`, color: 'text-amber-300', progress: 33 },
                { text: `"${adData.body}"`, color: 'text-white', progress: 68 },
                { text: `"${adData.cta}"`, color: 'text-emerald-300', progress: 100 }
            ];

            let currentScene = 0;
            
            function renderScene() {
                const scene = scenes[currentScene];
                subtitleText.textContent = scene.text;
                subtitleText.className = `text-xs sm:text-sm font-bold leading-snug ${scene.color}`;
                progressBar.style.width = `${scene.progress}%`;
                currentScene = (currentScene + 1) % scenes.length;
            }

            renderScene();
            subtitleInterval = setInterval(renderScene, 4000);
        }

        // --- Submit Form Utama ---
        adForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!uploadedImageBase64) {
                showToast('Silakan unggah foto produk terlebih dahulu!', 'error');
                return;
            }

            const productName = document.getElementById('product-name').value.trim();
            const affiliateLink = document.getElementById('affiliate-link').value.trim();
            const videoStyle = document.getElementById('video-style').value;
            const aspectRatio = document.getElementById('aspect-ratio').value;

            if (!productName || !affiliateLink) {
                showToast('Nama produk dan link afiliasi wajib diisi.', 'error');
                return;
            }

            // UI State -> Loading
            generateBtn.disabled = true;
            generateBtn.classList.add('opacity-70', 'cursor-not-allowed');
            emptyState.classList.add('hidden');
            resultState.classList.add('hidden');
            loadingState.classList.remove('hidden');
            updateLoadingSteps(1);

            try {
                // Simulasi transisi step visual
                const stepTimer1 = setTimeout(() => updateLoadingSteps(2), 1500);
                const stepTimer2 = setTimeout(() => updateLoadingSteps(3), 3200);

                // Panggil Gemini API
                const aiResult = await generateAdConceptWithGemini(
                    productName,
                    affiliateLink,
                    videoStyle,
                    aspectRatio,
                    uploadedImageBase64,
                    uploadedImageMimeType
                );

                clearTimeout(stepTimer1);
                clearTimeout(stepTimer2);

                currentAdData = {
                    ...aiResult,
                    productName,
                    affiliateLink,
                    aspectRatio
                };

                // Isi Data ke UI Hasil
                document.getElementById('text-hook').textContent = aiResult.hook;
                document.getElementById('text-body').textContent = aiResult.body;
                document.getElementById('text-cta').textContent = aiResult.cta;
                document.getElementById('social-caption').value = aiResult.socialCaption;
                document.getElementById('veo-prompt-text').textContent = aiResult.veoPrompt;

                // Tampilkan Hasil & Jalankan Simulasi Video
                loadingState.classList.add('hidden');
                resultState.classList.remove('hidden');
                startVideoSimulation(aiResult, productName, affiliateLink, aspectRatio);
                showToast('Konsep video iklan & prompt Veo berhasil dibuat!', 'success');

            } catch (error) {
                console.error(error);
                loadingState.classList.add('hidden');
                emptyState.classList.remove('hidden');
                if (error.message === 'NO_API_KEY') {
                    showToast('Masukkan Gemini API Key terlebih dahulu.', 'error');
                    openSettings();
                } else {
                    showToast('Gagal: ' + escapeHtml(error.message || 'Terjadi kesalahan, coba lagi.'), 'error');
                }
            } finally {
                generateBtn.disabled = false;
                generateBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        });

        // --- Tombol Putar Ulang ---
        document.getElementById('replay-btn').addEventListener('click', () => {
            if (!currentAdData) return;
            const prodImg = document.getElementById('video-product-img');
            // Reset animasi CSS
            prodImg.classList.remove('animate-ken-burns');
            void prodImg.offsetWidth; // trigger reflow
            prodImg.classList.add('animate-ken-burns');
            
            startVideoSimulation(
                currentAdData,
                currentAdData.productName,
                currentAdData.affiliateLink,
                currentAdData.aspectRatio
            );
            showToast('Memutar ulang pratinjau iklan...', 'info');
        });

        // --- Tombol Unduh Frame Iklan (Render ke Canvas PNG) ---
        document.getElementById('download-poster-btn').addEventListener('click', () => {
            if (!currentAdData || !imagePreview.src) return;

            const canvas = document.getElementById('export-canvas');
            const ctx = canvas.getContext('2d');

            // Set resolusi HD 1080x1920 (9:16)
            canvas.width = 1080;
            canvas.height = 1920;

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function() {
                // Background gelap elegan
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Gambar Produk di Tengah
                const scale = Math.min((canvas.width * 0.8) / img.width, (canvas.height * 0.5) / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (canvas.width - w) / 2;
                const y = (canvas.height - h) / 2 - 120;
                ctx.drawImage(img, x, y, w, h);

                // Badge Promo Atas
                ctx.fillStyle = '#e11d48';
                ctx.beginPath();
                ctx.roundRect(60, 80, 340, 64, 32);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 28px Inter, sans-serif';
                ctx.fillText('🔥 RACUN BELANJA', 95, 122);

                // Kotak Hook Teks
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.beginPath();
                ctx.roundRect(60, 1320, 960, 220, 32);
                ctx.fill();

                ctx.fillStyle = '#fcd34d';
                ctx.font = 'bold 38px Inter, sans-serif';
                wrapText(ctx, `"${currentAdData.hook}"`, 100, 1390, 880, 50);

                // Kartu CTA Bawah
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(60, 1580, 960, 200, 36);
                ctx.fill();

                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 42px Inter, sans-serif';
                ctx.fillText(currentAdData.productName.substring(0, 32), 100, 1665);

                ctx.fillStyle = '#059669';
                ctx.font = 'bold 30px Inter, sans-serif';
                ctx.fillText('🛒 Klik Link di Bio / Keranjang Sekarang!', 100, 1730);

                // Trigger Download
                const link = document.createElement('a');
                link.download = `Iklan-Afiliasi-${currentAdData.productName.replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('Frame iklan HD berhasil diunduh!', 'success');
            };
            img.src = imagePreview.src;
        });

        // Helper pembungkus teks di Canvas
        function wrapText(context, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            let currentY = y;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    context.fillText(line, x, currentY);
                    line = words[n] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            context.fillText(line, x, currentY);
        }
