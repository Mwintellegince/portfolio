document.addEventListener('DOMContentLoaded', () => {

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

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;

    // Track mouse coordinates
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
    });

    // Smoothly animate the outer trailing cursor ring
    function animateRing() {
        // Linear interpolation for smooth trailing
        const delay = 8; // Adjust speed (higher = slower trailing)
        ringX += (mouseX - ringX) / delay;
        ringY += (mouseY - ringY) / delay;

        cursorRing.style.left = `${ringX}px`;
        cursorRing.style.top = `${ringY}px`;

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
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Unobserve once revealed to keep layout responsive
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px' // Trigger slightly before element enters view fully
    });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    /* ==========================================================================
       ACTIVE LINK ON SCROLL & SCROLL PROGRESS TRACKING
       ========================================================================== */
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollProgress = document.getElementById('scroll-progress');

    window.addEventListener('scroll', () => {
        let currentSectionId = '';
        
        // Update Scroll Progress bar
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
            const progress = (window.scrollY / totalHeight) * 100;
            scrollProgress.style.width = `${progress}%`;
        }

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (pageYOffset >= (sectionTop - 250)) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
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
    
    const receiptFileInput = document.getElementById('instapay-receipt');
    const fileUploadText = document.getElementById('file-upload-text');
    const vodafoneFileInput = document.getElementById('vodafone-receipt');
    const vodafoneFileUploadText = document.getElementById('vodafone-file-upload-text');

    let currentPaymentMethod = 'PayPal';
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
            
            setPaymentMethod('PayPal');
            if (checkoutModal) checkoutModal.classList.add('active');
            playTone(600, 'sine', 0.1, 0.08);
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

        // Toggle required validation fields and standard submit button
        const ipaEl = document.getElementById('instapay-ipa');
        const vCashNumEl = document.getElementById('vodafone-number');
        const submitBtn = checkoutForm ? checkoutForm.querySelector('.checkout-submit-btn') : null;

        if (method === 'PayPal') {
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
                    alert('Please fill out your Name, Email, and Project Brief before starting the payment.');
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

                    alert('Payment successful! Your order has been registered and is under review.');
                });
            },
            onError: function(err) {
                console.error('PayPal Smart Buttons Checkout Error:', err);
                alert('A PayPal checkout error occurred. Please try InstaPay, Vodafone Cash, or contact us.');
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

            // ── INSTAPAY FLOW ──
            if (currentPaymentMethod === 'InstaPay') {
                if (!selectedFileBase64) {
                    alert('Please upload your InstaPay payment screenshot.');
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
                    alert('Please upload your Vodafone Cash transfer screenshot.');
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

});


