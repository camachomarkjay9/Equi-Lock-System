# EquiLock — Equipment Borrowing & Kiosk Management System

EquiLock is a two-server system for managing equipment borrowing in a school or organization. It combines a **Flask admin dashboard** with a **Node.js kiosk server**, optionally connected to Arduino hardware for physical locker control.

---

## System Overview

```
┌────────────────────────────────────────────────────────┐
│                      EquiLock                          │
│                                                        │
│  [Flask - main.py]          [Node.js - server.js]      │
│  Port 5000                  Port 5003                  │
│  • Admin dashboard          • Kiosk/borrowing UI       │
│  • User management          • QR code verification     │
│  • Email notifications      • Arduino hardware control │
│  • Overdue checker          • CV server launcher       │
│  • ngrok tunnel             • Wi-Fi/network manager    │
│                                                        │
│  [cv_server.py]  ← auto-launched by server.js          │
│  Port 5004                                             │
│  • Computer vision (face/ID detection)                 │
└────────────────────────────────────────────────────────┘
```

**Databases (auto-created on first run):**
| File | Used by |
|---|---|
| `users.db` | Both servers — user accounts, bans, reservations |
| `transactions.db` | Both servers — borrow/return logs, item reports |
| `equipment.csv` | Both servers — equipment labels and QR tokens |
| `labels.json` | Flask — display names for equipment categories |

---

## Prerequisites

### Python (Flask Server)
- Python **3.8+**
- pip

### Node.js (Kiosk Server)
- Node.js **18+**
- npm

### System Tools (for Raspberry Pi / Linux deployment)
- `nmcli` — for Wi-Fi management (`sudo apt install network-manager`)
- `matchbox-keyboard` — for on-screen keyboard (`sudo apt install matchbox-keyboard`)
- Arduino connected via USB (optional — runs in simulation mode if absent)

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd equilock
```

---

### 2. Set up the Flask server (`main.py`)

Install Python dependencies:

```bash
pip install flask flask-mail apscheduler
```

**Full list of Python packages used:**

| Package | Purpose |
|---|---|
| `flask` | Web framework & routing |
| `flask-mail` | Email notifications via Gmail SMTP |
| `werkzeug` | Secure file uploads (bundled with Flask) |
| `apscheduler` | Background jobs (overdue checker, ngrok restarter) |
| `sqlite3` | Database (built-in, no install needed) |

---

### 3. Set up the Node.js server (`server.js`)

Install Node.js dependencies:

```bash
npm install express body-parser cors sqlite3 csv-parser
```

If you have an **Arduino** connected and want hardware control:

```bash
npm install serialport
```

> ⚠️ `serialport` is **optional**. The server automatically falls back to simulation mode if no Arduino is detected.

**Full list of Node packages used:**

| Package | Purpose |
|---|---|
| `express` | Web framework |
| `body-parser` | Parse JSON request bodies |
| `cors` | Allow cross-origin requests from the kiosk UI |
| `sqlite3` | Read users and transaction databases |
| `csv-parser` | Parse `equipment.csv` for QR verification |
| `serialport` | *(optional)* Send commands to Arduino locker hardware |

---

## Configuration

### Flask — Email (Gmail SMTP)

Open `main.py` and update the email credentials:

```python
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-gmail-app-password'
```

> 💡 Use a **Gmail App Password**, not your regular password.  
> Generate one at: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

Also change the secret key to something secure:

```python
app.secret_key = "change-this-to-a-secure-random-string"
```

---

### Flask — ngrok (optional, for remote access)

The server auto-restarts ngrok every 3 hours. Update the path in `main.py` if needed:

```python
ngrok_path = r"C:\your-project-folder\ngrok.exe"
```

If you don't need ngrok, you can safely ignore this — it won't block the server from running.

---

### Node.js — Arduino Port

Open `server.js` and update the serial port if your Arduino is on a different port:

```js
path: 'COM6',         // Windows
// path: '/dev/ttyUSB0', // Linux / Raspberry Pi
baudRate: 9600
```

---

## Running the Servers

Run **both servers** — they need each other to function fully.

### Start the Flask server

```bash
python main.py
```

Flask will start on `http://localhost:5000`.  
On first run, it will automatically create `users.db`, `transactions.db`, and `equipment.csv`.

**Default admin credentials:**
- Username: `equilockadmin`
- Password: `12345678`

> 🔐 Change the admin password after your first login.

---

### Start the Node.js kiosk server

```bash
node server.js
```

The kiosk server will start on `http://localhost:5003`.  
It will also automatically launch `cv_server.py` (computer vision) in the background if the file exists in the same folder.

---

## Default Ports

| Server | Port | URL |
|---|---|---|
| Flask (admin dashboard) | 5000 | `http://localhost:5000` |
| Node.js (kiosk server) | 5003 | `http://localhost:5003` |
| cv_server.py (auto-launched) | 5004 | `http://localhost:5004` |

---

## Project File Structure

```
equilock/
├── main.py              # Flask admin server
├── server.js            # Node.js kiosk server
├── cv_server.py         # Computer vision server (auto-launched)
├── equipment.csv        # Equipment labels & QR tokens (auto-generated)
├── labels.json          # Display names for equipment (auto-generated)
├── users.db             # User accounts & bans (auto-generated)
├── transactions.db      # Borrow/return logs (auto-generated)
├── ngrok.exe            # ngrok binary (Windows, optional)
└── static/              # Frontend assets (images, JS, CSS)
```

---

## Equipment Managed

EquiLock manages the following equipment out of the box:

- Calculators (1–7)
- Projectors (1–4)
- Extension Cords (1–4)
- HDMI Cables (1–4)

Equipment entries are auto-added to `equipment.csv` on startup if they're missing.

---

## Background Jobs (Flask)

These run automatically while `main.py` is running:

| Job | Interval | What it does |
|---|---|---|
| `auto_overdue_checker` | Every 60 seconds | Marks overdue borrows, sends email warnings, applies bans |
| `auto_report_notifier` | Every 30 seconds | Emails admin when a new item damage report comes in |
| `run_ngrok_service` | Every 3 hours | Restarts ngrok to keep the public tunnel alive |

---

## Common Issues

**`ModuleNotFoundError: No module named 'flask'`**  
→ Run `pip install flask flask-mail apscheduler`

**`Cannot find module 'csv-parser'`**  
→ Run `npm install` in the project folder

**`⚠️ Arduino NOT connected — Running in SIMULATION mode`**  
→ Normal if no Arduino is plugged in. Locker commands will be logged to console instead.

**`cv_server.py not found`**  
→ The CV server is a separate file. If you don't have it, kiosk will still work — CV features will just be unavailable.

**Email not sending**  
→ Double-check that your Gmail App Password is correct and that "Less secure app access" or 2FA + App Passwords is properly configured on your Google account.

---

## Notes for Developers

- Both servers share the same SQLite database files. Make sure they're in the **same directory**.
- The Flask server must be running for the Node.js kiosk to verify admin IDs (`/api/admin_kiosk/verify`).
- When deploying on a **Raspberry Pi**, replace `COM6` with `/dev/ttyUSB0` (or whichever port the Arduino is on).
- `use_reloader=False` is intentional in Flask — it prevents the scheduler from starting twice.
