
let currentMode = 'borrow';
let selectedItemName = null;
let verifiedID = '';
let verifiedName = '';
let equipmentCondition = '';

const zoomLevel = 1.035;
document.body.style.transformOrigin = 'top center';
document.body.style.transform = `scale(${zoomLevel})`;
document.body.style.width = (100 / zoomLevel) + '%';
document.body.style.margin = '0 auto';

history.pushState(null, null, location.href);
window.onpopstate = function() { history.go(1); };

window.addEventListener('keydown', function(e) {
    if (e.ctrlKey && ['=', '-', '+', '0'].includes(e.key)) e.preventDefault();
}, { passive: false });

window.addEventListener('wheel', function(e) {
    if (e.ctrlKey) e.preventDefault();
}, { passive: false });

document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});

window.addEventListener('keydown', function(e) {
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (e.key === 'Backspace' && !isInput) e.preventDefault();
});

let idleTimer;
const idleTimeLimit = 120000;
const videoElement = document.getElementById('screenSaverVideo');

function resetIdleTimer() {
    if (videoElement.style.display === 'block') stopScreenSaver();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showScreenSaver, idleTimeLimit);
}

function showScreenSaver() {
    videoElement.style.display = 'block';
    videoElement.play();
}

function stopScreenSaver() {
    videoElement.pause();
    videoElement.style.display = 'none';
    location.reload();
}

window.onload = resetIdleTimer;
document.onmousemove = resetIdleTimer;
document.onkeypress = resetIdleTimer;
document.ontouchstart = resetIdleTimer;
videoElement.addEventListener('click', stopScreenSaver);

(function() {
    const INACTIVITY_MS = 15000; 
    let inactivityTimer = null;
    let isSignedIn = false; 

    function isWelcomeOrHomeScreen() {
        const welcome = document.getElementById('welcomeScreen');
        const scanPopup = document.getElementById('scanIDPopup');
        
        if (welcome && (welcome.style.display === 'flex' || welcome.style.display === 'block')) return true;
        
        const nextBtn = document.getElementById('nextButton');
        if (scanPopup && scanPopup.style.display === 'flex' && nextBtn && nextBtn.style.display === 'none') return true;
        return false;
    }

    function showInactivityPopup() {
        if (!isSignedIn) return;
        if (isWelcomeOrHomeScreen()) return;
        const popup = document.getElementById('inactivityPopup');
        if (popup) popup.style.display = 'flex';
    }

    function dismissInactivityPopup() {
        const popup = document.getElementById('inactivityPopup');
        if (popup) popup.style.display = 'none';
        resetInactivityTimer();
    }

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        if (!isSignedIn) return;
        if (isWelcomeOrHomeScreen()) return;
        inactivityTimer = setTimeout(showInactivityPopup, INACTIVITY_MS);
    }

    function stopInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }

    
    window.startInactivityWatch = function() {
        isSignedIn = true;
        resetInactivityTimer();
    };
    window.stopInactivityWatch = function() {
        isSignedIn = false;
        stopInactivityTimer();
        const popup = document.getElementById('inactivityPopup');
        if (popup) popup.style.display = 'none';
    };

    
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        document.addEventListener(evt, function() {
            if (!isSignedIn) return;
            const popup = document.getElementById('inactivityPopup');
            if (popup && popup.style.display === 'flex') return; 
            resetInactivityTimer();
        }, { passive: true });
    });

    
    document.addEventListener('DOMContentLoaded', function() {
        const yesBtn = document.getElementById('inactivityYesBtn');
        if (yesBtn) yesBtn.addEventListener('click', dismissInactivityPopup);
    });
})();

document.addEventListener('pointerdown', (e) => {
    const colors = ['#ffffff', '#00e5ff', '#ffeb3b', '#ff5252', '#69f0ae'];
    const sparks = 18;

    for (let i = 0; i < sparks; i++) {
        const spark = document.createElement('div');
        spark.className = 'firework';

        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 60;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        spark.style.left = e.clientX + 'px';
        spark.style.top = e.clientY + 'px';
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        spark.style.setProperty('--x', `${x}px`);
        spark.style.setProperty('--y', `${y}px`);

        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 700);
    }
});

function showAboutEquiLock() {
    document.getElementById('aboutEquiLockPopup').style.display = 'flex';
}

function closeAboutEquiLock() {
    document.getElementById('aboutEquiLockPopup').style.display = 'none';
}

function closeScanIDPopup() {
    document.getElementById('scanIDPopup').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const scanPopup = document.getElementById('scanIDPopup');
    const scannedIDElement = document.getElementById('scannedID');
    const nextButton = document.getElementById('nextButton');
    const menuScreen = document.getElementById('menuScreen');
    const menuHeader = document.getElementById('menuHeader');

    document.querySelectorAll('section, div[id$="Page"], #scanIDPopup, #returnScanPage')
        .forEach(el => el.style.display = 'none');
    document.body.style.overflow = 'hidden';
    if (welcomeScreen) welcomeScreen.style.display = 'flex';

    
    fetch('/warning_status')
        .then(r => r.json())
        .then(data => {
            if (data.active) {
                
                
                if (welcomeScreen) welcomeScreen.style.display = 'flex';
                const warningOverlay = document.getElementById('warningOverlay');
                if (warningOverlay) warningOverlay.style.display = 'flex';
                console.log(`🚨 Restoring warning for: ${data.equipment_label}`);
            }
        })
        .catch(() => {});

    let scannedID = '';
    let scanningActive = false;

    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const returnPage = document.getElementById('returnScanPage');
            if (!returnPage || returnPage.style.display !== 'flex') {
                event.preventDefault();
                return false;
            }
        }
    });

    window.showScanPopup = function() {
        scannedID = '';
        verifiedID = '';
        verifiedName = '';
        scanningActive = true;
        scannedIDElement.textContent = 'Waiting for scan...';
        nextButton.style.display = 'none';
        scanPopup.style.display = 'flex';
        menuScreen.style.display = 'none';
        
        const scanTitle = document.getElementById('scanPopupTitle');
        if (scanTitle) {
            scanTitle.textContent = 'PLEASE SCAN YOUR ID';
            scanTitle.classList.remove('hello-greeting');
        }
        
        const displayBox = scannedIDElement.closest('.display-box');
        if (displayBox) displayBox.classList.remove('verified');

        
        const popupContent = document.querySelector('#scanIDPopup .popup-content');
        if (popupContent) popupContent.classList.remove('popup-verified');
    };

    window.handleIDScan = function(event) {
        if (!scanningActive || scanPopup.style.display !== 'flex') return;

        if (event.key === 'Enter' || event.key === 'Return') {
            event.preventDefault();

            let cleanID = scannedID.trim();
            scannedID = '';

            if (!cleanID) return;

            fetch('/verify_id', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_number: cleanID })
                })
                .then(res => res.json())
                .then(result => {
                    if (result.status === 'banned') {
                        let displayMessage = '';
                        if (result.ban_end === 'PERMANENT' || !result.ban_end) {
                            displayMessage = result.message;
                        } else {
                            try {
                                const banDate = new Date(result.ban_end.replace(' ', 'T'));
                                const formattedDate = banDate.toLocaleString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                }).replace(/,/g, '');
                                displayMessage = `This ID is banned until ${formattedDate}`;
                            } catch (e) {
                                displayMessage = result.message;
                            }
                        }

                        scannedIDElement.innerHTML = `
                        <div style="color:red;font-size:28px;font-weight:bold;">ACCESS DENIED</div>
                        <div style="margin-top:12px;font-size:20px;">${displayMessage}</div>
                    `;
                        nextButton.style.display = 'none';
                        setTimeout(() => {
                            scanPopup.style.display = 'none';
                            location.reload();
                        }, 5000);
                        return;
                    }

                    
                    if (result.status === 'admin') {
                        window.location.href = '/admin-vault';
                        return;
                    }

                    if (result.status === 'valid') {
                        
                        if (result.is_admin) {
                            window.location.href = '/admin-vault';
                            return;
                        }
                        verifiedID = cleanID;
                        verifiedName = result.name;

                        
                        const scanTitle = document.getElementById('scanPopupTitle');
                        if (scanTitle) {
                            scanTitle.textContent = `HELLO!`;
                            scanTitle.classList.add('hello-greeting');
                        }

                        scannedIDElement.textContent = verifiedName;
                        const displayBox = scannedIDElement.closest('.display-box');
                        if (displayBox) displayBox.classList.add('verified');

                        
                        const popupContent = document.querySelector('#scanIDPopup .popup-content');
                        if (popupContent) popupContent.classList.add('popup-verified');
                        nextButton.style.display = 'inline-block';
                        return;
                    }

                    scannedIDElement.textContent = 'Invalid ID. Please try again.';
                })
                .catch(() => { scannedID = ''; });

        } else {
            if (event.key.length === 1) {
                scannedID += event.key;
                scannedIDElement.textContent = '*'.repeat(scannedID.length);
            }
        }
    };

    document.addEventListener('keydown', window.handleIDScan);

    nextButton.addEventListener('click', function() {
        if (!verifiedID) return;
        scanPopup.style.display = 'none';
        welcomeScreen.style.display = 'none';
        menuScreen.style.display = 'block';
        menuHeader.textContent = 'WELCOME, ' + verifiedName + '!';
        scanningActive = false;
        
        if (window.startInactivityWatch) window.startInactivityWatch();
    });
});

function showBorrow() {
    currentMode = 'borrow';
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('borrowPage').style.display = 'block';
    hideAllConfirmButtons();
    refreshItems();
    document.querySelector('.header-borrow div').textContent = 'What do you want to borrow?';
}

document.querySelector('.return-box').addEventListener('click', function() {
    currentMode = 'return';
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('borrowPage').style.display = 'block';
    hideAllConfirmButtons();
    refreshItems();
    document.querySelector('.header-borrow div').textContent = 'Select your borrowed item';
});

function cancelToWelcome() {
    if (window.stopInactivityWatch) window.stopInactivityWatch();
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
}

function showItemPage(pageId) {
    document.getElementById('borrowPage').style.display = 'none';
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'block';
        hideAllConfirmButtons();
        refreshItems(pageId);
    }
}

function goBackFromItemPage(pageId) {
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'none';
    document.getElementById('borrowPage').style.display = 'block';
    selectedItemName = null;
    hideAllConfirmButtons();
}

function goBackFromBorrow() {
    document.getElementById('borrowPage').style.display = 'none';
    document.getElementById('menuScreen').style.display = 'block';
}

function showCalculator() {
    showItemPage('calculatorPage');
    syncButtonsWithDatabase('calculatorPage');
}

function showProjector() {
    showItemPage('projectorPage');
    syncButtonsWithDatabase('projectorPage');
}

function showExtension() {
    showItemPage('extensionPage');
    syncButtonsWithDatabase('extensionPage');
}

function showHDMI() {
    showItemPage('hdmiPage');
    syncButtonsWithDatabase('hdmiPage');
}

function goBackFromCalculator() { goBackFromItemPage('calculatorPage'); }

function goBackFromProjector() { goBackFromItemPage('projectorPage'); }

function goBackFromExtension() { goBackFromItemPage('extensionPage'); }

function goBackFromHDMI() { goBackFromItemPage('hdmiPage'); }

(function() {
    let calcOffset = 0;

    
    
    function getItemStep() {
        const track = document.getElementById('calcScrollTrack');
        if (!track) return 252;
        const items = track.querySelectorAll('.item');
        if (items.length < 2) return 252;
        
        return items[1].offsetLeft - items[0].offsetLeft;
    }

    
    
    function getMaxOffset() {
        const wrapper = document.getElementById('calcScrollWrapper');
        const track = document.getElementById('calcScrollTrack');
        if (!wrapper || !track) return 0;
        
        
        
        const startX = getStartX();
        return Math.max(0, track.scrollWidth - wrapper.offsetWidth + startX);
    }

    
    function getStartX() {
        const track = document.getElementById('calcScrollTrack');
        if (!track) return 117;
        const firstItem = track.querySelector('.item');
        if (!firstItem) return 117;
        
        const marginLeft = parseInt(getComputedStyle(firstItem).marginLeft) || 28;
        return 145.5 - marginLeft;
    }

    function applyTransform(offset, animate) {
        const track = document.getElementById('calcScrollTrack');
        if (!track) return;
        track.style.transition = animate ? 'transform 0.35s cubic-bezier(0.4,0,0.2,1)' : 'none';
        track.style.transform = `translateX(${getStartX() - offset}px)`;
    }

    function snapOffset(raw) {
        const step = getItemStep();
        const snapped = Math.round(raw / step) * step;
        return Math.max(0, Math.min(getMaxOffset(), snapped));
    }

    function initCalcSwipe() {
        const wrapper = document.getElementById('calcScrollWrapper');
        if (!wrapper || wrapper._swipeInit) return;
        wrapper._swipeInit = true;

        let startX = 0;
        let startOffset = 0;
        let dragging = false;

        
        wrapper.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startOffset = calcOffset;
            dragging = true;
            const track = document.getElementById('calcScrollTrack');
            if (track) track.style.transition = 'none';
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const dx = startX - e.touches[0].clientX;
            calcOffset = Math.max(0, Math.min(getMaxOffset(), startOffset + dx));
            applyTransform(calcOffset, false);
        }, { passive: true });

        wrapper.addEventListener('touchend', () => {
            if (!dragging) return;
            dragging = false;
            calcOffset = snapOffset(calcOffset);
            applyTransform(calcOffset, true);
        }, { passive: true });

        
        wrapper.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startOffset = calcOffset;
            dragging = true;
            const track = document.getElementById('calcScrollTrack');
            if (track) track.style.transition = 'none';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = startX - e.clientX;
            calcOffset = Math.max(0, Math.min(getMaxOffset(), startOffset + dx));
            applyTransform(calcOffset, false);
        });

        window.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            calcOffset = snapOffset(calcOffset);
            applyTransform(calcOffset, true);
        });
    }

    function resetCalcScroll() {
        calcOffset = 0;
        applyTransform(0, false);
        initCalcSwipe();
    }

    const origShowCalc = window.showCalculator;
    window.showCalculator = function() {
        origShowCalc();
        
        requestAnimationFrame(() => requestAnimationFrame(resetCalcScroll));
    };

    document.addEventListener('DOMContentLoaded', () => {
        requestAnimationFrame(() => requestAnimationFrame(resetCalcScroll));
    });
})();

function cancelToBorrow() {
    document.getElementById('returnScanPage').style.display = 'none';
    const borrowPage = document.getElementById('borrowPage');
    if (borrowPage) borrowPage.style.display = 'block';
    else console.error('Error: borrowPage id not found!');
}

function selectItem(el) {
    const page = el.closest('div[id$="Page"]');
    if (!page) return;
    page.querySelectorAll('.item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    selectedItemName = el.querySelector('.item-name').textContent;
    const confirmBtn = page.querySelector('.confirm-btn');
    if (confirmBtn) {
        hideAllConfirmButtons();
        confirmBtn.style.display = 'flex';
    }
}

function hideAllConfirmButtons() {
    document.querySelectorAll('.confirm-btn').forEach(btn => btn.style.display = 'none');
}

async function syncButtonsWithDatabase(pageId) {
    try {
        const response = await fetch('/borrowed_items');
        const borrowedItems = await response.json();
        const items = document.querySelectorAll(`#${pageId} .item`);

        items.forEach(item => {
            const label = item.querySelector('.item-name').innerText.trim();
            const record = borrowedItems.find(b => b.equipment_label === label);

            if (currentMode === 'borrow') {
                if (record) {
                    item.style.opacity = '0.3';
                    item.style.pointerEvents = 'none';
                    item.style.filter = 'grayscale(1)';
                } else {
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                    item.style.filter = 'none';
                }
            } else if (currentMode === 'return') {
                if (record && record.user_id === verifiedID) {
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                    item.style.filter = 'none';
                } else {
                    item.style.opacity = '0.3';
                    item.style.pointerEvents = 'none';
                    item.style.filter = 'grayscale(1)';
                }
            }
        });
    } catch (err) {
        console.error('Database sync error:', err);
    }
}

async function refreshItems(pageId = null) {
    const borrowedRes = await fetch('/borrowed_items');
    const borrowedItems = await borrowedRes.json();

    const reserveRes = await fetch('/active_reservations');
    const reservations = await reserveRes.json();

    const itemReportsRes = await fetch('/check_item_reports');
    const itemReportsData = await itemReportsRes.json();
    const flaggedMap = itemReportsData.flagged || {};

    const queueRes = await fetch('/check_queue');
    const queueData = await queueRes.json();
    const queueMap = queueData.queue || {};

    const currentTime = new Date().toTimeString().slice(0, 5);
    const selectors = ['.calculator-page', '.projector-page', '.extension-page', '.hdmi-page'];

    const toAMPM = t => {
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    selectors.forEach(sel => {
        const section = pageId ? document.getElementById(pageId) : null;
        if (pageId && section && !section.classList.contains(sel.slice(1))) return;

        document.querySelectorAll(sel + ' .item').forEach(item => {
            const name = item.querySelector('.item-name').textContent;
            const borrowRecord = borrowedItems.find(r => r.equipment_label === name);
            const reserveRecord = reservations.find(r => r.equipment_label === name);
            const reportTypes = flaggedMap[name] || [];
            const queueEntry = queueMap[name];
            const iQueuedHere = queueEntry && String(queueEntry.user_id) === String(verifiedID);

            
            item.querySelectorAll('.report-badge, .reserved-badge, .available-badge, .queue-badge, .your-reservation-badge').forEach(b => b.remove());
            item.style.outline = '';
            item.style.boxShadow = '';

            if (currentMode === 'borrow') {
                let isHardBlocked = false; 

                
                if (reserveRecord) {
                    const isReservedForMe = (reserveRecord.user_idnumber === verifiedID);
                    const isWithinWindow = (currentTime >= reserveRecord.start_time && currentTime <= reserveRecord.end_time);
                    const isUpcoming = (currentTime < reserveRecord.start_time);

                    if (!isReservedForMe) {
                        
                        isHardBlocked = true;
                        const badge = document.createElement('div');
                        badge.className = 'reserved-badge';
                        if (isUpcoming) {
                            badge.textContent = `Resereved until ${toAMPM(reserveRecord.start_time)}`;
                            badge.style.background = '#c0bd01';
                        } else {
                            badge.textContent = `🔒 Res ${toAMPM(reserveRecord.start_time)}–${toAMPM(reserveRecord.end_time)}`;
                        }
                        item.appendChild(badge);
                    }
                }

                
                if (reportTypes.length > 0) {
                    isHardBlocked = true;
                    const badge = document.createElement('div');
                    badge.className = 'report-badge';
                    if (reportTypes.includes('locked')) {
                        badge.textContent = '🔒 Locked';
                        badge.style.background = '#7c3aed';
                    } else if (reportTypes.includes('no_item')) {
                        badge.textContent = '⚠️ No Item';
                        badge.style.background = '#ff4444';
                    } else if (reportTypes.includes('physical_damage') && reportTypes.includes('not_working')) {
                        badge.textContent = '⚠️ Damaged & Not Working';
                        badge.style.background = '#e67e00';
                    } else if (reportTypes.includes('physical_damage')) {
                        badge.textContent = '⚠️ Physical Damage';
                        badge.style.background = '#e67e00';
                    } else if (reportTypes.includes('not_working')) {
                        badge.textContent = '⚠️ Not Working';
                        badge.style.background = '#e67e00';
                    }
                    item.appendChild(badge);
                }

                
                if (borrowRecord && !isHardBlocked && String(borrowRecord.user_id) === String(verifiedID)) {
                    
                    const badge = document.createElement('div');
                    badge.className = 'queue-badge queued-mine';
                    badge.textContent = `📦 Borrowed by you`;
                    badge.style.background = '#343C98';
                    item.appendChild(badge);
                    item.style.opacity = '0.5';
                    item.style.pointerEvents = 'none';
                    item.style.filter = 'none';
                } else if (borrowRecord && !isHardBlocked) {
                    
                    const borrowTime = new Date(borrowRecord.borrow_time.replace(' ', 'T'));
                    const estReturn = new Date(borrowTime.getTime() + 4 * 60 * 60 * 1000);
                    const now = new Date();
                    const isOverdue = now > estReturn;

                    const estH = estReturn.getHours();
                    const estM = estReturn.getMinutes();
                    const estStr = `${estH % 12 || 12}:${String(estM).padStart(2, '0')} ${estH >= 12 ? 'PM' : 'AM'}`;

                    if (iQueuedHere) {
                        
                        const badge = document.createElement('div');
                        badge.className = 'queue-badge queued-mine';
                        badge.textContent = `✅ You're in queue`;
                        item.appendChild(badge);

                        if (isOverdue) {
                            const overdueTag = document.createElement('div');
                            overdueTag.className = 'available-badge';
                            overdueTag.textContent = `⚠️ Overdue since ${estStr}`;
                            overdueTag.style.background = '#dc2626';
                            overdueTag.style.bottom = '60px';
                            item.appendChild(overdueTag);
                        }
                    } else if (isOverdue) {
                        
                        const badge = document.createElement('div');
                        badge.className = 'available-badge';
                        badge.textContent = `⚠️ Overdue since ${estStr}`;
                        badge.style.background = '#dc2626';
                        item.appendChild(badge);
                    } else if (queueEntry) {
                        
                        const badge = document.createElement('div');
                        badge.className = 'available-badge';
                        badge.textContent = `🕒 Avail. ~${estStr}`;
                        item.appendChild(badge);
                    } else {
                        
                        const badge = document.createElement('div');
                        badge.className = 'available-badge';
                        badge.textContent = `🕒 Avail. ~${estStr}`;
                        item.appendChild(badge);
                    }

                    
                    item.style.opacity = '0.75';
                    item.style.pointerEvents = 'auto';
                    item.style.filter = 'none';
                    item.onclick = () => handleBorrowedItemClick(item, name, estStr, iQueuedHere, queueEntry, isOverdue);

                } else if (!borrowRecord && !isHardBlocked && queueEntry && queueEntry.priority_minutes_left !== null) {
                    
                    if (iQueuedHere) {
                        
                        const badge = document.createElement('div');
                        badge.className = 'queue-badge queued-mine';
                        badge.textContent = `🔔 Claim now! ${queueEntry.priority_minutes_left} min left`;
                        badge.style.background = '#16a34a';
                        item.appendChild(badge);
                        item.style.opacity = '1';
                        item.style.pointerEvents = 'auto';
                        item.style.filter = 'none';
                        item.onclick = () => selectItem(item);
                    } else {
                        
                        const badge = document.createElement('div');
                        badge.className = 'reserved-badge';
                        badge.textContent = `⏳ Res for queue (${queueEntry.priority_minutes_left} min)`;
                        item.appendChild(badge);
                        item.style.opacity = '0.5';
                        item.style.pointerEvents = 'none';
                        item.style.filter = 'none';
                    }

                } else if (!isHardBlocked) {
                    
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                    item.style.filter = 'none';
                    item.onclick = () => selectItem(item);

                    
                    if (reserveRecord && reserveRecord.user_idnumber === verifiedID) {
                        const isWithinWindowForMe = (currentTime >= reserveRecord.start_time && currentTime <= reserveRecord.end_time);
                        const isUpcomingForMe = (currentTime < reserveRecord.start_time);
                        if (isWithinWindowForMe || isUpcomingForMe) {
                            item.style.outline = '3px solid #a0a0a000';
                            item.style.boxShadow = '0 0 18px 4px rgba(169, 172, 2, 0)';
                            item.style.position = 'relative';
                            if (!item.querySelector('.your-reservation-badge')) {
                                const badge = document.createElement('div');
                                badge.className = 'your-reservation-badge';
                                badge.textContent = isUpcomingForMe ?
                                    `⭐ Your Reservation` :
                                    '⭐ Your Reservation';
                                badge.style.cssText = `
                                    position:absolute; bottom:6px; left:50%; transform:translateX(-50%);
                                    background:rgb(192, 196, 3); color:#fff; font-size:11px; font-weight:800;
                                    padding:3px 10px; border-radius:20px; white-space:nowrap; z-index:10;
                                `;
                                item.appendChild(badge);
                            }
                        }
                    } else {
                        item.style.outline = '';
                        item.style.boxShadow = '';
                    }
                } else {
                    
                    item.style.opacity = '0.5';
                    item.style.pointerEvents = 'none';
                    item.style.filter = 'none';
                }

            } else if (currentMode === 'return') {
                if (borrowRecord && borrowRecord.user_id === verifiedID) {
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                    item.onclick = () => selectItem(item);
                } else {
                    item.style.opacity = '0.3';
                    item.style.pointerEvents = 'none';
                }
            }

            if (name === selectedItemName) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    });
}

function handleBorrowedItemClick(itemEl, itemName, estTime, iQueuedHere, queueEntry, isOverdue) {
    if (iQueuedHere) {
        showQueuePopup(itemName, estTime, true, queueEntry, isOverdue);
    } else if (queueEntry) {
        showQueuePopup(itemName, estTime, false, queueEntry, isOverdue);
    } else {
        showQueuePopup(itemName, estTime, false, null, isOverdue);
    }
}

function showQueuePopup(itemName, estTime, iQueuedHere, queueEntry, isOverdue) {
    
    const existing = document.getElementById('queuePopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'queuePopup';
    popup.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 24px;
    `;

    const overdueNotice = isOverdue ?
        `<p style="font-size:13px;color:#ffffff;background:#dc2626;padding:8px 12px;border-radius:8px;margin-top:10px;font-weight:700;">⚠️ OVERDUE — Should have been returned by ${estTime}</p>` :
        `<p style="font-size:13px;color:#94a3b8;">Estimated available: <strong>${estTime}</strong></p>`;

    let bodyHTML = '';
    let btnHTML = '';

    if (iQueuedHere) {
        bodyHTML = `
            <div style="font-size:40px;margin-bottom:12px;">✅</div>
            <h3 style="font-size:20px;font-weight:900;color:#1e3a8a;margin-bottom:8px;">${itemName}</h3>
            <p style="font-size:14px;color:#64748b;margin-bottom:4px;">You are <strong>in the queue</strong> for this item.</p>
            ${overdueNotice}
            <p style="font-size:12px;color:#f59e0b;margin-top:8px;">⚠️ You have <strong>30 minutes</strong> to claim it once it's returned.</p>
        `;
        btnHTML = `
            <button id="queueCancelBtn" style="flex:1;padding:14px;background:#fff1f2;color:#dc2626;border:2px solid #fca5a5;border-radius:16px;font-weight:800;font-size:14px;cursor:pointer;">
                Leave Queue
            </button>
            <button id="queueCloseBtn" style="flex:1;padding:14px;background:#2563eb;color:white;border:none;border-radius:16px;font-weight:800;font-size:14px;cursor:pointer;">
                OK
            </button>
        `;
    } else if (queueEntry) {
        bodyHTML = `
            <div style="font-size:40px;margin-bottom:12px;">${isOverdue ? '⚠️' : '🕒'}</div>
            <h3 style="font-size:20px;font-weight:900;color:#1e3a8a;margin-bottom:8px;">${itemName}</h3>
            <p style="font-size:14px;color:#64748b;margin-bottom:4px;">This item is currently <strong>borrowed</strong>.</p>
            ${overdueNotice}
            <p style="font-size:13px;color:#ef4444;margin-top:8px;font-weight:700;">Someone is already waiting for this item.</p>
        `;
        btnHTML = `
            <button id="queueCloseBtn" style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:16px;font-weight:800;font-size:14px;cursor:pointer;">
                Close
            </button>
        `;
    } else {
        bodyHTML = `
            <div style="font-size:40px;margin-bottom:12px;">${isOverdue ? '⚠️' : '🕒'}</div>
            <h3 style="font-size:20px;font-weight:900;color:#1e3a8a;margin-bottom:8px;">${itemName}</h3>
            <p style="font-size:14px;color:#64748b;margin-bottom:4px;">This item is currently <strong>borrowed</strong>.</p>
            ${overdueNotice}
            <p style="font-size:13px;color:#0ea5e9;margin-top:10px;">Want to be next? Join the queue and you'll have <strong>30 minutes</strong> to claim it once returned.</p>
        `;
        btnHTML = `
            <button id="queueJoinBtn" style="flex:1;padding:14px;background:#2563eb;color:white;border:none;border-radius:16px;font-weight:800;font-size:14px;cursor:pointer;">
                Join Queue
            </button>
            <button id="queueCloseBtn" style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:16px;font-weight:800;font-size:14px;cursor:pointer;">
                Cancel
            </button>
        `;
    }

    popup.innerHTML = `
        <div style="background:white;border-radius:24px;padding:32px;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
            ${bodyHTML}
            <div style="display:flex;gap:12px;margin-top:24px;">
                ${btnHTML}
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    
    const closeBtn = document.getElementById('queueCloseBtn');
    if (closeBtn) closeBtn.onclick = () => popup.remove();

    
    const joinBtn = document.getElementById('queueJoinBtn');
    if (joinBtn) {
        joinBtn.onclick = async() => {
            joinBtn.disabled = true;
            joinBtn.textContent = 'Joining...';
            const res = await fetch('/join_queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equipment_label: itemName,
                    user_id: verifiedID,
                    user_name: verifiedName
                })
            });
            const data = await res.json();
            popup.remove();
            if (data.status === 'success' || data.status === 'already_queued') {
                refreshItems();
            } else if (data.status === 'queue_full') {
                alert('Queue is full — someone is already waiting for this item.');
                refreshItems();
            }
        };
    }

    
    const cancelBtn = document.getElementById('queueCancelBtn');
    if (cancelBtn) {
        cancelBtn.onclick = async() => {
            await fetch('/clear_queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ equipment_label: itemName, user_id: verifiedID })
            });
            popup.remove();
            refreshItems();
        };
    }

    
    popup.addEventListener('click', (e) => { if (e.target === popup) popup.remove(); });
}

setInterval(async() => {
    try {
        await fetch('/expire_queues', { method: 'POST' });
    } catch (e) {  }
}, 60000);

document.querySelectorAll('.confirm-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (!selectedItemName) return;

        if (currentMode === 'borrow') {
            showWaitPage();

            const waitBtn = document.getElementById('waitNextButton');
            const timerDisplay = document.getElementById('countdownTimer');
            const messageText = document.getElementById('waitMessageText');
            const loader = document.getElementById('borrowLoader');
            const successIcon = document.getElementById('borrowSuccessIcon');

            waitBtn.style.display = 'none';
            timerDisplay.style.display = 'none';

            
            fetch('/open-vault', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemName: selectedItemName })
                })
                .then(res => res.json())
                .then(data => console.log('Hardware Response (Buzz+Open):', data));

            
            setTimeout(() => {
                let timeLeft = 5;
                timerDisplay.style.display = 'block';
                timerDisplay.textContent = timeLeft;

                const countdown = setInterval(() => {
                    timeLeft -= 1;
                    timerDisplay.textContent = timeLeft;

                    if (timeLeft <= 0) {
                        clearInterval(countdown);

                        
                        timerDisplay.style.display = 'none';
                        if (loader) loader.style.display = 'none';

                        
                        if (successIcon) {
                            successIcon.style.display = 'block';
                            setTimeout(() => {
                                successIcon.style.opacity = '1';
                                successIcon.classList.add('animate-check');
                            }, 10);
                        }

                        
                        messageText.innerHTML = "Vault is now open, please get the item.";
                        messageText.classList.add('fade-in-up-blue');

                        
                        waitBtn.style.display = 'block';
                    }
                }, 1000);
            }, 2000);
        } else if (currentMode === 'return') {
            showReturnScanPage();
        }
    });
});

function showReturnScanPage() {
    document.querySelectorAll('section, div[id$="Page"]').forEach(el => el.style.display = 'none');

    const scanPage = document.getElementById('returnScanPage');
    const scanBox = document.getElementById('scannedEquipment');
    const nextBtn = document.getElementById('returnNextButton');

    scanPage.style.display = 'flex';
    scanBox.textContent = 'Waiting for scan...';
    nextBtn.style.display = 'none';

    let scannedInput = '';

    window.handleEquipmentScan = function(event) {
        if (['Shift', 'Control', 'Alt', 'CapsLock', 'Tab'].includes(event.key)) return;

        if (event.key === 'Enter') {
            event.preventDefault();

            let token = scannedInput.replace(/[^a-zA-Z0-9]/g, '').trim();
            scannedInput = '';

            if (!token) return;

            fetch('/verify_equipment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ qr_token: token, selected_label: selectedItemName })
                })
                .then(res => res.json())
                .then(data => {
                    const scanBoxEl = document.getElementById('scannedEquipment');
                    const nextBtnEl = document.getElementById('returnNextButton');

                    if (data.status === 'valid') {
                        
                        scanBoxEl.innerHTML = `<b style="color:green">✅ MATCH: ${data.masked_label}</b>`;
                        nextBtnEl.style.display = 'none'; 
                        document.removeEventListener('keydown', window.handleEquipmentScan);
                        setTimeout(() => {
                            scanPage.style.display = 'none';
                            startCVDetection();
                        }, 700); 
                    } else {
                        scanBoxEl.innerHTML = `<b style="color:red">❌ INVALID QR CODE</b><br><small>Not a match — try again</small>`;
                        nextBtnEl.style.display = 'none';
                    }
                });

        } else {
            scannedInput += event.key;
            document.getElementById('scannedEquipment').textContent = 'Scanning...';
        }
    };

    document.removeEventListener('keydown', window.handleEquipmentScan);
    document.addEventListener('keydown', window.handleEquipmentScan);

}

const CV_SERVER = 'http://localhost:5004';
const CV_DETECT_INTERVAL_MS = 400; 
const CV_CONFIRM_HOLD_MS = 1800; 
const CV_REQUEST_TIMEOUT_MS = 3500;

let cvStream = null; 
let cvDetectTimer = null;
let cvConfirmTimer = null;
let cvConfirmStart = null;
let cvActive = false;

async function startCVDetection() {
    
    
    try {
        const cfgRes = await fetch('/api/cv/config', {
            signal: AbortSignal.timeout(3000)
        });
        const cfg = await cfgRes.json();
        if (!cfg.cv_enabled) {
            
            console.log('[CV] Computer Vision is DISABLED — skipping detection, proceeding to return.');
            proceedToReturnTimer();
            return;
        }
    } catch (e) {
        
        console.warn('[CV] Could not check CV config — assuming disabled:', e.message);
        proceedToReturnTimer();
        return;
    }

    const page = document.getElementById('cvDetectionPage');

    
    cvActive = true;
    setCVState('scanning');
    setCVStatus('🔍', 'Starting camera…', '');
    document.getElementById('cvConfirmBarWrap').style.display = 'none';
    document.getElementById('cvConfirmBar').style.width = '0%';

    
    document.querySelectorAll('section, div[id$="Page"], #scanIDPopup, #returnScanPage')
        .forEach(el => { if (el.id !== 'cvDetectionPage') el.style.display = 'none'; });
    page.style.display = 'block';

    document.getElementById('cvCancelBtn').onclick = cancelCVDetection;

    
    fetch(`${CV_SERVER}/start_detection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expected_item: selectedItemName.toLowerCase() }),
            signal: AbortSignal.timeout(3000)
        })
        .then(r => r.json())
        .then(s => {
            if (!cvActive) return;
            if (!s.camera_available) {
                setCVStatus('❌', 'OpenCV hindi installed sa cv_server', 'pip3 install opencv-python-headless');
                return;
            }
            if (!s.model_loaded) {
                setCVStatus('⚠️', 'YOLO model hindi na-load', `Check cv_server.py · ${selectedItemName}`);
            }
            
            openMJPEGFeed();
            startDetectionLoop();
        })
        .catch(err => {
            if (!cvActive) return;
            setCVStatus('❌', 'CV server offline — hindi makonekta', `${err.message}`);
            
            setTimeout(() => {
                if (!cvActive) return;
                cvCleanup();
                proceedToReturnTimer();
            }, 5000);
        });
}

function openMJPEGFeed() {
    
    const video = document.getElementById('cvVideo');
    if (video) video.style.display = 'none';

    
    const oldImg = document.getElementById('cvMjpegImg');
    if (oldImg) oldImg.remove();

    
    
    const img = document.createElement('img');
    img.id = 'cvMjpegImg';
    img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block; position:absolute; top:0; left:0;';
    
    img.src = `${CV_SERVER}/camera_feed?t=${Date.now()}`;
    img.alt = 'Camera feed';

    img.onerror = () => {
        if (!cvActive) return;
        setCVStatus('Camera stream error', 'Check na nakakonekta ang webcam at tumatakbo ang cv_server.py');
    };

    const wrapper = document.getElementById('cvCameraWrapper');
    
    const canvas = document.getElementById('cvCanvas');
    wrapper.insertBefore(img, canvas);

    setCVStatus('Scanning for item…', `Expected: ${selectedItemName}`);
}

function startDetectionLoop() {
    if (!cvActive) return;

    cvDetectTimer = setInterval(async() => {
        if (!cvActive) return;

        try {
            const res = await fetch(`${CV_SERVER}/detect_live`, {
                signal: AbortSignal.timeout(CV_REQUEST_TIMEOUT_MS)
            });
            const data = await res.json();
            if (!cvActive) return;

            
            
            handleDetectionResult(data);

        } catch (e) {
            
            console.warn('[CV] Poll skip:', e.message);
        }

    }, CV_DETECT_INTERVAL_MS);
}

function handleDetectionResult(data) {
    if (data.match) {
        
        const pct = Math.round(data.matched_confidence * 100);
        setCVState('detected');
        setCVStatus(
            '✅',
            `${selectedItemName} detected!`,
            `${data.matched_class} · ${pct}% confidence · ${data.inference_ms}ms`
        );
        startConfirmHold();

    } else if (data.detected) {
        
        stopConfirmHold();
        setCVState('wrong');
        const found = data.found_classes.join(', ') || 'unknown';
        setCVStatus(
            '❌',
            'Wrong item detected',
            `Detected: ${found} — Please show ${selectedItemName}`
        );

    } else {
        
        stopConfirmHold();
        setCVState('scanning');
        setCVStatus(
            '🔍',
            'Scanning for item…',
            `Expected: ${selectedItemName} · ${data.inference_ms}ms`
        );
    }
}

function startConfirmHold() {
    if (cvConfirmStart !== null) return; 

    const barWrap = document.getElementById('cvConfirmBarWrap');
    const bar = document.getElementById('cvConfirmBar');
    barWrap.style.display = 'block';
    cvConfirmStart = Date.now();

    
    cvConfirmTimer = setInterval(() => {
        const elapsed = Date.now() - cvConfirmStart;
        const pct = Math.min(100, (elapsed / CV_CONFIRM_HOLD_MS) * 100);
        bar.style.width = pct + '%';

        if (elapsed >= CV_CONFIRM_HOLD_MS) {
            
            clearInterval(cvConfirmTimer);
            cvConfirmTimer = null;
            cvActive = false;
            clearInterval(cvDetectTimer);
            cvDetectTimer = null;

            bar.style.width = '100%';
            setCVStatus('🎉', 'Item confirmed! Opening vault…', '');

            setTimeout(() => {
                cvCleanup();
                proceedToReturnTimer();
            }, 600);
        }
    }, 80);
}

function stopConfirmHold() {
    if (cvConfirmTimer) {
        clearInterval(cvConfirmTimer);
        cvConfirmTimer = null;
    }
    cvConfirmStart = null;
    document.getElementById('cvConfirmBar').style.width = '0%';
    document.getElementById('cvConfirmBarWrap').style.display = 'none';
}

function drawBoxes(canvas, boxes, vidW, vidH) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!boxes || boxes.length === 0) return;

    
    
    
    const renderedW = canvas.offsetWidth || canvas.width;
    const renderedH = canvas.offsetHeight || canvas.height;
    const scaleX = renderedW / vidW;
    const scaleY = renderedH / vidH;

    boxes.forEach(b => {
        const [x1, y1, x2, y2] = b.box;
        const bx = x1 * scaleX;
        const by = y1 * scaleY;
        const bw = (x2 - x1) * scaleX;
        const bh = (y2 - y1) * scaleY;

        
        
        const state = document.getElementById('cvDetectionPage').className;
        const color = state.includes('detected') ? '#22c55e' :
            state.includes('wrong') ? '#ef4444' : '#38bdf8';

        ctx.globalAlpha = CV_CANVAS_ALPHA;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, by, bw, bh);

        
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        const label = `${b.class} ${Math.round(b.confidence * 100)}%`;
        ctx.font = 'bold 13px Poppins, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillRect(bx, by - 20, tw + 10, 20);

        
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.fillText(label, bx + 5, by - 5);
    });
}

function setCVState(state) {
    const page = document.getElementById('cvDetectionPage');
    page.className = `cv-detection-page cv-state-${state}`;
}

function setCVStatus(icon, text, sub) {
    document.getElementById('cvStatusIcon').textContent = icon;
    document.getElementById('cvStatusText').textContent = text;
    document.getElementById('cvDetectedLabel').textContent = sub;
}

function cvCleanup() {
    cvActive = false;
    if (cvDetectTimer) {
        clearInterval(cvDetectTimer);
        cvDetectTimer = null;
    }
    if (cvConfirmTimer) {
        clearInterval(cvConfirmTimer);
        cvConfirmTimer = null;
    }
    cvConfirmStart = null;

    
    const img = document.getElementById('cvMjpegImg');
    if (img) {
        img.src = ''; 
        img.remove();
    }

    
    const video = document.getElementById('cvVideo');
    if (video) video.style.display = '';

    
    fetch(`${CV_SERVER}/stop_detection`, { method: 'POST' }).catch(() => {});

    
    cvStream = null;
}

function cancelCVDetection() {
    cvCleanup();
    document.getElementById('cvDetectionPage').style.display = 'none';
    
    showReturnScanPage();
}

function proceedToReturnTimer() {
    document.getElementById('cvDetectionPage').style.display = 'none';
    startReturnTimer();
}

function startReturnTimer() {
    const returnWaitPage = document.getElementById('returnWaitPage');
    const timerDisplay = document.getElementById('returnCountdownTimer');
    const returnWaitNextBtn = document.getElementById('returnWaitNextButton');
    const returnMessage = document.getElementById('returnWaitMessage');
    const loader = document.getElementById('returnLoader');
    const successCheck = document.getElementById('returnSuccessCheck');

    
    document.querySelectorAll('section, div[id$="Page"]').forEach(el => el.style.display = 'none');
    returnWaitPage.style.display = 'flex';
    returnWaitNextBtn.style.display = 'none';

    
    loader.style.display = 'block';
    successCheck.style.display = 'none';
    successCheck.style.opacity = '0';
    successCheck.classList.remove('animate-check');
    timerDisplay.style.display = 'block';
    returnMessage.textContent = "Vault is opening, please wait.";
    returnMessage.style.color = "white";
    returnMessage.classList.remove('fade-in-up-blue');

    
    timerDisplay.style.display = 'none';

    let timeLeft = 5;

    fetch('/open-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: selectedItemName })
    });

    timerDisplay.style.display = 'block';
    timerDisplay.textContent = timeLeft;

    const timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            timerDisplay.textContent = timeLeft;
        } else {
            clearInterval(timerInterval);

            
            loader.style.display = 'none';
            timerDisplay.style.display = 'none';

            
            successCheck.style.display = 'block';
            setTimeout(() => {
                successCheck.style.opacity = '1';
                successCheck.classList.add('animate-check');
            }, 10);

            
            returnMessage.textContent = "Vault is now open! Please return the equipment.";
            returnMessage.classList.add('fade-in-up-blue');

            
            returnWaitNextBtn.style.display = 'flex';

            returnWaitNextBtn.onclick = function() {
                returnWaitPage.style.display = 'none';
                showConditionPage();
            };
        }
    }, 1000);
}

function showWaitPage() {
    document.querySelectorAll('section, div[id$="Page"], #scanIDPopup, #returnScanPage')
        .forEach(el => el.style.display = 'none');
    const wp = document.getElementById('waitPage');
    if (wp) wp.style.display = 'block';
}

function showConditionPage() {
    document.getElementById('waitPage').style.display = 'none';
    document.getElementById('conditionPage').style.display = 'block';

    
    if (currentMode === 'borrow' && selectedItemName) {
        fetch('/check_item_reports')
            .then(res => res.json())
            .then(data => {
                const flaggedMap = data.flagged || {};
                const reportTypes = flaggedMap[selectedItemName] || [];

                
                if (reportTypes.includes('no_item')) {
                    const mainContent = document.querySelector('.condition-container');
                    if (mainContent) mainContent.style.display = 'none';
                    const warningOverlay = document.getElementById('warningOverlay');
                    if (warningOverlay) warningOverlay.style.display = 'flex';
                    setTimeout(() => location.reload(), 45000);
                }
                
            })
            .catch(err => console.error('Item report check error:', err));
    }
}

(function initConditionPage() {
    const noBtn = document.getElementById('noBtn');
    const dropdownBorrow = document.getElementById('noDropdownBorrow');
    const dropdownReturn = document.getElementById('noDropdownReturn');
    const submitBorrowBtn = document.getElementById('submitNoBorrow');
    const submitReturnBtn = document.getElementById('submitNoReturn');
    const yesBtn = document.getElementById('yesBtn');

    
    if (noBtn) {
        noBtn.addEventListener('click', () => {
            if (currentMode === 'borrow') {
                const isOpen = dropdownBorrow.classList.contains('show');
                dropdownBorrow.classList.toggle('show', !isOpen);
                dropdownReturn.classList.remove('show');
            } else {
                const isOpen = dropdownReturn.classList.contains('show');
                dropdownReturn.classList.toggle('show', !isOpen);
                dropdownBorrow.classList.remove('show');
            }
        });

        dropdownBorrow.addEventListener('click', e => e.stopPropagation());
        dropdownReturn.addEventListener('click', e => e.stopPropagation());
    }

    
    if (submitBorrowBtn) {
        submitBorrowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const checkedBoxes = dropdownBorrow.querySelectorAll('input[type="checkbox"]:checked');
            const reasons = [];
            checkedBoxes.forEach(cb => reasons.push(cb.parentElement.textContent.trim()));

            if (reasons.length === 0) {
                alert("Please select at least one reason for the report.");
                return;
            }

            equipmentCondition = 'No: ' + reasons.join(', ');

            const hasNoItem = reasons.some(r => r.toLowerCase().includes('no item'));

            if (hasNoItem) {
                
                
                fetch('/log_item_report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: verifiedID,
                        user_name: verifiedName,
                        equipment_label: selectedItemName,
                        report_types: ['no_item']
                    })
                }).then(res => res.json()).then(data => console.log('Item Report Saved:', data));

                
                fetch('/set_warning', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        equipment_label: selectedItemName,
                        user_id: verifiedID,
                        user_name: verifiedName
                    })
                });

                
                setTimeout(() => {
                    fetch("/close-vault", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ itemName: selectedItemName })
                    });
                }, 3000);

                
                
                const mainContent = document.querySelector('.condition-container');
                if (mainContent) mainContent.style.display = 'none';
                const warningOverlay = document.getElementById('warningOverlay');
                if (warningOverlay) warningOverlay.style.display = 'flex';

            } else {
                
                fetch('/log_transaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: verifiedID,
                        user_name: verifiedName,
                        equipment_label: selectedItemName,
                        action: currentMode,
                        condition: equipmentCondition
                    })
                }).then(res => res.json()).then(data => console.log('Transaction Saved:', data));

                
                document.getElementById('conditionPage').style.display = 'none';
                showThankYou(true, true);
            }
        });
    }

    
    if (submitReturnBtn) {
        submitReturnBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const checkedBoxes = dropdownReturn.querySelectorAll('input[type="checkbox"]:checked');
            const reasons = [];
            checkedBoxes.forEach(cb => reasons.push(cb.parentElement.textContent.trim()));

            if (reasons.length === 0) {
                alert("Please select at least one reason for the report.");
                return;
            }

            equipmentCondition = 'No: ' + reasons.join(', ');

            
            const reportTypes = [];
            if (reasons.some(r => r.toLowerCase().includes('physical damage'))) reportTypes.push('physical_damage');
            if (reasons.some(r => r.toLowerCase().includes('not working'))) reportTypes.push('not_working');

            
            fetch('/log_transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: verifiedID,
                    user_name: verifiedName,
                    equipment_label: selectedItemName,
                    action: currentMode,
                    condition: equipmentCondition
                })
            }).then(res => res.json()).then(data => console.log('Transaction Saved:', data));

            
            if (reportTypes.length > 0) {
                fetch('/log_item_report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: verifiedID,
                        user_name: verifiedName,
                        equipment_label: selectedItemName,
                        report_types: reportTypes
                    })
                }).then(res => res.json()).then(data => console.log('Item Report Saved:', data));
            }

            
            document.getElementById('conditionPage').style.display = 'none';
            showThankYou(false, reportTypes.length > 0, true);
        });
    }

    
    if (yesBtn) {
        yesBtn.addEventListener('click', () => {
            equipmentCondition = 'Yes';

            fetch('/log_transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: verifiedID,
                    user_name: verifiedName,
                    equipment_label: selectedItemName,
                    action: currentMode,
                    condition: equipmentCondition
                })
            }).then(res => res.json()).then(data => console.log('Transaction Saved:', data));

            document.getElementById('conditionPage').style.display = 'none';
            showThankYou(currentMode === 'borrow');
        });
    }
})();

function showThankYou(showReminder, hasDamage = false, isReturn = false) {
    document.querySelectorAll('section, div[id$="Page"], #scanIDPopup, #returnScanPage')
        .forEach(el => el.style.display = 'none');

    if (hasDamage && isReturn) {
        const p = document.getElementById('returnDamageWarningPage');
        if (p) p.style.display = 'flex';
    } else if (hasDamage) {
        const p = document.getElementById('damageWarningPage');
        if (p) p.style.display = 'flex';

        
        const countdownEl = document.getElementById('damageCountdown');
        const doneBtn = document.getElementById('damageDoneBtn');
        let secs = 5;
        if (countdownEl && doneBtn) {
            countdownEl.textContent = secs;
            doneBtn.disabled = true;
            const dmgInterval = setInterval(() => {
                secs--;
                if (secs > 0) {
                    countdownEl.textContent = secs;
                } else {
                    clearInterval(dmgInterval);
                    countdownEl.textContent = '';
                    doneBtn.disabled = false;
                }
            }, 1000);

            doneBtn.onclick = function() {
                
                fetch('/log_transaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: verifiedID,
                        user_name: verifiedName,
                        equipment_label: selectedItemName,
                        action: 'return',
                        condition: equipmentCondition
                    })
                }).then(res => res.json()).then(data => console.log('Return logged:', data));

                
                if (p) p.style.display = 'none';
                const thanks = document.getElementById('thankYouPage');
                if (thanks) thanks.style.display = 'flex';
                setTimeout(() => location.reload(), 5000);
            };
        }
    } else {
        const thanks = document.getElementById('thankYouPage');
        const reminder = document.getElementById('returnReminder');
        const deadline = document.getElementById('returnDeadline');

        if (thanks) thanks.style.display = 'flex';

        if (showReminder && reminder && deadline) {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const borrowedAfter1pm = hour >= 13; 

            let due;
            let deadlineText;

            if (borrowedAfter1pm) {
                
                due = new Date(now);
                due.setHours(17, 30, 0, 0);
                deadlineText = '5:30 PM, ' + due.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            } else {
                
                due = new Date(Date.now() + 4 * 60 * 60 * 1000);
                deadlineText = due.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }) + ', ' + due.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }

            deadline.textContent = deadlineText;
            reminder.style.display = 'flex';
        }
    }

    
    if (!(hasDamage && !isReturn)) {
        setTimeout(() => location.reload(), 5000);
    }
}

(function() {
    let warningScannedID = '';

    document.addEventListener('keydown', function(event) {
        const warningOverlay = document.getElementById('warningOverlay');
        if (!warningOverlay || warningOverlay.style.display !== 'flex') {
            warningScannedID = '';
            return;
        }

        if (event.key === 'Enter' || event.key === 'Return') {
            event.preventDefault();
            const cleanID = warningScannedID.trim();
            warningScannedID = '';

            if (!cleanID) return;

            fetch('/verify_id', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_number: cleanID })
                })
                .then(res => res.json())
                .then(result => {
                    if (result.status === 'admin' || (result.status === 'valid' && result.is_admin)) {
                        
                        fetch('/clear_warning', { method: 'POST' })
                            .finally(() => {
                                window.location.href = '/admin-vault';
                            });
                    }
                })
                .catch(() => { warningScannedID = ''; });

        } else if (event.key.length === 1) {
            warningScannedID += event.key;
        }
    });
})();

