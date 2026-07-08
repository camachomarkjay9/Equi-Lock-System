let trendsChart;
let selectedDay = null;
let reservationData = {};

function showAlert(message, type = 'info') {
    return new Promise(resolve => {
        const icons = {
            info: { icon: 'fa-circle-info', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
            success: { icon: 'fa-circle-check', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
            error: { icon: 'fa-circle-xmark', color: '#dc2626', bg: '#fff1f2', border: '#fecaca' },
            warning: { icon: 'fa-triangle-exclamation', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        };
        const t = icons[type] || icons.info;
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:99998;display:flex;align-items:center;justify-content:center;padding:24px;';
        const box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:20px;padding:32px 28px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:\'Plus Jakarta Sans\',sans-serif;border:1px solid ' + t.border + ';';
        box.innerHTML =
            '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="width:52px;height:52px;background:' + t.bg + ';border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;border:1.5px solid ' + t.border + ';">' +
            '<i class="fas ' + t.icon + '" style="font-size:22px;color:' + t.color + ';"></i></div>' +
            '<p style="font-size:14px;font-weight:600;color:#334155;line-height:1.5;margin:0;">' + message + '</p></div>' +
            '<button id="alert-ok-btn" style="width:100%;padding:12px;background:' + t.color + ';color:white;border:none;border-radius:12px;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">OK</button>';
        backdrop.appendChild(box);
        document.body.appendChild(backdrop);
        const close = () => {
            backdrop.remove();
            resolve();
        };
        box.querySelector('#alert-ok-btn').onclick = close;
        backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
    });
}

function showConfirm(message, opts = {}) {
    const confirmText = opts.confirmText || 'Confirm';
    const cancelText = opts.cancelText || 'Cancel';
    const type = opts.type || 'warning';
    return new Promise(resolve => {
        const icons = {
            warning: { icon: 'fa-triangle-exclamation', color: '#d97706', bg: '#fffbeb', border: '#fde68a', btn: '#d97706' },
            danger: { icon: 'fa-trash', color: '#dc2626', bg: '#fff1f2', border: '#fecaca', btn: '#dc2626' },
            info: { icon: 'fa-circle-info', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', btn: '#2563eb' },
        };
        const t = icons[type] || icons.warning;
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:99998;display:flex;align-items:center;justify-content:center;padding:24px;';
        const box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:20px;padding:32px 28px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:\'Plus Jakarta Sans\',sans-serif;border:1px solid ' + t.border + ';';
        box.innerHTML =
            '<div style="text-align:center;margin-bottom:24px;">' +
            '<div style="width:52px;height:52px;background:' + t.bg + ';border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;border:1.5px solid ' + t.border + ';">' +
            '<i class="fas ' + t.icon + '" style="font-size:22px;color:' + t.color + ';"></i></div>' +
            '<p style="font-size:14px;font-weight:600;color:#334155;line-height:1.5;margin:0;">' + message + '</p></div>' +
            '<div style="display:flex;gap:10px;">' +
            '<button id="confirm-cancel-btn" style="flex:1;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">' + cancelText + '</button>' +
            '<button id="confirm-ok-btn"     style="flex:1;padding:12px;background:' + t.btn + ';color:white;border:none;border-radius:12px;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">' + confirmText + '</button>' +
            '</div>';
        backdrop.appendChild(box);
        document.body.appendChild(backdrop);
        const close = (r) => {
            backdrop.remove();
            resolve(r);
        };
        box.querySelector('#confirm-ok-btn').onclick = () => close(true);
        box.querySelector('#confirm-cancel-btn').onclick = () => close(false);
        backdrop.onclick = (e) => { if (e.target === backdrop) close(false); };
    });
}

async function confirmLogout() {
    const confirmed = await showConfirm(
        'Are you sure you want to logout?', { confirmText: 'Logout', cancelText: 'Cancel', type: 'warning' }
    );
    if (confirmed) window.location.href = '/logout';
}

function toggleSidebar() {
    const sidebar = document.querySelector('aside');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }
}

function closeSidebar() {
    document.querySelector('aside').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function showSection(id) {
    ['overview', 'transactions', 'management', 'reservations', 'settings', 'admin-accounts'].forEach(s => {
        const sec = document.getElementById('section-' + s);
        const btn = document.getElementById('btn-' + s);
        if (sec) sec.classList.add('section-hidden');
        if (btn) {
            btn.classList.remove('active', 'text-white');
            btn.classList.add('text-slate-400');
        }
    });
    document.getElementById('section-' + id).classList.remove('section-hidden');
    document.getElementById('btn-' + id).classList.add('active', 'text-white');
    document.getElementById('btn-' + id).classList.remove('text-slate-400');
    if (id === 'management') updateManagement();
    else if (id === 'reservations') fetchReservations();
    else if (id === 'overview') updateDashboard();
    else if (id === 'settings') loadAdminKioskID();
    else if (id === 'admin-accounts') loadAdminAccounts();

    
    closeSidebar();
}

function handleSettingAction(msg) {
    showAlert(msg, 'info');
}

async function updateReportsAlerts() {
    try {
        const res = await fetch('/api/item_reports');
        const reports = await res.json();

        
        const active = reports;

        const section = document.getElementById('reports-alert-section');
        const container = document.getElementById('reports-cards-container');
        const badge = document.getElementById('reports-count-badge');

        if (!active || active.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        badge.textContent = active.length;

        
        const openStates = {};
        container.querySelectorAll('.report-card[data-label]').forEach(card => {
            const details = card.querySelector('.report-details');
            if (details) {
                openStates[card.dataset.label] = details.style.display !== 'none';
            }
        });

        
        const missing = active.filter(r => r.report_types.includes('no_item'));
        const damaged = active.filter(r => !r.report_types.includes('no_item'));

        let html = '';
        missing.forEach(r => { html += buildReportCard(r, 'missing'); });
        damaged.forEach(r => { html += buildReportCard(r, 'damage'); });

        container.innerHTML = html;

        
        container.querySelectorAll('.report-card[data-label]').forEach(card => {
            const lbl = card.dataset.label;
            const details = card.querySelector('.report-details');
            const arrow = card.querySelector('.report-arrow');
            
            const shouldBeOpen = openStates[lbl] !== undefined ? openStates[lbl] : (details && details.style.display !== 'none');
            if (details) details.style.display = shouldBeOpen ? 'block' : 'none';
            if (arrow) arrow.style.transform = shouldBeOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        
        container.querySelectorAll('.dismiss-report-btn').forEach(btn => {
            btn.addEventListener('click', async(e) => {
                e.stopPropagation();
                const reportId = btn.dataset.id;
                const label = btn.dataset.label;
                const confirmed = await showConfirm(
                    `Delete the report for <b>${label}</b>?<br><span style="font-size:12px;color:#94a3b8;">This will permanently remove the report.</span>`, { confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' }
                );
                if (!confirmed) return;
                const card = btn.closest('.report-card');
                try {
                    await fetch('/api/item_reports/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ report_id: parseInt(reportId) })
                    });
                } catch (err) { console.error('Delete error:', err); }
                if (card) {
                    card.style.transition = 'opacity 0.3s, transform 0.3s';
                    card.style.opacity = '0';
                    card.style.transform = 'translateX(30px)';
                    setTimeout(() => updateReportsAlerts(), 350);
                }
            });
        });

        
        container.querySelectorAll('.report-card').forEach(card => {
            card.addEventListener('click', () => {
                const details = card.querySelector('.report-details');
                if (!details) return;
                const isOpen = details.style.display !== 'none';
                details.style.display = isOpen ? 'none' : 'block';
                const arrow = card.querySelector('.report-arrow');
                if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            });
        });

    } catch (e) {
        console.error('Reports alert error:', e);
    }
}

function buildReportCard(r, type) {
    const isMissing = type === 'missing';

    
    const typeLabels = {
        'no_item': '⚠️ Missing',
        'physical_damage': '🔧 Physical Damage',
        'not_working': '⚡ Not Working'
    };
    const typeTagsHtml = r.report_types.map(t =>
        `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
            t === 'no_item' ? 'bg-red-100 text-red-700' :
            t === 'physical_damage' ? 'bg-orange-100 text-orange-700' :
            'bg-yellow-100 text-yellow-700'
        }">${typeLabels[t] || t}</span>`
    ).join(' ');

    const reportedAtRaw = r.reported_at || r.report_time || null;
    const reportTime = reportedAtRaw && reportedAtRaw !== '---' ?
        (() => {
            const d = new Date(reportedAtRaw.trim().replace(' ', 'T'));
            return isNaN(d) ? reportedAtRaw : d.toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toUpperCase();
        })() :
        '---';

    const lastBorrowTime = r.last_borrow_time && r.last_borrow_time !== '---' ?
        (() => {
            const d = new Date(r.last_borrow_time.trim().replace(' ', 'T'));
            return isNaN(d) ? r.last_borrow_time : d.toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toUpperCase();
        })() :
        '---';

    if (isMissing) {
        
        return `
        <div class="report-card cursor-pointer rounded-2xl border-2 border-red-300 bg-red-50 shadow-md overflow-hidden"
             data-label="${r.equipment_label}" style="transition: box-shadow 0.2s;">
            <div class="flex items-center justify-between px-6 py-4 bg-red-500">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🚨</span>
                    <div>
                        <p class="text-white font-black text-base uppercase tracking-wide">MISSING EQUIPMENT</p>
                        <p class="text-red-100 font-bold text-sm">${r.equipment_label}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <svg class="report-arrow w-5 h-5 text-white transition-transform duration-200" style="transform:rotate(180deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </div>
            <div class="report-details px-6 py-5 space-y-3">
                <div class="flex flex-wrap gap-2 mb-2">${typeTagsHtml}</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="bg-white rounded-xl p-3 border border-red-100">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reported By</p>
                        <p class="font-bold text-slate-800 text-sm">${r.reported_by_name || r.reported_by || 'Unknown'}</p>
                        <p class="text-xs text-slate-400">${r.reported_by_id || ''}</p>
                    </div>
                    <div class="bg-white rounded-xl p-3 border border-red-100">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Report Time</p>
                        <p class="font-bold text-slate-700 text-sm">${reportTime}</p>
                    </div>
                    <div class="bg-white rounded-xl p-3 border border-red-100">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Borrower</p>
                        <p class="font-bold text-slate-800 text-sm">${r.last_borrower || 'No borrow record'}</p>
                    </div>
                    <div class="bg-white rounded-xl p-3 border border-red-100">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Borrow Time</p>
                        <p class="font-bold text-slate-700 text-sm">${lastBorrowTime}</p>
                    </div>
                </div>
            </div>
        </div>`;
    } else {
        
        const bgColor = r.report_types.includes('physical_damage') ? 'orange' : 'yellow';
        const headerBg = bgColor === 'orange' ? 'bg-orange-500' : 'bg-yellow-500';
        const borderColor = bgColor === 'orange' ? 'border-orange-300' : 'border-yellow-300';
        const bgLight = bgColor === 'orange' ? 'bg-orange-50' : 'bg-yellow-50';
        const detailBorder = bgColor === 'orange' ? 'border-orange-100' : 'border-yellow-100';

        return `
        <div class="report-card cursor-pointer rounded-2xl border-2 ${borderColor} ${bgLight} shadow-sm overflow-hidden"
             data-label="${r.equipment_label}" style="transition: box-shadow 0.2s;">
            <div class="flex items-center justify-between px-5 py-3 ${headerBg}">
                <div class="flex items-center gap-3">
                    <span class="text-lg">${r.report_types.includes('physical_damage') ? '🔧' : '⚡'}</span>
                    <div>
                        <p class="text-white font-black text-sm uppercase tracking-wide">${r.report_types.includes('physical_damage') && r.report_types.includes('not_working') ? 'Damaged & Not Working' : r.report_types.includes('physical_damage') ? 'Physical Damage' : 'Not Working'}</p>
                        <p class="text-white/80 font-semibold text-xs">${r.equipment_label}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <svg class="report-arrow w-4 h-4 text-white transition-transform duration-200" style="transform:rotate(0deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
                </div>
            </div>
            <div class="report-details px-5 py-4 space-y-2" style="display:none;">
                <div class="flex flex-wrap gap-2 mb-2">${typeTagsHtml}</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div class="bg-white rounded-xl p-3 border ${detailBorder}">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reported By</p>
                        <p class="font-bold text-slate-800 text-sm">${r.reported_by_name || r.reported_by || 'Unknown'}</p>
                        <p class="text-xs text-slate-400">${r.reported_by_id || ''}</p>
                    </div>
                    <div class="bg-white rounded-xl p-3 border ${detailBorder}">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Report Time</p>
                        <p class="font-bold text-slate-700 text-sm">${reportTime}</p>
                    </div>
                    <div class="bg-white rounded-xl p-3 border ${detailBorder}">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Borrower</p>
                        <p class="font-bold text-slate-800 text-sm">${r.last_borrower || 'No borrow record'}</p>
                    </div>
                    <div class="bg-white rounded-xl p-3 border ${detailBorder}">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Borrow Time</p>
                        <p class="font-bold text-slate-700 text-sm">${lastBorrowTime}</p>
                    </div>
                </div>
            </div>
        </div>`;
    }
}

async function updateDashboard() {
    try {
        const filterElement = document.getElementById('timeFilter');
        const period = filterElement ? filterElement.value : 'today';

        
        updateReportsAlerts();

        const statsRes = await fetch(`/api/stats?period=${period}`);
        const stats = await statsRes.json();

        document.getElementById('stat-visits').innerText = stats.visits || 0;
        document.getElementById('stat-borrowed').innerText = stats.borrowed || 0;
        document.getElementById('stat-returned').innerText = stats.returned || 0;
        document.getElementById('stat-overdue').innerText = stats.overdue || 0;

        
        try {
            const usersRes = await fetch('/api/management/data');
            const usersData = await usersRes.json();
            const users = usersData.users || [];
            const totalUsers = users.length;
            const students = users.filter(u => u.role === 'Student').length;
            const faculty = users.filter(u => u.role === 'Faculty').length;
            document.getElementById('stat-total-users').innerText = totalUsers;
            document.getElementById('stat-users-breakdown').innerText = `${students} Students · ${faculty} Faculty`;
        } catch (e) {  }

        
        const topList = document.getElementById('most-borrowed-list');
        try {
            const allTimeRes = await fetch('/api/stats?period=all');
            const allTimeStats = await allTimeRes.json();
            const topItems = allTimeStats.top_items || [];
            if (topItems.length > 0) {
                const rankColors = ['bg-yellow-500', 'bg-slate-400', 'bg-amber-700'];
                topList.innerHTML = topItems.map((item, idx) => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 ${rankColors[idx] || 'bg-blue-600'} text-white rounded-lg flex items-center justify-center text-[10px] font-black">${idx + 1}</div>
                        <span class="text-sm font-bold text-slate-700">${item.name}</span>
                    </div>
                    <span class="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">${item.count}x</span>
                </div>`).join('');
            } else {
                topList.innerHTML = '<div class="text-center text-slate-400 text-xs py-8">No usage data yet</div>';
            }
        } catch (e) {
            topList.innerHTML = '<div class="text-center text-slate-400 text-xs py-8">No usage data yet</div>';
        }

        const trxs = await (await fetch(`/api/transactions?period=${period}`)).json();
        const tableBody = document.getElementById('transaction-table-body');
        tableBody.innerHTML = '';

        let lastDate = "";

        trxs.forEach(t => {
                    const currentDate = t.borrow_time && t.borrow_time !== "---" ?
                        new Date(t.borrow_time.replace(/-/g, "/")).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        }) : "Unknown Date";

                    const formatTime = (dateStr) => {
                        if (!dateStr || dateStr === "---" || dateStr === "In Use") return dateStr;
                        const d = new Date(dateStr.replace(/-/g, "/"));
                        return d.toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        }).toUpperCase();
                    };

                    if (currentDate !== lastDate) {
                        tableBody.innerHTML += `
                <tr class="bg-blue-50"> 
                    <td colspan="7" class="px-8 py-1.5 text-[11px] font-extrabold text-blue-700 uppercase tracking-wider border-y border-blue-100/50">
                        ${currentDate}
                    </td>
                </tr>`;
                        lastDate = currentDate;
                    }

                    tableBody.innerHTML += `
            <tr class="hover:bg-blue-50/30 border-b border-slate-50">
                <td class="px-8 py-4 font-bold text-sm text-slate-700">${t.user_name}</td>
                <td class="px-8 py-4 text-blue-600 font-semibold text-sm">${t.equipment_label}</td>
                <td class="px-8 py-4 text-slate-500 text-xs font-medium">${formatTime(t.borrow_time)}</td>
                <td class="px-8 py-4 text-slate-500 text-xs font-medium">${formatTime(t.return_time)}</td>
                <td class="px-8 py-4 text-slate-600 text-xs font-medium">
                    ${(() => {
                        const totalMinutes = parseInt(t.duration) || 0;
                        const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
                        const mins = (totalMinutes % 60).toString().padStart(2, '0');
                        return `${hours}:${mins}`;
                    })()}
                </td>
                <td class="px-8 py-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.color_class} bg-slate-50 border border-current/10">
                        ${t.calculated_status}
                    </span>
                </td>
                <td class="px-8 py-4 text-[10px] font-medium ${t.report.toLowerCase().includes('no') ? 'text-red-500 font-bold' : 'text-slate-400'}">
                    ${t.report}
                </td>
            </tr>`;
        });

        
        const trxSearch = document.getElementById('trx-search');
        if (trxSearch && trxSearch.value.trim()) {
            filterRows('trx-search', 'transaction-table-body');
        }

        
        const recentBody = document.getElementById('recent-transactions-body');
        if (recentBody) {
            const recent = trxs.slice(0, 8);
            if (recent.length === 0) {
                recentBody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 text-xs italic">No transactions yet</td></tr>';
            } else {
                const formatTimeShort = (dateStr) => {
                    if (!dateStr || dateStr === "---" || dateStr === "In Use") return dateStr || '—';
                    const d = new Date(dateStr.replace(/-/g, "/"));
                    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
                };
                recentBody.innerHTML = recent.map(t => `
                    <tr class="hover:bg-blue-50/30">
                        <td class="px-6 py-3 font-bold text-sm text-slate-700">${t.user_name}</td>
                        <td class="px-6 py-3 text-blue-600 font-semibold text-sm">${t.equipment_label}</td>
                        <td class="px-6 py-3 text-slate-400 text-xs">${formatTimeShort(t.borrow_time)}</td>
                        <td class="px-6 py-3">
                            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.color_class} bg-slate-50 border border-current/10">${t.calculated_status}</span>
                        </td>
                    </tr>`).join('');
            }
        }

        const chartRes = await fetch(`/api/analytics?period=${period}`);
        const chart = await chartRes.json();
        
        const borrowMap = {};
        const returnMap = {};
        (chart.labels || []).forEach((lbl, i) => {
            borrowMap[lbl] = (chart.borrowData || [])[i] || 0;
            returnMap[lbl] = (chart.returnData || [])[i] || 0;
        });
        const last10Labels = [];
        const last10Borrow = [];
        const last10Return = [];
        
        const toLocalKey = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        for (let i = 9; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = toLocalKey(d);
            const shortLbl = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            last10Labels.push(shortLbl);
            last10Borrow.push(borrowMap[key] || 0);
            last10Return.push(returnMap[key] || 0);
        }
        trendsChart.data.labels = last10Labels;
        trendsChart.data.datasets[0].data = last10Borrow;
        trendsChart.data.datasets[1].data = last10Return;
        trendsChart.update();

    } catch (e) {
        console.log("Dashboard sync error:", e);
    }

    
    fetchDashboardReports();
}

async function fetchReservations() {
    try {
        const res = await fetch('/api/reservations/list');
        reservationData = await res.json();
        initCalendar();
    } catch (err) {
        console.error("Error fetching reservations:", err);
    }
}

function initCalendar() {
    const isMobile = window.matchMedia('(max-width: 1024px)').matches;
    if (isMobile) {
        initCalendarList();
    } else {
        initCalendarGrid();
    }
}

function initCalendarGrid() {
    const grid = document.getElementById('calendar-grid');
    const now = new Date();

    const currentTime = now.getHours().toString().padStart(2, '0') + ":" +
        now.getMinutes().toString().padStart(2, '0');

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const todayDay = now.getDate().toString().padStart(2, '0');
    const todayKey = `${year}-${month}-${todayDay}`;

    document.getElementById('calendar-month').innerText = now.toLocaleString('default', {
        month: 'long',
        year: 'numeric'
    });

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) grid.innerHTML += '<div></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = d.toString().padStart(2, '0');
        const dateKey = `${year}-${month}-${dayStr}`;

        const daily = reservationData[dateKey] || [];

        const resHtml = daily.map(r => {
            const isEnded = dateKey < todayKey || (dateKey === todayKey && r.end < currentTime);

            const badgeClass = isEnded
                ? "bg-slate-100 text-slate-400 border border-slate-200"
                : "bg-orange-500 text-white shadow-sm";

            return `
                <div class="res-badge group ${badgeClass}" 
                     data-date="${dateKey}" data-id="${r.id}"
                     style="margin-bottom: 2px; padding: 4px 6px; border-radius: 6px; font-size: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
                     onclick="event.stopPropagation(); handleResBadgeClick(event, '${dateKey}', ${r.id})">
                    <span class="truncate">
                        <i class="fa-solid fa-box-open mr-1"></i> <b>${r.equip}</b> 
                        <span class="${isEnded ? 'opacity-60' : 'opacity-90'} font-semibold">| End: ${r.end}</span>
                    </span>
                    <div class="res-actions flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <i onclick="event.stopPropagation(); openEditReservation(event, '${dateKey}', ${r.id})" class="fas fa-edit hover:text-yellow-300 cursor-pointer"></i>
                        <i onclick="event.stopPropagation(); deleteReservation(event, ${r.id})" class="fas fa-times hover:text-red-300 cursor-pointer"></i>
                    </div>
                </div>`;
        }).join('');

        const isPastDay = dateKey < todayKey;
        grid.innerHTML += `
        <div ${isPastDay ? '' : `onclick="openReserveModal(${d})"`}
             class="calendar-day bg-white rounded-xl p-2 flex flex-col border border-slate-100 transition-colors
             ${isPastDay ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-300 cursor-pointer'}">
            <span class="text-xs font-bold text-slate-400 mb-1">${d}</span>
            <div class="flex-1 overflow-y-auto">${resHtml}</div>
        </div>`;
    }
}

function initCalendarList() {
    const listEl = document.getElementById('calendar-list');
    const now = new Date();

    const currentTime = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const todayDay = now.getDate().toString().padStart(2, '0');
    const todayKey = `${year}-${month}-${todayDay}`;
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();

    document.getElementById('calendar-month').innerText = now.toLocaleString('default', {
        month: 'long', year: 'numeric'
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = '';

    for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = d.toString().padStart(2, '0');
        const dateKey = `${year}-${month}-${dayStr}`;
        const dayOfWeek = new Date(year, now.getMonth(), d).getDay();
        const isToday = dateKey === todayKey;
        const isPast = dateKey < todayKey;
        const daily = reservationData[dateKey] || [];

        
        

        const dateLabel = `${dayNames[dayOfWeek]}, ${now.toLocaleString('default', { month: 'short' })} ${d}`;

        const todayBorder = isToday ? 'border-l-4 border-l-blue-500' : isPast ? 'border-l-4 border-l-slate-200' : 'border-l-4 border-l-emerald-400';
        const dateLabelColor = isToday ? 'text-blue-600 font-black' : isPast ? 'text-slate-400 font-bold' : 'text-slate-700 font-bold';
        const todayBadge = isToday ? '<span style="font-size:9px;background:#2563eb;color:white;padding:2px 8px;border-radius:99px;margin-left:8px;font-weight:800;letter-spacing:0.05em;">TODAY</span>' : '';

        let resRows = '';

        if (daily.length === 0) {
            resRows = `<p style="font-size:11px;color:#cbd5e1;padding:6px 0 2px;font-style:italic;">No reservations</p>`;
        } else {
            resRows = daily.map(r => {
                const isEnded = isPast || (isToday && r.end < currentTime);
                const pillBg = isEnded ? '#f1f5f9' : '#fff7ed';
                const pillColor = isEnded ? '#94a3b8' : '#c2410c';
                const pillBorder = isEnded ? '#e2e8f0' : '#fed7aa';
                const iconColor = isEnded ? '#cbd5e1' : '#f97316';

                return `
                <div onclick="handleResBadgeClick(event, '${dateKey}', ${r.id})"
                     style="display:flex;align-items:center;justify-content:space-between;
                            padding:10px 12px;margin-bottom:6px;border-radius:10px;
                            background:${pillBg};border:1px solid ${pillBorder};cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                        <i class="fas fa-box-open" style="color:${iconColor};font-size:13px;flex-shrink:0;"></i>
                        <div style="min-width:0;">
                            <div style="font-size:13px;font-weight:700;color:${pillColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${r.equip}
                            </div>
                            <div style="font-size:10px;color:#94a3b8;margin-top:1px;">
                                ${r.name} &nbsp;·&nbsp; ${r.start} – ${r.end}
                            </div>
                        </div>
                    </div>
                    <i class="fas fa-ellipsis-v" style="color:#cbd5e1;font-size:13px;flex-shrink:0;margin-left:8px;"></i>
                </div>`;
            }).join('');
        }

        html += `
        <div style="margin-bottom:6px;background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,0.07);"
             class="${todayBorder}">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 6px;"
                 ${isPast ? '' : `onclick="openReserveModal(${d})"`}>
                <span style="font-size:13px;" class="${dateLabelColor}">${dateLabel}${todayBadge}</span>
                ${isPast
                    ? `<span style="background:#f1f5f9;border:1px solid #e2e8f0;color:#cbd5e1;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:not-allowed;">
                        <i class="fas fa-lock" style="margin-right:4px;"></i>Past
                       </span>`
                    : `<button style="background:#f0f9ff;border:1px solid #bfdbfe;color:#2563eb;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;">
                        <i class="fas fa-plus" style="margin-right:4px;"></i>Add
                       </button>`
                }
            </div>
            <div style="padding:0 14px 10px;">
                ${resRows}
            </div>
        </div>`;
    }

    listEl.innerHTML = html;
}

let cachedUsers = [];

function closeNameSuggestions() {
    const dd = document.getElementById('name-suggestions-dropdown');
    if (dd) dd.classList.add('hidden');
}

async function handleNameInput(val) {
    const dropdown = document.getElementById('name-suggestions-dropdown');

    if (!val || val.length < 1) {
        closeNameSuggestions();
        return;
    }

    if (cachedUsers.length === 0) {
        const res = await fetch('/api/management/data');
        const data = await res.json();
        cachedUsers = data.users;
    }

    const matches = cachedUsers.filter(u =>
        u.name.toLowerCase().includes(val.toLowerCase())
    );

    if (matches.length === 0) {
        closeNameSuggestions();
        return;
    }

    
    const highlight = (text, query) => {
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return text.slice(0, idx) +
            '<span style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 2px;">' +
            text.slice(idx, idx + query.length) +
            '</span>' +
            text.slice(idx + query.length);
    };

    const roleColors = {
        'Student': { bg: '#eff6ff', color: '#2563eb' },
        'Faculty': { bg: '#f0fdf4', color: '#16a34a' },
    };

    dropdown.innerHTML = matches.map(u => {
        const rc = roleColors[u.role] || { bg: '#f8fafc', color: '#64748b' };
        return `
        <div onmousedown="event.preventDefault(); selectUserName('${u.name.replace(/'/g, "\\'")}')"
            style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background 0.15s;"
            onmouseover="this.style.background='#f8faff'" onmouseout="this.style.background='white'">
            <div style="width:34px;height:34px;border-radius:50%;background:${rc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-user" style="font-size:13px;color:${rc.color};"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${highlight(u.name, val)}
                </div>
                <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;color:#94a3b8;margin-top:1px;">
                    ID: ${u.id}
                </div>
            </div>
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:9px;font-weight:800;text-transform:uppercase;background:${rc.bg};color:${rc.color};padding:2px 8px;border-radius:20px;flex-shrink:0;">
                ${u.role}
            </span>
        </div>`;
    }).join('');

    dropdown.classList.remove('hidden');
}

function selectUserName(name) {
    document.getElementById('r_name').value = name;
    closeNameSuggestions();
}

async function openReserveModal(day, editId = null) {
    selectedDay = day;

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const todayKey = `${year}-${month}-${now.getDate().toString().padStart(2, '0')}`;
    const dateKey = `${year}-${month}-${dayStr}`;

    
    if (dateKey < todayKey) return;

    document.getElementById('edit-res-id').value = editId || "";

    document.getElementById('reserve-date-display').innerText =
        `${now.toLocaleString('default', { month: 'long' })} ${day}, ${year}`;

    
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const res = await fetch(`/api/management/data?date_key=${dateKey}&current_time=${currentTime}`);
    const data = await res.json();

    
    
    let currentEquipName = "";
    if (editId) {
        const dailyReservations = reservationData[dateKey] || [];
        const existingRes = dailyReservations.find(x => x.id === parseInt(editId));
        if (existingRes) currentEquipName = existingRes.equip;
    }

    const statusLabel = {
        'Borrowed':                                 'Borrowed',
        'Missing':                                  'Missing',
        'Reserved':                                 'Reserved',
        'In Vault - Physical Damage':               'Physical Damage',
        'In Vault - Not Working':                   'Not Working',
        'In Vault - Physical Damage & Not Working': 'Damage & Not Working',
        'Locked':                                   'Locked',
    };

    document.getElementById('r_equip').innerHTML = '<option value="">Select Equipment</option>' +
        data.equipment.map(e => {
            
            const isAvailable = e.status === 'In Vault' || e.name === currentEquipName;
            const reason = statusLabel[e.status] || e.status;
            const label = isAvailable ? e.name : `${e.name} — ${reason}`;
            return `<option value="${e.name}" ${isAvailable ? '' : 'disabled'} style="${isAvailable ? '' : 'color:#94a3b8;'}">${label}</option>`;
        }).join('');

    if (!editId) {
        document.getElementById('r_name').value = "";
        document.getElementById('r_equip').value = "";
        document.getElementById('r_start').value = "";
        document.getElementById('r_end').value = "";
    }

    
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.classList.add('hidden');
        deleteBtn.dataset.resId = '';
    }

    document.getElementById('reserveModal').classList.remove('hidden');
}

async function openEditReservation(event, dateKey, resId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const day = parseInt(dateKey.split('-')[2]);
    const dailyData = reservationData[dateKey];

    if (!dailyData) return console.error("No data for this date:", dateKey);

    const res = dailyData.find(x => x.id === parseInt(resId));
    if (!res) return console.error("Reservation not found:", resId);

    await openReserveModal(day, resId);

    document.getElementById('r_name').value = res.name;
    document.getElementById('r_equip').value = res.equip;
    document.getElementById('r_start').value = res.start;
    document.getElementById('r_end').value = res.end;

    
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
        const isMobile = window.matchMedia('(max-width: 1024px)').matches;
        if (!isMobile) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.dataset.resId = resId;
        }
    }
}

async function saveReservation() {
    const equipVal = document.getElementById('r_equip').value;
    if (!equipVal) {
        await showAlert('Please select an equipment before saving.', 'warning');
        return;
    }
    const now = new Date();
    const payload = {
        res_id: document.getElementById('edit-res-id').value,
        date_key: `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`,
        name: document.getElementById('r_name').value,
        equip: equipVal,
        start: document.getElementById('r_start').value,
        end: document.getElementById('r_end').value
    };
    await fetch('/api/reservations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    closeReserveModal();
    fetchReservations();
}

async function deleteReservation(event, id) {
    event.stopPropagation();
    const confirmed = await showConfirm("Delete this reservation?", { confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' });
    if (confirmed) {
        await fetch('/api/reservations/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        fetchReservations();
    }
}

function closeReserveModal() {
    document.getElementById('reserveModal').classList.add('hidden');
    closeNameSuggestions();
    
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.classList.add('hidden');
        deleteBtn.dataset.resId = '';
    }
}

async function deleteReservationFromModal() {
    const deleteBtn = document.getElementById('modal-delete-btn');
    const id = deleteBtn ? parseInt(deleteBtn.dataset.resId) : null;
    if (!id) return;
    const confirmed = await showConfirm("Delete this reservation?", { confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' });
    if (confirmed) {
        await fetch('/api/reservations/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        closeReserveModal();
        fetchReservations();
    }
}

function handleResBadgeClick(event, dateKey, resId) {
    event.preventDefault();
    event.stopPropagation();

    const isMobile = window.matchMedia('(max-width: 1024px)').matches;

    if (!isMobile) {
        
        openEditReservation(null, dateKey, resId);
        return;
    }

    
    closeResBadgeMenu();

    const backdrop = document.createElement('div');
    backdrop.id = 'res-context-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:9998;';
    backdrop.onclick = closeResBadgeMenu;

    const menu = document.createElement('div');
    menu.id = 'res-context-menu';
    menu.style.cssText = [
        'position:fixed', 'bottom:0', 'left:0', 'right:0',
        'background:white', 'border-radius:20px 20px 0 0',
        'box-shadow:0 -4px 24px rgba(0,0,0,0.18)', 'z-index:9999',
        'padding:20px 24px 40px'
    ].join(';');
    menu.innerHTML = `
        <div style="width:40px;height:4px;background:#e2e8f0;border-radius:4px;margin:0 auto 20px;"></div>
        <p style="font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;color:#64748b;margin-bottom:16px;text-align:center;">Reservation Options</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button onclick="closeResBadgeMenu(); openEditReservation(null, '${dateKey}', ${resId})"
                style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#b45309;cursor:pointer;width:100%;">
                <i class="fas fa-edit"></i> Edit Reservation
            </button>
            <button onclick="closeResBadgeMenu(); deleteReservationById(${resId})"
                style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#fff1f2;border:1.5px solid #fca5a5;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#dc2626;cursor:pointer;width:100%;">
                <i class="fas fa-trash"></i> Delete Reservation
            </button>
        </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
}

function closeResBadgeMenu() {
    const menu = document.getElementById('res-context-menu');
    const backdrop = document.getElementById('res-context-backdrop');
    if (menu) menu.remove();
    if (backdrop) backdrop.remove();
}

async function deleteReservationById(id) {
    const confirmed = await showConfirm("Delete this reservation?", { confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' });
    if (confirmed) {
        await fetch('/api/reservations/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        fetchReservations();
    }
}

async function updateManagement() {
    try {
        const [res, labelsRes] = await Promise.all([
            fetch('/api/management/data'),
            fetch('/api/equipment/labels')
        ]);
        const data = await res.json();
        window._equipLabels = await labelsRes.json();

        document.getElementById('user-table-body').innerHTML = data.users.map(u => {
            let banButton = "";
            if (u.status === 'Banned') {
                banButton = `
                    <button onclick="unbanUser('${u.id}')" title="Unban User" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                        <i class="fas fa-unlock"></i>
                    </button>`;
            } else {
                banButton = `
                    <button onclick="openBanModal('${u.id}', '${u.name}', '${u.ban_start || ''}', '${u.ban_end || ''}')" title="Apply Ban" class="p-2 text-orange-500 hover:bg-orange-50 rounded-lg">
                        <i class="fas fa-user-slash"></i>
                    </button>`;
            }

            const courseYearHtml = u.role === 'Student'
                ? `<div class="text-xs font-bold text-slate-700">${u.course || '—'}</div>
                   <div class="text-[10px] text-slate-400">${u.year || '—'}</div>`
                : `<div class="text-[10px] text-slate-400 italic">N/A</div>`;

            const safeId      = (u.id      || '').replace(/'/g, "\\'");
            const safeName    = (u.name    || '').replace(/'/g, "\\'");
            const safeEmail   = (u.email   || '').replace(/'/g, "\\'");
            const safeRole    = (u.role    || '').replace(/'/g, "\\'");
            const safeCourse  = (u.course  || '').replace(/'/g, "\\'");
            const safeYear    = (u.year    || '').replace(/'/g, "\\'");

            return `
            <tr class="hover:bg-blue-50/30">
                <td class="px-8 py-4">
                    <div class="font-bold text-sm text-slate-700">${u.name}</div>
                    <div class="text-[9px] font-black text-blue-500 uppercase">${u.role}</div>
                </td>
                <td class="px-8 py-4">
                    <div class="text-xs font-mono text-slate-500">${u.id}</div>
                    <div class="text-[10px] text-slate-400">${u.email}</div>
                </td>
                <td class="px-8 py-4">${courseYearHtml}</td>
                <td class="px-8 py-4">
                    <span class="px-2 py-1 rounded text-[9px] font-black uppercase ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${u.status}
                    </span>
                </td>
                <td class="px-8 py-4 text-center">
                    <span class="font-bold text-sm ${u.violation > 0 ? 'text-red-600' : 'text-slate-500'}">
                        ${u.violation}
                    </span>
                </td>
                <td class="px-8 py-4">
                    <div class="flex justify-center gap-1">
                        ${banButton}
                        <button onclick="openAddModal('${safeId}', '${safeName}', '${safeEmail}', '${safeRole}', '${safeCourse}', '${safeYear}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteUser('${safeId}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        
        const countBadge = document.getElementById('user-count-badge');
        if (countBadge) countBadge.textContent = `${data.users.length} users`;

        document.getElementById('equipment-table-body').innerHTML = (() => {
            
            const CATEGORY_META = {
                calculator: { label: 'Calculator', keys: ['Calculator 1','Calculator 2','Calculator 3','Calculator 4','Calculator 5','Calculator 6','Calculator 7'], color: 'blue' },
                projector:  { label: 'Projector',  keys: ['Projector 1','Projector 2','Projector 3','Projector 4'], color: 'indigo' },
                extension:  { label: 'Extension',  keys: ['Extension 1','Extension 2','Extension 3','Extension 4'], color: 'emerald' },
                hdmi:       { label: 'HDMI',        keys: ['HDMI 1','HDMI 2','HDMI 3','HDMI 4'], color: 'violet' },
            };

            const statusConfig = {
                'Borrowed':                                 { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
                'In Vault':                                 { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
                'In Vault - Not Working':                   { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
                'In Vault - Physical Damage':               { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
                'In Vault - Physical Damage & Not Working': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
                'Missing':                                  { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
                'Locked':                                   { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
                'Reserved':                                 { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
            };

            
            const equipMap = {};
            data.equipment.forEach(e => { equipMap[e.name] = e; });

            
            
            const cachedLabels = window._equipLabels || {};

            let rows = '';
            for (const [catKey, cat] of Object.entries(CATEGORY_META)) {
                const catDisplayName = (cachedLabels.categories && cachedLabels.categories[catKey])
                    ? cachedLabels.categories[catKey].display_name : cat.label;
                const catImg = (cachedLabels.categories && cachedLabels.categories[catKey] && cachedLabels.categories[catKey].image)
                    ? cachedLabels.categories[catKey].image : '';

                
                rows += `<tr>
                    <td colspan="4" class="px-8 py-3 bg-slate-50 border-t border-b border-slate-100">
                        <div class="flex items-center gap-3">
                            ${catImg ? `<img src="/static/img/${catImg}?t=${Date.now()}" class="w-8 h-8 object-contain rounded-lg border border-slate-200 bg-white" onerror="this.style.display='none'">` : ''}
                            <span class="text-[11px] font-black uppercase tracking-widest text-slate-500">${catDisplayName}</span>
                            <button onclick="openRenameCatModal('${catKey}', '${catDisplayName.replace(/'/g,"\\'")}', '${catImg}')"
                                title="Edit category name / icon"
                                class="ml-1 px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1">
                                <i class="fas fa-pen text-[9px]"></i> Edit Category
                            </button>
                        </div>
                    </td>
                </tr>`;

                
                cat.keys.forEach(key => {
                    const e = equipMap[key];
                    if (!e) return;
                    const displayName = (cachedLabels.items && cachedLabels.items[key]) ? cachedLabels.items[key] : e.name;
                    const s = statusConfig[e.status] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };

                    const hasReport = !['In Vault', 'Borrowed'].includes(e.status);
                    const resetBtn = hasReport
                        ? `<button onclick="resetVault('${e.name.replace(/'/g, "\\'")}')" title="Reset Vault" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><i class="fas fa-rotate-left"></i></button>`
                        : `<button disabled title="No active report" class="p-2 text-slate-300 rounded-lg cursor-not-allowed"><i class="fas fa-rotate-left"></i></button>`;

                    const isInVault = e.status === 'In Vault';
                    const lockBtn = isInVault
                        ? `<button onclick="lockEquipment('${e.name.replace(/'/g, "\\'")}')" title="Lock Item" class="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition"><i class="fas fa-lock"></i></button>`
                        : `<button disabled title="${e.status === 'Reserved' ? 'Cannot lock while Reserved' : 'Cannot lock'}" class="p-2 text-slate-300 rounded-lg cursor-not-allowed"><i class="fas fa-lock"></i></button>`;

                    rows += `
                    <tr class="hover:bg-blue-50/30">
                        <td class="px-8 py-4">
                            <div class="font-bold text-sm text-slate-700">${displayName}</div>
                            ${displayName !== e.name ? `<div class="text-[9px] text-slate-400 font-mono">(key: ${e.name})</div>` : ''}
                        </td>
                        <td class="px-8 py-4">
                            <span class="equip-qr-trigger text-xs font-mono text-blue-500 hover:text-blue-700 underline decoration-dashed underline-offset-2 cursor-pointer transition"
                                  data-name="${e.name.replace(/"/g, '&quot;')}"
                                  data-token="${e.id}"
                                  title="Click to view QR code">${e.id}</span>
                        </td>
                        <td class="px-8 py-4">
                            <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase border ${s.bg} ${s.text} ${s.border}">${e.status}</span>
                        </td>
                        <td class="px-8 py-4">
                            <div class="flex justify-center gap-1">
                                ${resetBtn}
                                ${lockBtn}
                                <button onclick="changePicture('${e.name.replace(/'/g, "\\'")}', '${(e.image_url || '').replace(/'/g, "\\'")}')" title="Change Picture"
                                    class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition">
                                    <i class="fas fa-image"></i>
                                </button>
                                <button onclick="openRenameItemModal('${e.name.replace(/'/g, "\\'")}', '${displayName.replace(/'/g, "\\'")}')" title="Rename Item"
                                    class="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition">
                                    <i class="fas fa-pen"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                });
            }
            return rows;
        })();

    } catch (err) {
        console.error("Error updating management data:", err);
    }
}

async function unbanUser(idnumber) {
    if (!requireSuperAdmin('unban users')) return;
    const confirmed = await showConfirm("Are you sure you want to unban this user?", { confirmText: 'Yes, Unban', cancelText: 'Cancel', type: 'info' });
    if (!confirmed) return;

    try {
        const response = await fetch('/api/unban_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idnumber: idnumber })
        });
        const result = await response.json();
        if (result.success) {
            await showAlert(result.message, 'success');
            updateManagement();
        } else {
            await showAlert("Error: " + result.message, 'error');
        }
    } catch (error) {
        console.error("Error unbanning:", error);
    }
}

function openBanModal(id, name, start, end) {
    if (!requireSuperAdmin('ban users')) return;
    document.getElementById('ban-id').value = id;
    document.getElementById('ban-user-display').innerText = name;
    document.getElementById('ban_start').value = start;
    document.getElementById('ban_end').value = end;
    document.getElementById('banModal').classList.remove('hidden');
}

function closeBanModal() {
    document.getElementById('banModal').classList.add('hidden');
}

async function submitBan() {
    const data = {
        id: document.getElementById('ban-id').value,
        start: document.getElementById('ban_start').value,
        end: document.getElementById('ban_end').value
    };
    await fetch('/api/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    closeBanModal();
    updateManagement();
}

function openAddModal(id = '', name = '', email = '', role = 'Student', course = '', year = '') {
    document.getElementById('m_id').value = id;
    document.getElementById('m_name').value = name;
    document.getElementById('m_email').value = email;
    document.getElementById('m_role').value = role;
    document.getElementById('m_course').value = course;
    document.getElementById('m_year').value = year;
    toggleModalStudentFields();
    document.getElementById('addModal').classList.remove('hidden');
}

function toggleModalStudentFields() {
    const role = document.getElementById('m_role').value;
    const fields = document.getElementById('m_student_fields');
    if (role === 'Student') {
        fields.style.display = 'block';
    } else {
        fields.style.display = 'none';
        document.getElementById('m_course').value = '';
        document.getElementById('m_year').value = '';
    }
}

function closeAddModal() {
    document.getElementById('addModal').classList.add('hidden');
}

async function submitUser() {
    const role = document.getElementById('m_role').value;
    const data = {
        id: document.getElementById('m_id').value,
        name: document.getElementById('m_name').value,
        email: document.getElementById('m_email').value,
        role: role,
        course: role === 'Student' ? document.getElementById('m_course').value : '',
        year: role === 'Student' ? document.getElementById('m_year').value : ''
    };
    await fetch('/api/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    closeAddModal();
    updateManagement();
}

async function deleteUser(id) {
    const confirmed = await showConfirm("Delete this user? This action cannot be undone.", { confirmText: 'Delete', cancelText: 'Cancel', type: 'danger' });
    if (confirmed) {
        await fetch('/api/users/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        updateManagement();
    }
}

let currentReportId = null;

async function fetchDashboardReports() {
    try {
        const res = await fetch('/api/dashboard_reports');
        const reports = await res.json();
        renderDashboardReports(reports);
    } catch (e) {
        document.getElementById('reports-list').innerHTML =
            '<div class="text-center text-slate-400 text-xs py-8">Failed to load reports.</div>';
    }
}

function renderDashboardReports(reports) {
    const container = document.getElementById('reports-list');
    const badge = document.getElementById('reports-count-badge');

    if (!reports || reports.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 text-xs py-10"><i class="fas fa-check-circle text-green-400 text-2xl mb-2 block"></i>No active reports</div>';
        badge.classList.add('hidden');
        return;
    }

    badge.textContent = reports.length;
    badge.classList.remove('hidden');

    
    const missing  = reports.filter(r => r.report_type === 'no_item');
    const others   = reports.filter(r => r.report_type !== 'no_item');

    const typeLabel = { no_item: 'Missing', physical_damage: 'Physical Damage', not_working: 'Not Working' };
    const typeColor = {
        no_item:         { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'fa-circle-exclamation text-red-500',  dot: 'bg-red-500'    },
        physical_damage: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'fa-hammer text-orange-500',           dot: 'bg-orange-500' },
        not_working:     { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'fa-bolt text-yellow-500',             dot: 'bg-yellow-500' },
    };

    function renderCard(r, large = false) {
        const c = typeColor[r.report_type] || typeColor.not_working;
        const label = typeLabel[r.report_type] || r.report_type;
        const timeStr = r.report_time ? new Date(r.report_time.replace(' ', 'T')).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';

        return `
        <div onclick="openReportDetail(${JSON.stringify(r).replace(/"/g, '&quot;')})"
            class="cursor-pointer ${c.bg} border ${c.border} rounded-2xl p-4 ${large ? 'py-5' : ''} hover:shadow-md transition-all select-none"
            title="Click for details">
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <i class="fas ${c.icon} text-sm flex-shrink-0"></i>
                    <div class="min-w-0">
                        <p class="font-black ${c.text} text-sm truncate">${r.equipment_label}</p>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">${label}</p>
                    </div>
                </div>
                <span class="text-[9px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0 pt-0.5">${timeStr}</span>
            </div>
            ${large ? `<div class="mt-3 flex gap-4 text-[11px] text-slate-500">
                <span><i class="fas fa-user mr-1 text-slate-400"></i>${r.reported_by}</span>
                <span><i class="fas fa-history mr-1 text-slate-400"></i>${r.last_borrower || 'None'}</span>
            </div>` : ''}
        </div>`;
    }

    let html = '';
    
    missing.forEach(r  => { html += renderCard(r, true); });
    
    others.forEach(r   => { html += renderCard(r, false); });

    container.innerHTML = html;
}

function openReportDetail(r) {
    currentReportId = r.id;
    const typeLabel = { no_item: 'Missing', physical_damage: 'Physical Damage', not_working: 'Not Working' };
    const typeColor = { no_item: 'text-red-600', physical_damage: 'text-orange-600', not_working: 'text-yellow-600' };
    const label = typeLabel[r.report_type] || r.report_type;
    const color = typeColor[r.report_type] || 'text-slate-600';

    const timeStr = r.report_time
        ? new Date(r.report_time.replace(' ', 'T')).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        : '—';
    const borrowStr = r.last_borrow_time
        ? new Date(r.last_borrow_time.replace(' ', 'T')).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        : '—';

    document.getElementById('rdm-title').innerHTML =
        `<span class="${color}">${label}</span>`;

    document.getElementById('rdm-body').innerHTML = `
        <div class="bg-slate-50 rounded-2xl p-4 space-y-3 text-sm">
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Equipment</span><span class="font-black text-slate-800">${r.equipment_label}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Report Type</span><span class="font-bold ${color}">${label}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Reported By</span><span class="font-bold text-slate-700">${r.reported_by || 'Unknown'}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Reported At</span><span class="font-medium text-slate-600">${timeStr}</span></div>
        </div>
        <div class="bg-blue-50 rounded-2xl p-4 space-y-3 text-sm border border-blue-100">
            <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Last Borrow Record</p>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Borrower</span><span class="font-bold text-slate-700">${r.last_borrower || 'None on record'}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Borrow Time</span><span class="font-medium text-slate-600">${borrowStr}</span></div>
        </div>`;

    document.getElementById('reportDetailModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportDetailModal').classList.add('hidden');
    currentReportId = null;
}

async function dismissReportFromModal() {
    if (!currentReportId) return;
    const confirmed = await showConfirm(
        'Dismiss this report? It will no longer appear on the dashboard.',
        { confirmText: 'Dismiss', cancelText: 'Cancel', type: 'warning' }
    );
    if (!confirmed) return;

    try {
        const res = await fetch('/api/dashboard_reports/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_id: currentReportId })
        });
        const result = await res.json();
        if (result.success) {
            closeReportModal();
            fetchDashboardReports();
        } else {
            await showAlert('Error: ' + result.message, 'error');
        }
    } catch (e) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

async function resetVault(equipmentName) {
    const confirmed = await showConfirm(
        `Clear all reports for <b>${equipmentName}</b>?<br><span style="font-size:12px;color:#94a3b8;font-weight:500;">This will remove the warning badge and make the item available again.</span>`,
        { confirmText: 'Reset Vault', cancelText: 'Cancel', type: 'warning' }
    );
    if (!confirmed) return;

    try {
        const res = await fetch('/api/equipment/reset_vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipment_label: equipmentName })
        });
        const result = await res.json();
        if (result.success) {
            await showAlert(`✅ Vault reset for <b>${equipmentName}</b>.`, 'success');
            updateManagement();
        } else {
            await showAlert('Error: ' + result.message, 'error');
        }
    } catch (err) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

async function lockEquipment(equipmentName) {
    const confirmed = await showConfirm(
        `Lock <b>${equipmentName}</b>?<br><span style="font-size:12px;color:#94a3b8;font-weight:500;">Hindi mabo-borrow sa kiosk hanggang hindi mo ine-reset. Hindi ito magdidisplay sa dashboard.</span>`,
        { confirmText: 'Lock', cancelText: 'Cancel', type: 'info' }
    );
    if (!confirmed) return;

    try {
        const res = await fetch('/api/equipment/lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipment_label: equipmentName })
        });
        const result = await res.json();
        if (result.success) {
            await showAlert(`🔒 <b>${equipmentName}</b> is now locked.`, 'success');
            updateManagement();
        } else {
            await showAlert('Error: ' + result.message, 'error');
        }
    } catch (err) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

let _changePicTarget = null;
let _changePicFile = null;

function changePicture(equipmentName, imageUrl) {
    if (!requireSuperAdmin('change equipment picture')) return;
    _changePicTarget = equipmentName;
    _changePicFile = null;

    document.getElementById('changepic-label').textContent = equipmentName;
    document.getElementById('picPreviewWrap').classList.add('hidden');
    document.getElementById('picFileInput').value = '';
    document.getElementById('confirmChangePicBtn').disabled = true;

    
    const currentWrap = document.getElementById('currentPicWrap');
    const currentImg = document.getElementById('currentPicImg');
    if (imageUrl) {
        currentImg.src = imageUrl + '?t=' + Date.now();
        currentImg.onerror = () => { currentWrap.classList.add('hidden'); };
        currentWrap.classList.remove('hidden');
    } else {
        currentWrap.classList.add('hidden');
    }

    document.getElementById('changePicModal').classList.remove('hidden');
}

function closeChangePicModal() {
    document.getElementById('changePicModal').classList.add('hidden');
    document.getElementById('currentPicWrap').classList.add('hidden');
    _changePicTarget = null;
    _changePicFile = null;
}

function handleDrop(event) {
    event.preventDefault();
    document.getElementById('dropZone').classList.remove('border-blue-500', 'bg-blue-50');
    const file = event.dataTransfer.files[0];
    if (file) applyPicFile(file);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) applyPicFile(file);
}

function applyPicFile(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
        showAlert('Invalid file type. Please use JPG, PNG, WEBP, or GIF.', 'error');
        return;
    }

    _changePicFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('picPreview').src = e.target.result;
    };
    reader.readAsDataURL(file);

    const kb = (file.size / 1024).toFixed(1);
    const mb = (file.size / 1048576).toFixed(2);
    document.getElementById('picFileName').textContent = file.name;
    document.getElementById('picFileSize').textContent = file.size > 1048576 ? `${mb} MB` : `${kb} KB`;
    document.getElementById('picPreviewWrap').classList.remove('hidden');
    document.getElementById('confirmChangePicBtn').disabled = false;
}

function clearPicPreview() {
    _changePicFile = null;
    document.getElementById('picPreview').src = '';
    document.getElementById('picFileInput').value = '';
    document.getElementById('picPreviewWrap').classList.add('hidden');
    document.getElementById('confirmChangePicBtn').disabled = true;
}

async function confirmChangePicture() {
    if (!_changePicFile || !_changePicTarget) return;

    const btn = document.getElementById('confirmChangePicBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...';

    try {
        const formData = new FormData();
        formData.append('equipment_label', _changePicTarget);
        formData.append('image', _changePicFile);

        const res = await fetch('/api/equipment/change_picture', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (result.success) {
            closeChangePicModal();
            await showAlert(`✅ Picture updated for <b>${_changePicTarget}</b>!`, 'success');
            updateManagement();
        } else {
            btn.disabled = false;
            btn.innerHTML = 'Save Picture';
            await showAlert('Error: ' + result.message, 'error');
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = 'Save Picture';
        await showAlert('Network error. Please try again.', 'error');
    }
}

function filterRows(inputId, tableId) {
    let q = document.getElementById(inputId).value.toLowerCase();
    document.querySelectorAll(`#${tableId} tr`).forEach(r =>
        r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none"
    );
}

function applyCourseFilter() {
    const q = (document.getElementById('user-search')?.value || '').toLowerCase();
    const course = (document.getElementById('course-filter')?.value || '');

    document.querySelectorAll('#user-table-body tr').forEach(row => {
        const text = row.innerText.toLowerCase();
        const matchesSearch = !q || text.includes(q);
        
        let matchesCourse = true;
        if (course === 'Faculty') {
            matchesCourse = row.querySelector('td:first-child .text-blue-500')?.innerText?.trim() === 'Faculty';
        } else if (course) {
            matchesCourse = text.includes(course.toLowerCase());
        }
        row.style.display = matchesSearch && matchesCourse ? '' : 'none';
    });

    
    const visible = [...document.querySelectorAll('#user-table-body tr')].filter(r => r.style.display !== 'none').length;
    const badge = document.getElementById('user-count-badge');
    if (badge) badge.textContent = visible;
}

async function loadAdminKioskID() {
    try {
        const res = await fetch('/api/admin_kiosk/get');
        const data = await res.json();

        if (data.admin_idnumber) {
            document.getElementById('admin-kiosk-id-input').value = data.admin_idnumber;
            generateAdminQR(data.admin_idnumber);
        } else {
            document.getElementById('admin-kiosk-qr-wrap').classList.add('hidden');
        }
    } catch (e) {
        console.error('Error loading admin kiosk ID:', e);
    }
}

function onAdminKioskIDInput(val) {
    const trimmed = val.trim();
    if (trimmed.length >= 3) {
        generateAdminQR(trimmed);
    } else {
        document.getElementById('admin-kiosk-qr-wrap').classList.add('hidden');
    }
}

function generateAdminQR(idNumber) {
    const wrap = document.getElementById('admin-kiosk-qr-wrap');
    const canvas = document.getElementById('admin-kiosk-qr-canvas');
    const label = document.getElementById('admin-kiosk-qr-label');

    canvas.innerHTML = '';

    new QRCode(canvas, {
        text: idNumber,
        width: 160,
        height: 160,
        colorDark: '#3730a3',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    label.textContent = `ID: ${idNumber}`;
    wrap.classList.remove('hidden');
}

async function saveAdminKioskID() {
    const idVal = document.getElementById('admin-kiosk-id-input').value.trim();

    if (!idVal) {
        await showAlert('Please enter an Admin ID number.', 'warning');
        return;
    }

    const confirmed = await showConfirm(
        `Set <b>${idVal}</b> as the Admin Kiosk ID?<br><span style="font-size:12px;color:#94a3b8;">This ID will have vault control access at the kiosk.</span>`,
        { confirmText: 'Save', cancelText: 'Cancel', type: 'info' }
    );
    if (!confirmed) return;

    try {
        const res = await fetch('/api/admin_kiosk/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_idnumber: idVal, admin_name: '' })
        });
        const result = await res.json();
        if (result.success) {
            await showAlert(`✅ Admin Kiosk ID saved: <b>${idVal}</b>.`, 'success');
            loadAdminKioskID();
        } else {
            await showAlert('Error saving: ' + result.message, 'error');
        }
    } catch (e) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

let _adminPicFile = null;

async function loadAdminProfile() {
    try {
        const res = await fetch('/api/admin/profile');
        const data = await res.json();
        const name = data.display_name || 'Admin';
        const email = data.email || '';
        const pic = data.profile_pic ? `/static/admin_pics/${data.profile_pic}` : '';

        
        document.getElementById('sidebar-admin-name').textContent = name;
        document.getElementById('sidebar-admin-email').textContent = email || data.username || 'Admin';

        if (pic) {
            document.getElementById('sidebar-admin-pic').src = pic + '?t=' + Date.now();
        }

        
        document.getElementById('admin-profile-name').value = name;
        document.getElementById('admin-profile-email').value = email;
        if (pic) {
            document.getElementById('modal-admin-pic').src = pic + '?t=' + Date.now();
        }
    } catch (e) {
        console.error('loadAdminProfile error:', e);
    }
}

function openAdminProfileModal() {
    _adminPicFile = null;
    loadAdminProfile();
    document.getElementById('adminProfileModal').classList.remove('hidden');
}

function closeAdminProfileModal() {
    document.getElementById('adminProfileModal').classList.add('hidden');
    _adminPicFile = null;
}

function previewAdminPic(event) {
    const file = event.target.files[0];
    if (!file) return;
    _adminPicFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('modal-admin-pic').src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function saveAdminProfile() {
    const name = document.getElementById('admin-profile-name').value.trim();
    const email = document.getElementById('admin-profile-email').value.trim();

    if (!name) {
        await showAlert('Please enter a display name.', 'warning');
        return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await showAlert('Please enter a valid email address.', 'warning');
        return;
    }

    try {
        
        const res = await fetch('/api/admin/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: name, email: email })
        });
        const result = await res.json();
        if (!result.success) {
            await showAlert('Error saving profile: ' + result.message, 'error');
            return;
        }

        
        if (_adminPicFile) {
            const formData = new FormData();
            formData.append('image', _adminPicFile);
            const picRes = await fetch('/api/admin/profile/picture', {
                method: 'POST',
                body: formData
            });
            const picResult = await picRes.json();
            if (!picResult.success) {
                await showAlert('Profile saved but picture upload failed: ' + picResult.message, 'warning');
            }
        }

        
        await loadAdminProfile();

        closeAdminProfileModal();
        await showAlert('Profile updated successfully!', 'success');
    } catch (e) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

function initChart() {
    const ctx = document.getElementById('trendsChart').getContext('2d');
    trendsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Borrows',
                data: [],
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                borderColor: '#fbbf24',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
            }, {
                label: 'Returns',
                data: [],
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}

async function updateNotificationBadge() {
    try {
        const response = await fetch('/api/notifications/unread');
        const data = await response.json();
        const badge = document.getElementById('notif-badge');

        if (data && data.count > 0) {
            badge.innerText = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (err) {
        console.error("Error fetching notifications:", err);
    }
}

async function markAsRead() {
    const badge = document.getElementById('notif-badge');
    if (!badge.classList.contains('hidden')) {
        try {
            await fetch('/api/notifications/mark_read', { method: 'POST' });
            badge.classList.add('hidden');
        } catch (err) {
            console.error("Error marking as read:", err);
        }
    }
}

let _sseSource = null;

function getActiveSection() {
    for (const s of ['overview', 'transactions', 'management', 'reservations']) {
        const el = document.getElementById('section-' + s);
        if (el && !el.classList.contains('section-hidden')) return s;
    }
    return null;
}

async function refreshActiveSection() {
    const s = getActiveSection();
    if (!s) return;
    if (s === 'overview') updateDashboard();
    else if (s === 'transactions') updateDashboard();
    else if (s === 'management') {
        await updateManagement();
        const uSearch = document.getElementById('user-search');
        const courseFilter = document.getElementById('course-filter');
        if ((uSearch && uSearch.value.trim()) || (courseFilter && courseFilter.value)) {
            applyCourseFilter();
        }
    }
    else if (s === 'reservations') fetchReservations();
    updateNotificationBadge();
}

function startSSE() {
    if (_sseSource) {
        _sseSource.close();
        _sseSource = null;
    }

    const source = new EventSource('/api/stream');
    _sseSource = source;

    source.addEventListener('update', () => {
        refreshActiveSection();
    });

    source.addEventListener('heartbeat', () => {
        
    });

    source.onerror = () => {
        source.close();
        _sseSource = null;
        setTimeout(startSSE, 3000);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    updateNotificationBadge();
    loadAdminProfile();

    
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

    
    startSSE();

    
    initAdminRole();
});

window._adminRole = 'admin'; 

async function initAdminRole() {
    try {
        const res = await fetch('/api/admin/session-info');
        const data = await res.json();
        window._adminRole = data.role || 'admin';
    } catch (e) {
        window._adminRole = 'admin';
    }
    applyRoleUI();
}

function applyRoleUI() {
    const isSuperAdmin = window._adminRole === 'superadmin';
    const adminAccBtn = document.getElementById('btn-admin-accounts');
    if (adminAccBtn) adminAccBtn.style.display = isSuperAdmin ? '' : 'none';
    const roleBadge = document.getElementById('sidebar-role-badge');
    if (roleBadge) {
        roleBadge.textContent = isSuperAdmin ? 'Super Admin' : 'Admin';
        roleBadge.className = isSuperAdmin
            ? 'text-[10px] font-black uppercase tracking-wider text-yellow-300'
            : 'text-[10px] font-black uppercase tracking-wider text-blue-200';
    }
}

function requireSuperAdmin(actionName) {
    if (window._adminRole !== 'superadmin') {
        showAlert('⛔ Super Admin access required to ' + actionName + '.', 'error');
        return false;
    }
    return true;
}

window.onload = () => {
    initChart();
    updateDashboard();
};

async function exportAllRecords() {
    try {
        showAlert('Exporting records...', 'info');
        const res = await fetch('/api/transactions/export');
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity_logs_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('✅ Records exported successfully!', 'success');
    } catch (e) {
        showAlert('Export failed. Please try again.', 'error');
    }
}

function confirmClearLogs() {
    if (!requireSuperAdmin('clear activity logs')) return;
    document.getElementById('clearLogsModal').classList.remove('hidden');
}

function closeClearLogsModal() {
    document.getElementById('clearLogsModal').classList.add('hidden');
}

async function clearAllLogs() {
    closeClearLogsModal();
    try {
        const res = await fetch('/api/transactions/clear', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            document.getElementById('transaction-table-body').innerHTML = '';
            await showAlert('✅ All activity logs have been cleared.', 'success');
            refreshStats();
        } else {
            await showAlert('Error: ' + result.message, 'error');
        }
    } catch (e) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

document.addEventListener('click', function(e) {
    const trigger = e.target.closest('.equip-qr-trigger');
    if (trigger) {
        openEquipQRModal(trigger.dataset.name, trigger.dataset.token);
    }
});

function openEquipQRModal(name, token) {
    document.getElementById('equip-qr-name').textContent = name;

    
    const canvas = document.getElementById('equip-qr-canvas');
    canvas.innerHTML = '';

    
    new QRCode(canvas, {
        text: token,
        width: 180,
        height: 180,
        colorDark: '#1e3a8a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('equipQRModal').classList.remove('hidden');
}

function closeEquipQRModal() {
    document.getElementById('equipQRModal').classList.add('hidden');
    document.getElementById('equip-qr-canvas').innerHTML = '';
}

let _renameItemKey = null;

function openRenameItemModal(itemKey, currentDisplay) {
    if (!requireSuperAdmin('rename items')) return;
    _renameItemKey = itemKey;
    document.getElementById('renameItem-key').textContent = itemKey;
    document.getElementById('renameItem-input').value = currentDisplay;
    document.getElementById('renameItemModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('renameItem-input').focus(), 100);
}

function closeRenameItemModal() {
    document.getElementById('renameItemModal').classList.add('hidden');
    _renameItemKey = null;
}

async function submitRenameItem() {
    const newDisplay = document.getElementById('renameItem-input').value.trim();
    if (!newDisplay) { await showAlert('Please enter a name.', 'warning'); return; }
    if (!_renameItemKey) return;

    try {
        const res = await fetch('/api/equipment/rename_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_key: _renameItemKey, new_display: newDisplay })
        });
        const result = await res.json();
        if (result.success) {
            closeRenameItemModal();
            await showAlert(`✅ "<b>${_renameItemKey || ''}</b>" now displays as "<b>${newDisplay}</b>" on the kiosk.`, 'success');
            updateManagement();
        } else {
            await showAlert('Error: ' + result.message, 'error');
        }
    } catch (e) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

let _renameCatKey = null;
let _renameCatFile = null;

function openRenameCatModal(catKey, currentName, currentImage) {
    if (!requireSuperAdmin('rename categories')) return;
    _renameCatKey = catKey;
    _renameCatFile = null;
    document.getElementById('renameCat-key').value = catKey;
    document.getElementById('renameCat-input').value = currentName;
    document.getElementById('renameCat-file-name').textContent = 'No new file selected';
    document.getElementById('renameCat-file').value = '';

    const imgEl = document.getElementById('renameCat-img-preview');
    if (currentImage) {
        imgEl.src = '/static/img/' + currentImage + '?t=' + Date.now();
        imgEl.style.display = '';
    } else {
        imgEl.style.display = 'none';
    }

    document.getElementById('renameCatModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('renameCat-input').focus(), 100);
}

function closeRenameCatModal() {
    document.getElementById('renameCatModal').classList.add('hidden');
    _renameCatKey = null;
    _renameCatFile = null;
}

function previewCatIcon(event) {
    const file = event.target.files[0];
    if (!file) return;
    _renameCatFile = file;
    document.getElementById('renameCat-file-name').textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
        const imgEl = document.getElementById('renameCat-img-preview');
        imgEl.src = e.target.result;
        imgEl.style.display = '';
    };
    reader.readAsDataURL(file);
}

async function submitRenameCategory() {
    if (!_renameCatKey) return;
    const newName = document.getElementById('renameCat-input').value.trim();
    if (!newName) { await showAlert('Please enter a category name.', 'warning'); return; }

    try {
        
        const nameRes = await fetch('/api/equipment/rename_category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_key: _renameCatKey, new_name: newName })
        });
        const nameResult = await nameRes.json();
        if (!nameResult.success) {
            await showAlert('Error renaming: ' + nameResult.message, 'error');
            return;
        }

        
        if (_renameCatFile) {
            const formData = new FormData();
            formData.append('category_key', _renameCatKey);
            formData.append('image', _renameCatFile);
            const imgRes = await fetch('/api/equipment/change_category_image', {
                method: 'POST',
                body: formData
            });
            const imgResult = await imgRes.json();
            if (!imgResult.success) {
                await showAlert('Name saved but image upload failed: ' + imgResult.message, 'warning');
                closeRenameCatModal();
                updateManagement();
                return;
            }
        }

        closeRenameCatModal();
        await showAlert(`✅ Category updated to "<b>${newName}</b>".`, 'success');
        updateManagement();
    } catch (e) {
        await showAlert('Network error. Please try again.', 'error');
    }
}

async function loadAdminAccounts() {
    try {
        const res = await fetch('/api/admins');
        if (!res.ok) return;
        const data = await res.json();
        const tbody = document.getElementById('admin-accounts-tbody');
        if (!tbody) return;
        if (!data.admins || data.admins.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-8 py-8 text-center text-slate-400 text-sm">No admin accounts found.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.admins.map(a => {
            const isSuperAdmin = a.role === 'superadmin';
            const roleTag = isSuperAdmin
                ? `<span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-black rounded-full uppercase">Super Admin</span>`
                : `<span class="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-full uppercase">Admin</span>`;
            const removeBtn = isSuperAdmin
                ? `<span class="text-[11px] text-slate-300 italic">Protected</span>`
                : `<button onclick="removeAdmin(${a.id}, '${a.username}')" class="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Remove Admin"><i class="fas fa-trash-alt"></i></button>`;
            return `<tr class="border-t border-slate-100 hover:bg-slate-50 transition">
                <td class="px-6 py-4 font-bold text-slate-800 text-sm">${a.display_name || 'Admin'}</td>
                <td class="px-6 py-4 text-slate-500 text-sm font-mono">@${a.username}</td>
                <td class="px-6 py-4 text-slate-400 text-sm">${a.email || '<span class="italic text-slate-300">No email set</span>'}</td>
                <td class="px-6 py-4">${roleTag}</td>
                <td class="px-6 py-4 text-center">${removeBtn}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('loadAdminAccounts error:', e);
    }
}

async function removeAdmin(id, username) {
    const confirmed = await showConfirm(`Remove admin "@${username}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
        const res = await fetch(`/api/admins/remove/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showAlert('Admin removed successfully.', 'success');
            loadAdminAccounts();
        } else {
            showAlert(data.message || 'Failed to remove admin.', 'error');
        }
    } catch (e) {
        showAlert('Network error.', 'error');
    }
}

async function submitAddAdmin() {
    const username = document.getElementById('new-admin-username').value.trim();
    const password = document.getElementById('new-admin-password').value.trim();
    const display_name = document.getElementById('new-admin-displayname').value.trim();
    const email = document.getElementById('new-admin-email').value.trim();

    if (!username || !password) {
        showAlert('Username at password ay required.', 'warning');
        return;
    }
    try {
        const res = await fetch('/api/admins/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, display_name, email })
        });
        const data = await res.json();
        if (data.success) {
            showAlert(data.message, 'success');
            document.getElementById('new-admin-username').value = '';
            document.getElementById('new-admin-password').value = '';
            document.getElementById('new-admin-displayname').value = '';
            document.getElementById('new-admin-email').value = '';
            loadAdminAccounts();
        } else {
            showAlert(data.message || 'Failed to add admin.', 'error');
        }
    } catch (e) {
        showAlert('Network error.', 'error');
    }
}