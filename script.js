document.addEventListener('DOMContentLoaded', () => {

    // Force page scroll reset to top on refresh
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    if (window.location.hash) {
        history.replaceState(null, null, ' ');
    }

    /* ==========================================================================
       FIREBASE CONFIGURATION & SYNCHRONIZATION (OPTIONAL)
       ========================================================================== */
    // Paste your Firebase Config here. If left empty, the application will fallback to LocalStorage.
    const FIREBASE_CONFIG = {
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    };

    let db = null;
    let isFirebaseActive = false;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function initFirebase() {
        if (!FIREBASE_CONFIG.apiKey) {
            console.log("Firebase config not found. Falling back to LocalStorage.");
            initLocalOrderTracker();
            return false;
        }
        try {
            await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js");
            
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            isFirebaseActive = true;
            console.log("Firebase Firestore initialized on client side.");
            
            setupClientOrderStatusListener();
            return true;
        } catch (e) {
            console.error("Failed to initialize Firebase on client:", e);
            initLocalOrderTracker();
            return false;
        }
    }

    function initLocalOrderTracker() {
        const lastOrderId = localStorage.getItem('last_order_id');
        if (!lastOrderId) return;
        
        const storedOrders = localStorage.getItem('client_orders');
        if (storedOrders) {
            const orders = JSON.parse(storedOrders);
            const order = orders.find(o => o.id === lastOrderId);
            if (order) {
                updateOrderStatusUI(order.status, order.planName, lastOrderId, order.timestamp);
            }
        }
    }

    function setupClientOrderStatusListener() {
        if (!isFirebaseActive || !db) return;
        const lastOrderId = localStorage.getItem('last_order_id');
        if (!lastOrderId) return;
        
        db.collection('orders').doc(lastOrderId).onSnapshot((doc) => {
            if (doc.exists) {
                const orderData = doc.data();
                updateOrderStatusUI(orderData.status, orderData.planName, lastOrderId, orderData.timestamp);
            } else {
                initLocalOrderTracker();
            }
        }, (error) => {
            console.error("Error listening to order status in Firestore:", error);
            initLocalOrderTracker();
        });
    }

    function updateOrderStatusUI(status, planName, orderId, timestamp) {
        const trackerCapsule = document.getElementById('order-tracker-capsule');
        const trackIdEl = document.getElementById('track-id');
        const trackPlanEl = document.getElementById('track-plan');
        const trackStatusEl = document.getElementById('track-status');
        const trackTimeEl = document.getElementById('track-time');
        
        const stepSubmitted = document.getElementById('step-submitted');
        const stepProcessing = document.getElementById('step-processing');
        const stepProcessingDesc = document.getElementById('step-processing-desc');
        const stepProcessingTitle = stepProcessing ? stepProcessing.querySelector('.step-title') : null;

        if (trackerCapsule) trackerCapsule.classList.remove('hidden');
        if (trackIdEl) trackIdEl.textContent = orderId;
        if (trackPlanEl) trackPlanEl.textContent = planName;
        
        if (trackStatusEl) {
            trackStatusEl.textContent = status;
            trackStatusEl.className = 'tracker-value badge ' + status;
        }
        
        if (trackTimeEl && timestamp) {
            const d = new Date(timestamp);
            trackTimeEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
        }

        if (stepSubmitted) {
            stepSubmitted.className = 'timeline-step completed';
        }
        
        if (stepProcessing) {
            if (status === 'pending') {
                stepProcessing.className = 'timeline-step active';
                if (stepProcessingTitle) stepProcessingTitle.textContent = "Awaiting Verification";
                if (stepProcessingDesc) stepProcessingDesc.textContent = "Payment is under manual review by the admin.";
            } else if (status === 'approved') {
                stepProcessing.className = 'timeline-step completed';
                if (stepProcessingTitle) stepProcessingTitle.textContent = "Approved & Initiated";
                if (stepProcessingDesc) stepProcessingDesc.textContent = "Mohamed approved your order and will contact you via email.";
            } else if (status === 'rejected') {
                stepProcessing.className = 'timeline-step completed';
                if (stepProcessingTitle) stepProcessingTitle.textContent = "Refunded & Cancelled";
                if (stepProcessingDesc) stepProcessingDesc.textContent = "Request cancelled. Payment refunded back to your source wallet/card.";
            }
        }
    }

    // Bind Order Tracker modal events
    const trackerCapsule = document.getElementById('order-tracker-capsule');
    const trackerModal = document.getElementById('tracker-modal');
    const closeTrackerBtn = document.getElementById('close-tracker');

    if (trackerCapsule && trackerModal) {
        trackerCapsule.addEventListener('click', () => {
            trackerModal.classList.add('active');
            if (typeof playTone === 'function') {
                playTone(450, 'sine', 0.15, 0.1);
            }
        });
    }
    if (closeTrackerBtn && trackerModal) {
        closeTrackerBtn.addEventListener('click', () => {
            trackerModal.classList.remove('active');
        });
        trackerModal.addEventListener('click', (e) => {
            if (e.target === trackerModal) {
                trackerModal.classList.remove('active');
            }
        });
    }

    // Initialize Firebase client-side
    initFirebase();

    /* ==========================================================================
       CUSTOM NOTIFICATION MODAL  (replaces browser alert())
       ========================================================================== */
    const notifOverlay = document.getElementById('notif-overlay');
    const notifIconWrap = document.getElementById('notif-icon-wrap');
    const notifTitle   = document.getElementById('notif-title');
    const notifMsg     = document.getElementById('notif-msg');
    const notifOkBtn   = document.getElementById('notif-ok-btn');

    // SVG icons
    const ICONS = {
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>`,
        warn: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
               </svg>`
    };

    // Play error/success sound via Web Audio API
    function playNotifSound(type) {
        try {
            const actx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'success') {
                // Ascending two-tone chime
                [[523, 0], [659, 0.12]].forEach(([freq, delay]) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, actx.currentTime + delay);
                    gain.gain.setValueAtTime(0.18, actx.currentTime + delay);
                    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + delay + 0.35);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(actx.currentTime + delay);
                    osc.stop(actx.currentTime + delay + 0.35);
                });
            } else {
                // Short descending error buzz
                [[320, 0, 'sawtooth'], [200, 0.14, 'sawtooth']].forEach(([freq, delay, wave]) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = wave;
                    osc.frequency.setValueAtTime(freq, actx.currentTime + delay);
                    gain.gain.setValueAtTime(0.12, actx.currentTime + delay);
                    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + delay + 0.22);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(actx.currentTime + delay);
                    osc.stop(actx.currentTime + delay + 0.22);
                });
            }
        } catch (e) { /* silently ignore if audio is blocked */ }
    }

    /**
     * showNotification(message, type)
     * type: 'error' | 'success' | 'warn'  (defaults to 'error')
     */
    function showNotification(message, type = 'error') {
        if (!notifOverlay) { alert(message); return; }

        // Reset
        notifIconWrap.className = 'notif-icon-wrap';
        notifOkBtn.className    = 'notif-ok-btn';
        notifTitle.className    = 'notif-title';

        // Set content based on type
        const labels = { error: 'Error', success: 'Success', warn: 'Warning' };
        notifTitle.textContent  = labels[type] || 'Notice';
        notifMsg.textContent    = message;
        notifIconWrap.innerHTML = ICONS[type] || ICONS.error;
        notifIconWrap.classList.add(type);
        notifTitle.classList.add(type);
        if (type === 'error' || type === 'warn') notifOkBtn.classList.add('error-btn');
        if (type === 'success') notifOkBtn.classList.add('success-btn');

        // Show modal
        notifOverlay.classList.add('active');
        playNotifSound(type);

        // Re-trigger icon animation by removing/re-adding the class
        void notifIconWrap.offsetWidth;
        notifOkBtn.focus();
    }

    // Close on OK button
    if (notifOkBtn) {
        notifOkBtn.addEventListener('click', () => {
            notifOverlay.classList.remove('active');
        });
    }

    // Close on backdrop click
    if (notifOverlay) {
        notifOverlay.addEventListener('click', (e) => {
            if (e.target === notifOverlay) notifOverlay.classList.remove('active');
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && notifOverlay && notifOverlay.classList.contains('active')) {
            notifOverlay.classList.remove('active');
        }
    });

    /* ==========================================================================
       MOBILE HAMBURGER NAVIGATION
       ========================================================================== */
    const navHamburger = document.getElementById('nav-hamburger');
    const siteNav      = document.getElementById('site-nav');

    if (navHamburger && siteNav) {
        // Toggle open/close
        navHamburger.addEventListener('click', () => {
            const isOpen = siteNav.classList.toggle('nav-open');
            navHamburger.classList.toggle('open', isOpen);
            navHamburger.setAttribute('aria-expanded', String(isOpen));
            // Prevent body scroll when nav is open
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Close nav when a link is clicked
        siteNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                siteNav.classList.remove('nav-open');
                navHamburger.classList.remove('open');
                navHamburger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });
    }

    /* ==========================================================================
       CUSTOM CURSOR SETUP
       ========================================================================== */
    const cursorDot = document.getElementById('custom-cursor');
    const cursorRing = document.getElementById('custom-cursor-ring');

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    // Track mouse coordinates
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        if (cursorDot) {
            cursorDot.style.setProperty('--cursor-x', `${mouseX}px`);
            cursorDot.style.setProperty('--cursor-y', `${mouseY}px`);
        }
    });

    // Smoothly animate the outer trailing cursor ring
    function animateRing() {
        // Linear interpolation for smooth trailing
        const delay = 8; // Adjust speed (higher = slower trailing)
        
        if (ringX === -100 && ringY === -100 && mouseX !== -100) {
            ringX = mouseX;
            ringY = mouseY;
        } else {
            ringX += (mouseX - ringX) / delay;
            ringY += (mouseY - ringY) / delay;
        }

        if (cursorRing) {
            cursorRing.style.setProperty('--ring-x', `${ringX}px`);
            cursorRing.style.setProperty('--ring-y', `${ringY}px`);
        }

        requestAnimationFrame(animateRing);
    }
    animateRing();

    // Hover effect classes on clickable elements
    const hoverables = document.querySelectorAll('a, button, .btn-primary, .project-card, .image-frame');
    hoverables.forEach(item => {
        item.addEventListener('mouseenter', () => {
            document.body.classList.add('hovered');
        });
        item.addEventListener('mouseleave', () => {
            document.body.classList.remove('hovered');
            // Reset magnetic offset if any
            if (item.classList.contains('magnetic')) {
                item.style.transform = 'translate3d(0px, 0px, 0px)';
            }
        });
    });

    /* ==========================================================================
       MAGNETIC HOVER EFFECT
       ========================================================================== */
    const magneticElements = document.querySelectorAll('.magnetic');
    
    magneticElements.forEach(elem => {
        elem.addEventListener('mousemove', (e) => {
            const rect = elem.getBoundingClientRect();
            // Calculate center point of the element
            const elemX = rect.left + rect.width / 2;
            const elemY = rect.top + rect.height / 2;

            // Get distance multiplier from custom attribute or default to 15
            const distanceLimit = parseFloat(elem.getAttribute('data-dist')) || 15;

            // Calculate offset distance
            const deltaX = e.clientX - elemX;
            const deltaY = e.clientY - elemY;

            // Apply magnetic translation relative to mouse proximity
            elem.style.transform = `translate3d(${deltaX * 0.3}px, ${deltaY * 0.3}px, 0px)`;
            
            // Adjust inner element spacing if button contains text
            const spanText = elem.querySelector('span');
            if (spanText) {
                spanText.style.transform = `translate3d(${deltaX * 0.1}px, ${deltaY * 0.1}px, 0px)`;
            }
        });

        elem.addEventListener('mouseleave', () => {
            elem.style.transform = 'translate3d(0, 0, 0)';
            const spanText = elem.querySelector('span');
            if (spanText) {
                spanText.style.transform = 'translate3d(0, 0, 0)';
            }
        });
    });

    /* ==========================================================================
       SCROLL REVEAL (INTERSECTION OBSERVER)
       ========================================================================== */
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const rect = entry.boundingClientRect;
            const isExitingTop = !entry.isIntersecting && rect.top < 0;
            
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                entry.target.classList.remove('faded-up');
            } else if (isExitingTop) {
                entry.target.classList.remove('revealed');
                entry.target.classList.add('faded-up');
            } else {
                entry.target.classList.remove('revealed');
                entry.target.classList.remove('faded-up');
            }
        });
    }, {
        threshold: 0.05,
        rootMargin: '0px 0px 0px 0px'
    });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    /* ==========================================================================
       ACTIVE LINK ON SCROLL & SCROLL PROGRESS TRACKING (THROTTLED)
       ========================================================================== */
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollProgress = document.getElementById('scroll-progress');

    let scrollScheduled = false;
    window.addEventListener('scroll', () => {
        if (!scrollScheduled) {
            scrollScheduled = true;
            requestAnimationFrame(() => {
                const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (totalHeight > 0 && scrollProgress) {
                    const progress = (window.scrollY / totalHeight) * 100;
                    scrollProgress.style.width = `${progress}%`;
                }

                let currentSectionId = '';
                sections.forEach(section => {
                    const sectionTop = section.offsetTop;
                    if (window.scrollY >= (sectionTop - 250)) {
                        currentSectionId = section.getAttribute('id');
                    }
                });

                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${currentSectionId}`) {
                        link.classList.add('active');
                    }
                });
                
                scrollScheduled = false;
            });
        }
    });

    /* ==========================================================================
       LOCAL TIME CLOCK WIDGET (LIVE SECONDS)
       ========================================================================== */
    const timeWidget = document.getElementById('time-widget');
    
    function updateClock() {
        const now = new Date();
        const options = {
            timeZone: 'Africa/Cairo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        
        try {
            const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
            timeWidget.textContent = `${timeString} CAIRO`;
        } catch (e) {
            // Fallback to local time if timezone format fails
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            timeWidget.textContent = `${hours}:${minutes}:${seconds} LOCAL`;
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000); // Live update every second

    /* ==========================================================================
       WEB AUDIO SYNTHESIZER & REAL-TIME VISUALIZER
       ========================================================================== */
    let audioCtx = null;
    let analyserNode = null;
    let canvasCtx = null;
    let visualizerCanvas = null;
    let dataArray = null;
    let bufferLength = 0;

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function setupVisualizer() {
        visualizerCanvas = document.getElementById('piano-visualizer');
        if (!visualizerCanvas) return;
        canvasCtx = visualizerCanvas.getContext('2d');
        drawSilence();
    }

    function drawSilence() {
        if (!canvasCtx || !visualizerCanvas) return;
        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        canvasCtx.fillStyle = document.body.classList.contains('light-theme') ? '#f4f4f5' : (document.body.classList.contains('terminal-theme') ? '#020803' : '#050507');
        canvasCtx.fillRect(0, 0, width, height);
        
        canvasCtx.strokeStyle = document.body.classList.contains('terminal-theme') ? 'rgba(51, 255, 51, 0.2)' : (document.body.classList.contains('light-theme') ? 'rgba(170, 124, 17, 0.2)' : 'rgba(212, 175, 55, 0.2)');
        canvasCtx.lineWidth = 1.5;
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
    }

    function startVisualizerLoop() {
        if (!analyserNode || !canvasCtx || !visualizerCanvas) return;
        
        bufferLength = analyserNode.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        
        function draw() {
            if (!analyserNode) return;
            requestAnimationFrame(draw);
            analyserNode.getByteTimeDomainData(dataArray);
            
            canvasCtx.fillStyle = document.body.classList.contains('light-theme') ? '#f4f4f5' : (document.body.classList.contains('terminal-theme') ? '#020803' : '#050507');
            canvasCtx.fillRect(0, 0, width, height);
            
            canvasCtx.lineWidth = 1.5;
            canvasCtx.strokeStyle = document.body.classList.contains('terminal-theme') ? '#33ff33' : (document.body.classList.contains('light-theme') ? '#aa7c11' : '#d4af37');
            
            canvasCtx.beginPath();
            const sliceWidth = width * 1.0 / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;
                
                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
        }
        draw();
    }

    function playTone(freq, type = 'sine', duration = 0.4, volume = 0.12) {
        try {
            const ctx = getAudioContext();
            
            // Connect to visualizer analyser
            if (!analyserNode) {
                analyserNode = ctx.createAnalyser();
                analyserNode.fftSize = 128;
                analyserNode.connect(ctx.destination);
                startVisualizerLoop();
            }
            
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            gainNode.gain.setValueAtTime(volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(analyserNode);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn("Audio Context error: ", e);
        }
    }

    // Note frequency mappings
    const pianoNotes = {
        'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
        'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
        'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88
    };

    const pianoKeys = document.querySelectorAll('.piano-key');
    pianoKeys.forEach(key => {
        key.addEventListener('mousedown', () => {
            const note = key.getAttribute('data-note');
            const freq = pianoNotes[note];
            if (freq) {
                playTone(freq, 'sine', 0.5, 0.15);
                key.classList.add('playing');
                setTimeout(() => key.classList.remove('playing'), 150);
            }
        });
    });

    setupVisualizer();

    /* ==========================================================================
       ARDUINO OBSTACLE SENSOR SIMULATOR
       ========================================================================== */
    const distSlider = document.getElementById('distance-range');
    const distReadout = document.getElementById('sensor-distance');
    const sensorWaves = document.getElementById('sensor-waves');
    const sensorObstacle = document.getElementById('sensor-obstacle');
    const sensorSimulator = document.querySelector('.sensor-simulator');
    
    let sonarTimer = null;

    function triggerSonarPing(distance) {
        if (sonarTimer) clearInterval(sonarTimer);

        if (distance >= 50) {
            if (sensorSimulator) sensorSimulator.classList.remove('alert-active');
            if (sensorWaves) sensorWaves.classList.remove('warning');
            return;
        }

        if (sensorSimulator) sensorSimulator.classList.add('alert-active');
        if (sensorWaves) sensorWaves.classList.add('warning');

        const pingInterval = 180 + ((distance - 10) / 40) * 620;

        sonarTimer = setInterval(() => {
            playTone(880, 'sine', 0.06, 0.08);
        }, pingInterval);
    }

    if (distSlider) {
        distSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (distReadout) distReadout.textContent = val;
            
            const bottomPercent = 30 + ((val - 10) / 190) * 120;
            if (sensorObstacle) sensorObstacle.style.bottom = `${bottomPercent}px`;
            
            triggerSonarPing(val);
        });

        const val = parseInt(distSlider.value);
        const bottomPercent = 30 + ((val - 10) / 190) * 120;
        if (sensorObstacle) sensorObstacle.style.bottom = `${bottomPercent}px`;
        
        const projectCard = distSlider.closest('.project-card');
        if (projectCard) {
            projectCard.addEventListener('mouseleave', () => {
                if (sonarTimer) {
                    clearInterval(sonarTimer);
                    sonarTimer = null;
                }
                if (sensorWaves) sensorWaves.classList.remove('warning');
                if (sensorSimulator) sensorSimulator.classList.remove('alert-active');
            });
            projectCard.addEventListener('mouseenter', () => {
                triggerSonarPing(parseInt(distSlider.value));
            });
        }
    }

    /* ==========================================================================
       CLOWDY TERMINAL COMMAND SIMULATOR
       ========================================================================== */
    const terminalOutput = document.getElementById('terminal-output');
    const terminalInput = document.getElementById('terminal-input');
    const terminalButtons = document.querySelectorAll('.term-btn');

    const commands = {
        'help': 'Available commands: system, about, pc_status, clear',
        'system': 'CLOWDY OS v1.4.2\nPlatform: Windows Desktop\nLLM Backend: Gemini Flash\nInterface: Audio/Screen Integration',
        'about': 'Subject: Mohamed Abdelhamid\nRole: Computer Engineer & Designer\nFocus: Merging technical logic with visual layouts.',
        'pc_status': 'CHECKING SYSTEM PROTECTION...\n-> Proactive Sandbox: ACTIVE\n-> Credentials Encrypted: YES\n-> PC Vulnerabilities detected: 0\n-> Status: SECURED',
        'clear': ''
    };

    function executeCommand(cmdText) {
        if (!terminalOutput) return;
        const normalizedCmd = cmdText.trim().toLowerCase();
        
        // Print user input line
        const userLine = document.createElement('div');
        userLine.className = 'terminal-line user';
        userLine.textContent = `guest@clowdy:~$ ${cmdText}`;
        terminalOutput.appendChild(userLine);

        // Process response
        const responseLine = document.createElement('div');
        responseLine.className = 'terminal-line system';
        
        if (normalizedCmd === 'clear') {
            terminalOutput.innerHTML = '';
            return;
        }

        if (normalizedCmd in commands) {
            responseLine.textContent = commands[normalizedCmd];
        } else if (normalizedCmd !== '') {
            responseLine.textContent = `Command not found: '${cmdText}'. Type 'help' for options.`;
        } else {
            return;
        }

        terminalOutput.appendChild(responseLine);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        
        // play subtle typewriter key sound
        playTone(600, 'triangle', 0.05, 0.04);
    }

    if (terminalInput) {
        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalInput.value;
                executeCommand(cmd);
                terminalInput.value = '';
            }
        });
    }

    terminalButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.getAttribute('data-cmd');
            executeCommand(cmd);
        });
    });

    /* ==========================================================================
       FLOATING DESIGNER THEME PANEL
       ========================================================================== */
    const themePanel = document.getElementById('theme-panel');
    const panelToggle = document.getElementById('theme-panel-toggle');
    const themeOpts = document.querySelectorAll('.theme-opt');

    if (panelToggle && themePanel) {
        panelToggle.addEventListener('click', () => {
            themePanel.classList.toggle('active');
            playTone(440, 'sine', 0.1, 0.05);
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!themePanel.contains(e.target)) {
                themePanel.classList.remove('active');
            }
        });
    }

    themeOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            const theme = opt.getAttribute('data-theme');
            
            // Update active button classes
            themeOpts.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            // Apply theme on body
            document.body.classList.remove('light-theme', 'terminal-theme');
            if (theme === 'light') {
                document.body.classList.add('light-theme');
            } else if (theme === 'terminal') {
                document.body.classList.add('terminal-theme');
            }

            // Redraw visualizer silent state when theme changes background colors
            drawSilence();
            playTone(523.25, 'sine', 0.2, 0.08); // Chord C5 click sound
        });
    });

    /* ==========================================================================
       INTERACTIVE BOOTLOADER / LOADING SCREEN
       ========================================================================== */
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderProgressBar = document.getElementById('loader-progress-bar');
    const loaderPercentage = document.getElementById('loader-percentage');
    const loaderTerminal = document.getElementById('loader-terminal');
    const loaderStatus = document.getElementById('loader-status');
    const boostBtn = document.getElementById('boost-boot-btn');
    const skipBtn = document.getElementById('skip-boot-btn');

    let loaderProgress = 0;
    let bootCompleted = false;

    const bootLogs = [
        "Initializing CPU registers...",
        "Validating system interrupt tables...",
        "Checking physical RAM address space...",
        "Mapping electronic structures...",
        "Deserializing Clowdy AI Core model...",
        "Binding speech synthesis pathways...",
        "Mounting web visualizer modules...",
        "Compiling custom grid shaders...",
        "Booting interactive portfolio interface...",
        "All systems stable. Launching."
    ];

    let lastPrintedLogIdx = -1;

    function addLoaderLog(line) {
        if (!loaderTerminal) return;
        const div = document.createElement('div');
        div.className = 'loader-term-line';
        div.textContent = `> ${line}`;
        loaderTerminal.appendChild(div);
        loaderTerminal.scrollTop = loaderTerminal.scrollHeight;
        
        // play subtle click sound
        playTone(750, 'triangle', 0.04, 0.05);
    }

    function playBootChime() {
        // Play an ascending major arpeggio chord (C4 -> E4 -> G4 -> C5)
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                playTone(freq, 'sine', 0.8, 0.12);
            }, idx * 120);
        });
    }

    function completeBoot() {
        if (bootCompleted) return;
        bootCompleted = true;
        
        if (loaderStatus) loaderStatus.textContent = "BOOT_SUCCESSFUL";
        if (loaderOverlay) loaderOverlay.classList.add('loaded');
        
        document.body.classList.add('boot-completed');
        
        playBootChime();
        
        // Ensure scroll works after loading overlay exits
        document.body.style.overflowY = 'auto';
    }

    function stepProgress() {
        if (bootCompleted) return;
        
        // Random incremental step or manual boost updates
        const increment = Math.floor(Math.random() * 8) + 2;
        updateProgress(loaderProgress + increment);

        if (loaderProgress < 100) {
            // Speed up speed as it gets closer
            const delay = 100 + (Math.random() * 250);
            setTimeout(stepProgress, delay);
        }
    }

    function updateProgress(value) {
        if (bootCompleted) return;
        
        loaderProgress = Math.min(value, 100);
        if (loaderProgressBar) loaderProgressBar.style.width = `${loaderProgress}%`;
        if (loaderPercentage) loaderPercentage.textContent = `${loaderProgress}%`;

        // Calculate how many logs we should print based on progress
        const targetLogIdx = Math.floor((loaderProgress / 100) * bootLogs.length);
        for (let i = lastPrintedLogIdx + 1; i < targetLogIdx; i++) {
            if (bootLogs[i]) {
                addLoaderLog(bootLogs[i]);
            }
            lastPrintedLogIdx = i;
        }

        if (loaderProgress >= 100) {
            completeBoot();
        }
    }

    // Hide scrollbar during load
    document.body.style.overflowY = 'hidden';

    // Start auto loading sequence
    setTimeout(stepProgress, 500);

    if (boostBtn) {
        boostBtn.addEventListener('click', () => {
            if (bootCompleted) return;
            // Manual speed up clicking boost
            updateProgress(loaderProgress + 15);
            playTone(880, 'sine', 0.05, 0.1);
        });
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            updateProgress(100);
        });
    }

    /* ==========================================================================
       LOGIC GATE SIMULATOR SANDBOX
       ========================================================================== */
    const gateSelect = document.getElementById('gate-type');
    const inputABtn = document.getElementById('input-a');
    const inputBBtn = document.getElementById('input-b');
    const gateOutput = document.getElementById('gate-output');
    const gateSymbolText = document.getElementById('gate-symbol-text');
    
    const lineA = document.getElementById('line-a');
    const lineB = document.getElementById('line-b');
    const lineOut = document.getElementById('line-out');
    
    const nodeA = document.getElementById('node-a');
    const nodeB = document.getElementById('node-b');
    const nodeOut = document.getElementById('node-out');

    let inputAVal = 0;
    let inputBVal = 0;

    function recalculateLogic() {
        if (!gateSelect || !gateOutput) return;
        const gate = gateSelect.value;
        let outputVal = 0;

        // Perform logic calculations
        switch (gate) {
            case 'AND':
                outputVal = (inputAVal === 1 && inputBVal === 1) ? 1 : 0;
                break;
            case 'OR':
                outputVal = (inputAVal === 1 || inputBVal === 1) ? 1 : 0;
                break;
            case 'XOR':
                outputVal = (inputAVal !== inputBVal) ? 1 : 0;
                break;
            case 'NAND':
                outputVal = !(inputAVal === 1 && inputBVal === 1) ? 1 : 0;
                break;
        }

        // Update output text
        gateOutput.textContent = outputVal;

        // Update active class indicators
        if (outputVal === 1) {
            gateOutput.classList.add('active');
            if (lineOut) lineOut.setAttribute('stroke', '#d4af37'); // Gold active line
            if (nodeOut) nodeOut.setAttribute('fill', '#d4af37');
        } else {
            gateOutput.classList.remove('active');
            if (lineOut) lineOut.setAttribute('stroke', '#52525b'); // Gray line
            if (nodeOut) nodeOut.setAttribute('fill', '#52525b');
        }

        // Update input lines active coloring
        if (lineA) lineA.setAttribute('stroke', inputAVal === 1 ? '#d4af37' : '#52525b');
        if (nodeA) nodeA.setAttribute('fill', inputAVal === 1 ? '#d4af37' : '#52525b');
        
        if (lineB) lineB.setAttribute('stroke', inputBVal === 1 ? '#d4af37' : '#52525b');
        if (nodeB) nodeB.setAttribute('fill', inputBVal === 1 ? '#d4af37' : '#52525b');
    }

    if (inputABtn) {
        inputABtn.addEventListener('click', () => {
            inputAVal = inputAVal === 0 ? 1 : 0;
            inputABtn.setAttribute('data-state', inputAVal);
            inputABtn.querySelector('span').textContent = inputAVal;
            inputABtn.classList.toggle('active', inputAVal === 1);
            
            playTone(400, 'triangle', 0.08, 0.08);
            recalculateLogic();
        });
    }

    if (inputBBtn) {
        inputBBtn.addEventListener('click', () => {
            inputBVal = inputBVal === 0 ? 1 : 0;
            inputBBtn.setAttribute('data-state', inputBVal);
            inputBBtn.querySelector('span').textContent = inputBVal;
            inputBBtn.classList.toggle('active', inputBVal === 1);
            
            playTone(400, 'triangle', 0.08, 0.08);
            recalculateLogic();
        });
    }

    if (gateSelect) {
        gateSelect.addEventListener('change', () => {
            if (gateSymbolText) gateSymbolText.textContent = gateSelect.value;
            playTone(450, 'triangle', 0.08, 0.08);
            recalculateLogic();
        });
    }

    // Run first calculation
    recalculateLogic();

    /* ==========================================================================
       8-STEP AUDIO SEQUENCER SANDBOX
       ========================================================================== */
    const seqGrid = document.getElementById('sequencer-grid');
    const seqPlayBtn = document.getElementById('seq-play-btn');
    const seqBpmSlider = document.getElementById('seq-bpm');
    const seqBpmVal = document.getElementById('seq-bpm-val');

    let seqIsPlaying = false;
    let seqInterval = null;
    let seqStep = 0;
    let seqBpm = 120;
    
    // Grid size: 4 rows (Synth, Hat, Snare, Kick), 8 steps
    const numRows = 4;
    const numCols = 8;
    const seqState = Array(numRows).fill().map(() => Array(numCols).fill(false));

    // Dynamic grid generation
    if (seqGrid) {
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                const pad = document.createElement('button');
                pad.className = 'seq-pad';
                pad.setAttribute('data-row', row);
                pad.setAttribute('data-col', col);
                
                // Add click listener
                pad.addEventListener('click', () => {
                    const r = parseInt(pad.getAttribute('data-row'));
                    const c = parseInt(pad.getAttribute('data-col'));
                    seqState[r][c] = !seqState[r][c];
                    pad.classList.toggle('active', seqState[r][c]);
                    
                    // Preview trigger sound on select
                    if (seqState[r][c]) {
                        playSeqInstrument(r);
                    } else {
                        playTone(300, 'triangle', 0.05, 0.04);
                    }
                });
                seqGrid.appendChild(pad);
            }
        }
    }

    function playSeqInstrument(row) {
        switch (row) {
            case 0: // Synth Tone
                playTone(329.63, 'sine', 0.2, 0.1); // E4 Note
                break;
            case 1: // Hi-Hat
                playTone(9000, 'triangle', 0.03, 0.06); 
                break;
            case 2: // Snare
                playSnareTone();
                break;
            case 3: // Kick
                playKickTone();
                break;
        }
    }

    function playKickTone() {
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            if (analyserNode) {
                osc.connect(gain);
                gain.connect(analyserNode);
            } else {
                osc.connect(gain);
                gain.connect(ctx.destination);
            }
            
            osc.frequency.setValueAtTime(140, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
            
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch(e){}
    }

    function playSnareTone() {
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            if (analyserNode) {
                osc.connect(gain);
                gain.connect(analyserNode);
            } else {
                osc.connect(gain);
                gain.connect(ctx.destination);
            }
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(240, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.08);
            
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch(e){}
    }

    function runSequencerStep() {
        if (!seqIsPlaying) return;

        // Clear playing highlights from pads
        const pads = document.querySelectorAll('.seq-pad');
        pads.forEach(p => p.classList.remove('playing'));

        // Highlight current active step column
        const columnPads = document.querySelectorAll(`.seq-pad[data-col="${seqStep}"]`);
        columnPads.forEach(p => {
            p.classList.add('playing');
            const r = parseInt(p.getAttribute('data-row'));
            if (seqState[r][seqStep]) {
                playSeqInstrument(r);
            }
        });

        // Step to next column index
        seqStep = (seqStep + 1) % 8;

        // Set next step timeout
        const stepTimeMs = (30 / seqBpm) * 1000; // Half-beat (8th notes) length
        seqInterval = setTimeout(runSequencerStep, stepTimeMs);
    }

    if (seqPlayBtn) {
        seqPlayBtn.addEventListener('click', () => {
            seqIsPlaying = !seqIsPlaying;
            seqPlayBtn.textContent = seqIsPlaying ? 'Stop' : 'Play';
            seqPlayBtn.classList.toggle('active', seqIsPlaying);

            if (seqIsPlaying) {
                seqStep = 0;
                runSequencerStep();
            } else {
                if (seqInterval) clearTimeout(seqInterval);
                const pads = document.querySelectorAll('.seq-pad');
                pads.forEach(p => p.classList.remove('playing'));
            }
        });
    }

    if (seqBpmSlider) {
        seqBpmSlider.addEventListener('input', (e) => {
            seqBpm = parseInt(e.target.value);
            if (seqBpmVal) seqBpmVal.textContent = seqBpm;
        });
    }

    /* ==========================================================================
       CHECKOUT FLOW CONTROLLER
       ========================================================================== */
    const checkoutModal = document.getElementById('checkout-modal');
    const closeCheckoutBtn = document.getElementById('close-checkout');
    
    const checkoutPlanBadge = document.getElementById('checkout-plan-badge');
    const checkoutPlanNameInput = document.getElementById('checkout-plan-name');
    const checkoutPlanPriceInput = document.getElementById('checkout-plan-price');
    const checkoutPriceTxt = document.getElementById('checkout-price-txt');
    
    const checkoutForm = document.getElementById('checkout-form');
    const paymentMethodBtns = document.querySelectorAll('.pay-method-btn');
    
    const paypalFields = document.getElementById('paypal-fields');
    const instapayFields = document.getElementById('instapay-fields');
    const vodafoneFields = document.getElementById('vodafone-fields');
    const kashierFields = document.getElementById('kashier-fields');
    
    const receiptFileInput = document.getElementById('instapay-receipt');
    const fileUploadText = document.getElementById('file-upload-text');
    const vodafoneFileInput = document.getElementById('vodafone-receipt');
    const vodafoneFileUploadText = document.getElementById('vodafone-file-upload-text');

    let currentPaymentMethod = 'Kashier';
    let selectedFileBase64 = '';
    let selectedVodafoneFileBase64 = '';

    // Bind pricing buttons to open modal
    document.querySelectorAll('.select-plan-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const plan = btn.getAttribute('data-plan');
            const price = btn.getAttribute('data-price');

            if (checkoutPlanBadge) checkoutPlanBadge.textContent = plan;
            if (checkoutPlanNameInput) checkoutPlanNameInput.value = plan;
            if (checkoutPlanPriceInput) checkoutPlanPriceInput.value = price;
            if (checkoutPriceTxt) checkoutPriceTxt.textContent = `${parseInt(price).toLocaleString()} EGP`;

            // Reset modal inputs & show
            if (checkoutForm) checkoutForm.reset();
            selectedFileBase64 = '';
            selectedVodafoneFileBase64 = '';
            if (fileUploadText) fileUploadText.textContent = "Upload Receipt Screenshot";
            if (vodafoneFileUploadText) vodafoneFileUploadText.textContent = "Upload Transfer Screenshot";
            
            setPaymentMethod('Kashier');
            if (checkoutModal) checkoutModal.classList.add('active');
            playTone(600, 'sine', 0.1, 0.08);
        });
    });

    // Plans Category Tab Toggling
    const plansTabBtns = document.querySelectorAll('.plans-tab-btn');
    const planCards = document.querySelectorAll('.plan-card');

    plansTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const category = btn.getAttribute('data-category');

            // Set active class on buttons
            plansTabBtns.forEach(b => b.classList.toggle('active', b === btn));

            // Hide/Show plan cards with reflow for animations
            planCards.forEach(card => {
                if (card.getAttribute('data-category') === category) {
                    card.classList.remove('hidden');
                    // Reset animation
                    card.style.animation = 'none';
                    card.offsetHeight; // force reflow
                    card.style.animation = '';
                } else {
                    card.classList.add('hidden');
                }
            });

            playTone(550, 'triangle', 0.05, 0.08);
        });
    });

    if (closeCheckoutBtn && checkoutModal) {
        closeCheckoutBtn.addEventListener('click', () => {
            checkoutModal.classList.remove('active');
        });
        
        // Click outside modal to close
        checkoutModal.addEventListener('click', (e) => {
            if (e.target === checkoutModal) {
                checkoutModal.classList.remove('active');
            }
        });
    }

    // Toggle Payment Methods
    paymentMethodBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const method = btn.getAttribute('data-method');
            setPaymentMethod(method);
            playTone(450, 'triangle', 0.05, 0.08);
        });
    });

    function setPaymentMethod(method) {
        currentPaymentMethod = method;
        paymentMethodBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-method') === method);
        });

        // Hide all fields first
        if (paypalFields) paypalFields.classList.add('hidden');
        if (instapayFields) instapayFields.classList.add('hidden');
        if (vodafoneFields) vodafoneFields.classList.add('hidden');
        if (kashierFields) kashierFields.classList.add('hidden');

        // Toggle required validation fields and standard submit button
        const ipaEl = document.getElementById('instapay-ipa');
        const vCashNumEl = document.getElementById('vodafone-number');
        const submitBtn = checkoutForm ? checkoutForm.querySelector('.checkout-submit-btn') : null;

        if (method === 'Kashier') {
            if (kashierFields) kashierFields.classList.remove('hidden');
            if (ipaEl) ipaEl.required = false;
            if (vCashNumEl) vCashNumEl.required = false;
            if (submitBtn) {
                submitBtn.style.display = 'flex';
                submitBtn.querySelector('span').textContent = 'Proceed to Card Payment';
            }
        } else if (method === 'PayPal') {
            if (paypalFields) paypalFields.classList.remove('hidden');
            if (ipaEl) ipaEl.required = false;
            if (vCashNumEl) vCashNumEl.required = false;
            if (submitBtn) submitBtn.style.display = 'none'; // PayPal buttons handle checkout
            renderPayPalButtons();
        } else if (method === 'InstaPay') {
            if (instapayFields) instapayFields.classList.remove('hidden');
            if (ipaEl) ipaEl.required = true;
            if (vCashNumEl) vCashNumEl.required = false;
            if (submitBtn) {
                submitBtn.style.display = 'flex';
                submitBtn.querySelector('span').textContent = 'Submit Order';
            }
        } else if (method === 'VodafoneCash') {
            if (vodafoneFields) vodafoneFields.classList.remove('hidden');
            if (ipaEl) ipaEl.required = false;
            if (vCashNumEl) vCashNumEl.required = true;
            if (submitBtn) {
                submitBtn.style.display = 'flex';
                submitBtn.querySelector('span').textContent = 'Submit Order';
            }
        }
    }

    // Convert uploaded receipt images to Base64
    if (receiptFileInput) {
        receiptFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (fileUploadText) fileUploadText.textContent = file.name;
                const reader = new FileReader();
                reader.onload = function(evt) {
                    selectedFileBase64 = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (vodafoneFileInput) {
        vodafoneFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (vodafoneFileUploadText) vodafoneFileUploadText.textContent = file.name;
                const reader = new FileReader();
                reader.onload = function(evt) {
                    selectedVodafoneFileBase64 = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    /* ==========================================================================
       PAYPAL BUTTONS INTEGRATION (Client-side Smart Buttons)
       ========================================================================== */
    function renderPayPalButtons() {
        const container = document.getElementById('paypal-button-container');
        if (!container) return;
        container.innerHTML = ''; // Clear any existing buttons

        const planName = checkoutPlanNameInput ? checkoutPlanNameInput.value : 'Service Plan';
        const price = checkoutPlanPriceInput ? parseInt(checkoutPlanPriceInput.value) : 0;
        
        // PayPal does not support EGP. Convert to USD (assume 1 USD = 50 EGP)
        const usdAmount = (price / 50).toFixed(2);

        if (typeof paypal === 'undefined') {
            container.innerHTML = '<p style="color:var(--red);font-size:0.82rem;text-align:center;">PayPal integration is loading. Please reload if it persists.</p>';
            return;
        }

        paypal.Buttons({
            style: {
                layout: 'vertical',
                color:  'gold',
                shape:  'rect',
                label:  'paypal'
            },
            createOrder: function(data, actions) {
                // Validate form details first
                const clientName = document.getElementById('client-name').value.trim();
                const clientEmail = document.getElementById('client-email').value.trim();
                const clientBrief = document.getElementById('client-brief').value.trim();

                if (!clientName || !clientEmail || !clientBrief) {
                    showNotification('Please fill out your Name, Email, and Project Brief before starting the payment.', 'warn');
                    throw new Error('Form validation failed');
                }

                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            currency_code: 'USD',
                            value: usdAmount
                        },
                        description: `${planName} — Portfolio Client Order`
                    }]
                });
            },
            onApprove: function(data, actions) {
                return actions.order.capture().then(function(details) {
                    const clientName = document.getElementById('client-name').value.trim();
                    const clientEmail = document.getElementById('client-email').value.trim();
                    const clientBrief = document.getElementById('client-brief').value.trim();

                    const order = {
                        id:            'ord_' + Date.now(),
                        name:          clientName,
                        email:         clientEmail,
                        plan:          planName,
                        price:         price + ' EGP',
                        paymentMethod: 'PayPal',
                        paypalOrderId: data.orderID || details.id || '',
                        brief:         clientBrief,
                        receipt:       null,
                        status:        'pending',
                        submittedAt:   new Date().toISOString()
                    };

                    saveNewOrder(order);

                    playTone(523.25, 'sine', 0.15, 0.1);
                    setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 100);
                    setTimeout(() => playTone(783.99, 'sine', 0.3,  0.1), 200);

                    if (checkoutModal) checkoutModal.classList.remove('active');
                    if (checkoutForm) checkoutForm.reset();

                    showNotification('Payment successful! Your order has been registered and is under review.', 'success');
                });
            },
            onError: function(err) {
                console.error('PayPal Smart Buttons Checkout Error:', err);
                showNotification('A PayPal checkout error occurred. Please try InstaPay, Vodafone Cash, or contact us.', 'error');
            }
        }).render('#paypal-button-container');
    }

    // Save order to localStorage (and optionally Firestore)
    function saveNewOrder(order) {
        let localOrders = [];
        try { localOrders = JSON.parse(localStorage.getItem('client_orders') || '[]'); } catch {}
        localOrders.push(order);
        localStorage.setItem('client_orders', JSON.stringify(localOrders));
        localStorage.setItem('last_order_id', order.id);

        if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && typeof db !== 'undefined' && db) {
            try {
                const { id, ...orderData } = order;
                db.collection('orders').doc(id).set(orderData)
                    .then(() => { if (typeof setupClientOrderStatusListener === 'function') setupClientOrderStatusListener(); })
                    .catch(() => { if (typeof initLocalOrderTracker === 'function') initLocalOrderTracker(); });
            } catch { if (typeof initLocalOrderTracker === 'function') initLocalOrderTracker(); }
        } else {
            if (typeof initLocalOrderTracker === 'function') initLocalOrderTracker();
        }
    }

    /* ==========================================================================
       CHECKOUT FORM — SUBMIT HANDLER (For Manual Flows: InstaPay / Vodafone Cash)
    ========================================================================== */
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const planName   = checkoutPlanNameInput.value;
            const price      = parseInt(checkoutPlanPriceInput.value);
            const clientName  = document.getElementById('client-name').value.trim();
            const clientEmail = document.getElementById('client-email').value.trim();
            const clientBrief = document.getElementById('client-brief').value.trim();

            // ── KASHIER CARD FLOW ──
            if (currentPaymentMethod === 'Kashier') {
                showNotification('Direct credit/debit card payment is temporarily undergoing system integration and security clearance. It will be fully operational as soon as possible. Please place your order using InstaPay or Vodafone Cash in the meantime.', 'warn');
                return;
            }

            // ── INSTAPAY FLOW ──
            if (currentPaymentMethod === 'InstaPay') {
                if (!selectedFileBase64) {
                    showNotification('Please upload your InstaPay payment screenshot.', 'warn');
                    return;
                }
                const ipaAddress = document.getElementById('instapay-ipa').value.trim();
                const order = {
                    id:            'ord_' + Date.now(),
                    name:          clientName,
                    email:         clientEmail,
                    plan:          planName,
                    price:         price + ' EGP',
                    paymentMethod: 'instapay',
                    ipaAddress,
                    brief:         clientBrief,
                    receipt:       selectedFileBase64,
                    status:        'pending',
                    submittedAt:   new Date().toISOString()
                };
                saveNewOrder(order);

                playTone(523.25, 'sine', 0.15, 0.1);
                setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 100);
                setTimeout(() => playTone(783.99, 'sine', 0.3,  0.1), 200);

                if (checkoutModal) checkoutModal.classList.remove('active');
                checkoutForm.reset();
                return;
            }

            // ── VODAFONE CASH FLOW ──
            if (currentPaymentMethod === 'VodafoneCash') {
                if (!selectedVodafoneFileBase64) {
                    showNotification('Please upload your Vodafone Cash transfer screenshot.', 'warn');
                    return;
                }
                const walletNumber = document.getElementById('vodafone-number').value.trim();
                const order = {
                    id:            'ord_' + Date.now(),
                    name:          clientName,
                    email:         clientEmail,
                    plan:          planName,
                    price:         price + ' EGP',
                    paymentMethod: 'Vodafone Cash',
                    walletNumber,
                    brief:         clientBrief,
                    receipt:       selectedVodafoneFileBase64,
                    status:        'pending',
                    submittedAt:   new Date().toISOString()
                };
                saveNewOrder(order);

                playTone(523.25, 'sine', 0.15, 0.1);
                setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 100);
                setTimeout(() => playTone(783.99, 'sine', 0.3,  0.1), 200);

                if (checkoutModal) checkoutModal.classList.remove('active');
                checkoutForm.reset();
                return;
            }
        });
    }

    /* ==========================================================================
       CINEMATIC VIEW MODE & AMBIENT AUDIO SYNTHESIZER
       ========================================================================== */
    const cinematicToggle = document.getElementById('cinematic-toggle');
    const cinematicExit = document.getElementById('cinematic-exit-btn');
    const cinematicPlay = document.getElementById('cinematic-play-btn');
    const cinematicAudio = document.getElementById('cinematic-audio-btn');
    
    let cinematicActive = false;
    let autoScrollActive = false;
    let ambientAudioActive = false;
    
    let autoScrollTimer = null;
    const scrollSpeed = 0.6; // buttery slow speed in pixels per frame
    
    let ambientTimer = null;
    let ambientOscillators = [];
    let ambientGainNodes = [];
    let currentChordIndex = 0;
    
    const ambientChords = [
        [130.81, 196.00, 261.63, 329.63, 493.88, 587.33], // Cmaj9
        [87.31, 174.61, 261.63, 349.23, 440.00, 523.25],  // Fmaj9
        [110.00, 220.00, 329.63, 392.00, 493.88, 587.33], // Am9
        [98.00, 196.00, 293.66, 392.00, 440.00, 587.33]   // G6/11
    ];

    function toggleCinematicMode() {
        cinematicActive = !cinematicActive;
        document.body.classList.toggle('cinematic-active', cinematicActive);
        
        if (cinematicActive) {
            playTone(110.00, 'triangle', 1.5, 0.1); // Play deep atmospheric entry tone
            setTimeout(() => playTone(220.00, 'sine', 1.8, 0.08), 200);
            
            autoScrollActive = true;
            updateAutoScrollUI();
            runAutoScroll();
            
            ambientAudioActive = true;
            updateAudioUI();
            startAmbientSynthesizer();
        } else {
            stopCinematicServices();
        }
    }

    function stopCinematicServices() {
        cinematicActive = false;
        document.body.classList.remove('cinematic-active');
        
        autoScrollActive = false;
        updateAutoScrollUI();
        if (autoScrollTimer) cancelAnimationFrame(autoScrollTimer);
        
        ambientAudioActive = false;
        updateAudioUI();
        stopAmbientSynthesizer();
        
        playTone(392.00, 'sine', 0.4, 0.08); // Exit chime
        setTimeout(() => playTone(261.63, 'sine', 0.5, 0.1), 100);
    }

    function runAutoScroll() {
        if (!autoScrollActive || !cinematicActive) return;
        window.scrollBy(0, scrollSpeed);
        
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= totalHeight - 2) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            autoScrollActive = false;
            updateAutoScrollUI();
            
            setTimeout(() => {
                if (cinematicActive) {
                    autoScrollActive = true;
                    updateAutoScrollUI();
                    runAutoScroll();
                }
            }, 3000);
            return;
        }
        
        autoScrollTimer = requestAnimationFrame(runAutoScroll);
    }

    function updateAutoScrollUI() {
        if (!cinematicPlay) return;
        const playIcon = cinematicPlay.querySelector('.play-icon');
        const pauseIcon = cinematicPlay.querySelector('.pause-icon');
        
        cinematicPlay.classList.toggle('active', autoScrollActive);
        if (autoScrollActive) {
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
        } else {
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        }
    }

    function updateAudioUI() {
        if (!cinematicAudio) return;
        const muteIcon = cinematicAudio.querySelector('.mute-icon');
        const soundIcon = cinematicAudio.querySelector('.sound-icon');
        
        cinematicAudio.classList.toggle('active', ambientAudioActive);
        if (ambientAudioActive) {
            if (muteIcon) muteIcon.classList.add('hidden');
            if (soundIcon) soundIcon.classList.remove('hidden');
        } else {
            if (muteIcon) muteIcon.classList.remove('hidden');
            if (soundIcon) soundIcon.classList.add('hidden');
        }
    }

    function startAmbientSynthesizer() {
        if (ambientTimer) clearInterval(ambientTimer);
        triggerAmbientChord();
        
        ambientTimer = setInterval(() => {
            if (!ambientAudioActive) return;
            triggerAmbientChord();
        }, 6000);
    }

    function stopAmbientSynthesizer() {
        if (ambientTimer) {
            clearInterval(ambientTimer);
            ambientTimer = null;
        }
        
        const ctx = getAudioContext();
        const fadeTime = 0.5;
        
        ambientGainNodes.forEach(gainNode => {
            try {
                gainNode.gain.cancelScheduledValues(ctx.currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + fadeTime);
            } catch (e) {}
        });
        
        setTimeout(() => {
            ambientOscillators.forEach(osc => { try { osc.stop(); } catch(e){} });
            ambientOscillators = [];
            ambientGainNodes = [];
        }, fadeTime * 1000 + 50);
    }

    function triggerAmbientChord() {
        try {
            const ctx = getAudioContext();
            const now = ctx.currentTime;
            
            const masterFilter = ctx.createBiquadFilter();
            masterFilter.type = 'lowpass';
            masterFilter.frequency.setValueAtTime(320, now);
            masterFilter.Q.setValueAtTime(2.5, now);
            
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.setValueAtTime(0.12, now);
            lfoGain.gain.setValueAtTime(140, now);
            
            lfo.connect(lfoGain);
            lfoGain.connect(masterFilter.frequency);
            lfo.start(now);
            ambientOscillators.push(lfo);
            
            if (analyserNode) {
                masterFilter.connect(analyserNode);
            } else {
                masterFilter.connect(ctx.destination);
            }

            const chordFreqs = ambientChords[currentChordIndex];
            currentChordIndex = (currentChordIndex + 1) % ambientChords.length;

            chordFreqs.forEach((freq) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.05, now + 2.0);
                gain.gain.setValueAtTime(0.05, now + 3.5);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 6.0);
                
                osc.connect(gain);
                gain.connect(masterFilter);
                
                osc.start(now);
                osc.stop(now + 6.0);
                
                ambientOscillators.push(osc);
                ambientGainNodes.push(gain);
            });
        } catch (e) {
            console.warn("Ambient synthesizer failed to run: ", e);
        }
    }

    if (cinematicToggle) {
        cinematicToggle.addEventListener('click', toggleCinematicMode);
    }
    
    if (cinematicExit) {
        cinematicExit.addEventListener('click', stopCinematicServices);
    }

    if (cinematicPlay) {
        cinematicPlay.addEventListener('click', () => {
            autoScrollActive = !autoScrollActive;
            updateAutoScrollUI();
            playTone(450, 'sine', 0.1, 0.05);
            if (autoScrollActive) runAutoScroll();
        });
    }

    if (cinematicAudio) {
        cinematicAudio.addEventListener('click', () => {
            ambientAudioActive = !ambientAudioActive;
            updateAudioUI();
            playTone(450, 'sine', 0.1, 0.05);
            if (ambientAudioActive) {
                startAmbientSynthesizer();
            } else {
                stopAmbientSynthesizer();
            }
        });
    }

    /* ==========================================================================
       DYNAMIC AMBIENT PARTICLES/ORBS BACKGROUND CANVAS
       ========================================================================== */
    const ambientCanvas = document.getElementById('ambient-canvas');
    if (ambientCanvas) {
        const ctx = ambientCanvas.getContext('2d');
        let width = ambientCanvas.width = window.innerWidth;
        let height = ambientCanvas.height = window.innerHeight;
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                width = ambientCanvas.width = window.innerWidth;
                height = ambientCanvas.height = window.innerHeight;
            }, 200);
        });

        const orbs = [];
        const numOrbs = 5;
        
        for (let i = 0; i < numOrbs; i++) {
            orbs.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                radius: Math.random() * 200 + 150
            });
        }

        function drawAmbientBackground() {
            ctx.clearRect(0, 0, width, height);
            
            let colorStr = 'rgba(212, 175, 55, 0.04)'; 
            if (document.body.classList.contains('light-theme')) {
                colorStr = 'rgba(170, 124, 17, 0.03)'; 
            } else if (document.body.classList.contains('terminal-theme')) {
                colorStr = 'rgba(51, 255, 51, 0.03)'; 
            }

            orbs.forEach(orb => {
                orb.x += orb.vx;
                orb.y += orb.vy;

                if (orb.x < -orb.radius) orb.x = width + orb.radius;
                if (orb.x > width + orb.radius) orb.x = -orb.radius;
                if (orb.y < -orb.radius) orb.y = height + orb.radius;
                if (orb.y > height + orb.radius) orb.y = -orb.radius;

                const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
                grad.addColorStop(0, colorStr);
                grad.addColorStop(1, 'transparent');
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            requestAnimationFrame(drawAmbientBackground);
        }
        
        drawAmbientBackground();
    }

    /* ==========================================================================
       POLICIES SLIDE-OUT DRAWER CONTROLLER
       ========================================================================== */
    const policiesDrawer = document.getElementById('policies-drawer');
    const policiesOverlay = document.getElementById('policies-drawer-overlay');
    const policiesClose = document.getElementById('policies-drawer-close');
    const menuPoliciesBtn = document.getElementById('menu-policies-btn');
    const footerPolicyLink = document.querySelector('.footer-policy-link');
    const checkoutNoticeBox = document.querySelector('.checkout-notice-box');

    function openPoliciesDrawer(e) {
        if (e) e.preventDefault();
        
        if (siteNav && siteNav.classList.contains('nav-open')) {
            siteNav.classList.remove('nav-open');
            if (navHamburger) {
                navHamburger.classList.remove('open');
                navHamburger.setAttribute('aria-expanded', 'false');
            }
            document.body.style.overflow = '';
        }

        if (policiesDrawer && policiesOverlay) {
            policiesDrawer.classList.add('active');
            policiesOverlay.classList.add('active');
            playTone(550, 'sine', 0.1, 0.05);
        }
    }

    function closePoliciesDrawer() {
        if (policiesDrawer && policiesOverlay) {
            policiesDrawer.classList.remove('active');
            policiesOverlay.classList.remove('active');
            playTone(400, 'sine', 0.1, 0.05);
        }
    }

    if (menuPoliciesBtn) {
        menuPoliciesBtn.addEventListener('click', openPoliciesDrawer);
    }
    if (footerPolicyLink) {
        footerPolicyLink.addEventListener('click', openPoliciesDrawer);
    }
    
    if (checkoutNoticeBox) {
        checkoutNoticeBox.querySelectorAll('a').forEach(link => {
            if (link.getAttribute('href').startsWith('policies.html')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    openPoliciesDrawer();
                    
                    const hashIdx = link.getAttribute('href').indexOf('#');
                    if (hashIdx !== -1) {
                        const targetHash = link.getAttribute('href').substring(hashIdx);
                        const targetSection = document.getElementById('drawer-' + targetHash.substring(1));
                        if (targetSection) {
                            setTimeout(() => {
                                targetSection.scrollIntoView({ behavior: 'smooth' });
                            }, 500);
                        }
                    }
                });
            }
        });
    }

    if (policiesClose) {
        policiesClose.addEventListener('click', closePoliciesDrawer);
    }
    if (policiesOverlay) {
        policiesOverlay.addEventListener('click', closePoliciesDrawer);
    }

    const drawerNavLinks = document.querySelectorAll('.policies-drawer-nav-link');
    const drawerSections = document.querySelectorAll('.policies-drawer-section');
    const drawerContentContainer = document.querySelector('.policies-drawer-content');

    drawerNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
                
                drawerNavLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    if (drawerContentContainer) {
        drawerContentContainer.addEventListener('scroll', () => {
            let activeId = '';
            drawerSections.forEach(section => {
                const sectionTop = section.offsetTop;
                if (drawerContentContainer.scrollTop >= (sectionTop - 120)) {
                    activeId = '#' + section.getAttribute('id');
                }
            });

            drawerNavLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === activeId);
            });
        });
    }

});


