/*
   Vesak Card Website - Core JavaScript Logic
   Includes: Particle System, 3-Step Wizard, Dynamic Image Loader with Caching, 
   Procedural Vector Fallback, Real-time Canvas Renderer, and Exporting.
*/

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. STATE MANAGEMENT
    // -------------------------------------------------------------
    const state = {
        sender: '',
        recipient: '',
        bgId: 1,
        currentStep: 1
    };

    const TOTAL_STEPS = 3;
    const imageCache = {}; // Cache for pre-loaded background JPEGs

    // Pre-load and cache the official University of Sri Jayewardenepura logo
    let jpuraLogoImage = null;
    function loadJpuraLogo() {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = 'src/jpura.webp';
            img.onload = () => {
                jpuraLogoImage = img;
                updateLivePreview(); // re-draw preview once loaded
                resolve(img);
            };
            img.onerror = () => {
                resolve(null);
            };
        });
    }
    loadJpuraLogo();

    // -------------------------------------------------------------
    // 2. DOM ELEMENTS SELECTION
    // -------------------------------------------------------------
    const landingView = document.getElementById('landing-view');
    const creatorView = document.getElementById('creator-view');
    const startBtn = document.getElementById('start-wizard-btn');
    const mainLogoBtn = document.getElementById('main-logo-btn');
    const friendshipCounter = document.getElementById('friendship-counter');

    // Wizard Controls
    const prevStepBtn = document.getElementById('prev-step-btn');
    const nextStepBtn = document.getElementById('next-step-btn');
    const stepTitle = document.getElementById('wizard-step-title');
    const stepSubtitle = document.getElementById('wizard-step-subtitle');
    const stepIndicatorsBar = document.getElementById('step-indicators-bar');

    // Inputs & Counters
    const inputSender = document.getElementById('input-sender');
    const inputRecipient = document.getElementById('input-recipient');
    const senderCounter = document.getElementById('sender-counter');
    const recipientCounter = document.getElementById('recipient-counter');
    const bgSelectionGrid = document.getElementById('bg-selection-grid');

    // Canvas Preview
    const previewCanvas = document.getElementById('preview-canvas');
    const previewCtx = previewCanvas.getContext('2d');
    const previewImage = document.getElementById('preview-image');

    // Modal
    const successModal = document.getElementById('success-modal');
    const modalSuccessTitle = document.getElementById('modal-success-title');
    const modalSuccessDesc = document.getElementById('modal-success-desc');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Actions
    const btnDownloadCard = document.getElementById('btn-download-card');
    const btnWebShare = document.getElementById('btn-web-share');
    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    const shareMessengerBtn = document.getElementById('share-messenger-btn');
    const shareInstagramBtn = document.getElementById('share-instagram-btn');

    // Ensure custom Google Fonts are fully loaded before rendering
    document.fonts.ready.then(() => {
        updateLivePreview();
    });

    // -------------------------------------------------------------
    // 3. BACKGROUND DUST PARTICLE SYSTEM
    // -------------------------------------------------------------
    const particlesCanvas = document.getElementById('bg-particles');
    const pCtx = particlesCanvas.getContext('2d');

    let particles = [];
    const maxParticles = 50;

    function resizeParticlesCanvas() {
        particlesCanvas.width = window.innerWidth;
        particlesCanvas.height = window.innerHeight;
    }

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * particlesCanvas.width;
            this.y = particlesCanvas.height + Math.random() * 100;
            this.size = Math.random() * 2 + 0.5;
            this.speedY = -(Math.random() * 0.6 + 0.2);
            this.speedX = Math.random() * 0.3 - 0.15;
            this.alpha = Math.random() * 0.4 + 0.2;
            this.fadeSpeed = Math.random() * 0.004 + 0.001;
            this.glowColor = Math.random() > 0.6 ? '#fbfcdb' : '#ffffff';
        }

        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            this.alpha -= this.fadeSpeed;

            this.speedX += Math.random() * 0.04 - 0.02;
            this.speedX = Math.max(-0.3, Math.min(0.3, this.speedX));

            if (this.alpha <= 0 || this.y < -10 || this.x < -10 || this.x > particlesCanvas.width + 10) {
                this.reset();
            }
        }

        draw() {
            pCtx.save();
            pCtx.globalAlpha = this.alpha;
            pCtx.shadowBlur = 8;
            pCtx.shadowColor = this.glowColor;
            pCtx.fillStyle = this.glowColor;
            pCtx.beginPath();
            pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            pCtx.fill();
            pCtx.restore();
        }
    }

    function initParticles() {
        resizeParticlesCanvas();
        particles = [];
        for (let i = 0; i < maxParticles; i++) {
            particles.push(new Particle());
            particles[i].y = Math.random() * particlesCanvas.height;
        }
    }

    function animateParticles() {
        pCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        requestAnimationFrame(animateParticles);
    }

    window.addEventListener('resize', resizeParticlesCanvas);
    initParticles();
    animateParticles();

    // -------------------------------------------------------------
    // 4. COUNTER ANIMATION
    // -------------------------------------------------------------
    function animateCounter(target) {
        let count = target - 100;
        const speed = 15;
        const timer = setInterval(() => {
            count += 2;
            if (count >= target) {
                count = target;
                clearInterval(timer);
            }
            friendshipCounter.textContent = count.toLocaleString('si-LK');
        }, speed);
    }
    animateCounter(6106);

    // -------------------------------------------------------------
    // 5. ASYNCHRONOUS TEMPLATE LOADER (WITH CACHING & FALLBACK)
    // -------------------------------------------------------------
    function getTemplateImage(bgId) {
        const src = `src/${bgId}.webp`;

        // Return cached image if available
        if (imageCache[src]) {
            return Promise.resolve(imageCache[src]);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                imageCache[src] = img;
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load ${src}`));
            };
        });
    }

    // -------------------------------------------------------------
    // 6. CARD TEMPLATE DRAWING ENGINE (HIGH FIDELITY)
    // -------------------------------------------------------------

    // Core drawing logic used for both Live Preview and High-res Export
    function drawVesakCard(ctx, w, h, bgId, senderName, recipientName, backgroundImage = null) {
        ctx.clearRect(0, 0, w, h);
        ctx.save();

        if (backgroundImage) {
            // A. DRAW DESIGNED JPEG TEMPLATE
            ctx.drawImage(backgroundImage, 0, 0, w, h);
        } else {
            // B. PROCEDURAL VECTOR FALLBACK (For templates 7-15 not yet uploaded)
            let g = ctx.createRadialGradient(w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, w * 0.9);
            g.addColorStop(0, '#ffd54f');
            g.addColorStop(0.3, '#f57c00');
            g.addColorStop(0.7, '#0d47a1');
            g.addColorStop(1, '#020617');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);

            // Meditating Buddha Silhouette
            ctx.fillStyle = 'rgba(28, 1, 12, 0.9)';
            ctx.beginPath();
            ctx.arc(w * 0.65, h * 0.28, 55, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(w * 0.65, h * 0.36, 68, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(w * 0.58, h * 0.34, 15, 60);
            ctx.fillRect(w * 0.70, h * 0.34, 15, 60);
            ctx.beginPath();
            ctx.ellipse(w * 0.65, h * 0.58, 180, 160, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(191, 54, 12, 0.45)';
            ctx.beginPath();
            ctx.ellipse(w * 0.65, h * 0.58, 178, 158, 0, 0, Math.PI * 2);
            ctx.fill();

            // Card borders
            ctx.strokeStyle = 'rgba(255, 213, 79, 0.3)';
            ctx.lineWidth = 3;
            ctx.strokeRect(20, 20, w - 40, h - 40);

            // Typography: "HAPPY VESAK DAY"
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = "300 24px 'Outfit', sans-serif";
            ctx.fillText("H A P P Y", 80, 100);
            ctx.fillStyle = '#ffd54f';
            ctx.font = "800 68px 'Outfit', sans-serif";
            ctx.fillText("VESAK", 80, 165);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = "300 24px 'Outfit', sans-serif";
            ctx.fillText("D A Y", 80, 205);

            // Pre-printed fall-back wish
            ctx.fillStyle = '#ffffff';
            ctx.font = "500 21px 'Abhaya Libre', serif";
            const fallbackPoem = [
                "May the blessings of",
                "the thrice-sacred day",
                "fill your life with",
                "Harmony, Prosperity, and",
                "Inner Peace."
            ];
            fallbackPoem.forEach((l, i) => ctx.fillText(l, 80, 270 + (i * 32)));

            // Drawn Parchment box for fall-back (Matches user card parchment size & placement)
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 8;
            ctx.fillStyle = '#ebdcb9';
            ctx.beginPath();
            ctx.roundRect(140, 730, 520, 140, 8);
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = '#4e2f12';
            ctx.font = "700 28px 'Kalam', 'Caveat', cursive";
            ctx.fillText("From:", 180, 785);
            ctx.fillText("To:", 180, 835);

            // University Logo Bar Fall-back
            ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
            ctx.beginPath();
            ctx.roundRect(140, h - 90, 520, 52, 26);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 213, 79, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(140, h - 90, 520, 52, 26);
            ctx.stroke();

            let ex = 166, ey = h - 64;
            if (jpuraLogoImage) {
                // Render the official Japura logo image
                ctx.drawImage(jpuraLogoImage, ex - 16, ey - 16, 32, 32);
            } else {
                // Fail-safe golden vector shapes fallback
                ctx.fillStyle = '#ffd54f';
                ctx.beginPath();
                ctx.arc(ex, ey, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
                ctx.beginPath();
                ctx.arc(ex, ey, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffd54f';
                ctx.beginPath();
                ctx.arc(ex, ey, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffd54f';
            ctx.font = "800 13px 'Outfit', sans-serif";
            ctx.fillText("FACULTY OF COMPUTING", ex + 28, ey - 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = "500 11px 'Outfit', sans-serif";
            ctx.fillText("UNIVERSITY OF SRI JAYEWARDENEPURA", ex + 28, ey + 12);
        }

        // 3. OVERLAY SENDER & RECIPIENT NAMES (Aligned on the pre-printed parchment paper)
        const scale = w / 1200; // coordinate scale factor

        ctx.fillStyle = '#3d1d04'; // Premium organic dark brown ink color
        ctx.font = `700 ${36 * scale}px 'Kalam', 'Caveat', cursive`;

        // Draw Sender Name (From) - Centered horizontally, shifted slightly left for optimal balance
        ctx.textAlign = 'center';
        const finalSender = senderName.trim() ? senderName : "........................................";
        ctx.fillText(finalSender, 620 * scale, 1296 * scale);

        // Draw Recipient Name (To) - Centered horizontally, shifted slightly left for optimal balance
        const finalRecipient = recipientName.trim() ? recipientName : "........................................";
        ctx.fillText(finalRecipient, 620 * scale, 1348 * scale);

        ctx.restore();
    }

    // -------------------------------------------------------------
    // 7. LIVE PREVIEW UPDATE TRIGGER
    // -------------------------------------------------------------
    function updateLivePreview() {
        getTemplateImage(state.bgId)
            .then(img => {
                // Success: draw designed JPEG template
                drawVesakCard(
                    previewCtx,
                    previewCanvas.width,
                    previewCanvas.height,
                    state.bgId,
                    state.sender,
                    state.recipient,
                    img
                );
                previewImage.src = previewCanvas.toDataURL('image/png');
            })
            .catch(err => {
                // Fallback: draw beautiful procedural vector template
                drawVesakCard(
                    previewCtx,
                    previewCanvas.width,
                    previewCanvas.height,
                    state.bgId,
                    state.sender,
                    state.recipient,
                    null
                );
                previewImage.src = previewCanvas.toDataURL('image/png');
            });
    }

    // -------------------------------------------------------------
    // 8. INPUT LISTENERS & REAL-TIME CHARACTER COUNTERS
    // -------------------------------------------------------------
    inputSender.addEventListener('input', (e) => {
        state.sender = e.target.value;
        if (senderCounter) {
            senderCounter.textContent = `${e.target.value.length}/20`;
        }
        updateLivePreview();
    });

    inputRecipient.addEventListener('input', (e) => {
        state.recipient = e.target.value;
        if (recipientCounter) {
            recipientCounter.textContent = `${e.target.value.length}/20`;
        }
        updateLivePreview();
    });

    // -------------------------------------------------------------
    // 9. BACKGROUNDS GRID GENERATION (15 OPTIONS)
    // -------------------------------------------------------------
    function renderBackgroundOptions() {
        bgSelectionGrid.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            const opt = document.createElement('div');
            opt.className = `bg-option bg-theme-${i}`;
            if (i === state.bgId) opt.classList.add('selected');
            opt.dataset.id = i;
            opt.title = `Template ${i}`;

            // Set grid thumbnail background with the actual designed WEBP
            opt.style.backgroundImage = `url('src/${i}.webp')`;

            // Inner border wrapper
            const innerBorder = document.createElement('div');
            innerBorder.style.position = 'absolute';
            innerBorder.style.top = '4px';
            innerBorder.style.left = '4px';
            innerBorder.style.right = '4px';
            innerBorder.style.bottom = '4px';
            innerBorder.style.border = '1px solid rgba(255,213,79,0.15)';
            innerBorder.style.borderRadius = '6px';
            opt.appendChild(innerBorder);

            opt.addEventListener('click', () => {
                document.querySelectorAll('.bg-option').forEach(el => el.classList.remove('selected'));
                opt.classList.add('selected');
                state.bgId = i;
                updateLivePreview();
            });
            bgSelectionGrid.appendChild(opt);
        }
    }

    // -------------------------------------------------------------
    // 10. WIZARD STEP NAVIGATION CONTROLLER
    // -------------------------------------------------------------
    function setStep(step) {
        if (step < 1 || step > TOTAL_STEPS) return;

        // Transition panes smoothly
        document.querySelectorAll('.step-pane').forEach((pane, idx) => {
            if (idx + 1 === step) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        // Update indicators
        const dots = stepIndicatorsBar.querySelectorAll('.step-dot');
        dots.forEach((dot, idx) => {
            dot.className = 'step-dot';
            if (idx + 1 === step) {
                dot.classList.add('active');
            } else if (idx + 1 < step) {
                dot.classList.add('completed');
            }
        });

        state.currentStep = step;
        prevStepBtn.disabled = (step === 1);

        if (step === TOTAL_STEPS) {
            nextStepBtn.innerHTML = `Finish <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
            nextStepBtn.style.background = 'linear-gradient(135deg, #ffd54f 0%, #ffb300 100%)';
            nextStepBtn.style.color = '#12010A';
        } else {
            nextStepBtn.innerHTML = `Next <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;
            nextStepBtn.style.background = ''; // restore to CSS default
            nextStepBtn.style.color = '';
        }

        // Dynamic Header titles per step
        switch (step) {
            case 1:
                stepTitle.textContent = "පළමු පියවර: නම් ඇතුළත් කරන්න";
                stepSubtitle.textContent = "සුබපැතුම් යවන්නා සහ ලබන්නාගේ නම් සටහන් කරන්න";
                break;
            case 2:
                stepTitle.textContent = "දෙවන පියවර: පසුබිම තෝරන්න";
                stepSubtitle.textContent = "කාඩ්පතට ගැලපෙන අලංකාර වෙසක් පසුබිමක් තෝරන්න (8 options)";
                break;
            case 3:
                stepTitle.textContent = "තෙවන පියවර: බාගත කර බෙදාගන්න";
                stepSubtitle.textContent = "ඔබ සැකසූ සුබපැතුම් පත බාගත කර මිතුරන් අතර බෙදා හරින්න";
                break;
        }
    }

    startBtn.addEventListener('click', () => {
        landingView.style.display = 'none';
        creatorView.style.display = 'grid';

        renderBackgroundOptions();
        updateLivePreview();
        setStep(1);
    });

    mainLogoBtn.addEventListener('click', () => {
        creatorView.style.display = 'none';
        landingView.style.display = 'flex';
        // Reset inputs
        inputSender.value = '';
        inputRecipient.value = '';
        state.sender = '';
        state.recipient = '';
        state.bgId = 1;
        if (senderCounter) senderCounter.textContent = '0/20';
        if (recipientCounter) recipientCounter.textContent = '0/20';
        updateLivePreview();
    });

    prevStepBtn.addEventListener('click', () => {
        setStep(state.currentStep - 1);
    });

    nextStepBtn.addEventListener('click', () => {
        if (state.currentStep < TOTAL_STEPS) {
            setStep(state.currentStep + 1);
        } else {
            modalSuccessTitle.textContent = "සුභ වෙසක් මංගල්‍යයක් වේවා! 🌸";
            modalSuccessDesc.textContent = "ඔබගේ අලංකාර වෙසක් සුබපැතුම් පත සාර්ථකව නිර්මාණය කර ඇත. පහත Download හෝ Share යෙදුම් භාවිතයෙන් එය ඔබේ හිතවතුන් අතරේ සැනෙකින් බෙදාහරින්න.";
            successModal.style.display = 'flex';
        }
    });

    modalCloseBtn.addEventListener('click', () => {
        successModal.style.display = 'none';
        
        // Redirect to Home (Landing Page View)
        creatorView.style.display = 'none';
        landingView.style.display = 'flex';
        
        // Reset all inputs, state parameters, and character counters for a clean fresh start
        inputSender.value = '';
        inputRecipient.value = '';
        state.sender = '';
        state.recipient = '';
        state.bgId = 1;
        if (senderCounter) senderCounter.textContent = '0/20';
        if (recipientCounter) recipientCounter.textContent = '0/20';
        updateLivePreview();
    });

    // -------------------------------------------------------------
    // 11. HIGH-RESOLUTION EXPORT GENERATOR
    // -------------------------------------------------------------
    function generateHighResCard(callback) {
        // Compose card at extreme sharp resolution (1200x1500px, 4:5 ratio)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 1200;
        exportCanvas.height = 1500;

        const exportCtx = exportCanvas.getContext('2d');

        // Use the same fallback logic as the live preview
        getTemplateImage(state.bgId)
            .then(img => {
                drawVesakCard(
                    exportCtx, exportCanvas.width, exportCanvas.height,
                    state.bgId, state.sender, state.recipient, img
                );
                callback(exportCanvas);
            })
            .catch(err => {
                drawVesakCard(
                    exportCtx, exportCanvas.width, exportCanvas.height,
                    state.bgId, state.sender, state.recipient, null
                );
                callback(exportCanvas);
            });
    }

    // -------------------------------------------------------------
    // 12. DOWNLOAD & SHARE ACTIONS
    // -------------------------------------------------------------
    // Download Card
    btnDownloadCard.addEventListener('click', () => {
        btnDownloadCard.style.opacity = '0.7';
        btnDownloadCard.style.pointerEvents = 'none';

        generateHighResCard((canvas) => {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `VesakCardGreeting_${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Increment friendship counter locally
            let count = parseInt(friendshipCounter.textContent.replace(/,/g, ''));
            friendshipCounter.textContent = (count + 1).toLocaleString('si-LK');

            modalSuccessTitle.textContent = "බාගත කිරීම සාර්ථකයි! 📥";
            modalSuccessDesc.textContent = "ඔබගේ වෙසක් පත සාර්ථකව ජංගම දුරකථනයට හෝ පරිගණකයට සුරැකී ඇත. දැන් එය ඕනෑම මාධ්‍යයකින් ඔබගේ හිතමිතුරන් වෙත යවන්න!";
            successModal.style.display = 'flex';

            btnDownloadCard.style.opacity = '1';
            btnDownloadCard.style.pointerEvents = 'auto';
        });
    });

    // -------------------------------------------------------------
    // 13. UNIFIED SOCIAL MEDIA SHARER WITH IMAGE + TEXT SUPPORT
    // -------------------------------------------------------------
    function shareCardWithImage(platformName, shareText, fallbackUrl = '') {
        const cleanUrl = window.location.origin + window.location.pathname;
        const fullShareText = `${shareText}\n\nමෙතැනින් ඔබේ පතත් සාදාගන්න: ${cleanUrl}`;

        // Temporarily disable the active sharing button to prevent duplicate clicks
        const activeBtn = document.activeElement;
        if (activeBtn) {
            activeBtn.style.opacity = '0.7';
            activeBtn.style.pointerEvents = 'none';
        }

        generateHighResCard((canvas) => {
            canvas.toBlob((blob) => {
                const file = new File([blob], `USJ_Vesak_Card_${Date.now()}.png`, { type: 'image/png' });

                // If Web Share API with binary files is supported (primarily mobile platforms)
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: 'පින්බර වෙසක් සිහිවටනයක් 🌸',
                        text: fullShareText
                    })
                        .then(() => {
                            modalSuccessTitle.textContent = "බෙදාගැනීම සාර්ථකයි! 🔗";
                            modalSuccessDesc.textContent = `ඔබගේ වෙසක් පත සාර්ථකව ${platformName} ඔස්සේ බෙදා ගන්නා ලදී. සාමය සහ සතුට පතුරවන්න!`;
                            successModal.style.display = 'flex';
                        })
                        .catch((err) => {
                            console.log('Share canceled or failed:', err);
                        })
                        .finally(() => {
                            if (activeBtn) {
                                activeBtn.style.opacity = '1';
                                activeBtn.style.pointerEvents = 'auto';
                            }
                        });
                } else {
                    // Fallback for Desktop & Unsupported Browsers:
                    // 1. Auto-download the high-res customized PNG image first
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `VesakCardGreeting_${Date.now()}.png`;
                    link.href = dataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // 2. If a fallback share URL is specified, open it in a new tab to share the link
                    if (fallbackUrl) {
                        const encodedText = encodeURIComponent(fullShareText);
                        let finalUrl = fallbackUrl;
                        if (platformName === 'WhatsApp') {
                            finalUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
                        } else if (platformName === 'Messenger') {
                            finalUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cleanUrl)}`;
                        }
                        window.open(finalUrl, '_blank');
                    }

                    // 3. Try to copy the image to the clipboard
                    const targetPlatform = platformName === 'Direct Share' ? 'ඕනෑම තැනක' : platformName;
                    if (navigator.clipboard && window.ClipboardItem) {
                        navigator.clipboard.write([
                            new ClipboardItem({
                                [blob.type]: blob
                            })
                        ]).then(() => {
                            modalSuccessTitle.textContent = "බාගත කිරීම සහ කොපි කිරීම සාර්ථකයි! 📥📋";
                            modalSuccessDesc.textContent = `ඔබගේ බ්‍රවුසරය සෘජුවම රූප Share කිරීමට සහය නොදක්වයි. එබැවින්, ඔබගේ වෙසක් පත ස්වයංක්‍රීයව බාගත කරන ලදී!\n\nඑමෙන්ම රූපය ඔබගේ Clipboard එකටද පිටපත් කරන ලදී (Copy). ඔබට එය ${targetPlatform} හි සෘජුවම Paste (Ctrl+V) කර පහසුවෙන් යැවිය හැක. 🌸`;
                            successModal.style.display = 'flex';
                        }).catch((err) => {
                            console.log('Clipboard write failed:', err);
                            modalSuccessTitle.textContent = "බාගත කිරීම සාර්ථකයි! 📥";
                            modalSuccessDesc.textContent = `ඔබගේ බ්‍රවුසරය සෘජුවම රූප Share කිරීමට සහය නොදක්වයි. එබැවින්, ඔබගේ වෙසක් පත ස්වයංක්‍රීයව බාගත කරන ලදී! දැන් එය පහසුවෙන්ම ${targetPlatform} වෙත Upload කර යැවිය හැක. 🌸`;
                            successModal.style.display = 'flex';
                        }).finally(() => {
                            if (activeBtn) {
                                activeBtn.style.opacity = '1';
                                activeBtn.style.pointerEvents = 'auto';
                            }
                        });
                    } else {
                        modalSuccessTitle.textContent = "බාගත කිරීම සාර්ථකයි! 📥";
                        modalSuccessDesc.textContent = `ඔබගේ බ්‍රවුසරය සෘජුවම රූප Share කිරීමට සහය නොදක්වයි. එබැවින්, ඔබගේ වෙසක් පත ස්වයංක්‍රීයව බාගත කරන ලදී! දැන් එය පහසුවෙන්ම ${targetPlatform} වෙත Upload කර යැවිය හැක. 🌸`;
                        successModal.style.display = 'flex';
                        if (activeBtn) {
                            activeBtn.style.opacity = '1';
                            activeBtn.style.pointerEvents = 'auto';
                        }
                    }
                }
            }, 'image/png');
        });
    }

    // Direct Web Share Button
    btnWebShare.addEventListener('click', () => {
        shareCardWithImage('Direct Share', 'පරිගණක පීඨයේ වෙසක් සිහිවටන පතකින් ඔබටත් මටත් සාමය සතුට පිරි සුභ වෙසක් මංගල්‍යයක් වේවා! 🌸✨');
    });

    // Individual Platform Sharing Triggers
    shareWhatsappBtn.addEventListener('click', () => {
        shareCardWithImage('WhatsApp', 'පරිගණක පීඨයේ වෙසක් සිහිවටන පතකින් ඔබටත් මටත් සාමය සතුට පිරි සුභ වෙසක් මංගල්‍යයක් වේවා! 🌸✨', 'whatsapp');
    });

    shareMessengerBtn.addEventListener('click', () => {
        shareCardWithImage('Messenger', 'පරිගණක පීඨයේ වෙසක් සිහිවටන පතකින් ඔබටත් මටත් සාමය සතුට පිරි සුභ වෙසක් මංගල්‍යයක් වේවා! 🌸✨', 'messenger');
    });

    shareInstagramBtn.addEventListener('click', () => {
        shareCardWithImage('Instagram', 'පරිගණක පීඨයේ වෙසක් සිහිවටන පතකින් ඔබටත් මටත් සාමය සතුට පිරි සුභ වෙසක් මංගල්‍යයක් වේවා! 🌸✨');
    });
});