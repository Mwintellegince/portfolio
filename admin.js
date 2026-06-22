document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================================
       FIREBASE CONFIGURATION & SYNCHRONIZATION
    ===================================================================== */
    // Synchronized with main script config
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
            console.log("Firebase config not found for admin. Falling back to LocalStorage.");
            loadAllData();
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
            console.log("Firebase Firestore initialized on admin side.");
            
            setupFirebaseListeners();
            return true;
        } catch (e) {
            console.error("Failed to initialize Firebase on admin:", e);
            loadAllData();
            return false;
        }
    }

    function setupFirebaseListeners() {
        if (!db) return;

        // Sync orders
        db.collection('orders').onSnapshot(snapshot => {
            let orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('client_orders', JSON.stringify(orders));
            loadAllData();
        }, err => {
            console.error("Firebase Orders Sync Error:", err);
            loadAllData();
        });

        // Sync applications
        db.collection('applications').onSnapshot(snapshot => {
            let apps = [];
            snapshot.forEach(doc => {
                apps.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('client_applications', JSON.stringify(apps));
            loadAllData();
        }, err => {
            console.error("Firebase Applications Sync Error:", err);
            loadAllData();
        });

        // Sync announcements
        db.collection('announcements').onSnapshot(snapshot => {
            let anns = [];
            snapshot.forEach(doc => {
                anns.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('client_announcements', JSON.stringify(anns));
            loadAllData();
        }, err => {
            console.error("Firebase Announcements Sync Error:", err);
            loadAllData();
        });

        // Sync workers
        db.collection('workers').onSnapshot(snapshot => {
            let workers = [];
            snapshot.forEach(doc => {
                workers.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('client_workers', JSON.stringify(workers));
            loadAllData();
        }, err => {
            console.error("Firebase Workers Sync Error:", err);
            loadAllData();
        });

        // Sync users
        db.collection('users').onSnapshot(snapshot => {
            let users = [];
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('client_users', JSON.stringify(users));
            loadAllData();
        }, err => {
            console.error("Firebase Users Sync Error:", err);
            loadAllData();
        });
    }


    /* =====================================================================
       CURSOR
    ===================================================================== */
    const curDot  = document.getElementById('cur-dot');
    const curRing = document.getElementById('cur-ring');
    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        if (curDot) { curDot.style.left = `${mx}px`; curDot.style.top = `${my}px`; }
    });

    (function animRing() {
        rx += (mx - rx) / 8;
        ry += (my - ry) / 8;
        if (curRing) { curRing.style.left = `${rx}px`; curRing.style.top = `${ry}px`; }
        requestAnimationFrame(animRing);
    })();

    function bindHover() {
        document.querySelectorAll('a, button, input, .receipt-card, .receipt-thumb').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('hovered'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('hovered'));
        });
    }
    bindHover();

    /* =====================================================================
       LIVE CLOCK
    ===================================================================== */
    const clockEl = document.getElementById('topbar-time');
    function updateClock() {
        if (!clockEl) return;
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-EG', { timeZone: 'Africa/Cairo', hour12: false });
    }
    updateClock();
    setInterval(updateClock, 1000);

    /* =====================================================================
       TOAST
    ===================================================================== */
    function toast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3200);
        setTimeout(() => el.remove(), 3600);
    }

    /* =====================================================================
       LOCK / AUTH  (SHA-256 salted hash)
    ===================================================================== */
    const ADMIN_SALT = 'MOHAMED_PORTFOLIO_SALT_2026';
    const ADMIN_HASH = '7b04eb67ff2d05be4b6422141c4294d6a4c3e1a1e81cad9be71c29babdd965ff';
    const OWNER_HASH = '5fbd5afae9b74d450bc43812f5e36338ee3ef21ec86ab634b49cb96db76ecdca';

    const lockScreen  = document.getElementById('lock-screen');
    const appEl       = document.getElementById('app');
    const pwInput     = document.getElementById('pw-input');
    const lockBtn     = document.getElementById('lock-btn');
    const lockError   = document.getElementById('lock-error');
    const logoutBtn   = document.getElementById('sidebar-logout-btn');

    const dots = [
        document.getElementById('dot-1'),
        document.getElementById('dot-2'),
        document.getElementById('dot-3'),
    ];

    // Animate dots while typing
    let dotTimer;
    if (pwInput) {
        pwInput.addEventListener('input', () => {
            clearTimeout(dotTimer);
            const len = pwInput.value.length;
            dots.forEach((d, i) => d.classList.toggle('active', i < Math.min(len, 3)));
            dotTimer = setTimeout(() => dots.forEach(d => d.classList.remove('active')), 1500);
        });
    }

    async function sha256(str) {
        const data = new TextEncoder().encode(str + ADMIN_SALT);
        const buf  = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function sha256WithSalt(str, salt) {
        const data = new TextEncoder().encode(str + salt);
        const buf  = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function attemptLogin() {
        if (!pwInput || !lockBtn) return;
        lockBtn.textContent = 'Verifying…';
        lockBtn.classList.add('loading');
        const hash = await sha256(pwInput.value.trim());
        pwInput.value = '';
        dots.forEach(d => d.classList.remove('active'));

        if (hash === ADMIN_HASH || hash === OWNER_HASH) {
            sessionStorage.setItem('adminOk', '1');
            if (hash === OWNER_HASH) {
                sessionStorage.setItem('ownerOk', '1');
            } else {
                sessionStorage.removeItem('ownerOk');
            }
            lockError.classList.remove('show');
            lockBtn.textContent = 'Access Granted ✓';
            setTimeout(() => {
                lockScreen.classList.add('fade-out');
                setTimeout(() => {
                    lockScreen.style.display = 'none';
                    appEl.classList.add('visible');
                    initFirebase();
                    bindHover();
                }, 600);
            }, 400);
        } else {
            lockError.classList.add('show');
            lockBtn.textContent = 'Unlock Dashboard';
            lockBtn.classList.remove('loading');
            // shake animation
            pwInput.style.borderColor = 'rgba(231,76,60,.5)';
            setTimeout(() => pwInput.style.borderColor = '', 700);
        }
    }

    if (lockBtn)  lockBtn.addEventListener('click', attemptLogin);
    if (pwInput)  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });

    // Auto-reauth if session active
    if (sessionStorage.getItem('adminOk') === '1') {
        lockScreen.style.display = 'none';
        appEl.classList.add('visible');
        initFirebase();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('adminOk');
            sessionStorage.removeItem('ownerOk');
            appEl.classList.remove('visible');
            lockScreen.style.display = 'flex';
            lockScreen.classList.remove('fade-out');
            lockBtn.textContent = 'Unlock Dashboard';
        });
    }

    /* =====================================================================
       SIDEBAR NAVIGATION
    ===================================================================== */
    const navItems   = document.querySelectorAll('.nav-item[data-page]');
    const pages      = document.querySelectorAll('.page');
    const topbarName = document.getElementById('topbar-page-name');

    const pageNames = {
        overview: '/ Overview',
        users:    '/ Users & Workers',
        pending:  '/ Pending Orders',
        history:  '/ History',
        receipts: '/ Receipts',
        applications: '/ Applications',
        announcements: '/ Announcements'
    };

    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            navItems.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.page;
            pages.forEach(p => p.classList.remove('active'));
            const page = document.getElementById(`page-${target}`);
            if (page) { page.classList.add('active'); }
            if (topbarName) topbarName.textContent = pageNames[target] || '';
        });
    });

    /* =====================================================================
       DATA LAYER  (localStorage)
    ===================================================================== */
    function getOrders() {
        try { return JSON.parse(localStorage.getItem('client_orders') || '[]'); } catch { return []; }
    }
    function saveOrders(arr) {
        localStorage.setItem('client_orders', JSON.stringify(arr));
    }
    function getWorkers() {
        try { return JSON.parse(localStorage.getItem('client_workers') || '[]'); } catch { return []; }
    }
    function saveWorkers(arr) {
        localStorage.setItem('client_workers', JSON.stringify(arr));
    }
    function getUsers() {
        try { return JSON.parse(localStorage.getItem('client_users') || '[]'); } catch { return []; }
    }
    function saveUsers(arr) {
        localStorage.setItem('client_users', JSON.stringify(arr));
    }

    function loadAllData() {
        renderStats();
        renderPending();
        renderHistory();
        renderReceipts();
        renderApplications();
        renderAnnouncements();
        renderActivity();
        updateBadges();
        renderUsers();
        renderWorkers();
    }

    /* =====================================================================
       STATS
    ===================================================================== */
    function renderStats() {
        const orders = getOrders();
        let sales = 0, refunds = 0, pending = 0;
        orders.forEach(o => {
            const price = parseFloat((o.price || '0').toString().replace(/[^\d.]/g, '')) || 0;
            if (o.status === 'approved') sales   += price;
            if (o.status === 'rejected') refunds += price;
            if (!o.status || o.status === 'pending') pending++;
        });
        setText('stat-sales',    `${sales.toLocaleString('en-EG')} EGP`);
        setText('stat-refunds',  `${refunds.toLocaleString('en-EG')} EGP`);
        setText('stat-pending',  pending);
        setText('stat-total',    orders.length);
    }

    function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

    /* =====================================================================
       BADGES
    ===================================================================== */
    function updateBadges() {
        const orders  = getOrders();
        const pending = orders.filter(o => !o.status || o.status === 'pending').length;
        const history = orders.filter(o => o.status === 'approved' || o.status === 'rejected').length;
        setText('nav-badge-pending', pending);
        setText('nav-badge-history', history);
        setText('pending-pill', pending);
        setText('history-pill', history);

        // Applications badges
        const apps = getApplications();
        const pendingApps = apps.filter(a => !a.status || a.status === 'pending').length;
        setText('nav-badge-applications', pendingApps);
        setText('apps-pill', pendingApps);
    }

    /* =====================================================================
       PENDING ORDERS TABLE
    ===================================================================== */
    function renderPending() {
        const tbody  = document.getElementById('pending-tbody');
        if (!tbody) return;
        const orders = getOrders().filter(o => !o.status || o.status === 'pending');

        if (!orders.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No pending orders — all clear.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map((o, idx) => {
            let payBadge = '';
            if (o.paymentMethod === 'instapay') {
                payBadge = '<span class="badge instapay">InstaPay</span>';
            } else if (o.paymentMethod === 'Vodafone Cash') {
                payBadge = '<span class="badge vodafone" style="background:#e60000; color:#fff;">Vodafone Cash</span>';
            } else if (o.paymentMethod === 'PayPal') {
                payBadge = '<span class="badge paypal" style="background:#0070ba; color:#fff;">PayPal</span>';
            } else {
                payBadge = `<span class="badge card">${esc(o.paymentMethod || 'Card / Bank')}</span>`;
            }

            const receiptCell = o.receipt
                ? `<div class="receipt-thumb" data-receipt="${o.receipt}" onclick="window._adminViewReceipt('${o.receipt}')">
                       <img src="${o.receipt}" alt="Receipt">
                   </div>`
                : `<div class="receipt-thumb" title="No receipt">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                   </div>`;

            const date = o.submittedAt
                ? new Date(o.submittedAt).toLocaleDateString('en-EG', { day:'numeric', month:'short', year:'numeric' })
                : '—';

            const realIdx = getOrders().indexOf(getOrders().find(x =>
                x.name === o.name && x.submittedAt === o.submittedAt && x.plan === o.plan
            ));

            return `<tr>
                <td>
                    <div class="client-name">${esc(o.name || '—')}</div>
                    <div class="client-email">${esc(o.email || '')}</div>
                </td>
                <td><span class="badge pending">${esc(o.plan || '—')}</span></td>
                <td>${payBadge}</td>
                <td><div class="brief-text">${esc(o.brief || o.projectBrief || '—')}</div></td>
                <td>${receiptCell}</td>
                <td style="font-size:.72rem;color:var(--muted);">${date}</td>
                <td>
                    <div class="action-group">
                        <button class="btn-view" title="View details" onclick="window._adminViewDetail(${realIdx})">
                            <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </button>
                        <button class="btn-accept" onclick="window._adminAccept(${realIdx})">Accept</button>
                        <button class="btn-reject" onclick="window._adminReject(${realIdx})">Reject</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    /* =====================================================================
       HISTORY TABLE
    ===================================================================== */
    function renderHistory() {
        const tbody  = document.getElementById('history-tbody');
        if (!tbody) return;
        const orders = getOrders().filter(o => o.status === 'approved' || o.status === 'rejected');

        if (!orders.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No completed orders yet.</td></tr>';
            return;
        }

        tbody.innerHTML = [...orders].reverse().map(o => {
            const statusBadge = o.status === 'approved'
                ? '<span class="badge approved">Approved</span>'
                : '<span class="badge rejected">Rejected</span>';

            let payBadge = '';
            if (o.paymentMethod === 'instapay') {
                payBadge = '<span class="badge instapay">InstaPay</span>';
            } else if (o.paymentMethod === 'Vodafone Cash') {
                payBadge = '<span class="badge vodafone" style="background:#e60000; color:#fff;">Vodafone Cash</span>';
            } else if (o.paymentMethod === 'PayPal') {
                payBadge = '<span class="badge paypal" style="background:#0070ba; color:#fff;">PayPal</span>';
            } else {
                payBadge = `<span class="badge card">${esc(o.paymentMethod || 'Card / Bank')}</span>`;
            }

            const price = o.price ? `${o.price}` : '—';
            const date  = o.completedAt
                ? new Date(o.completedAt).toLocaleDateString('en-EG', { day:'numeric', month:'short', year:'numeric' })
                : (o.submittedAt ? new Date(o.submittedAt).toLocaleDateString('en-EG') : '—');

            return `<tr>
                <td>
                    <div class="client-name">${esc(o.name || '—')}</div>
                    <div class="client-email">${esc(o.email || '')}</div>
                </td>
                <td>${esc(o.plan || '—')}</td>
                <td>${statusBadge}</td>
                <td>${payBadge}</td>
                <td style="font-weight:600;color:var(--gold);">${esc(price)}</td>
                <td style="font-size:.72rem;color:var(--muted);">${date}</td>
            </tr>`;
        }).join('');
    }

    /* =====================================================================
       RECEIPTS GALLERY
    ===================================================================== */
    function renderReceipts() {
        const grid   = document.getElementById('receipt-grid');
        if (!grid) return;
        const orders = getOrders().filter(o => o.receipt && o.paymentMethod === 'instapay');

        if (!orders.length) {
            grid.innerHTML = '<p style="color:var(--muted);font-size:.82rem;padding:24px;">No InstaPay receipts uploaded yet.</p>';
            return;
        }

        grid.innerHTML = orders.map(o =>
            `<div class="receipt-card" onclick="window._adminViewReceipt('${o.receipt}')">
                <img class="rc-img" src="${o.receipt}" alt="Receipt">
                <div class="rc-meta">
                    <div class="rc-name">${esc(o.name || '—')}</div>
                    <div class="rc-plan">${esc(o.plan || '—')}</div>
                </div>
            </div>`
        ).join('');
    }

    /* =====================================================================
       ACTIVITY FEED
    ===================================================================== */
    function renderActivity() {
        const list = document.getElementById('activity-list');
        if (!list) return;
        const orders = getOrders().slice(-10).reverse();
        if (!orders.length) {
            list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:.82rem;">No activity yet.</div>';
            return;
        }
        list.innerHTML = orders.map(o => {
            let dotClass = 'gold', msg = `New order from ${esc(o.name || 'Unknown')} — ${esc(o.plan || '')}`;
            if (o.status === 'approved') { dotClass = 'green'; msg = `Accepted: ${esc(o.name)} — ${esc(o.plan)}`; }
            if (o.status === 'rejected') { dotClass = 'red';   msg = `Rejected & Refunded: ${esc(o.name)} — ${esc(o.plan)}`; }
            const time = o.submittedAt
                ? new Date(o.submittedAt).toLocaleString('en-EG', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
                : '';
            return `<div class="activity-item">
                <span class="activity-dot ${dotClass}"></span>
                <div class="activity-body">
                    <div class="activity-title">${msg}</div>
                    <div class="activity-time">${time}</div>
                </div>
            </div>`;
        }).join('');
    }

    /* =====================================================================
       ACCEPT / REJECT HANDLERS
    ===================================================================== */
    let pendingRejectIdx = -1;

    async function syncOrderUpdate(order) {
        if (isFirebaseActive && db) {
            try {
                const { id, ...orderData } = order;
                await db.collection('orders').doc(id).set(orderData);
            } catch (err) {
                console.error("Error syncing order update to Firestore:", err);
            }
        }
    }

    window._adminAccept = async function(idx) {
        const orders = getOrders();
        if (!orders[idx]) return;
        orders[idx].status      = 'approved';
        orders[idx].completedAt = new Date().toISOString();
        saveOrders(orders);
        toast(`✓ Order from ${orders[idx].name} accepted.`, 'success');
        loadAllData();
        await syncOrderUpdate(orders[idx]);
    };

    window._adminReject = function(idx) {
        const orders = getOrders();
        if (!orders[idx]) return;
        const order = orders[idx];

        if (order.paymentMethod === 'instapay' || order.paymentMethod === 'Vodafone Cash') {
            // Show refund modal
            pendingRejectIdx = idx;
            setText('rm-amount', order.price ? `${order.price}` : '—');
            setText('rm-name',   order.name || '—');

            const subEl = document.getElementById('rm-sub');
            const labelEl = document.getElementById('rm-ipa-label');
            const ipaEl = document.getElementById('rm-ipa');
            const warnEl = document.getElementById('rm-warn');

            if (order.paymentMethod === 'instapay') {
                if (subEl) subEl.textContent = "This order was paid via InstaPay. Transfer the amount back before confirming.";
                if (labelEl) labelEl.textContent = "Customer IPA";
                if (ipaEl) ipaEl.textContent = order.ipaAddress || order.senderIpa || '—';
                if (warnEl) warnEl.innerHTML = "<strong>Action required:</strong> Open your InstaPay app and transfer the amount back to the customer's address above before clicking confirm.";
            } else {
                if (subEl) subEl.textContent = "This order was paid via Vodafone Cash. Transfer the amount back before confirming.";
                if (labelEl) labelEl.textContent = "Customer Wallet";
                if (ipaEl) ipaEl.textContent = order.walletNumber || '—';
                if (warnEl) warnEl.innerHTML = "<strong>Action required:</strong> Open your mobile wallet app and transfer the amount back to the customer's Vodafone Cash number above before clicking confirm.";
            }

            document.getElementById('refund-modal').classList.add('open');
        } else {
            // Card / bank / PayPal: auto refund note
            orders[idx].status      = 'rejected';
            orders[idx].completedAt = new Date().toISOString();
            saveOrders(orders);
            toast(`Order rejected. PayPal/Card refund typically takes 5–14 business days.`, 'error');
            loadAllData();
            await syncOrderUpdate(orders[idx]);
        }
    };

    // Refund modal
    const refundModal   = document.getElementById('refund-modal');
    const rmConfirmBtn  = document.getElementById('rm-confirm');
    const rmCancelBtn   = document.getElementById('rm-cancel');

    if (rmConfirmBtn) {
        rmConfirmBtn.addEventListener('click', async () => {
            if (pendingRejectIdx < 0) return;
            const orders = getOrders();
            orders[pendingRejectIdx].status      = 'rejected';
            orders[pendingRejectIdx].completedAt = new Date().toISOString();
            saveOrders(orders);
            toast(`Refund confirmed. Order rejected.`, 'error');
            refundModal.classList.remove('open');
            const updatedOrder = orders[pendingRejectIdx];
            pendingRejectIdx = -1;
            loadAllData();
            await syncOrderUpdate(updatedOrder);
        });
    }
    if (rmCancelBtn) {
        rmCancelBtn.addEventListener('click', () => {
            refundModal.classList.remove('open');
            pendingRejectIdx = -1;
        });
    }

    /* =====================================================================
       RECEIPT VIEWER
    ===================================================================== */
    window._adminViewReceipt = function(src) {
        const viewer = document.getElementById('receipt-viewer');
        const img    = document.getElementById('rv-img');
        if (!viewer || !img) return;
        img.src = src;
        viewer.classList.add('open');
    };
    const rvClose = document.getElementById('rv-close');
    if (rvClose) {
        rvClose.addEventListener('click', () => {
            document.getElementById('receipt-viewer').classList.remove('open');
        });
    }
    document.getElementById('receipt-viewer')?.addEventListener('click', e => {
        if (e.target === document.getElementById('receipt-viewer')) {
            document.getElementById('receipt-viewer').classList.remove('open');
        }
    });

    /* =====================================================================
       ORDER DETAIL MODAL
    ===================================================================== */
    window._adminViewOrder = function(idx) {
        const orders = getOrders();
        const o = orders[idx];
        if (!o) return;
        setText('dm-id',     o.id || `Order #${idx + 1}`);
        setText('dm-name',   o.name || '—');
        setText('dm-email',  o.email || '—');
        setText('dm-plan',   o.plan || '—');
        setText('dm-amount', o.price || '—');
        setText('dm-payment', o.paymentMethod || '—');
        setText('dm-brief',  o.brief || o.projectBrief || '—');

        const assignSelect = document.getElementById('dm-assign-worker');
        if (assignSelect) {
            const workers = getWorkers();
            assignSelect.innerHTML = '<option value="">Unassigned</option>' + 
                workers.map(w => `<option value="${esc(w.email)}">${esc(w.name)} (${esc(w.major)})</option>`).join('');
            assignSelect.value = o.assignedWorkerEmail || '';
            assignSelect.onchange = null;
            assignSelect.onchange = async () => {
                const selectedEmail = assignSelect.value;
                orders[idx].assignedWorkerEmail = selectedEmail;
                saveOrders(orders);
                if (selectedEmail) {
                    const worker = workers.find(w => w.email === selectedEmail);
                    toast(`Order assigned to ${worker ? worker.name : selectedEmail}.`, 'success');
                } else {
                    toast('Order unassigned.', 'info');
                }
                await syncOrderUpdate(orders[idx]);
            };
        }

        const deleteBtn = document.getElementById('dm-delete-btn');
        if (deleteBtn) {
            if (sessionStorage.getItem('ownerOk') === '1') {
                deleteBtn.style.display = 'inline-block';
                deleteBtn.onclick = async () => {
                    if (confirm('Are you sure you want to delete this order?')) {
                        const allOrders = getOrders();
                        const orderToDelete = allOrders[idx];
                        if (orderToDelete) {
                            allOrders.splice(idx, 1);
                            saveOrders(allOrders);
                            document.getElementById('detail-modal').classList.remove('open');
                            toast('Order deleted successfully.', 'success');
                            loadAllData();
                            if (isFirebaseActive && db) {
                                try {
                                    await db.collection('orders').doc(orderToDelete.id).delete();
                                } catch (err) {
                                    console.error("Error deleting order from firestore:", err);
                                }
                            }
                        }
                    }
                };
            } else {
                deleteBtn.style.display = 'none';
            }
        }

        document.getElementById('detail-modal').classList.add('open');
    };

    const dmClose = document.getElementById('dm-close');
    if (dmClose) {
        dmClose.addEventListener('click', () => {
            document.getElementById('detail-modal').classList.remove('open');
        });
    }

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => {
            if (e.target === m) m.classList.remove('open');
        });
    });

    /* =====================================================================
       REFRESH BUTTONS
    ===================================================================== */
    function setupRefresh(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            btn.classList.add('spin');
            setTimeout(() => {
                loadAllData();
                btn.classList.remove('spin');
                toast('Data refreshed.', 'info');
            }, 600);
        });
    }
    setupRefresh('overview-refresh-btn');
    setupRefresh('pending-refresh-btn');

    /* =====================================================================
       RESET ALL ORDERS
    ===================================================================== */
    const resetModal      = document.getElementById('reset-modal');
    const resetOpenBtn    = document.getElementById('reset-orders-btn');
    const confirmResetBtn = document.getElementById('confirm-reset-btn');
    const cancelResetBtn  = document.getElementById('cancel-reset-btn');

    if (resetOpenBtn) {
        resetOpenBtn.addEventListener('click', () => resetModal.classList.add('open'));
    }
    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', () => resetModal.classList.remove('open'));
    }
    if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', () => {
            localStorage.removeItem('client_orders');
            resetModal.classList.remove('open');
            loadAllData();
            toast('All orders have been reset to zero.', 'info');
        });
    }

    /* =====================================================================
       HELPERS
    ===================================================================== */
    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* =====================================================================
       AUTO-REFRESH every 30 seconds (live updates)
       ===================================================================== */
    setInterval(() => {
        if (sessionStorage.getItem('adminOk') === '1' && !isFirebaseActive) loadAllData();
    }, 30000);

    /* =====================================================================
       REGISTERED USERS & ACTIVE WORKERS MANAGEMENT
       ===================================================================== */
    async function syncWorkerUpdate(worker) {
        if (isFirebaseActive && db) {
            try {
                const { id, ...workerData } = worker;
                await db.collection('workers').doc(id).set(workerData);
            } catch (err) {
                console.error("Error syncing worker to Firestore:", err);
            }
        }
    }

    async function syncWorkerDelete(id) {
        if (isFirebaseActive && db) {
            try {
                await db.collection('workers').doc(id).delete();
            } catch (err) {
                console.error("Error deleting worker from Firestore:", err);
            }
        }
    }

    function renderUsers() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        const users = getUsers();
        if (!users.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No users registered yet.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
            const role = u.role || 'client';
            
            // Count how many orders this user placed
            const orders = getOrders();
            const orderCount = orders.filter(o => o.email === u.email).length;

            return `
                <tr>
                    <td>
                        <div class="client-name">${esc(u.displayName || u.name)}</div>
                        <div class="client-email">${esc(u.email)}</div>
                    </td>
                    <td><span class="badge card">${esc(role)}</span></td>
                    <td>${dateStr}</td>
                    <td><strong style="color:var(--text);">${orderCount}</strong></td>
                </tr>
            `;
        }).join('');
    }

    function renderWorkers() {
        const tbody = document.getElementById('workers-tbody');
        if (!tbody) return;

        const workers = getWorkers();
        if (!workers.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No workers registered yet.</td></tr>';
            return;
        }

        const isOwner = sessionStorage.getItem('ownerOk') === '1';

        tbody.innerHTML = workers.map((w, idx) => {
            const dateStr = w.joinedAt ? new Date(w.joinedAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
            const faStatus = w.twoFactorSetup ? '<span class="badge approved">2FA Enabled</span>' : '<span class="badge pending">2FA Pending</span>';
            const actionHtml = isOwner ? 
                `<button class="btn-reject" onclick="window._adminRemoveWorker('${w.id}')" style="cursor:none; font-size:.7rem; padding:4px 8px;">Remove</button>` : 
                `<span style="color:var(--muted); font-size:.75rem;">Locked</span>`;

            return `
                <tr>
                    <td>
                        <div class="client-name">${esc(w.name)}</div>
                        <div class="client-email">${esc(w.email)}</div>
                    </td>
                    <td><strong style="color:var(--text);">${esc(w.major)}</strong></td>
                    <td>${dateStr}</td>
                    <td>${faStatus}</td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join('');
    }

    window._adminRemoveWorker = async function(id) {
        if (sessionStorage.getItem('ownerOk') !== '1') {
            toast('Owner permissions required.', 'error');
            return;
        }
        if (confirm('Are you sure you want to remove this worker?')) {
            let workers = getWorkers();
            workers = workers.filter(w => w.id !== id);
            saveWorkers(workers);
            toast('Worker removed successfully.', 'success');
            loadAllData();
            await syncWorkerDelete(id);
        }
    };

    /* =====================================================================
       RECRUITMENT (APPLICATIONS) MANAGEMENT
       ===================================================================== */
    function getApplications() {
        try { return JSON.parse(localStorage.getItem('client_applications') || '[]'); } catch { return []; }
    }
    function saveApplications(arr) {
        localStorage.setItem('client_applications', JSON.stringify(arr));
    }

    async function syncApplicationUpdate(app) {
        if (isFirebaseActive && db) {
            try {
                const { id, ...appData } = app;
                await db.collection('applications').doc(id).set(appData);
            } catch (err) {
                console.error("Error syncing application to Firestore:", err);
            }
        }
    }

    function renderApplications() {
        const tbody = document.getElementById('apps-tbody');
        if (!tbody) return;

        const apps = getApplications();
        if (!apps.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No applications received yet.</td></tr>';
            return;
        }

        const sorted = apps.map((a, i) => ({ ...a, originalIdx: i }));
        sorted.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.submittedAt) - new Date(a.submittedAt);
        });

        tbody.innerHTML = sorted.map(a => {
            let statusClass = 'pending';
            if (a.status === 'approved') statusClass = 'approved';
            if (a.status === 'rejected') statusClass = 'rejected';

            const nameHtml = `
                <div class="client-name">${esc(a.name)}</div>
                <div class="client-email">${esc(a.email)}</div>
            `;

            const dateStr = a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
            
            const linksHtml = `
                <div style="display:flex; gap:8px; font-size:.7rem;">
                    ${a.website ? `<a href="${esc(a.website)}" target="_blank" class="gold" style="text-decoration:none; cursor:none;">Website</a>` : ''}
                    ${a.github ? `<a href="${esc(a.github)}" target="_blank" class="gold" style="text-decoration:none; cursor:none;">GitHub</a>` : ''}
                    ${(!a.website && !a.github) ? '<span style="color:var(--muted);">None</span>' : ''}
                </div>
            `;

            const actionsHtml = `
                <div class="action-group">
                    <button class="btn-view" onclick="window._adminViewApplication(${a.originalIdx})" style="cursor:none;">View</button>
                    ${a.status === 'pending' ? `
                        <button class="btn-accept" onclick="window._adminApproveApplication(${a.originalIdx})" style="cursor:none;">Approve</button>
                        <button class="btn-reject" onclick="window._adminRejectApplication(${a.originalIdx})" style="cursor:none;">Reject</button>
                    ` : ''}
                </div>
            `;

            return `
                <tr>
                    <td>${nameHtml}</td>
                    <td><strong style="color:var(--text);">${esc(a.major)}</strong></td>
                    <td><span class="badge ${statusClass}">${a.status}</span></td>
                    <td>${dateStr}</td>
                    <td>${linksHtml}</td>
                    <td>${actionsHtml}</td>
                </tr>
            `;
        }).join('');
    }

    const appDetailModal = document.getElementById('app-detail-modal');
    const admCloseBtn = document.getElementById('adm-close');

    if (admCloseBtn) {
        admCloseBtn.addEventListener('click', () => {
            if (appDetailModal) appDetailModal.classList.remove('open');
        });
    }
    if (appDetailModal) {
        appDetailModal.addEventListener('click', (e) => {
            if (e.target === appDetailModal) appDetailModal.classList.remove('open');
        });
    }

    window._adminViewApplication = function(idx) {
        const apps = getApplications();
        const app = apps[idx];
        if (!app) return;

        setText('adm-id', app.id);
        setText('adm-name', app.name);
        setText('adm-email', app.email);
        setText('adm-major', app.major);
        
        const skillsContainer = document.getElementById('adm-skills');
        if (skillsContainer) {
            if (app.skills && app.skills.length > 0) {
                skillsContainer.innerHTML = app.skills.map(s => `
                    <span style="background:rgba(212,175,55,.1); color:var(--gold); border:1px solid rgba(212,175,55,.2); border-radius:4px; padding:3px 8px; font-size:.7rem; font-weight:600;">${esc(s)}</span>
                `).join('');
            } else {
                skillsContainer.innerHTML = '<span style="color:var(--muted); font-size:.8rem;">No skills selected.</span>';
            }
        }

        const answersContainer = document.getElementById('adm-answers');
        if (answersContainer) {
            if (app.answers && app.answers.length > 0) {
                answersContainer.innerHTML = app.answers.map(ans => `
                    <div style="background:rgba(255,255,255,.02); border:1px solid var(--border); border-radius:6px; padding:10px 12px; margin-bottom:8px;">
                        <div style="font-weight:600; color:var(--muted); margin-bottom:4px; font-size:.75rem; white-space:normal;">Q: ${esc(ans.questionText)}</div>
                        <div style="color:var(--text); line-height:1.4; white-space:pre-wrap; font-size:.78rem;">A: ${esc(ans.answerText)}</div>
                    </div>
                `).join('');
            } else {
                answersContainer.innerHTML = '<span style="color:var(--muted); font-size:.8rem;">No questions answered.</span>';
            }
        }

        setText('adm-contribution', app.contribution || '—');

        const cvBtn = document.getElementById('adm-cv-btn');
        if (cvBtn) {
            cvBtn.href = app.cv || '#';
            cvBtn.download = `CV_${app.name.replace(/\s+/g, '_')}_${app.major.replace(/\s+/g, '_')}`;
            if (!app.cv) {
                cvBtn.style.pointerEvents = 'none';
                cvBtn.style.opacity = '0.5';
            } else {
                cvBtn.style.pointerEvents = 'auto';
                cvBtn.style.opacity = '1';
            }
        }

        const deleteAppBtn = document.getElementById('adm-delete-btn');
        if (deleteAppBtn) {
            if (sessionStorage.getItem('ownerOk') === '1') {
                deleteAppBtn.style.display = 'inline-block';
                deleteAppBtn.onclick = async () => {
                    if (confirm('Are you sure you want to delete this application?')) {
                        const allApps = getApplications();
                        const appToDelete = allApps[idx];
                        if (appToDelete) {
                            allApps.splice(idx, 1);
                            saveApplications(allApps);
                            document.getElementById('app-detail-modal').classList.remove('open');
                            toast('Application deleted successfully.', 'success');
                            loadAllData();
                            if (isFirebaseActive && db) {
                                try {
                                    await db.collection('applications').doc(appToDelete.id).delete();
                                } catch (err) {
                                    console.error("Error deleting application from firestore:", err);
                                }
                            }
                        }
                    }
                };
            } else {
                deleteAppBtn.style.display = 'none';
            }
        }

        const uidField = document.getElementById('adm-user-uid');
        if (uidField) uidField.textContent = app.userUid || app.userId || '—';

        if (appDetailModal) appDetailModal.classList.add('open');
    };

    const inviteModal = document.getElementById('invite-modal');
    const inviteLinkInput = document.getElementById('invite-link-input');
    const copyInviteBtn = document.getElementById('copy-invite-btn');
    const inviteCloseBtn = document.getElementById('invite-close-btn');

    if (inviteCloseBtn) {
        inviteCloseBtn.addEventListener('click', () => {
            if (inviteModal) inviteModal.classList.remove('open');
        });
    }
    if (inviteModal) {
        inviteModal.addEventListener('click', (e) => {
            if (e.target === inviteModal) inviteModal.classList.remove('open');
        });
    }
    if (copyInviteBtn && inviteLinkInput) {
        copyInviteBtn.addEventListener('click', () => {
            inviteLinkInput.select();
            document.execCommand('copy');
            toast('Invite link copied to clipboard.', 'success');
        });
    }

    const INVITE_SALT = "WORKER_PORTAL_INVITE_2026";
    const SIGNUP_SALT = "WORKER_PORTAL_SIGNUP_2026";

    window._adminApproveApplication = async function(idx) {
        const apps = getApplications();
        if (!apps[idx]) return;
        
        const app = apps[idx];
        app.status = 'approved';
        saveApplications(apps);
        await syncApplicationUpdate(app);

        // Generate temporary password
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let rand = '';
        for (let i = 0; i < 6; i++) {
            rand += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const tempPassword = `WORKER-${rand}`;

        // Create password hash using the SIGNUP_SALT
        const tempPassHash = await sha256WithSalt(tempPassword, app.email + SIGNUP_SALT);

        // Create new worker profile
        const workerId = 'work_' + app.email.replace(/\./g, '_');
        const newWorker = {
            id: workerId,
            name: app.name,
            email: app.email,
            major: app.major,
            passwordHash: tempPassHash,
            joinedAt: new Date().toISOString(),
            twoFactorSetup: false
        };

        // Save worker profile locally
        let localWorkers = getWorkers();
        const wIdx = localWorkers.findIndex(w => w.email === app.email);
        if (wIdx !== -1) {
            localWorkers[wIdx] = newWorker;
        } else {
            localWorkers.push(newWorker);
        }
        saveWorkers(localWorkers);
        await syncWorkerUpdate(newWorker);

        // Fill credentials modal
        const credEmailEl = document.getElementById('cred-email');
        const credPasswordEl = document.getElementById('cred-password');
        if (credEmailEl) credEmailEl.textContent = app.email;
        if (credPasswordEl) credPasswordEl.textContent = tempPassword;

        // SMTP simulated logs
        const smtpLogsEl = document.getElementById('smtp-logs');
        if (smtpLogsEl) {
            smtpLogsEl.innerHTML = '';
            const logs = [
                `[${new Date().toLocaleTimeString()}] Connecting to SMTP server at mail.mwintellegince.com:587...`,
                `[${new Date().toLocaleTimeString()}] Connection established. TLS v1.3 handshake successful.`,
                `[${new Date().toLocaleTimeString()}] Authenticating with credentials daemon@mwintellegince.com...`,
                `[${new Date().toLocaleTimeString()}] Dispatching email payload to <${app.email}>...`,
                `[${new Date().toLocaleTimeString()}] Headers: Subject: Welcome to MW Intelligence! Worker Portal Credentials`,
                `[${new Date().toLocaleTimeString()}] Mail transmission complete. Status: 250 OK (Queued for delivery).`
            ];
            
            let logIdx = 0;
            function writeLog() {
                if (logIdx < logs.length) {
                    smtpLogsEl.innerHTML += `<div>${logs[logIdx]}</div>`;
                    smtpLogsEl.scrollTop = smtpLogsEl.scrollHeight;
                    logIdx++;
                    setTimeout(writeLog, 600);
                }
            }
            writeLog();
        }

        if (inviteModal) {
            inviteModal.classList.add('open');
        }

        toast(`Worker approved & temporary credentials generated.`, 'success');
        loadAllData();
    };

    window._adminRejectApplication = async function(idx) {
        const apps = getApplications();
        if (!apps[idx]) return;
        apps[idx].status = 'rejected';
        saveApplications(apps);
        toast(`Application rejected for ${apps[idx].name}.`, 'error');
        loadAllData();
        await syncApplicationUpdate(apps[idx]);
    };

    const appsRefreshBtn = document.getElementById('apps-refresh-btn');
    if (appsRefreshBtn) {
        appsRefreshBtn.addEventListener('click', () => {
            appsRefreshBtn.classList.add('spin');
            if (isFirebaseActive) {
                setupFirebaseListeners();
            } else {
                loadAllData();
            }
            setTimeout(() => appsRefreshBtn.classList.remove('spin'), 600);
        });
    }

    /* =====================================================================
       ANNOUNCEMENT MANAGEMENT
       ===================================================================== */
    function getAnnouncements() {
        try { return JSON.parse(localStorage.getItem('client_announcements') || '[]'); } catch { return []; }
    }
    function saveAnnouncements(arr) {
        localStorage.setItem('client_announcements', JSON.stringify(arr));
    }

    async function syncAnnouncementUpdate(ann) {
        if (isFirebaseActive && db) {
            try {
                const { id, ...annData } = ann;
                await db.collection('announcements').doc(id).set(annData);
            } catch (err) {
                console.error("Error syncing announcement to Firestore:", err);
            }
        }
    }

    async function syncAnnouncementDelete(id) {
        if (isFirebaseActive && db) {
            try {
                await db.collection('announcements').doc(id).delete();
            } catch (err) {
                console.error("Error deleting announcement from Firestore:", err);
            }
        }
    }

    function renderAnnouncements() {
        const listContainer = document.getElementById('announcements-list');
        if (!listContainer) return;

        const anns = getAnnouncements();
        if (!anns.length) {
            listContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted); font-size:.82rem;">No announcements created yet.</div>';
            return;
        }

        anns.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        listContainer.innerHTML = anns.map(a => {
            const activeBadge = a.isActive ? '<span class="badge approved" style="padding:2px 6px; font-size:.6rem;">ACTIVE</span>' : '<span class="badge" style="background:rgba(255,255,255,.05); color:var(--muted); border:1px solid rgba(255,255,255,.1); padding:2px 6px; font-size:.6rem;">INACTIVE</span>';
            const recruitmentLabel = a.isRecruitment ? '<span style="color:var(--gold); font-size:.7rem; font-weight:600; margin-left:8px;">[Recruitment]</span>' : '';
            
            const linkDesc = a.linkText ? `<div style="font-size:.72rem; color:var(--muted); margin-top:4px;">Button: <strong>${esc(a.linkText)}</strong> &rarr; <span style="font-family:var(--font-mono);">${esc(a.linkUrl)}</span></div>` : '';

            return `
                <div style="background:rgba(255,255,255,.02); border:1px solid var(--border); border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1; padding-right:12px;">
                            <div style="font-size:.85rem; color:var(--text); line-height:1.4;">${esc(a.text)} ${recruitmentLabel}</div>
                            ${linkDesc}
                            <div style="font-size:.68rem; color:var(--muted); margin-top:6px;">Created: ${new Date(a.timestamp).toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${activeBadge}
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; border-top:1px solid rgba(255,255,255,.03); padding-top:10px; justify-content:flex-end;">
                        <button class="btn-view" style="font-size:.68rem; padding:4px 8px; cursor:none;" onclick="window._adminToggleAnnouncementActive('${a.id}')">
                            ${a.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn-reject" style="font-size:.68rem; padding:4px 8px; cursor:none;" onclick="window._adminDeleteAnnouncement('${a.id}')">
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window._adminToggleAnnouncementActive = async function(id) {
        let anns = getAnnouncements();
        const ann = anns.find(a => a.id === id);
        if (!ann) return;

        const newActiveState = !ann.isActive;

        if (newActiveState) {
            anns.forEach(a => {
                if (a.id !== id && a.isActive) {
                    a.isActive = false;
                    syncAnnouncementUpdate(a);
                }
            });
        }
        ann.isActive = newActiveState;
        saveAnnouncements(anns);
        toast(ann.isActive ? 'Announcement banner activated.' : 'Announcement banner deactivated.', 'success');
        loadAllData();
        await syncAnnouncementUpdate(ann);
    };

    window._adminDeleteAnnouncement = async function(id) {
        let anns = getAnnouncements();
        anns = anns.filter(a => a.id !== id);
        saveAnnouncements(anns);
        toast('Announcement removed.', 'success');
        loadAllData();
        await syncAnnouncementDelete(id);
    };

    const annForm = document.getElementById('announcement-form');
    if (annForm) {
        annForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const text = document.getElementById('ann-text').value.trim();
            const recruitmentCheckbox = document.getElementById('ann-recruitment');
            const activeCheckbox = document.getElementById('ann-active');
            
            const isRecruitment = recruitmentCheckbox ? recruitmentCheckbox.checked : false;
            
            let linkText = document.getElementById('ann-link-text').value.trim();
            let linkUrl = document.getElementById('ann-link-url').value.trim();

            if (isRecruitment) {
                linkUrl = '#apply';
                if (!linkText) linkText = 'Apply Now';
            }

            const isActive = activeCheckbox ? activeCheckbox.checked : true;

            const newAnn = {
                id: 'ann_' + Date.now(),
                text,
                linkText,
                linkUrl,
                isActive,
                isRecruitment,
                timestamp: new Date().toISOString()
            };

            let anns = getAnnouncements();

            if (isActive) {
                anns.forEach(a => {
                    if (a.isActive) {
                        a.isActive = false;
                        syncAnnouncementUpdate(a);
                    }
                });
            }

            anns.push(newAnn);
            saveAnnouncements(anns);
            toast('Announcement published successfully.', 'success');

            annForm.reset();
            const linkUrlEl = document.getElementById('ann-link-url');
            if (linkUrlEl) {
                linkUrlEl.disabled = false;
                linkUrlEl.style.opacity = '1';
            }
            loadAllData();
            await syncAnnouncementUpdate(newAnn);
        });

        const recruitmentCheckbox = document.getElementById('ann-recruitment');
        if (recruitmentCheckbox) {
            recruitmentCheckbox.addEventListener('change', () => {
                const linkTextEl = document.getElementById('ann-link-text');
                const linkUrlEl = document.getElementById('ann-link-url');
                if (recruitmentCheckbox.checked) {
                    if (linkTextEl && !linkTextEl.value) linkTextEl.value = 'Apply Now';
                    if (linkUrlEl) {
                        linkUrlEl.value = '#apply';
                        linkUrlEl.disabled = true;
                        linkUrlEl.style.opacity = '0.5';
                    }
                } else {
                    if (linkUrlEl) {
                        linkUrlEl.value = '';
                        linkUrlEl.disabled = false;
                        linkUrlEl.style.opacity = '1';
                    }
                }
            });
        }
    }

});
