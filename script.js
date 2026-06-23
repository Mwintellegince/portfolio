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
        apiKey: "AIzaSyCkTEyPv2X906jBzR_WKHUSZU6HL1m0Kn8",
        authDomain: "getclowdy.firebaseapp.com",
        projectId: "getclowdy",
        storageBucket: "getclowdy.firebasestorage.app",
        messagingSenderId: "285613770049",
        appId: "1:285613770049:web:f37154f2c37799372c0dc0",
        measurementId: "G-FGGP0LT1C0"
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


            
    let currentUser = null;
    let userOrdersListener = null;

    async function sha256(str) {
        const data = new TextEncoder().encode(str + "USER_AUTH_SALT_2026");
        const buf  = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function initFirebase() {
        if (!FIREBASE_CONFIG.apiKey) {
            console.log("Firebase config not found. Falling back to LocalStorage.");
            setupClientAuthObserver();
            return false;
        }
        try {
            await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js");
            
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            isFirebaseActive = true;
            console.log("Firebase Firestore and Auth initialized on client side.");
            
            db.enablePersistence().catch((err) => {
                console.warn("Firestore persistence failed:", err.code);
            });
            
            setupClientAuthObserver();
            return true;
        } catch (e) {
            console.error("Failed to initialize Firebase on client:", e);
            setupClientAuthObserver();
            return false;
        }
    }

    /* ==========================================================================
       USER AUTHENTICATION & PROFILE DASHBOARD
       ========================================================================== */
    const authModal = document.getElementById('auth-modal');
    const profileModal = document.getElementById('profile-modal');
    const closeAuthBtn = document.getElementById('close-auth');
    const closeProfileBtn = document.getElementById('close-profile');
    const menuAuthBtn = document.getElementById('menu-auth-btn');

    const tabSignIn = document.getElementById('tab-signin');
    const tabSignUp = document.getElementById('tab-signup');
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const googleAuthBtn = document.getElementById('google-auth-btn');
    const googleBtnText = document.getElementById('google-btn-text');

    const profileDisplayName = document.getElementById('profile-display-name');
    const profileEmail = document.getElementById('profile-email');
    const profileRole = document.getElementById('profile-role');
    const profileWorkerBtn = document.getElementById('profile-worker-btn');
    const profileLogoutBtn = document.getElementById('profile-logout-btn');
    const profileOrdersContainer = document.getElementById('profile-orders-container');

    const authStatusMsg = document.getElementById('auth-status-msg');

    function showAuthStatus(message, type = 'error') {
        if (!authStatusMsg) return;
        authStatusMsg.textContent = message;
        authStatusMsg.classList.remove('hidden');
        if (type === 'error' || type === 'warn') {
            authStatusMsg.style.borderLeftColor = 'var(--red)';
            authStatusMsg.style.color = 'var(--red)';
        } else {
            authStatusMsg.style.borderLeftColor = 'var(--green)';
            authStatusMsg.style.color = 'var(--green)';
        }
    }

    function clearAuthStatus() {
        if (authStatusMsg) {
            authStatusMsg.textContent = '';
            authStatusMsg.classList.add('hidden');
        }
    }

    // Tab Switching
    if (tabSignIn && tabSignUp && signinForm && signupForm) {
        tabSignIn.addEventListener('click', () => {
            clearAuthStatus();
            tabSignIn.classList.add('active');
            tabSignUp.classList.remove('active');
            signinForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            document.getElementById('auth-modal-title').textContent = "Sign In";
        });
        tabSignUp.addEventListener('click', () => {
            clearAuthStatus();
            tabSignUp.classList.add('active');
            tabSignIn.classList.remove('active');
            signupForm.classList.remove('hidden');
            signinForm.classList.add('hidden');
            document.getElementById('auth-modal-title').textContent = "Sign Up";
        });
    }

    function openAuthModal() {
        if (authModal) {
            clearAuthStatus();
            authModal.classList.add('active');
            playTone(550, 'sine', 0.1, 0.05);
        }
    }

    function closeAuthModal() {
        if (authModal) {
            clearAuthStatus();
            authModal.classList.remove('active');
            playTone(400, 'sine', 0.1, 0.05);
            // Reset welcome success container state back to original form view
            setTimeout(() => {
                const formsContainer = document.getElementById('auth-forms-container');
                const welcomeContainer = document.getElementById('auth-welcome-container');
                const authTitle = document.getElementById('auth-modal-title');
                const authSub = document.getElementById('auth-modal-sub');
                
                if (formsContainer) {
                    formsContainer.style.display = '';
                    formsContainer.style.opacity = '1';
                    formsContainer.style.transform = 'translateY(0)';
                }
                if (welcomeContainer) {
                    welcomeContainer.classList.add('hidden');
                    welcomeContainer.style.opacity = '0';
                    welcomeContainer.style.transform = 'translateY(15px)';
                }
                if (authTitle) authTitle.style.display = '';
                if (authSub) authSub.style.display = '';
            }, 400);
        }
    }

    function animateWelcomeSuccess(userName, isSignUp) {
        const formsContainer = document.getElementById('auth-forms-container');
        const welcomeContainer = document.getElementById('auth-welcome-container');
        const authTitle = document.getElementById('auth-modal-title');
        const authSub = document.getElementById('auth-modal-sub');
        const welcomeTitle = document.getElementById('auth-welcome-title');
        const welcomeText = document.getElementById('auth-welcome-text');

        // Play positive tone
        playTone(523.25, 'sine', 0.15, 0.1);
        setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 100);
        setTimeout(() => playTone(783.99, 'sine', 0.3,  0.1), 200);

        if (formsContainer) {
            formsContainer.style.opacity = '0';
            formsContainer.style.transform = 'translateY(-10px)';
        }

        setTimeout(() => {
            if (formsContainer) formsContainer.style.display = 'none';
            if (authTitle) authTitle.style.display = 'none';
            if (authSub) authSub.style.display = 'none';

            if (welcomeTitle) {
                welcomeTitle.textContent = isSignUp ? "Welcome!" : "Welcome Back!";
            }
            if (welcomeText) {
                welcomeText.textContent = userName ? `${userName}` : "You have been successfully authenticated.";
            }

            if (welcomeContainer) {
                welcomeContainer.classList.remove('hidden');
                // Trigger reflow
                welcomeContainer.offsetHeight;
                welcomeContainer.style.opacity = '1';
                welcomeContainer.style.transform = 'translateY(0)';
            }
        }, 300);

        setTimeout(closeAuthModal, 2200);
    }

    function openProfileModal() {
        if (profileModal) {
            profileModal.classList.add('active');
            renderUserProfileAndOrders();
            playTone(550, 'sine', 0.1, 0.05);
        }
    }

    function closeProfileModal() {
        if (profileModal) {
            profileModal.classList.remove('active');
            playTone(400, 'sine', 0.1, 0.05);
        }
    }

    if (menuAuthBtn) {
        menuAuthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentUser) {
                openProfileModal();
            } else {
                openAuthModal();
            }
        });
    }
    if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuthModal);
    if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfileModal);

    if (authModal) {
        authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
    }
    if (profileModal) {
        profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeProfileModal(); });
    }

    // Dynamic prefill lock helper
    function setFormPrefills(user) {
        const clientNameField = document.getElementById('client-name');
        const clientEmailField = document.getElementById('client-email');
        const applyNameField = document.getElementById('apply-name');
        const applyEmailField = document.getElementById('apply-email');

        if (user) {
            if (clientNameField) { clientNameField.value = user.displayName; clientNameField.readOnly = true; }
            if (clientEmailField) { clientEmailField.value = user.email; clientEmailField.readOnly = true; }
            if (applyNameField) { applyNameField.value = user.displayName; applyNameField.readOnly = true; }
            if (applyEmailField) { applyEmailField.value = user.email; applyEmailField.readOnly = true; }
        } else {
            if (clientNameField) { clientNameField.value = ""; clientNameField.readOnly = false; }
            if (clientEmailField) { clientEmailField.value = ""; clientEmailField.readOnly = false; }
            if (applyNameField) { applyNameField.value = ""; applyNameField.readOnly = false; }
            if (applyEmailField) { applyEmailField.value = ""; applyEmailField.readOnly = false; }
        }
    }

    // Set auth state
    function setAuthUserState(user) {
        currentUser = user;
        if (menuAuthBtn) {
            menuAuthBtn.innerHTML = user ? `
                <span class="profile-nav-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--accent); background: rgba(212, 175, 55, 0.05); padding: 2px; vertical-align: middle; transition: all 0.2s; margin-top: -2px;">
                    <svg viewBox="0 0 24 24" style="width: 100%; height: 100%; fill: none; stroke: var(--accent); stroke-width: 2.2; transition: stroke 0.2s;">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </span>
            ` : `<span class="nav-num">09</span> Sign In`;
        }
        
        // Update custom mobile bottom nav elements
        const mobileProfileLabel = document.getElementById('mobile-nav-profile-label');
        if (mobileProfileLabel) {
            mobileProfileLabel.textContent = user ? "Profile" : "Sign In";
        }
        const mobileDrawerAuthBtn = document.getElementById('mobile-drawer-auth-btn');
        if (mobileDrawerAuthBtn) {
            mobileDrawerAuthBtn.innerHTML = user ? `<span class="drawer-num">09</span> Profile` : `<span class="drawer-num">09</span> Sign In`;
        }

        setFormPrefills(user);
        if (!user && profileModal) {
            profileModal.classList.remove('active');
        }

        // Show/hide announcement banner based on auth state
        if (user) {
            loadActiveAnnouncement();
        } else {
            displayAnnouncement(null);
        }
    }

    // Initialize Auth Observer
    function setupClientAuthObserver() {
        if (isFirebaseActive && firebase.auth) {
            firebase.auth().onAuthStateChanged(async (firebaseUser) => {
                if (firebaseUser) {
                    // Check if document exists in Firestore
                    try {
                        const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            const profileData = {
                                uid: firebaseUser.uid,
                                displayName: userData.displayName,
                                email: userData.email,
                                role: userData.role || 'client'
                            };
                            setAuthUserState(profileData);

                            // Save to local client_users array for local sync / admin access
                            let localUsers = [];
                            try { localUsers = JSON.parse(localStorage.getItem('client_users') || '[]'); } catch {}
                            if (!localUsers.some(u => u.email && userData.email && u.email.toLowerCase() === userData.email.toLowerCase())) {
                                localUsers.push({
                                    displayName: userData.displayName,
                                    email: userData.email,
                                    role: userData.role || 'client',
                                    createdAt: userData.createdAt || new Date().toISOString()
                                });
                                localStorage.setItem('client_users', JSON.stringify(localUsers));
                            }
                        } else {
                            // Account not in Firestore database. Prompt user to sign up
                            await firebase.auth().signOut();
                            setAuthUserState(null);
                            showAuthStatus("Account does not exist. Please sign up first.", "error");
                        }
                    } catch (err) {
                        console.error("Auth Firestore observer error:", err);
                        // Offline or connection failure fallback
                        const fallbackUser = {
                            uid: firebaseUser.uid,
                            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                            email: firebaseUser.email,
                            role: 'client'
                        };
                        setAuthUserState(fallbackUser);

                        // Save to local client_users array for local sync / admin access
                        let localUsers = [];
                        try { localUsers = JSON.parse(localStorage.getItem('client_users') || '[]'); } catch {}
                        if (!localUsers.some(u => u.email && fallbackUser.email && u.email.toLowerCase() === fallbackUser.email.toLowerCase())) {
                            localUsers.push({
                                displayName: fallbackUser.displayName,
                                email: fallbackUser.email,
                                role: 'client',
                                createdAt: new Date().toISOString()
                            });
                            localStorage.setItem('client_users', JSON.stringify(localUsers));
                        }
                    }
                } else {
                    setAuthUserState(null);
                    if (userOrdersListener) {
                        userOrdersListener();
                        userOrdersListener = null;
                    }
                    if (userAppsListener) {
                        userAppsListener();
                        userAppsListener = null;
                    }
                }
            });
        } else {
            // LocalStorage auth observer fallback
            try {
                const storedUser = localStorage.getItem('active_client_user');
                if (storedUser) {
                    setAuthUserState(JSON.parse(storedUser));
                } else {
                    setAuthUserState(null);
                }
            } catch {
                setAuthUserState(null);
            }
        }
    }

    // Credentials Submit: Sign In
    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signin-email').value.trim().toLowerCase();
            const password = document.getElementById('signin-password').value;

            if (isFirebaseActive) {
                try {
                    // Start authentication sign-in
                    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                    const uid = userCredential.user.uid;
                    
                    let userDoc = null;
                    let isOffline = false;
                    try {
                        userDoc = await db.collection('users').doc(uid).get();
                    } catch (dbErr) {
                        console.warn("Firestore user check failed, falling back to Auth details:", dbErr);
                        isOffline = true;
                    }

                    if (!isOffline && userDoc && !userDoc.exists) {
                        await firebase.auth().signOut();
                        showAuthStatus("Account does not exist. Please sign up first.", "error");
                        return;
                    }

                    let name = "";
                    if (!isOffline && userDoc && userDoc.exists) {
                        name = userDoc.data().displayName;
                    } else {
                        name = userCredential.user.displayName || email.split('@')[0];
                    }

                    showAuthStatus(isOffline ? "Logged in successfully (Offline mode)!" : "Logged in successfully!", "success");
                    if (isOffline) {
                        setAuthUserState({
                            uid: uid,
                            displayName: name,
                            email: email,
                            role: 'client'
                        });
                    }
                    animateWelcomeSuccess(name, false);
                } catch (err) {
                    console.error("Firebase Sign In Error:", err);
                    showAuthStatus(err.message || "Invalid credentials.", "error");
                }
            } else {
                // LocalStorage Fallback
                let localUsers = [];
                try { localUsers = JSON.parse(localStorage.getItem('client_users') || '[]'); } catch {}
                const passHash = await sha256(password);
                const user = localUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === passHash);
                if (user) {
                    const loggedInUser = {
                        uid: 'usr_' + Date.now(),
                        displayName: user.displayName,
                        email: user.email,
                        role: user.role || 'client'
                    };
                    localStorage.setItem('active_client_user', JSON.stringify(loggedInUser));
                    setAuthUserState(loggedInUser);
                    animateWelcomeSuccess(user.displayName, false);
                } else {
                    showAuthStatus("Account does not exist or invalid credentials.", "error");
                }
            }
        });
    }

    // Credentials Submit: Sign Up
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim().toLowerCase();
            const password = document.getElementById('signup-password').value;

            if (password.length < 6) {
                showAuthStatus("Password must be at least 6 characters.", "warn");
                return;
            }

            if (isFirebaseActive) {
                try {
                    // Create account in Firebase Auth
                    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                    const uid = userCredential.user.uid;
                    const newUserData = {
                        displayName: name,
                        email: email,
                        role: 'client',
                        createdAt: new Date().toISOString()
                    };
                    
                    // Write profile to Firestore (catch any write errors gracefully, e.g. client offline)
                    let isWriteOk = true;
                    try {
                        await db.collection('users').doc(uid).set(newUserData);
                    } catch (dbErr) {
                        console.warn("Failed to write user profile to Firestore (offline fallback):", dbErr);
                        isWriteOk = false;
                    }

                    showAuthStatus(isWriteOk ? "Account created successfully! Logging in..." : "Account created successfully (Offline mode)!", "success");
                    
                    // In offline fallback, auth observer might fail to query userDoc, so we set user state here too
                    setAuthUserState({
                        uid: uid,
                        displayName: name,
                        email: email,
                        role: 'client'
                    });
                    
                    animateWelcomeSuccess(name, true);
                } catch (err) {
                    console.error("Firebase Sign Up Error:", err);
                    showAuthStatus(err.message || "Registration failed.", "error");
                }
            } else {
                // LocalStorage Fallback
                let localUsers = [];
                try { localUsers = JSON.parse(localStorage.getItem('client_users') || '[]'); } catch {}
                if (localUsers.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
                    showAuthStatus("Account already exists with this email.", "warn");
                    return;
                }
                const passHash = await sha256(password);
                localUsers.push({
                    displayName: name,
                    email: email,
                    passwordHash: passHash,
                    role: 'client',
                    createdAt: new Date().toISOString()
                });
                localStorage.setItem('client_users', JSON.stringify(localUsers));

                const loggedInUser = {
                    uid: 'usr_' + Date.now(),
                    displayName: name,
                    email: email,
                    role: 'client'
                };
                localStorage.setItem('active_client_user', JSON.stringify(loggedInUser));
                setAuthUserState(loggedInUser);
                animateWelcomeSuccess(name, true);
            }
        });
    }

    // Google Sign In / Sign Up Handler
    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', async () => {
            if (!isFirebaseActive) {
                showAuthStatus("Google Authentication is only available in cloud deployment mode.", "warn");
                return;
            }
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const userCredential = await firebase.auth().signInWithPopup(provider);
                const firebaseUser = userCredential.user;
                const uid = firebaseUser.uid;

                let userDoc = null;
                let isOffline = false;
                try {
                    userDoc = await db.collection('users').doc(uid).get();
                } catch (dbErr) {
                    console.warn("Firestore user check failed (degraded/offline mode):", dbErr);
                    isOffline = true;
                }

                if (!isOffline && userDoc && userDoc.exists) {
                    // Sign In Successful
                    const name = userDoc.data().displayName;
                    showAuthStatus(`Welcome back, ${name}!`, "success");
                    animateWelcomeSuccess(name, false);
                } else {
                    // Check if it is a sign-up action or block
                    const isSignUpTab = tabSignUp.classList.contains('active');
                    if (!isSignUpTab && !isOffline) {
                        await firebase.auth().signOut();
                        showAuthStatus("Account does not exist. Please sign up first.", "error");
                        return;
                    }
                    
                    // Create user profile object
                    const newUserData = {
                        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                        email: firebaseUser.email,
                        role: 'client',
                        createdAt: new Date().toISOString()
                    };

                    if (!isOffline) {
                        try {
                            await db.collection('users').doc(uid).set(newUserData);
                        } catch (writeErr) {
                            console.error("Failed to save user doc to Firestore:", writeErr);
                        }
                    }

                    showAuthStatus(isOffline ? "Logged in successfully (Offline mode)!" : "Google Account registered successfully!", "success");
                    
                    // Ensure the client state is set
                    setAuthUserState({
                        uid: uid,
                        displayName: newUserData.displayName,
                        email: newUserData.email,
                        role: 'client'
                    });
                    
                    animateWelcomeSuccess(newUserData.displayName, true);
                }
            } catch (err) {
                console.error("Google Auth error:", err);
                showAuthStatus(err.message || "Google authentication failed.", "error");
            }
        });
    }

    // Sign Out
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', async () => {
            if (isFirebaseActive) {
                try {
                    await firebase.auth().signOut();
                    showNotification("Signed out successfully.", "info");
                } catch (err) {
                    console.error("Error signing out:", err);
                }
            } else {
                localStorage.removeItem('active_client_user');
                setAuthUserState(null);
                showNotification("Signed out successfully.", "info");
            }
            closeProfileModal();
        });
    }

    // Check if worker email has a profile to access worker.html
    if (profileWorkerBtn) {
        profileWorkerBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            const email = currentUser.email.toLowerCase();

            // Check if worker exists in workers database
            let isWorker = false;
            let workerObj = null;

            if (isFirebaseActive && db) {
                try {
                    const docId = 'work_' + email.replace(/\./g, '_');
                    const doc = await db.collection('workers').doc(docId).get();
                    if (doc.exists) {
                        isWorker = true;
                        workerObj = { id: doc.id, ...doc.data() };
                    } else {
                        // Fallback: Scan workers collection case-insensitively in case it was created with mixed casing
                        const snapshot = await db.collection('workers').get();
                        snapshot.forEach(d => {
                            const data = d.data();
                            if (data.email && data.email.toLowerCase() === email) {
                                isWorker = true;
                                workerObj = { id: d.id, ...data };
                            }
                        });
                    }
                } catch (err) {
                    console.error("Firestore worker search error:", err);
                }
            } 
            
            // ALWAYS check local storage as a fallback, as Admin might have failed to write to Firestore due to permissions
            if (!isWorker) {
                let localWorkers = [];
                try { localWorkers = JSON.parse(localStorage.getItem('client_workers') || '[]'); } catch {}
                const localW = localWorkers.find(w => w.email && w.email.toLowerCase() === email);
                if (localW) {
                    isWorker = true;
                    workerObj = localW;
                }
            }

            if (isWorker) {
                // Auto authenticate in worker.html
                sessionStorage.setItem('workerOk', '1');
                sessionStorage.setItem('workerEmail', email);
                localStorage.setItem('active_worker_profile', JSON.stringify(workerObj));
                showNotification("Redirecting to worker dashboard...", "success");
                setTimeout(() => {
                    window.location.href = 'worker.html';
                }, 1000);
            } else {
                let isPending = false;
                if (isFirebaseActive && db) {
                    try {
                        const snapshot = await db.collection('applications').get();
                        snapshot.forEach(d => {
                            if (d.data().email && d.data().email.toLowerCase() === email) {
                                isPending = true;
                            }
                        });
                    } catch (err) {}
                }
                if (!isPending) {
                    let localApps = [];
                    try { localApps = JSON.parse(localStorage.getItem('client_applications') || '[]'); } catch {}
                    if (localApps.some(a => a.email && a.email.toLowerCase() === email)) {
                        isPending = true;
                    }
                }

                if (isPending) {
                    showNotification("Your application is currently under review by an administrator.", "info");
                    closeProfileModal();
                } else {
                    showNotification("You do not have a worker profile. Apply to become a worker.", "warn");
                    closeProfileModal();
                    setTimeout(() => openApplyModal(), 500);
                }
            }
        });
    }

    // Render client profile data and orders
    function renderUserProfileAndOrders() {
        if (!currentUser) return;
        if (profileDisplayName) profileDisplayName.textContent = currentUser.displayName;
        if (profileEmail) profileEmail.textContent = currentUser.email;
        if (profileRole) profileRole.textContent = currentUser.role || 'client';

        if (userOrdersListener) {
            // Unsubscribe existing listener to prevent leaks
            userOrdersListener();
            userOrdersListener = null;
        }

        if (userAppsListener) {
            // Unsubscribe existing listener to prevent leaks
            userAppsListener();
            userAppsListener = null;
        }

        // Render orders list
        if (isFirebaseActive && db) {
            userOrdersListener = db.collection('orders')
                .onSnapshot((snapshot) => {
                    let orders = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.email && currentUser.email && data.email.toLowerCase() === currentUser.email.toLowerCase()) {
                            orders.push({ id: doc.id, ...data });
                        }
                    });
                    // Sort by submitted time descending
                    orders.sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                    displayUserOrders(orders);
                }, (err) => {
                    console.error("Error listening to user orders:", err);
                    displayLocalUserOrders();
                });
        } else {
            displayLocalUserOrders();
        }

        // Render applications list
        if (isFirebaseActive && db) {
            userAppsListener = db.collection('applications')
                .onSnapshot((snapshot) => {
                    let apps = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.email && currentUser.email && data.email.toLowerCase() === currentUser.email.toLowerCase()) {
                            apps.push({ id: doc.id, ...data });
                        }
                    });
                    apps.sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                    displayUserApplications(apps);
                }, (err) => {
                    console.error("Error listening to user applications:", err);
                    displayLocalUserApplications();
                });
        } else {
            displayLocalUserApplications();
        }
    }

    function displayLocalUserOrders() {
        let localOrders = [];
        try { localOrders = JSON.parse(localStorage.getItem('client_orders') || '[]'); } catch {}
        const filtered = localOrders.filter(o => o.email && currentUser.email && o.email.toLowerCase() === currentUser.email.toLowerCase());
        filtered.sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        displayUserOrders(filtered);
    }

    function displayUserOrders(orders) {
        if (!profileOrdersContainer) return;
        if (orders.length === 0) {
            profileOrdersContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px;">No orders found. Purchase a plan to get started!</p>';
            return;
        }

        profileOrdersContainer.innerHTML = orders.map(order => {
            const status = order.status || 'pending';
            const price = order.price || '—';
            const plan = order.plan || 'Service Plan';
            const dateStr = new Date(order.submittedAt).toLocaleDateString();

            // Timeline states
            let step1 = 'completed', step2 = '', step3 = '', step4 = '';
            if (status === 'pending') step2 = 'active';
            if (status === 'approved') { step2 = 'completed'; step3 = 'active'; }
            if (status === 'completed') { step2 = 'completed'; step3 = 'completed'; step4 = 'completed'; }
            
            let statusBadgeClass = status;
            let statusLabel = status.toUpperCase();

            if (status === 'cancelled') {
                statusBadgeClass = 'rejected';
                statusLabel = 'CANCELLED';
            }

            const canCancel = (status === 'pending' || status === 'approved');

            const orderHtml = `
                <div style="background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 6px; padding: 18px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
                        <div>
                            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dark);">${order.id}</div>
                            <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">${plan}</div>
                        </div>
                        <span class="tracker-value badge ${statusBadgeClass}">${statusLabel}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                        <div>Date: <span style="color: var(--text-primary); font-weight: 500;">${dateStr}</span></div>
                        <div>Price: <span style="color: var(--accent); font-weight: 600;">${price}</span></div>
                    </div>

                    ${(status !== 'cancelled' && status !== 'rejected') ? `
                    <!-- Timeline Progress -->
                    <div class="tracker-timeline" style="margin-top: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                        <div class="timeline-step ${step1}" style="text-align: center;">
                            <div class="step-indicator" style="margin: 0 auto; width:20px; height:20px; font-size:0.6rem; line-height:20px;">1</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">Submitted</div>
                        </div>
                        <div class="timeline-step ${step2}" style="text-align: center;">
                            <div class="step-indicator" style="margin: 0 auto; width:20px; height:20px; font-size:0.6rem; line-height:20px;">2</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">Verified</div>
                        </div>
                        <div class="timeline-step ${step3}" style="text-align: center;">
                            <div class="step-indicator" style="margin: 0 auto; width:20px; height:20px; font-size:0.6rem; line-height:20px;">3</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">Building</div>
                        </div>
                        <div class="timeline-step ${step4}" style="text-align: center;">
                            <div class="step-indicator" style="margin: 0 auto; width:20px; height:20px; font-size:0.6rem; line-height:20px;">4</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">Delivery</div>
                        </div>
                    </div>
                    ` : `
                    <div style="font-size: 0.75rem; color: var(--text-muted); padding: 5px 0;">This order is closed and no further actions will be taken.</div>
                    `}

                    ${canCancel ? `
                    <button class="btn-primary" onclick="window._clientCancelOrder('${order.id}')" style="margin-top: 10px; width:100%; padding: 8px; font-size: 0.72rem; font-family: var(--font-mono); text-transform: uppercase; border-color: var(--red); color: var(--red); justify-content: center;">
                        Cancel Order
                    </button>
                    ` : ''}
                </div>
            `;
            return orderHtml;
        }).join('');
        bindHover();
    }

    function displayLocalUserApplications() {
        let localApps = [];
        try { localApps = JSON.parse(localStorage.getItem('client_applications') || '[]'); } catch {}
        const filtered = localApps.filter(a => a.email && currentUser.email && a.email.toLowerCase() === currentUser.email.toLowerCase());
        filtered.sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        displayUserApplications(filtered);
    }

    function displayUserApplications(apps) {
        const container = document.getElementById('profile-applications-container');
        if (!container) return;
        if (apps.length === 0) {
            container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px;">No applications found. Apply to work with us under Careers!</p>';
            return;
        }

        container.innerHTML = apps.map(app => {
            const status = app.status || 'pending';
            const major = app.major || 'general';
            const dateStr = new Date(app.submittedAt).toLocaleDateString();

            let statusBadgeClass = 'pending';
            let statusLabel = status.toUpperCase();
            let statusMessage = '';

            if (status === 'approved' || status === 'accepted') {
                statusBadgeClass = 'success';
                statusLabel = 'ACCEPTED';
                statusMessage = '<div style="margin-top:8px;padding:10px 12px;background:rgba(16,185,129,.08);border-left:3px solid #10b981;border-radius:4px;font-size:.78rem;color:#10b981;">Welcome to the team! Check your email for login credentials and next steps.</div>';
            }
            if (status === 'rejected') {
                statusBadgeClass = 'rejected';
                statusLabel = 'REJECTED';
                const reason = app.rejectionReason
                    ? `<span style="color:var(--text-primary);">${esc(app.rejectionReason)}</span>`
                    : 'No specific reason provided.';
                statusMessage = `<div style="margin-top:8px;padding:10px 12px;background:rgba(239,68,68,.06);border-left:3px solid #ef4444;border-radius:4px;font-size:.78rem;color:var(--text-muted);">Reason: ${reason}</div>`;
            }

            const appHtml = `
                <div style="background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                        <div>
                            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dark);">${app.id}</div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 2px; text-transform: capitalize;">${esc(major)} Engineer Application</div>
                        </div>
                        <span class="tracker-value badge ${statusBadgeClass}">${statusLabel}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
                        <div>Date: <span style="color: var(--text-primary); font-weight: 500;">${dateStr}</span></div>
                    </div>
                    ${statusMessage}
                </div>
            `;
            return appHtml;
        }).join('');
        bindHover();
    }

    // Client Cancel Order Action
    window._clientCancelOrder = async function(orderId) {
        const ok = await customConfirm("Cancel this order request?");
        if (!ok) return;

        if (isFirebaseActive && db) {
            try {
                await db.collection('orders').doc(orderId).update({ status: 'cancelled' });
                showNotification("Order has been cancelled.", "success");
            } catch (err) {
                console.error("Firestore cancel order error:", err);
                showNotification("Failed to cancel order. Try again.", "error");
            }
        } else {
            // Local fallback
            let localOrders = [];
            try { localOrders = JSON.parse(localStorage.getItem('client_orders') || '[]'); } catch {}
            const oIdx = localOrders.findIndex(o => o.id === orderId);
            if (oIdx !== -1) {
                localOrders[oIdx].status = 'cancelled';
                localStorage.setItem('client_orders', JSON.stringify(localOrders));
                displayLocalUserOrders();
                showNotification("Order has been cancelled.", "success");
            }
        }
    };

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
        if (!notifOverlay) { console.warn('Notification:', message); return; }

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

        // Show modal & override custom cursor to reveal default browser pointer
        document.body.classList.add('has-error-notif');
        notifOverlay.classList.add('active');
        playNotifSound(type);

        // Re-trigger icon animation by removing/re-adding the class
        void notifIconWrap.offsetWidth;
        notifOkBtn.focus();
    }

    // Custom Confirm (replaces browser confirm())
    function customConfirm(msg) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('confirm-overlay');
            const msgEl = document.getElementById('confirm-msg');
            const yesBtn = document.getElementById('confirm-yes-btn');
            const noBtn = document.getElementById('confirm-no-btn');
            if (!overlay || !yesBtn || !noBtn) { resolve(false); return; }
            if (msgEl) msgEl.textContent = msg;
            overlay.classList.add('active');
            const cleanup = () => {
                overlay.classList.remove('active');
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
            };
            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };
            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
        });
    }

    // Close on OK button
    if (notifOkBtn) {
        notifOkBtn.addEventListener('click', () => {
            notifOverlay.classList.remove('active');
            document.body.classList.remove('has-error-notif');
        });
    }

    // Close on backdrop click
    if (notifOverlay) {
        notifOverlay.addEventListener('click', (e) => {
            if (e.target === notifOverlay) {
                notifOverlay.classList.remove('active');
                document.body.classList.remove('has-error-notif');
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && notifOverlay && notifOverlay.classList.contains('active')) {
            notifOverlay.classList.remove('active');
            document.body.classList.remove('has-error-notif');
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
            document.body.classList.toggle('nav-open-active', isOpen);
            // Prevent body scroll when nav is open
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Close nav when a link is clicked
        siteNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                siteNav.classList.remove('nav-open');
                navHamburger.classList.remove('open');
                navHamburger.setAttribute('aria-expanded', 'false');
                document.body.classList.remove('nav-open-active');
                document.body.style.overflow = '';
            });
        });

        // Close nav when clicking outside the menu drawer
        document.addEventListener('click', (e) => {
            if (document.body.classList.contains('nav-open-active')) {
                if (!siteNav.contains(e.target) && !navHamburger.contains(e.target)) {
                    siteNav.classList.remove('nav-open');
                    navHamburger.classList.remove('open');
                    navHamburger.setAttribute('aria-expanded', 'false');
                    document.body.classList.remove('nav-open-active');
                    document.body.style.overflow = '';
                }
            }
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
                
                // Update custom mobile bottom nav active highlights
                const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
                let hasActiveSection = false;
                mobileNavItems.forEach(item => {
                    item.classList.remove('active');
                    const target = item.getAttribute('href');
                    if (target === `#${currentSectionId}`) {
                        item.classList.add('active');
                        hasActiveSection = true;
                    }
                });
                
                // Fallback: If section is hero or empty, mark Now active
                if (!hasActiveSection || currentSectionId === 'hero' || currentSectionId === '') {
                    const nowItem = document.querySelector('.mobile-nav-item[data-target="now"]');
                    if (nowItem) {
                        nowItem.classList.add('active');
                    }
                }
                
                // Update indicator position
                if (typeof updateMobileIndicator === 'function') {
                    updateMobileIndicator();
                }

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

    // Bind pricing buttons to open modal (conditional visibility for unauthenticated users)
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
            
            const authWarning = document.getElementById('checkout-auth-warning');
            const paymentWrapper = document.getElementById('checkout-payment-wrapper');
            const submitBtn = checkoutForm ? checkoutForm.querySelector('.checkout-submit-btn') : null;

            if (!currentUser) {
                if (authWarning) authWarning.classList.remove('hidden');
                if (paymentWrapper) paymentWrapper.classList.add('hidden');
                
                // Hide all payment fields
                if (paypalFields) paypalFields.classList.add('hidden');
                if (instapayFields) instapayFields.classList.add('hidden');
                if (vodafoneFields) vodafoneFields.classList.add('hidden');
                if (kashierFields) kashierFields.classList.add('hidden');
                
                if (submitBtn) submitBtn.style.setProperty('display', 'none', 'important');
            } else {
                if (authWarning) authWarning.classList.add('hidden');
                if (paymentWrapper) paymentWrapper.classList.remove('hidden');
                if (submitBtn) submitBtn.style.display = ''; // Restore submit button display
                
                setFormPrefills(currentUser);
                setPaymentMethod('Kashier');
            }
            
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

    const checkoutSigninBtn = document.getElementById('checkout-signin-btn');
    if (checkoutSigninBtn) {
        checkoutSigninBtn.addEventListener('click', () => {
            if (checkoutModal) checkoutModal.classList.remove('active');
            openAuthModal();
            showAuthStatus("Please sign in or create an account to buy a plan.", "warn");
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
            const clientEmail = document.getElementById('client-email').value.trim().toLowerCase();
            const clientBrief = document.getElementById('client-brief').value.trim();

            // ── KASHIER CARD FLOW ──
            if (currentPaymentMethod === 'Kashier') {
                const orderId = 'ord_' + Date.now();
                const order = {
                    id:            orderId,
                    name:          clientName,
                    email:         clientEmail,
                    plan:          planName,
                    price:         price + ' EGP',
                    paymentMethod: 'Kashier',
                    brief:         clientBrief,
                    receipt:       null,
                    status:        'pending',
                    submittedAt:   new Date().toISOString()
                };

                showNotification('Initializing secure card payment...', 'info');

                try {
                    const response = await fetch('/api/kashierHash', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            orderId: orderId,
                            amount: price
                        })
                    });

                    if (!response.ok) {
                        throw new Error('API server returned an error');
                    }

                    const data = await response.json();
                    if (data.paymentUrl) {
                        saveNewOrder(order);
                        showNotification('Redirecting to Kashier Payment Gateway...', 'success');
                        setTimeout(() => {
                            window.location.href = data.paymentUrl;
                        }, 1000);
                    } else {
                        throw new Error('No payment URL received');
                    }
                } catch (err) {
                    console.error('Kashier card payment initialization failed:', err);
                    showNotification('Direct card payment initialization failed. Please use InstaPay, Vodafone Cash, or try again.', 'error');
                }

                if (checkoutModal) checkoutModal.classList.remove('active');
                checkoutForm.reset();
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

    /* ==========================================================================
       ANNOUNCEMENT BANNER & CAREERS MODAL CONTROLLERS
       ========================================================================== */
    const MAJOR_SKILLS = {
        'Graphic Designer': [
            'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe After Effects',
            'Blender 3D', 'Branding & Identity', 'UI/UX Layouts', 'Typography'
        ],
        'Web Developer': [
            'HTML5 & CSS3', 'JavaScript (ES6+)', 'React.js / Vue.js', 'Node.js & Express',
            'TailwindCSS', 'REST APIs & GraphQL', 'Git & Version Control', 'Web Performance Optimization'
        ],
        'Programs Developer': [
            'Python (Advanced)', 'C++ / C#', 'Java', 'Desktop GUI (Qt / Electron)',
            'AI & Machine Learning Integration', 'Databases (SQL & NoSQL)', 'System Architecture', 'Scripting & Automation'
        ]
    };

    const MAJOR_QUESTIONS = {
        'Graphic Designer': [
            {
                id: 'design_q1',
                question: 'How do you optimize vector assets and brand exports for high-resolution displays without quality loss or excessive file size?'
            },
            {
                id: 'design_q2',
                question: 'Describe your UI/UX design workflow when transitioning a desktop concept into a fully responsive mobile interface. What design systems or grids do you prioritize?'
            },
            {
                id: 'design_q3',
                question: 'How do you handle client revisions when they clash with fundamental UI/UX accessibility guidelines (e.g., color contrast or font readability)?'
            },
            {
                id: 'design_q4',
                question: 'What is your process for creating a cohesive brand identity system? What assets do you deliver?'
            }
        ],
        'Web Developer': [
            {
                id: 'web_q1',
                question: 'Explain how you would diagnose and resolve a layout thrashing issue caused by repetitive DOM reads and writes in a high-frequency event handler (e.g., custom cursor/scroll).'
            },
            {
                id: 'web_q2',
                question: 'How do you secure public-facing client-side forms from bot spam and XSS attacks when integrating with Firebase Firestore collections?'
            },
            {
                id: 'web_q3',
                question: 'Explain the difference between CSR, SSR, and SSG, and when you would choose one over the others for a performance-focused client project.'
            },
            {
                id: 'web_q4',
                question: 'How do you optimize a website\'s critical rendering path to achieve a 95+ score on Google Lighthouse?'
            }
        ],
        'Programs Developer': [
            {
                id: 'prog_q1',
                question: 'How do you design a thread-safe worker pool in your preferred programming language to handle concurrent, high-throughput network scraping jobs?'
            },
            {
                id: 'prog_q2',
                question: 'Explain the architectural difference between a monolithic and microservices setup for an enterprise software application. How would you handle database consistency across service boundaries?'
            },
            {
                id: 'prog_q3',
                question: 'How do you structure database queries and indexing to optimize performance for a read-heavy application handling millions of records?'
            },
            {
                id: 'prog_q4',
                question: 'What is your approach to automated testing (unit, integration, end-to-end)? How do you ensure high code coverage without slowing down delivery?'
            }
        ]
    };

    const applyModal = document.getElementById('apply-modal');
    const closeApplyBtn = document.getElementById('close-apply');
    const menuApplyBtn = document.getElementById('menu-apply-btn');
    const applyMajorSelect = document.getElementById('apply-major');
    const applySkillsSection = document.getElementById('apply-skills-section');
    const applySkillsGrid = document.getElementById('apply-skills-grid');
    const applyQuestionsSection = document.getElementById('apply-questions-section');
    const applyQuestionsContainer = document.getElementById('apply-questions-container');
    const applyCvInput = document.getElementById('apply-cv');
    const applyForm = document.getElementById('apply-form');

    let uploadedCvBase64 = null;

    // Toggle Modal
    async function openApplyModal(e) {
        if (e) e.preventDefault();

        if (!currentUser) {
            openAuthModal();
            showAuthStatus("Please sign in to submit an application.", "warn");
            return;
        }

        const email = currentUser.email ? currentUser.email.toLowerCase() : '';
        if (!email) {
            showNotification("Your account is missing an email address. Please update your profile.", "error");
            return;
        }

        // Check if they are already an active worker
        let isWorker = false;
        let workerObj = null;

        if (isFirebaseActive && typeof db !== 'undefined' && db) {
            try {
                const docId = 'work_' + email.replace(/\./g, '_');
                const doc = await db.collection('workers').doc(docId).get();
                if (doc.exists) {
                    isWorker = true;
                    workerObj = { id: doc.id, ...doc.data() };
                }
            } catch (err) {}
        }
        if (!isWorker) {
            let localWorkers = [];
            try { localWorkers = JSON.parse(localStorage.getItem('client_workers') || '[]'); } catch {}
            const localW = localWorkers.find(w => w.email && w.email.toLowerCase() === email);
            if (localW) {
                isWorker = true;
                workerObj = localW;
            }
        }

        if (isWorker) {
            sessionStorage.setItem('workerOk', '1');
            sessionStorage.setItem('workerEmail', email);
            localStorage.setItem('active_worker_profile', JSON.stringify(workerObj));
            showNotification('You are already an approved team member. Redirecting to Worker Dashboard...', 'success');
            setTimeout(() => { window.location.href = 'worker.html'; }, 1000);
            return;
        }

        // Check if user already applied
        let isPending = false;
        if (isFirebaseActive && typeof db !== 'undefined' && db) {
            try {
                const snapshot = await db.collection('applications').get();
                snapshot.forEach(d => {
                    if (d.data().email && d.data().email.toLowerCase() === email) {
                        isPending = true;
                    }
                });
            } catch (err) {}
        }
        if (!isPending) {
            let existingApps = [];
            try { existingApps = JSON.parse(localStorage.getItem('client_applications') || '[]'); } catch {}
            if (existingApps.some(a => a.email && a.email.toLowerCase() === email)) {
                isPending = true;
            }
        }

        if (isPending) {
            showNotification('Your application is currently under review by an administrator.', 'info');
            return;
        }
        
        if (siteNav && siteNav.classList.contains('nav-open')) {
            siteNav.classList.remove('nav-open');
            if (navHamburger) {
                navHamburger.classList.remove('open');
                navHamburger.setAttribute('aria-expanded', 'false');
            }
            document.body.style.overflow = '';
        }

        if (applyModal) {
            applyModal.classList.add('active');
            playTone(550, 'sine', 0.1, 0.05);
        }
    }

    function closeApplyModal() {
        if (applyModal) {
            applyModal.classList.remove('active');
            playTone(400, 'sine', 0.1, 0.05);
        }
    }

    if (menuApplyBtn) {
        menuApplyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentUser) {
                openAuthModal();
                showAuthStatus("Please sign in or create an account to apply.", "warn");
            } else {
                setFormPrefills(currentUser);
                openApplyModal();
            }
        });
    }
    if (closeApplyBtn) {
        closeApplyBtn.addEventListener('click', closeApplyModal);
    }
    if (applyModal) {
        applyModal.addEventListener('click', (e) => {
            if (e.target === applyModal) closeApplyModal();
        });
    }

    // Dynamic rendering of fields
    if (applyMajorSelect) {
        applyMajorSelect.addEventListener('change', () => {
            const major = applyMajorSelect.value;
            
            // Render Skills
            const skills = MAJOR_SKILLS[major] || [];
            if (skills.length > 0) {
                applySkillsGrid.innerHTML = skills.map((skill, idx) => `
                    <label class="skill-check-item">
                        <input type="checkbox" name="skills" value="${skill}">
                        <span>${skill}</span>
                    </label>
                `).join('');
                applySkillsSection.classList.remove('hidden');
            } else {
                applySkillsSection.classList.add('hidden');
            }

            // Render Questions
            const questions = MAJOR_QUESTIONS[major] || [];
            if (questions.length > 0) {
                applyQuestionsContainer.innerHTML = questions.map((q, idx) => `
                    <div class="challenge-question">
                        <label for="apply-q-${idx}"><strong>Question ${idx + 1}:</strong> ${q.question}</label>
                        <textarea id="apply-q-${idx}" required rows="3" placeholder="Write your professional response..."></textarea>
                    </div>
                `).join('');
                applyQuestionsSection.classList.remove('hidden');
            } else {
                applyQuestionsSection.classList.add('hidden');
            }
        });
    }

    // CV Reader with 800KB check
    if (applyCvInput) {
        applyCvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                uploadedCvBase64 = null;
                return;
            }
            if (file.size > 800 * 1024) {
                showNotification('File is too large. CV must be smaller than 800KB.', 'error');
                applyCvInput.value = '';
                uploadedCvBase64 = null;
                return;
            }
            const reader = new FileReader();
            reader.onload = function(evt) {
                uploadedCvBase64 = evt.target.result;
                showNotification('CV loaded successfully.', 'success');
            };
            reader.onerror = function() {
                showNotification('Error reading file.', 'error');
                applyCvInput.value = '';
                uploadedCvBase64 = null;
            };
            reader.readAsDataURL(file);
        });
    }

    // Submit Application
    if (applyForm) {
        applyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                if (!currentUser) {
                    showNotification('Please sign in to submit an application.', 'warn');
                    return;
                }

                const name = document.getElementById('apply-name').value.trim();
                const email = document.getElementById('apply-email').value.trim().toLowerCase();
                const major = applyMajorSelect.value;
                const website = document.getElementById('apply-website').value.trim();
                const github = document.getElementById('apply-github').value.trim();
                const contribution = document.getElementById('apply-contribution').value.trim();

                if (!name || !email || !major || !contribution) {
                    showNotification('Please fill in all required fields.', 'warn');
                    return;
                }

                if (!uploadedCvBase64) {
                    showNotification('Please upload your CV (PDF or Image, max 800KB).', 'warn');
                    return;
                }

                // Gather selected skills
                const selectedSkills = [];
                applyForm.querySelectorAll('input[name="skills"]:checked').forEach(cb => {
                    selectedSkills.push(cb.value);
                });

                // Gather question responses
                const responses = [];
                const questions = MAJOR_QUESTIONS[major] || [];
                for (let idx = 0; idx < questions.length; idx++) {
                    const q = questions[idx];
                    const el = document.getElementById(`apply-q-${idx}`);
                    const answerVal = el ? el.value.trim() : '';
                    responses.push({
                        questionId: q.id,
                        questionText: q.question,
                        answerText: answerVal
                    });
                }

                const application = {
                    id: 'app_' + Date.now(),
                    name,
                    email,
                    userId: currentUser.uid,
                    major,
                    website,
                    github,
                    skills: selectedSkills,
                    answers: responses,
                    cv: uploadedCvBase64,
                    contribution,
                    status: 'pending',
                    submittedAt: new Date().toISOString()
                };

                let localApps = [];
                try { localApps = JSON.parse(localStorage.getItem('client_applications') || '[]'); } catch {}
                localApps.push(application);
                localStorage.setItem('client_applications', JSON.stringify(localApps));

                if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && typeof db !== 'undefined' && db) {
                    try {
                        const { id, ...appData } = application;
                        db.collection('applications').doc(id).set(appData).catch(err => {
                            console.error('Firestore application sync background error:', err);
                        });
                    } catch (err) {
                        console.error('Firestore application sync error:', err);
                    }
                }

                playTone(523.25, 'sine', 0.15, 0.1);
                setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 100);
                setTimeout(() => playTone(783.99, 'sine', 0.3,  0.1), 200);

                showNotification('Application submitted! You will be contacted if there is any update.', 'success');

                closeApplyModal();
                applyForm.reset();
                uploadedCvBase64 = null;
                if (applySkillsSection) applySkillsSection.classList.add('hidden');
                if (applyQuestionsSection) applyQuestionsSection.classList.add('hidden');
            } catch (err) {
                console.error('Application submit error:', err);
                showNotification('Something went wrong while submitting. Please try again.', 'error');
            }
        });
    }

    // Announcement Banner Management
    function loadActiveAnnouncement() {
        if (!currentUser) {
            displayAnnouncement(null);
            return;
        }
        if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && typeof db !== 'undefined' && db) {
            db.collection('announcements').where('isActive', '==', true).limit(1).get()
                .then(snapshot => {
                    if (!currentUser) {
                        displayAnnouncement(null);
                        return;
                    }
                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        displayAnnouncement({ id: doc.id, ...doc.data() });
                    } else {
                        displayAnnouncement(null);
                    }
                })
                .catch(err => {
                    console.error('Error fetching announcement from firestore:', err);
                    if (currentUser) {
                        loadLocalActiveAnnouncement();
                    } else {
                        displayAnnouncement(null);
                    }
                });
        } else {
            loadLocalActiveAnnouncement();
        }
    }

    function loadLocalActiveAnnouncement() {
        if (!currentUser) {
            displayAnnouncement(null);
            return;
        }
        let announcements = [];
        try { announcements = JSON.parse(localStorage.getItem('client_announcements') || '[]'); } catch {}
        const active = announcements.find(a => a.isActive);
        if (active) {
            displayAnnouncement(active);
        } else {
            // Default recruitment announcement fallback
            const defaultAnn = {
                id: 'default_recruitment',
                text: 'We are hiring! Looking for Graphic Designers, Web Developers, and Programs Developers.',
                linkText: 'Apply Now',
                linkUrl: '#apply',
                isActive: true,
                isRecruitment: true
            };
            displayAnnouncement(defaultAnn);
        }
    }

    function displayAnnouncement(ann) {
        const announcementBanner = document.getElementById('announcement-banner');
        const bannerText = document.getElementById('banner-text');
        const bannerActionBtn = document.getElementById('banner-action-btn');
        const closeBannerBtn = document.getElementById('close-banner');

        if (!ann || !announcementBanner) {
            if (announcementBanner) announcementBanner.style.display = 'none';
            document.body.classList.remove('has-announcement');
            return;
        }

        // Check if dismissed in this session
        if (sessionStorage.getItem('dismissed_announcement_' + ann.id) === '1') {
            announcementBanner.style.display = 'none';
            document.body.classList.remove('has-announcement');
            return;
        }

        if (bannerText) bannerText.textContent = ann.text;
        
        if (ann.linkText && bannerActionBtn) {
            bannerActionBtn.textContent = ann.linkText + ' →';
            bannerActionBtn.style.display = 'inline-block';
            
            // Set link action
            bannerActionBtn.onclick = (e) => {
                e.preventDefault();
                if (ann.isRecruitment || ann.linkUrl === '#apply') {
                    openApplyModal();
                } else if (ann.linkUrl) {
                    window.open(ann.linkUrl, '_blank');
                }
            };
        } else if (bannerActionBtn) {
            bannerActionBtn.style.display = 'none';
        }

        announcementBanner.style.display = 'flex';
        document.body.classList.add('has-announcement');

        // Dismiss handler
        if (closeBannerBtn) {
            closeBannerBtn.onclick = () => {
                sessionStorage.setItem('dismissed_announcement_' + ann.id, '1');
                announcementBanner.style.opacity = '0';
                announcementBanner.style.transform = 'translateY(-100%)';
                setTimeout(() => {
                    announcementBanner.style.display = 'none';
                    announcementBanner.style.opacity = '';
                    announcementBanner.style.transform = '';
                    document.body.classList.remove('has-announcement');
                }, 400);
            };
        }
    }

    // Call banner initializer after initialization
    setTimeout(loadActiveAnnouncement, 500);

    /* ==========================================================================
       CUSTOM MOBILE BOTTOM NAVIGATION & DRAWER SYSTEM
       ========================================================================== */
    function initMobileNav() {
        const mobileNavBar = document.querySelector('.mobile-nav-bar');
        const mobileIndicator = document.querySelector('.mobile-nav-indicator');
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
        const mobileDrawer = document.getElementById('mobile-drawer');
        const mobileDrawerOverlay = document.getElementById('mobile-drawer-overlay');
        const mobileDrawerClose = document.getElementById('mobile-drawer-close');
        const mobileDrawerApplyBtn = document.getElementById('mobile-drawer-apply-btn');
        const mobileDrawerAuthBtn = document.getElementById('mobile-drawer-auth-btn');

        if (!mobileNavBar) return;

        // Position indicator initially and on resize
        setTimeout(updateMobileIndicator, 200);
        window.addEventListener('resize', updateMobileIndicator);

        // Expose update function globally inside script scope
        window.updateMobileIndicator = updateMobileIndicator;

        function updateMobileIndicator() {
            if (!mobileNavBar || !mobileIndicator) return;
            const activeItem = mobileNavBar.querySelector('.mobile-nav-item.active');
            if (activeItem) {
                const rect = activeItem.getBoundingClientRect();
                const parentRect = mobileNavBar.getBoundingClientRect();
                const left = rect.left - parentRect.left + (rect.width - mobileIndicator.offsetWidth) / 2;
                mobileIndicator.style.transform = `translateX(${left}px)`;
            }
        }

        // Click handlers for bottom nav items
        mobileNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const targetType = item.getAttribute('data-target');

                if (targetType === 'profile') {
                    e.preventDefault();
                    if (currentUser) {
                        if (typeof openProfileModal === 'function') openProfileModal();
                    } else {
                        if (typeof openAuthModal === 'function') openAuthModal();
                    }
                } else if (targetType === 'more') {
                    e.preventDefault();
                    openMobileDrawer();
                } else {
                    // Standard navigation (Now, Work, Team)
                    mobileNavItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    updateMobileIndicator();
                }
            });
        });

        // Drawer open/close functions
        function openMobileDrawer() {
            if (mobileDrawer && mobileDrawerOverlay) {
                mobileDrawerOverlay.classList.add('active');
                mobileDrawer.classList.add('drawer-open');
                document.body.style.overflow = 'hidden';
            }
        }

        function closeMobileDrawer() {
            if (mobileDrawer && mobileDrawerOverlay) {
                mobileDrawerOverlay.classList.remove('active');
                mobileDrawer.classList.remove('drawer-open');
                document.body.style.overflow = '';
            }
        }

        if (mobileDrawerClose) {
            mobileDrawerClose.addEventListener('click', closeMobileDrawer);
        }
        if (mobileDrawerOverlay) {
            mobileDrawerOverlay.addEventListener('click', closeMobileDrawer);
        }

        // Close drawer when links are clicked
        const drawerLinks = document.querySelectorAll('.drawer-link');
        drawerLinks.forEach(link => {
            link.addEventListener('click', () => {
                closeMobileDrawer();
                
                // Highlight the corresponding bottom nav item if applicable
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const targetName = href.substring(1);
                    const matchingNavItem = document.querySelector(`.mobile-nav-item[data-target="${targetName}"]`);
                    if (matchingNavItem) {
                        mobileNavItems.forEach(i => i.classList.remove('active'));
                        matchingNavItem.classList.add('active');
                        updateMobileIndicator();
                    }
                }
            });
        });

        // Special buttons inside the drawer
        if (mobileDrawerApplyBtn) {
            mobileDrawerApplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeMobileDrawer();
                const careersBtn = document.getElementById('menu-apply-btn');
                if (careersBtn) careersBtn.click();
            });
        }

        if (mobileDrawerAuthBtn) {
            mobileDrawerAuthBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeMobileDrawer();
                if (currentUser) {
                    if (typeof openProfileModal === 'function') openProfileModal();
                } else {
                    if (typeof openAuthModal === 'function') openAuthModal();
                }
            });
        }
    }

    // Initialize Mobile Navigation
    initMobileNav();

    // Handle URL redirects / query params on load
    const urlParams = new URLSearchParams(window.location.search);
    const openParam = urlParams.get('open');
    if (openParam === 'auth') {
        setTimeout(() => {
            if (typeof openAuthModal === 'function') openAuthModal();
        }, 600);
    } else if (openParam === 'careers') {
        setTimeout(() => {
            const careersBtn = document.getElementById('menu-apply-btn');
            if (careersBtn) careersBtn.click();
        }, 600);
    }

});


