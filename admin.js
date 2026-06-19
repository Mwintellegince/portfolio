document.addEventListener('DOMContentLoaded', () => {


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

    async function attemptLogin() {
        if (!pwInput || !lockBtn) return;
        lockBtn.textContent = 'Verifying…';
        lockBtn.classList.add('loading');
        const hash = await sha256(pwInput.value.trim());
        pwInput.value = '';
        dots.forEach(d => d.classList.remove('active'));

        if (hash === ADMIN_HASH) {
            sessionStorage.setItem('adminOk', '1');
            lockError.classList.remove('show');
            lockBtn.textContent = 'Access Granted ✓';
            setTimeout(() => {
                lockScreen.classList.add('fade-out');
                setTimeout(() => {
                    lockScreen.style.display = 'none';
                    appEl.classList.add('visible');
                    loadAllData();
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
        loadAllData();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('adminOk');
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
        pending:  '/ Pending Orders',
        history:  '/ History',
        receipts: '/ Receipts',
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

    function loadAllData() {
        renderStats();
        renderPending();
        renderHistory();
        renderReceipts();
        renderActivity();
        updateBadges();
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

    window._adminAccept = function(idx) {
        const orders = getOrders();
        if (!orders[idx]) return;
        orders[idx].status      = 'approved';
        orders[idx].completedAt = new Date().toISOString();
        saveOrders(orders);
        toast(`✓ Order from ${orders[idx].name} accepted.`, 'success');
        loadAllData();
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
        }
    };

    // Refund modal
    const refundModal   = document.getElementById('refund-modal');
    const rmConfirmBtn  = document.getElementById('rm-confirm');
    const rmCancelBtn   = document.getElementById('rm-cancel');

    if (rmConfirmBtn) {
        rmConfirmBtn.addEventListener('click', () => {
            if (pendingRejectIdx < 0) return;
            const orders = getOrders();
            orders[pendingRejectIdx].status      = 'rejected';
            orders[pendingRejectIdx].completedAt = new Date().toISOString();
            saveOrders(orders);
            toast(`Refund confirmed. Order rejected.`, 'error');
            refundModal.classList.remove('open');
            pendingRejectIdx = -1;
            loadAllData();
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
    window._adminViewDetail = function(idx) {
        const orders = getOrders();
        const o = orders[idx];
        if (!o) return;
        setText('dm-id',     `Order #${idx + 1}`);
        setText('dm-name',   o.name || '—');
        setText('dm-email',  o.email || '—');
        setText('dm-plan',   o.plan || '—');
        setText('dm-amount', o.price || '—');
        setText('dm-payment', o.paymentMethod || '—');
        setText('dm-brief',  o.brief || o.projectBrief || '—');
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
        if (sessionStorage.getItem('adminOk') === '1') loadAllData();
    }, 30000);

});
