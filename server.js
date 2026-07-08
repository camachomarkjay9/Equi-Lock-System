const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const { execSync, spawn } = require('child_process');
const os = require('os');
const http = require('http');

function postLocalJson(path, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = http.request({
            hostname: 'localhost',
            port: 5004,
            path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const app = express();
const PORT = 5003;

app.use(cors());
app.use(bodyParser.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

const usersDb = new sqlite3.Database(path.join(__dirname, 'users.db'));
const transDb = new sqlite3.Database(path.join(__dirname, 'transactions.db'));
const csvPath = path.join(__dirname, 'equipment.csv');

const scanStartTimes = {};

transDb.run(`ALTER TABLE transactions ADD COLUMN borrow_transaction_duration TEXT`, () => {});
transDb.run(`ALTER TABLE transactions ADD COLUMN return_transaction_duration TEXT`, () => {});

let arduinoPort = null;
let arduinoConnected = false;

function tryConnectArduino() {
    try {
        const { SerialPort } = require('serialport');
        const port = new SerialPort({
            path: 'COM6', 
            baudRate: 9600,
            autoOpen: false
        });

        port.open((err) => {
            if (err) {
                console.warn(`⚠️  Arduino NOT connected (${err.message}). Running in SIMULATION mode.`);
                arduinoConnected = false;
            } else {
                console.log('✅ Arduino connected on /dev/ttyUSB0');
                arduinoPort = port;
                arduinoConnected = true;
            }
        });

        port.on('error', (err) => {
            console.warn(`⚠️  Arduino error: ${err.message}. Switching to SIMULATION mode.`);
            arduinoConnected = false;
            arduinoPort = null;
        });

        port.on('close', () => {
            console.warn('⚠️  Arduino disconnected. Switching to SIMULATION mode.');
            arduinoConnected = false;
            arduinoPort = null;
        });

    } catch (err) {
        console.warn(`⚠️  SerialPort unavailable (${err.message}). Running in SIMULATION mode.`);
        arduinoConnected = false;
    }
}

function sendToArduino(command) {
    if (arduinoConnected && arduinoPort) {
        arduinoPort.write(`${command}\n`, (err) => {
            if (err) console.error(`❌ Arduino write error: ${err.message}`);
        });
        console.log(`📡 [ARDUINO] Sent: ${command}`);
    } else {
        console.log(`🔵Arduino command: ${command}`);
    }
}

tryConnectArduino();

const itemHardwareMap = {
    "Calculator 1": "C1",
    "Calculator 2": "C2",
    "Calculator 3": "C3",
    "Calculator 4": "C4",
    "Calculator 5": "C5", 
    "Calculator 6": "C6",
    "Calculator 7": "C7",
    "Projector 1": "P1",
    "Projector 2": "P2",
    "Projector 3": "P3",
    "Projector 4": "P4",
    "Extension 1": "E1",
    "Extension 2": "E2",
    "Extension 3": "E3",
    "Extension 4": "E4",
    "HDMI 1": "H1",
    "HDMI 2": "H2",
    "HDMI 3": "H3",
    "HDMI 4": "H4"
};

app.post('/verify_equipment', (req, res) => {
    const { qr_token, selected_label } = req.body;
    let found = false;

    const cleanToken = qr_token.replace(/[^a-zA-Z0-9]/g, '').trim().toLowerCase();
    
    
    const resolvedLabel = resolveItemKey(selected_label) || selected_label;

    fs.createReadStream(csvPath)
        .pipe(csv({ bom: true }))
        .on('data', (row) => {
            
            const rawToken = row['qr_token'] || row['qr_token\r'] || '';
            const rawLabel = row['label'] || row['\ufefflabel'] || '';
            const csvToken = rawToken.replace(/[^a-zA-Z0-9]/g, '').trim().toLowerCase();
            const csvLabel = rawLabel.replace(/\r/g, '').trim();

            console.log(`[verify] token:[${csvToken}] vs [${cleanToken}] | label:[${csvLabel}] vs [${resolvedLabel}] (selected: "${selected_label}")`);

            if (csvToken === cleanToken && csvLabel === resolvedLabel) {
                found = true;
                if (!res.headersSent) {
                    res.json({ status: 'valid', masked_label: 'QR Code Verified ✓' });
                }
            }
        })
        .on('end', () => {
            if (!found && !res.headersSent) {
                console.log(`No match: token[${cleanToken}] label[${resolvedLabel}]`);
                res.json({ status: 'invalid' });
            }
        });
});

app.post('/verify_id', (req, res) => {
    const id_number = req.body.id_number ? String(req.body.id_number).trim() : "";

    usersDb.get(
        `SELECT fullname, ban_start, ban_end, violation_count
         FROM users
         WHERE idnumber = ?`, [id_number],
        (err, row) => {
            if (err) {
                console.error("❌ Database Error:", err);
                return res.status(500).json({ status: "error", message: "Database error" });
            }

            if (!row) {
                
                fetch('http://localhost:5000/api/admin_kiosk/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id_number: id_number })
                    })
                    .then(r => r.json())
                    .then(adminResult => {
                        console.log(`[ADMIN CHECK] Not in users table. Flask says is_admin: ${adminResult.is_admin}`);
                        if (adminResult.is_admin === true) {
                            res.json({ status: "admin", is_admin: true, admin_name: adminResult.admin_name });
                        } else {
                            res.json({ status: "invalid", message: "ID not found" });
                        }
                    })
                    .catch(() => {
                        res.json({ status: "invalid", message: "ID not found" });
                    });
                return;
            }

            console.log(`User: ${row.fullname}, Violations: ${row.violation_count}`);

            
            if (Number(row.violation_count) >= 3) {
                return res.json({
                    status: "banned",
                    id_number: id_number,
                    ban_start: "PERMANENT",
                    ban_end: "PERMANENT",
                    message: "This ID is permanently banned, Please Consult the Admin"
                });
            }

            
            const now = new Date();
            const banStart = row.ban_start ? new Date(row.ban_start.replace(" ", "T")) : null;
            const banEnd = row.ban_end ? new Date(row.ban_end.replace(" ", "T")) : null;

            
            if (banStart && banEnd && now >= banStart && now <= banEnd) {
                return res.json({
                    status: "banned",
                    id_number,
                    ban_start: row.ban_start,
                    ban_end: row.ban_end,
                    message: `This ID is temporary banned until ${row.ban_end}`
                });
            }

            
            fetch('http://localhost:5000/api/admin_kiosk/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_number: id_number })
                })
                .then(r => r.json())
                .then(adminResult => {
                    console.log(`[ADMIN CHECK] Scanned: [${id_number}] len=${id_number.length}`);
                    console.log(`[ADMIN CHECK] Scanned hex: ${Buffer.from(id_number).toString('hex')}`);
                    console.log(`[ADMIN CHECK] Flask says is_admin: ${adminResult.is_admin}`);
                    
                    scanStartTimes[id_number] = Date.now();
                    res.json({
                        status: "valid",
                        name: row.fullname,
                        is_admin: adminResult.is_admin === true
                    });
                })
                .catch(err => {
                    console.warn(`[ADMIN CHECK] Flask unreachable: ${err.message}`);
                    
                    scanStartTimes[id_number] = Date.now();
                    res.json({
                        status: "valid",
                        name: row.fullname,
                        is_admin: false
                    });
                });
        }
    );
});

app.post('/check_availability', (req, res) => {
    const { equipment_label, user_idnumber } = req.body;

    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    const currentTime = now.toTimeString().slice(0, 5);

    console.log(`[CHECK] Date: ${today} | Time: ${currentTime} | Label: ${equipment_label}`);

    usersDb.get(`
        SELECT user_idnumber, start_time, end_time 
        FROM reservations 
        WHERE equipment_label = ? AND date_key = ?
    `, [equipment_label, today], (err, reservation) => {
        if (err) {
            console.error("Database Error (Reservations):", err);
            return res.status(500).json({ status: 'error' });
        }

        transDb.get(`
            SELECT user_id FROM transactions 
            WHERE equipment_label = ? AND return_time IS NULL
            ORDER BY id DESC LIMIT 1
        `, [equipment_label], (err, transaction) => {
            if (err) {
                console.error("Database Error (Transactions):", err);
                return res.status(500).json({ status: 'error' });
            }

            if (transaction) {
                if (String(transaction.user_id) === String(user_idnumber)) {
                    return res.json({ status: 'available', message: 'Nasa iyo na ang item na ito.' });
                } else {
                    return res.json({
                        status: 'unavailable',
                        reason: 'still_in_use',
                        message: 'Kasalukuyang hiniram ng ibang user.'
                    });
                }
            }

            
            
            transDb.get(
                `SELECT return_time FROM transactions 
                 WHERE equipment_label = ? AND return_time IS NOT NULL 
                 ORDER BY id DESC LIMIT 1`, [equipment_label],
                (err, lastReturn) => {
                    if (err) {
                        console.error("Database Error (Last Return):", err);
                        return res.status(500).json({ status: 'error' });
                    }

                    transDb.get(
                        `SELECT user_id, user_name FROM item_queue 
                         WHERE equipment_label = ? 
                         ORDER BY id ASC LIMIT 1`, [equipment_label],
                        (err, queueEntry) => {
                            if (err) {
                                console.error("Database Error (Queue):", err);
                                return res.status(500).json({ status: 'error' });
                            }

                            
                            if (queueEntry && lastReturn) {
                                const returnTime = new Date(lastReturn.return_time.replace(' ', 'T'));
                                const minutesSinceReturn = (now - returnTime) / 60000;

                                if (minutesSinceReturn < 30) {
                                    const isQueuedUser = String(queueEntry.user_id) === String(user_idnumber);
                                    if (!isQueuedUser) {
                                        const minutesLeft = Math.ceil(30 - minutesSinceReturn);
                                        console.log(`[QUEUE BLOCK] ${user_idnumber} blocked — ${queueEntry.user_name} has priority for ${minutesLeft} more min`);
                                        return res.json({
                                            status: 'unavailable',
                                            reason: 'queue_priority',
                                            message: `May priority user na naka-queue. Magiging available sa lahat pagkatapos ng ${minutesLeft} minuto.`,
                                            minutes_left: minutesLeft
                                        });
                                    } else {
                                        console.log(`[QUEUE] Priority user ${user_idnumber} is borrowing — clearing queue`);
                                        return res.json({ status: 'available', message: 'Ikaw ang priority sa queue!' });
                                    }
                                }
                                
                            }

                            
                            if (reservation) {
                                const isReservedForMe = (String(reservation.user_idnumber) === String(user_idnumber));
                                const isAfter = (currentTime > reservation.end_time);
                                const isWithin = (currentTime >= reservation.start_time && currentTime <= reservation.end_time);

                                if (isAfter) {
                                    return res.json({ status: 'available' });
                                }

                                if (isWithin) {
                                    if (isReservedForMe) {
                                        return res.json({ status: 'available' });
                                    } else {
                                        return res.json({
                                            status: 'unavailable',
                                            reason: 'reserved_for_another_user',
                                            until: reservation.end_time,
                                            message: `Naka-reserve ito hanggang ${reservation.end_time}.`
                                        });
                                    }
                                }

                                if (currentTime < reservation.start_time && !isReservedForMe) {
                                    return res.json({
                                        status: 'unavailable',
                                        reason: 'reserved_for_another_user',
                                        starts: reservation.start_time,
                                        message: `Naka-reserve ito simula ${reservation.start_time}.`
                                    });
                                }
                            }

                            res.json({ status: 'available' });
                        }
                    );
                }
            );
        });
    });
});

app.get('/active_reservations', (req, res) => {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    const currentTime = now.toTimeString().slice(0, 5);

    usersDb.all(`
        SELECT equipment_label, user_idnumber, start_time, end_time 
        FROM reservations 
        WHERE date_key = ? AND end_time >= ?
        ORDER BY start_time ASC
    `, [today, currentTime], (err, rows) => {
        if (err) {
            console.error("Dashboard Error:", err);
            return res.status(500).json({ status: 'error' });
        }
        res.json(rows);
    });
});

app.get('/borrowed_items', (req, res) => {
    transDb.all(`SELECT equipment_label, user_id, borrow_time FROM transactions WHERE return_time IS NULL`, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error' });
        res.json(rows);
    });
});

transDb.run(`
    CREATE TABLE IF NOT EXISTS item_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_label TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        queued_at TEXT,
        notified_at TEXT
    )
`);

app.post('/join_queue', (req, res) => {
    const { equipment_label, user_id, user_name } = req.body;
    const now = new Date();
    const timestamp = now.toLocaleString('sv-SE').replace('T', ' ');

    
    transDb.get(
        `SELECT id, user_id FROM item_queue WHERE equipment_label = ?`, [equipment_label],
        (err, existing) => {
            if (existing) {
                if (String(existing.user_id) === String(user_id)) {
                    return res.json({ status: 'already_queued' });
                } else {
                    return res.json({ status: 'queue_full' });
                }
            }

            transDb.run(
                `INSERT INTO item_queue (equipment_label, user_id, user_name, queued_at) VALUES (?, ?, ?, ?)`, [equipment_label, user_id, user_name, timestamp],
                (err) => {
                    if (err) return res.status(500).json({ status: 'error' });
                    console.log(`📋 Queue: [${equipment_label}] → ${user_name}`);
                    res.json({ status: 'success' });
                }
            );
        }
    );
});

app.get('/check_queue', (req, res) => {
    transDb.all(`SELECT * FROM item_queue ORDER BY id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error' });

        const now = new Date();

        
        const lookups = rows.map(row => new Promise(resolve => {
            if (row.notified_at) {
                
                return resolve(row);
            }

            
            transDb.get(
                `SELECT return_time FROM transactions
                 WHERE equipment_label = ? AND return_time IS NOT NULL
                 ORDER BY id DESC LIMIT 1`, [row.equipment_label],
                (err, lastReturn) => {
                    if (lastReturn) {
                        
                        transDb.run(
                            `UPDATE item_queue SET notified_at = ? WHERE id = ?`, [lastReturn.return_time, row.id]
                        );
                        resolve({...row, notified_at: lastReturn.return_time });
                    } else {
                        resolve(row); 
                    }
                }
            );
        }));

        Promise.all(lookups).then(resolvedRows => {
            const queueMap = {};
            resolvedRows.forEach(row => {
                if (!queueMap[row.equipment_label]) {
                    
                    let priorityMinutesLeft = null;
                    if (row.notified_at) {
                        const notifiedTime = new Date(row.notified_at.replace(' ', 'T'));
                        const minutesSince = (now - notifiedTime) / 60000;
                        if (minutesSince < 30) {
                            priorityMinutesLeft = Math.ceil(30 - minutesSince);
                        }
                    }
                    queueMap[row.equipment_label] = {
                        user_id: row.user_id,
                        user_name: row.user_name,
                        queued_at: row.queued_at,
                        notified_at: row.notified_at,
                        priority_minutes_left: priorityMinutesLeft
                    };
                }
            });
            res.json({ queue: queueMap });
        });
    });
});

app.post('/expire_queues', (req, res) => {
    const now = new Date();

    
    transDb.all(`SELECT * FROM item_queue`, [], (err, queueRows) => {
        if (err) return res.status(500).json({ status: 'error' });

        
        const checks = queueRows.map(row => {
            return new Promise(resolve => {
                
                transDb.get(
                    `SELECT id, return_time FROM transactions 
                     WHERE equipment_label = ? AND return_time IS NOT NULL 
                     ORDER BY id DESC LIMIT 1`, [row.equipment_label],
                    (err, lastReturn) => {
                        if (!lastReturn) return resolve(null); 

                        const returnTime = new Date(lastReturn.return_time.replace(' ', 'T'));
                        const queuedAt = new Date(row.queued_at.replace(' ', 'T'));

                        
                        
                        if (returnTime < queuedAt) return resolve(null);

                        
                        const windowStart = row.notified_at ?
                            new Date(row.notified_at.replace(' ', 'T')) :
                            returnTime;
                        const minutesSinceWindow = (now - windowStart) / 60000;

                        if (minutesSinceWindow >= 30) {
                            
                            transDb.run(
                                `DELETE FROM item_queue WHERE id = ?`, [row.id],
                                () => {
                                    console.log(`⏰ Queue expired: [${row.equipment_label}] for ${row.user_name}`);
                                    resolve({ expired: true, equipment_label: row.equipment_label });
                                }
                            );
                        } else {
                            resolve(null);
                        }
                    }
                );
            });
        });

        Promise.all(checks).then(results => {
            const expired = results.filter(Boolean);
            res.json({ status: 'ok', expired });
        });
    });
});

app.post('/clear_queue', (req, res) => {
    const { equipment_label, user_id } = req.body;
    transDb.run(
        `DELETE FROM item_queue WHERE equipment_label = ? AND user_id = ?`, [equipment_label, user_id],
        (err) => {
            if (err) return res.status(500).json({ status: 'error' });
            res.json({ status: 'success' });
        }
    );
});

transDb.run(`
    CREATE TABLE IF NOT EXISTS item_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_label TEXT NOT NULL,
        report_type TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        reported_at TEXT
    )
`);

app.post('/log_item_report', (req, res) => {
    const { user_id, user_name, equipment_label, report_types } = req.body;
    const now = new Date();
    const timestamp = now.toLocaleString('sv-SE').replace('T', ' ');

    if (!report_types || report_types.length === 0) {
        return res.status(400).json({ status: 'error', message: 'No report_types provided' });
    }

    const stmt = transDb.prepare(
        `INSERT INTO item_reports (equipment_label, report_type, user_id, user_name, reported_at) VALUES (?, ?, ?, ?, ?)`
    );

    report_types.forEach(type => {
        stmt.run([equipment_label, type, user_id, user_name, timestamp]);
        console.log(`⚠️  Item Report [${type}]: [${equipment_label}] by ${user_name}`);
    });

    stmt.finalize((err) => {
        if (err) {
            console.error('❌ Item Report Error:', err);
            return res.status(500).json({ status: 'error' });
        }
        res.json({ status: 'success' });
    });
});

app.get('/check_item_reports', (req, res) => {
    transDb.all(
        `SELECT equipment_label, report_type FROM item_reports`, [],
        (err, rows) => {
            if (err) {
                console.error('❌ Check Item Reports Error:', err);
                return res.status(500).json({ status: 'error' });
            }

            
            const flagged = {};
            rows.forEach(row => {
                if (!flagged[row.equipment_label]) flagged[row.equipment_label] = [];
                if (!flagged[row.equipment_label].includes(row.report_type)) {
                    flagged[row.equipment_label].push(row.report_type);
                }
            });

            res.json({ flagged });
        }
    );
});

transDb.run(`
    CREATE TABLE IF NOT EXISTS kiosk_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_label TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        created_at TEXT NOT NULL,
        active INTEGER DEFAULT 1
    )
`);

app.get('/warning_status', (req, res) => {
    transDb.get(
        `SELECT equipment_label, user_name, created_at FROM kiosk_warnings WHERE active = 1 ORDER BY id DESC LIMIT 1`, [],
        (err, row) => {
            if (err) return res.status(500).json({ status: 'error' });
            if (row) {
                res.json({ active: true, equipment_label: row.equipment_label, user_name: row.user_name, created_at: row.created_at });
            } else {
                res.json({ active: false });
            }
        }
    );
});

app.post('/set_warning', (req, res) => {
    const { equipment_label, user_id, user_name } = req.body;
    const now = new Date().toLocaleString('sv-SE').replace('T', ' ');

    
    transDb.run(`UPDATE kiosk_warnings SET active = 0`, [], (err) => {
        transDb.run(
            `INSERT INTO kiosk_warnings (equipment_label, user_id, user_name, created_at, active) VALUES (?, ?, ?, ?, 1)`, [equipment_label, user_id || '', user_name || '', now],
            (err) => {
                if (err) return res.status(500).json({ status: 'error' });
                console.log(`🚨 Warning set: [${equipment_label}] by ${user_name}`);
                res.json({ status: 'success' });
            }
        );
    });
});

app.post('/clear_warning', (req, res) => {
    transDb.run(`UPDATE kiosk_warnings SET active = 0`, [], (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        console.log(`✅ Warning cleared by admin`);
        res.json({ status: 'success' });
    });
});

transDb.run(`
    CREATE TABLE IF NOT EXISTS kiosk_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
`);

app.get('/api/cv/config', (req, res) => {
    transDb.get(
        `SELECT value FROM kiosk_config WHERE key = 'cv_enabled'`, [],
        (err, row) => {
            if (err) return res.status(500).json({ status: 'error' });
            
            const cv_enabled = row ? row.value === 'true' : false;
            res.json({ cv_enabled });
        }
    );
});

app.post('/api/cv/config', (req, res) => {
    const { cv_enabled } = req.body;
    const value = cv_enabled ? 'true' : 'false';
    const now = new Date().toLocaleString('sv-SE').replace('T', ' ');

    transDb.run(
        `INSERT INTO kiosk_config (key, value, updated_at) VALUES ('cv_enabled', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [value, now],
        (err) => {
            if (err) {
                console.error('❌ CV Config save error:', err);
                return res.status(500).json({ status: 'error' });
            }
            console.log(`${cv_enabled ? '✅' : '🔴'} CV Config saved to DB: ${value}`);

            
            postLocalJson('/api/cv/set_mode', { cv_enabled: !!cv_enabled })
                .catch(() => {
                    
                    console.warn('⚠️  CV sync to cv_server.py failed (will sync on next startup)');
                });

            res.json({ status: 'ok', cv_enabled: !!cv_enabled });
        }
    );
});

app.post('/clear_item_report', (req, res) => {
    const { equipment_label } = req.body;
    transDb.run(
        `DELETE FROM item_reports WHERE equipment_label = ?`, [equipment_label],
        (err) => {
            if (err) {
                console.error('❌ Clear Item Report Error:', err);
                return res.status(500).json({ status: 'error' });
            }
            console.log(`✅ Item Reports cleared: [${equipment_label}]`);
            res.json({ status: 'success' });
        }
    );
});

app.get('/arduino_status', (req, res) => {
    res.json({
        connected: arduinoConnected,
        mode: arduinoConnected ? 'hardware' : 'simulation'
    });
});

const LABELS_JSON_PATH = path.join(__dirname, 'labels.json');

function resolveItemKey(itemName) {
    
    if (itemHardwareMap[itemName]) return itemName;

    
    try {
        const raw = fs.readFileSync(LABELS_JSON_PATH, 'utf8');
        const labels = JSON.parse(raw);
        const items = labels.items || {};
        
        
        for (const [originalKey, displayName] of Object.entries(items)) {
            if (displayName === itemName && itemHardwareMap[originalKey]) {
                return originalKey;
            }
        }
    } catch (e) {
        console.warn('[resolveItemKey] Could not read labels.json:', e.message);
    }

    return null; 
}

app.post('/open-vault', (req, res) => {
    const { itemName } = req.body;
    const resolvedKey = resolveItemKey(itemName);
    const hwCode = resolvedKey ? itemHardwareMap[resolvedKey] : null;
    if (hwCode) {
        
        console.log(`🔔 BUZZING: ${hwCode} (label: "${itemName}" → key: "${resolvedKey}")`);
        sendToArduino(`BUZZ:${hwCode}`);

        
        setTimeout(() => {
            console.log(`🔓 OPENING: ${hwCode}`);
            sendToArduino(`OPEN:${hwCode}`);
        }, 2000);

        res.json({ status: 'success', mode: arduinoConnected ? 'hardware' : 'simulation' });
    } else {
        console.warn(`[open-vault] No hardware mapping for: "${itemName}"`);
        res.json({ status: 'error', message: 'Item not mapped' });
    }
});

app.post('/close-vault', (req, res) => {
    const { itemName } = req.body;
    const resolvedKey = resolveItemKey(itemName);
    const hwCode = resolvedKey ? itemHardwareMap[resolvedKey] : null;
    if (hwCode) {
        console.log(`🔒 CLOSE: ${hwCode} (label: "${itemName}" → key: "${resolvedKey}")`);
        sendToArduino(`CLOSE:${hwCode}`);
        res.json({ status: 'success' });
    } else {
        console.warn(`[close-vault] No hardware mapping for: "${itemName}"`);
        res.json({ status: 'error', message: 'Item not mapped' });
    }
});

app.post('/log_transaction', (req, res) => {
    const { user_id, user_name, equipment_label, action, condition } = req.body;
    const now = new Date();
    const timestamp = now.toLocaleString('sv-SE').replace('T', ' ');
    const resolvedKey = resolveItemKey(equipment_label);
    const hwCode = resolvedKey ? itemHardwareMap[resolvedKey] : null;

    
    function formatTxDuration(startMs) {
        if (!startMs) return null;
        const totalSec = Math.round((Date.now() - startMs) / 1000);
        if (totalSec < 60) return `${totalSec}s`;
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }

    if (action === 'borrow') {
        const borrowCondition = condition || "Unknown";
        const borrowTxDuration = formatTxDuration(scanStartTimes[user_id]);
        
        delete scanStartTimes[user_id];
        console.log(`📋 [BORROW] User: ${user_id} | Item: ${equipment_label} | Condition: ${borrowCondition} | TX Duration: ${borrowTxDuration}`);
        transDb.run(
            `INSERT INTO transactions (user_id, user_name, equipment_label, borrow_time, condition, borrow_transaction_duration, notified, ban_applied) VALUES (?, ?, ?, ?, ?, ?, 'No', 'No')`, [user_id, user_name, equipment_label, timestamp, borrowCondition, borrowTxDuration],
            () => {
                
                transDb.run(
                    `DELETE FROM item_queue WHERE equipment_label = ? AND user_id = ?`, [equipment_label, user_id],
                    () => console.log(`✅ Queue cleared for ${user_id} after claiming [${equipment_label}]`)
                );
                if (hwCode && borrowCondition === 'Yes') {
                    console.log(`🔒 CLOSE: ${hwCode}`);
                    sendToArduino(`CLOSE:${hwCode}`);
                }
                res.json({ status: 'success' });
            }
        );
    } else {
        transDb.get(
            `SELECT id, borrow_time FROM transactions WHERE user_id = ? AND equipment_label = ? AND return_time IS NULL ORDER BY id DESC LIMIT 1`, [user_id, equipment_label],
            (err, row) => {
                if (row) {
                    const duration = Math.floor(Math.abs(now - new Date(row.borrow_time)) / 60000) + " mins";
                    const returnCondition = condition || "Unknown";
                    const returnTxDuration = formatTxDuration(scanStartTimes[user_id]);
                    
                    delete scanStartTimes[user_id];
                    console.log(`📋 [RETURN] User: ${user_id} | Item: ${equipment_label} | Condition updated to: ${returnCondition} | TX Duration: ${returnTxDuration}`);
                    transDb.run(
                        `UPDATE transactions SET return_time = ?, duration = ?, condition = ?, return_transaction_duration = ? WHERE id = ?`, [timestamp, duration, returnCondition, returnTxDuration, row.id],
                        () => {
                            
                            transDb.get(
                                `SELECT user_id, user_name FROM item_queue WHERE equipment_label = ? ORDER BY id ASC LIMIT 1`, [equipment_label],
                                (err, queueEntry) => {
                                    if (queueEntry) {
                                        
                                        if (queueEntry.notified_at) {
                                            console.log(`⚠️  Queue already notified for [${equipment_label}] — skipping email`);
                                        } else {
                                            
                                            
                                            transDb.run(
                                                `UPDATE item_queue SET notified_at = ? WHERE equipment_label = ? AND user_id = ?`, [timestamp, equipment_label, queueEntry.user_id],
                                                (updateErr) => {
                                                    if (updateErr) {
                                                        console.error(`❌ Failed to set notified_at for ${queueEntry.user_name}:`, updateErr);
                                                        return;
                                                    }
                                                    console.log(`⏱️  Queue notified_at set for ${queueEntry.user_name}`);
                                                    console.log(`📧 Notifying queued user: ${queueEntry.user_name} for [${equipment_label}]`);
                                                    fetch('http://localhost:5000/api/send_queue_email', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ equipment_label })
                                                        })
                                                        .then(r => r.json())
                                                        .then(data => {
                                                            if (data.success) {
                                                                console.log(`✅ Queue email sent to ${data.notified_user}`);
                                                            } else {
                                                                console.log(`⚠️  Queue email failed: ${data.message}`);
                                                            }
                                                        })
                                                        .catch(e => console.error(`❌ Flask email call error: ${e.message}`));
                                                }
                                            );
                                        }
                                    }
                                }
                            );
                        }
                    );
                }
                if (hwCode) {
                    console.log(`🔒 CLOSE: ${hwCode}`);
                    sendToArduino(`CLOSE:${hwCode}`);
                }
                res.json({ status: 'success' });
            }
        );
    }
});

function flaskGet(flaskPath, res) {
    http.get({ hostname: 'localhost', port: 5000, path: flaskPath }, (flaskRes) => {
        let data = '';
        flaskRes.on('data', chunk => data += chunk);
        flaskRes.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.send(data);
        });
    }).on('error', (err) => {
        console.error('[Flask proxy error]', err.message);
        res.status(502).json({ error: 'Flask unreachable', detail: err.message });
    });
}

app.get('/api/equipment/labels', (req, res) => {
    flaskGet('/api/equipment/labels', res);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/admin-vault', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'admin_vault.html'));
});

app.post('/admin-close-vault', (req, res) => {
    const { itemName } = req.body;
    const resolvedKey = resolveItemKey(itemName);
    const hwCode = resolvedKey ? itemHardwareMap[resolvedKey] : null;
    if (hwCode) {
        console.log(`🔒 [ADMIN] CLOSING: ${hwCode} (label: "${itemName}" → key: "${resolvedKey}")`);
        sendToArduino(`CLOSE:${hwCode}`);
        res.json({ status: 'success', mode: arduinoConnected ? 'hardware' : 'simulation' });
    } else {
        res.json({ status: 'error', message: 'Item not mapped' });
    }
});

app.post('/admin-close-all-open', (req, res) => {
    const { openItems } = req.body; 
    if (!Array.isArray(openItems) || openItems.length === 0) {
        return res.json({ status: 'success', closed: [] });
    }

    const closed = [];
    openItems.forEach(itemName => {
        const resolvedKey = resolveItemKey(itemName);
        const hwCode = resolvedKey ? itemHardwareMap[resolvedKey] : null;
        if (hwCode) {
            console.log(`🔒 [ADMIN EXIT] CLOSING: ${hwCode} (label: "${itemName}" → key: "${resolvedKey}")`);
            sendToArduino(`CLOSE:${hwCode}`);
            closed.push(itemName);
        }
    });

    res.json({ status: 'success', closed });
});

function runCmd(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', timeout: 8000 });
    } catch (e) {
        return e.stdout || '';
    }
}

function getWifiInterface() {
    try {
        const out = runCmd('nmcli -t -f DEVICE,TYPE device status');
        for (const line of out.split('\n')) {
            const parts = line.split(':');
            if (parts[1] && parts[1].trim() === 'wifi') return parts[0].trim();
        }
    } catch (_) {}
    return 'wlan0';
}

function getEthInterface() {
    try {
        const out = runCmd('nmcli -t -f DEVICE,TYPE device status');
        for (const line of out.split('\n')) {
            const parts = line.split(':');
            if (parts[1] && parts[1].trim() === 'ethernet') return parts[0].trim();
        }
    } catch (_) {}
    return 'eth0';
}

app.get('/api/network/status', (req, res) => {
    try {
        const result = { wifi: null, ethernet: null, active_type: null };

        
        const wifiOut = runCmd('nmcli -t -f NAME,DEVICE,STATE,TYPE connection show --active');
        for (const line of wifiOut.split('\n')) {
            const parts = line.split(':');
            if (parts[3] && parts[3].trim() === '802-11-wireless' && parts[2] && parts[2].trim() === 'activated') {
                const ssid = parts[0].trim();
                const wIface = parts[1] ? parts[1].trim() : getWifiInterface();
                let signal = '';
                try {
                    const iwOut = runCmd(`iwconfig ${wIface} 2>/dev/null`);
                    const sigMatch = iwOut.match(/Signal level[=:](-?\d+)/);
                    if (sigMatch) {
                        const dbm = parseInt(sigMatch[1]);
                        const pct = Math.min(100, Math.max(0, 2 * (dbm + 100)));
                        signal = `${pct}%`;
                    }
                } catch (_) {}
                result.wifi = { ssid, signal, state: 'connected' };
                result.active_type = 'wifi';
                break;
            }
        }

        
        const ethIface = getEthInterface();
        const ethOut = runCmd(`ip -4 addr show ${ethIface} 2>/dev/null`);
        const ipMatch = ethOut.match(/inet (\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
            result.ethernet = { ip: ipMatch[1] };
            if (!result.active_type) result.active_type = 'ethernet';
        }

        if (!result.active_type) result.active_type = 'none';
        res.json(result);
    } catch (e) {
        res.json({ error: e.message, active_type: 'none' });
    }
});

app.get('/api/network/scan', (req, res) => {
    try {
        const wIface = getWifiInterface();

        
        try { runCmd(`nmcli device wifi rescan ifname ${wIface}`); } catch (_) {}
        execSync('sleep 1'); 

        
        const raw = runCmd(
            `nmcli -t -f SSID,SIGNAL,SECURITY,CHAN device wifi list ifname ${wIface}`
        );

        const networks = [];
        const seen = new Set();

        for (const line of raw.split('\n')) {
            if (!line.trim()) continue;
            
            const parts = line.split(':');
            if (parts.length < 4) continue;
            const chan = parts[parts.length - 1].trim();
            const security = parts[parts.length - 2].trim();
            const signal = parseInt(parts[parts.length - 3].trim()) || 0;
            const ssid = parts.slice(0, parts.length - 3).join(':').trim();
            if (!ssid || seen.has(ssid)) continue;
            seen.add(ssid);
            const bars = signal >= 80 ? 4 : signal >= 60 ? 3 : signal >= 40 ? 2 : 1;
            const chanNum = parseInt(chan) || 0;
            const band = chanNum > 14 ? '5 GHz' : '2.4 GHz';
            const isOpen = !security || security === '--' || security.toLowerCase() === 'none';
            networks.push({ ssid, signal, bars, band, security: isOpen ? 'Open' : 'Secured' });
        }

        networks.sort((a, b) => b.signal - a.signal);
        res.json({ networks });
    } catch (e) {
        res.json({ error: e.message, networks: [] });
    }
});

app.post('/api/network/connect', (req, res) => {
    const { ssid, password } = req.body;
    if (!ssid) return res.json({ status: 'error', message: 'SSID required' });

    
    const args = ['device', 'wifi', 'connect', ssid];
    if (password) args.push('password', password);

    let stdout = '';
    let stderr = '';
    const proc = spawn('nmcli', args);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
        const combined = (stdout + stderr).toLowerCase();
        console.log(`[nmcli connect] code=${code} out=${stdout.trim()} err=${stderr.trim()}`);

        if (code === 0 && (combined.includes('successfully') || combined.includes('activated'))) {
            return res.json({ status: 'success', message: `Connected to ${ssid}` });
        }

        
        let msg = (stdout + stderr).trim() || 'Connection failed';
        if (combined.includes('secrets were required') || combined.includes('password') || combined.includes('802-11-wireless-security.psk')) {
            msg = 'Wrong password';
        } else if (combined.includes('not found') || combined.includes('no network')) {
            msg = `Network "${ssid}" not found`;
        } else if (combined.includes('timeout') || combined.includes('timed out')) {
            msg = 'Connection timed out';
        } else if (combined.includes('already') || combined.includes('connected')) {
            
            return res.json({ status: 'success', message: `Already connected to ${ssid}` });
        }

        res.json({ status: 'error', message: msg });
    });

    proc.on('error', (e) => {
        console.error('[nmcli connect] spawn error:', e.message);
        res.json({ status: 'error', message: `nmcli not available: ${e.message}` });
    });
});

app.post('/api/network/disconnect', (req, res) => {
    try {
        const wIface = getWifiInterface();
        runCmd(`nmcli device disconnect ${wIface}`);
        res.json({ status: 'success' });
    } catch (e) {
        res.json({ status: 'error', message: e.message });
    }
});

app.get('/osk/open', (req, res) => {
    try { runCmd('pkill matchbox-keyboard'); } catch (_) {}
    runCmd('DISPLAY=:0 matchbox-keyboard &');
    res.json({ status: 'ok' });
});

app.get('/osk/close', (req, res) => {
    runCmd('pkill matchbox-keyboard');
    res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EquiLock Server: http://localhost:${PORT}`);
    launchCvServer();

    
    
    setTimeout(() => {
        transDb.get(
            `SELECT value FROM kiosk_config WHERE key = 'cv_enabled'`, [],
            (err, row) => {
                const cv_enabled = row ? row.value === 'true' : false;
                console.log(`🔄 Syncing CV state to cv_server.py: ${cv_enabled ? 'ENABLED' : 'DISABLED'}`);
                postLocalJson('/api/cv/set_mode', { cv_enabled })
                    .then(() => console.log(`✅ CV state synced: ${cv_enabled ? 'ON' : 'OFF'}`))
                    .catch(() => console.warn('⚠️  CV sync on startup failed — cv_server.py baka hindi pa ready'));
            }
        );
    }, 5000); 
});

let cvProcess = null;

function launchCvServer() {
    const cvPath = path.join(__dirname, 'cv_server.py');

    if (!fs.existsSync(cvPath)) {
        console.warn('⚠️  cv_server.py not found sa', cvPath, '— CV server hindi sisimulan.');
        return;
    }

    
    const pythonBin = (() => {
        try { execSync('python3 --version', { stdio: 'ignore' }); return 'python3'; } catch (_) {}
        try { execSync('python --version', { stdio: 'ignore' }); return 'python'; } catch (_) {}
        return null;
    })();

    if (!pythonBin) {
        console.error('❌ Walang makitang python3 o python. CV server hindi sisimulan.');
        return;
    }

    console.log(`🐍 Sisimulan ang CV server: ${pythonBin} cv_server.py`);

    cvProcess = spawn(pythonBin, [cvPath], {
        cwd: __dirname, 
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false 
    });

    cvProcess.stdout.on('data', (data) => {
        
        process.stdout.write(`[CV] ${data}`);
    });

    cvProcess.stderr.on('data', (data) => {
        process.stderr.write(`[CV] ${data}`);
    });

    cvProcess.on('close', (code) => {
        console.warn(`⚠️  CV server nag-exit (code ${code}). Mag-restart sa 5 segundo...`);
        cvProcess = null;
        
        setTimeout(launchCvServer, 5000);
    });

    cvProcess.on('error', (err) => {
        console.error(`❌ CV server error: ${err.message}`);
    });
}

process.on('exit', () => { if (cvProcess) cvProcess.kill(); });
process.on('SIGINT', () => {
    if (cvProcess) cvProcess.kill();
    process.exit();
});
process.on('SIGTERM', () => {
    if (cvProcess) cvProcess.kill();
    process.exit();
});