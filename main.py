from flask import Flask, jsonify, request, render_template, redirect, url_for, session, abort, send_file
from flask_mail import Mail, Message
from werkzeug.utils import secure_filename
import sqlite3
import csv
import json
import os
import random
import re
from collections import defaultdict
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import subprocess
import time
import os

app = Flask(__name__)
app.secret_key = "walang_password"
otp_storage = {}
sent_notifications = set()

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'equilocka@gmail.com'
app.config['MAIL_PASSWORD'] = 'yveq yzwg oonr rgvt'
mail = Mail(app)

BASE = os.path.dirname(os.path.abspath(__file__))
TRX_DB = os.path.join(BASE, "transactions.db")
USR_DB = os.path.join(BASE, "users.db")
EQP_CSV = os.path.join(BASE, "equipment.csv")
LABELS_JSON = os.path.join(BASE, "labels.json")

def db(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def run_ngrok_service():
    """Pinapatay ang lumang ngrok at nagbubukas ng bago"""
    try:

        subprocess.run("taskkill /f /im ngrok.exe", shell=True, capture_output=True)
        

        ngrok_path = r"C:\act4\equilock  --v 1.3\backend 1\ngrok.exe"
        

        cmd = f'start /d "C:\\act4\\equilock  --v 1.3\\backend 1" ngrok http 5000'
        
        print(f"🔄 [{datetime.now().strftime('%H:%M:%S')}] Restarting ngrok service...")
        subprocess.Popen(cmd, shell=True)
        
    except Exception as e:
        print(f"❌ Error sa ngrok service: {e}")

def init_db():
    """Ensure all tables and columns exist in users.db and transactions.db"""
    

    conn = db(USR_DB)
    

    

    cursor = conn.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    if "ban_start" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN ban_start TEXT")
    if "ban_end" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN ban_end TEXT")
    if "violation_count" not in columns:
        conn.execute("UPDATE users SET violation_count = 0 WHERE violation_count IS NULL")
    if "course" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN course TEXT DEFAULT ''")
    if "year_level" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN year_level TEXT DEFAULT ''")
    

    

    cur = conn.execute("PRAGMA table_info(admin_account)")
    existing_cols = [row[1] for row in cur.fetchall()]
    for col, default in [('display_name', "'Admin'"), ('email', "''"), ('profile_pic', "''"), ('role', "'admin'")]:
        if col not in existing_cols:
            print(f"Migrating admin_account: adding '{col}' column...")
            conn.execute(f"ALTER TABLE admin_account ADD COLUMN {col} TEXT DEFAULT {default}")
    conn.commit()

    conn.execute("UPDATE admin_account SET role = 'superadmin' WHERE id = 1")

    conn.execute("INSERT OR IGNORE INTO admin_kiosk (id, admin_idnumber, admin_name) VALUES (1, '', '')")

    conn.commit()
    conn.close()

    conn_trx = sqlite3.connect(TRX_DB)
    

    cursor_trx = conn_trx.execute("PRAGMA table_info(transactions)")
    trx_columns = [row[1] for row in cursor_trx.fetchall()]
    
    if "notified" not in trx_columns:
        print("adding notified column to transactions...")
        conn_trx.execute("ALTER TABLE transactions ADD COLUMN notified TEXT DEFAULT 'No'")

    if "ban_applied" not in trx_columns:
        print("adding ban_applied column to transactions...")
        conn_trx.execute("ALTER TABLE transactions ADD COLUMN ban_applied TEXT DEFAULT 'No'")

    conn_trx.execute("UPDATE transactions SET notified = 'Yes' WHERE notified = '1' OR CAST(notified AS TEXT) = '1'")
    conn_trx.execute("UPDATE transactions SET notified = 'No'  WHERE notified = '0' OR CAST(notified AS TEXT) = '0' OR notified IS NULL")

    conn_trx.execute("UPDATE transactions SET ban_applied = 'Yes' WHERE condition LIKE '%[Ban Applied]%'")
    conn_trx.execute("UPDATE transactions SET condition = TRIM(REPLACE(condition, '[Ban Applied]', '')) WHERE condition LIKE '%[Ban Applied]%'")

    conn_trx.commit()
    print("✅ notified + ban_applied column migration done")

    cursor_ir = conn_trx.execute("PRAGMA table_info(item_reports)")
    ir_columns = [row[1] for row in cursor_ir.fetchall()]
    for col, definition in [
        ("user_id",         "TEXT"),
        ("user_name",       "TEXT"),
        ("reported_at",     "TEXT"),
        ("admin_notified",  "INTEGER DEFAULT 0"),
    ]:
        if col not in ir_columns:
            print(f"Adding {col!r} column to item_reports...")
            conn_trx.execute(f"ALTER TABLE item_reports ADD COLUMN {col} {definition}")

    conn_trx.commit()
    conn_trx.close()

def ensure_equipment_csv():
    import uuid
    ALL_EQUIPMENT = [
        "Calculator 1", "Calculator 2", "Calculator 3", "Calculator 4",
        "Calculator 5", "Calculator 6", "Calculator 7",
        "Projector 1", "Projector 2", "Projector 3", "Projector 4",
        "HDMI 1", "HDMI 2", "HDMI 3", "HDMI 4",
        "Extension 1", "Extension 2", "Extension 3", "Extension 4",
    ]

    existing = {}
    if os.path.exists(EQP_CSV):
        with open(EQP_CSV, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lbl = row.get("label", "").strip()
                if lbl:
                    existing[lbl] = row.get("qr_token", "")

    added = False
    for equip in ALL_EQUIPMENT:
        if equip not in existing:
            existing[equip] = str(uuid.uuid4())
            added = True
            print(f"[CSV] Added missing equipment: {equip}")

    if added or not os.path.exists(EQP_CSV):
        with open(EQP_CSV, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=["label", "qr_token"])
            writer.writeheader()
            for equip in ALL_EQUIPMENT:
                writer.writerow({"label": equip, "qr_token": existing.get(equip, str(uuid.uuid4()))})
        print("[CSV] equipment.csv updated.")

init_db()
ensure_equipment_csv()

_DEFAULT_CATEGORY_IMAGES = {
    "calculator": "scical.png",
    "projector":  "proj.png",
    "extension":  "ext.png",
    "hdmi":       "hdmi.png",
}
_DEFAULT_CATEGORY_NAMES = {
    "calculator": "Calculator",
    "projector":  "Projector",
    "extension":  "Extension Cord",
    "hdmi":       "HDMI Cable",
}
_ALL_ITEM_KEYS = [
    "Calculator 1", "Calculator 2", "Calculator 3", "Calculator 4",
    "Calculator 5", "Calculator 6", "Calculator 7",
    "Projector 1", "Projector 2", "Projector 3", "Projector 4",
    "Extension 1", "Extension 2", "Extension 3", "Extension 4",
    "HDMI 1", "HDMI 2", "HDMI 3", "HDMI 4",
]

def load_labels():
    """Load labels.json; fill missing keys with defaults."""
    if os.path.exists(LABELS_JSON):
        with open(LABELS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"categories": {}, "items": {}}

    for key in ["calculator", "projector", "extension", "hdmi"]:
        if key not in data["categories"]:
            data["categories"][key] = {
                "display_name": _DEFAULT_CATEGORY_NAMES[key],
                "image": _DEFAULT_CATEGORY_IMAGES[key]
            }
        else:
            cat = data["categories"][key]
            if "display_name" not in cat:
                cat["display_name"] = _DEFAULT_CATEGORY_NAMES[key]
            if "image" not in cat:
                cat["image"] = _DEFAULT_CATEGORY_IMAGES[key]

    for key in _ALL_ITEM_KEYS:
        if key not in data["items"]:
            data["items"][key] = key

    return data

def save_labels(data):
    with open(LABELS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_display_name(item_key):
    """I-resolve ang display name ng equipment item key mula sa labels.json."""
    try:
        labels = load_labels()
        return labels["items"].get(item_key, item_key)
    except Exception:
        return item_key

def is_superadmin():
    """Check kung ang naka-login na admin ay superadmin."""
    return session.get('admin_role') == 'superadmin'

def require_superadmin():
    """I-call sa simula ng superadmin-only routes. Returns error response o None."""
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    if not is_superadmin():
        return jsonify({"success": False, "message": "Super Admin access required"}), 403
    return None

@app.route('/Signup')
def index():
    """Students' main signup page"""
    return render_template('signup.html')

@app.route('/submit', methods=['POST'])
def submit():
    """Handle student signup form submission"""
    fullname = request.form.get('fullname', '').strip()
    email = request.form.get('email', '').strip()
    idnumber = request.form.get('idnumber', '').strip().replace(' ', '').replace('–', '-')
    role = request.form.get('role', '').strip()
    agree = request.form.get('agree')
    course = request.form.get('course', '').strip() if role == 'Student' else ''
    year_level = request.form.get('year_level', '').strip() if role == 'Student' else ''

    if not all([fullname, email, idnumber, role, agree]):
        return "<h2>⚠️ Please fill out all fields and agree to the terms.</h2>"
    if role == 'Student' and not all([course, year_level]):
        return "<h2>⚠️ Please select your course and year level.</h2>"
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return "<h2>⚠️ Invalid email format.</h2>"

    try:
        conn = db(USR_DB)
        conn.execute(
            "INSERT INTO users (fullname, email, idnumber, role, course, year_level) VALUES (?, ?, ?, ?, ?, ?)",
            (fullname, email, idnumber, role, course, year_level)
        )
        conn.commit()
        conn.close()
        return redirect(url_for('thank_you'))
    except sqlite3.IntegrityError:
        return "<h2>⚠️ This ID number is already registered.</h2>"
    except Exception as e:
        return f"<h2>⚠️ Error: {e}</h2>"

@app.route('/thankyou')
def thank_you():
    return render_template('thankyou.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route('/api/admin/login', methods=['POST'])
def admin_login_api():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    conn = db(USR_DB)

    admin = conn.execute("SELECT * FROM admin_account WHERE username = ? AND password = ?", (username, password)).fetchone()
    conn.close()

    if admin:
        session['admin_logged_in'] = True
        session['admin_id'] = admin['id']
        session['admin_role'] = admin['role'] or 'admin'
        session['admin_username'] = admin['username']
        return jsonify({"success": True, "role": admin['role'] or 'admin'})
    else:
        return jsonify({"success": False, "message": "Wrong username or password"})

@app.route("/admin")
def admin_dashboard():
    if not session.get('admin_logged_in'):
        return redirect(url_for('login_page'))
    return render_template("admin_index.html")

@app.route('/api/admins', methods=['GET'])
def list_admins():
    err = require_superadmin()
    if err: return err
    try:
        conn = db(USR_DB)
        rows = conn.execute(
            "SELECT id, username, display_name, email, role FROM admin_account ORDER BY id"
        ).fetchall()
        conn.close()
        return jsonify({"admins": [dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admins/add', methods=['POST'])
def add_admin():
    err = require_superadmin()
    if err: return err
    try:
        data = request.json or {}
        username     = data.get("username", "").strip()
        password     = data.get("password", "").strip()
        display_name = data.get("display_name", "").strip() or "Admin"
        email        = data.get("email", "").strip()
        if not username or not password:
            return jsonify({"success": False, "message": "Username at password ay required."})
        conn = db(USR_DB)
        existing = conn.execute("SELECT id FROM admin_account WHERE username = ?", (username,)).fetchone()
        if existing:
            conn.close()
            return jsonify({"success": False, "message": "Username already exists."})
        conn.execute(
            "INSERT INTO admin_account (username, password, display_name, email, role) VALUES (?, ?, ?, ?, ?)",
            (username, password, display_name, email, "admin")
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Admin '{username}' added successfully."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/admins/remove/<int:admin_id>', methods=['DELETE'])
def remove_admin(admin_id):
    err = require_superadmin()
    if err: return err
    try:
        if admin_id == session.get('admin_id'):
            return jsonify({"success": False, "message": "Hindi mo matatanggal ang iyong sariling account."})
        if admin_id == 1:
            return jsonify({"success": False, "message": "Hindi matatanggal ang primary Super Admin."})
        conn = db(USR_DB)
        conn.execute("DELETE FROM admin_account WHERE id = ?", (admin_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/admin/session-info', methods=['GET'])
def admin_session_info():
    if not session.get('admin_logged_in'):
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify({
        "admin_id": session.get('admin_id'),
        "role": session.get('admin_role', 'admin'),
        "username": session.get('admin_username', '')
    })

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login_page'))

@app.route('/api/admin/forgot-password', methods=['POST'])
def send_otp():
    global otp_storage

    email_input = request.json.get("email", "").strip()
    conn = db(USR_DB)
    admin_row = conn.execute(
        "SELECT id, email FROM admin_account WHERE LOWER(email) = LOWER(?)",
        (email_input,)
    ).fetchone()
    conn.close()

    if not email_input:
        return jsonify({"success": False, "message": "Walang email na nilagay."})
    if not admin_row:
        return jsonify({"success": False, "message": "Email not authorized."})

    admin_email = admin_row["email"].strip()
    otp = str(random.randint(100000, 999999))
    otp_storage[email_input.lower()] = otp
    session['reset_email'] = email_input
    try:
        msg = Message(
            "EquiLock Admin Recovery Code",
            sender=app.config['MAIL_USERNAME'],
            recipients=[admin_email]
        )
        msg.body = f"Your recovery code is: {otp}"
        mail.send(msg)
        return jsonify({"success": True, "message": "Code sent!"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/admin/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    email = (data.get("email") or "").strip().lower()
    user_otp = data.get("otp")
    if email in otp_storage and otp_storage[email] == user_otp:
        session['admin_logged_in'] = True
        del otp_storage[email]
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Maling Code!"})

@app.route('/api/admin/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    new_password = data.get("new_password")
    
    if session.get('admin_logged_in'):
        try:
            conn = db(USR_DB)

            email_used = session.get('reset_email', '')
            conn.execute("UPDATE admin_account SET password = ? WHERE LOWER(email) = LOWER(?)", (new_password, email_used))
            conn.commit()
            conn.close()
            return jsonify({"success": True, "message": "Password updated in Database!"})
        except Exception as e:
            return jsonify({"success": False, "message": str(e)})
    
    return jsonify({"success": False, "message": "Unauthorized access."})

ADMIN_PIC_DIR = os.path.join(BASE, "static", "admin_pics")
os.makedirs(ADMIN_PIC_DIR, exist_ok=True)

@app.route('/api/admin/profile', methods=['GET'])
def get_admin_profile():
    if not session.get('admin_logged_in'):
        return jsonify({"error": "Unauthorized"}), 403
    try:
        admin_id = session.get('admin_id', 1)
        conn = db(USR_DB)
        admin = conn.execute(
            "SELECT username, display_name, email, profile_pic, role FROM admin_account WHERE id = ?",
            (admin_id,)
        ).fetchone()
        conn.close()
        if admin:
            return jsonify({
                "username": admin["username"] or "",
                "display_name": admin["display_name"] or "Admin",
                "email": admin["email"] or "",
                "profile_pic": admin["profile_pic"] or "",
                "role": admin["role"] or "admin"
            })
        return jsonify({"username": "", "display_name": "Admin", "email": "", "profile_pic": "", "role": "admin"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/profile/save', methods=['POST'])
def save_admin_profile():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    try:
        data = request.json
        display_name = data.get("display_name", "").strip() or "Admin"
        email = data.get("email", "").strip()
        conn = db(USR_DB)
        admin_id = session.get('admin_id', 1)
        conn.execute(
            "UPDATE admin_account SET display_name = ?, email = ? WHERE id = ?",
            (display_name, email, admin_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/admin/profile/picture', methods=['POST'])
def save_admin_profile_picture():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image provided"})
        file = request.files['image']
        if not file or file.filename == '':
            return jsonify({"success": False, "message": "Empty file"})
        if not allowed_file(file.filename):
            return jsonify({"success": False, "message": "Invalid file type"})

        admin_id = session.get('admin_id', 1)
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"admin_profile_{admin_id}.{ext}"
        save_path = os.path.join(ADMIN_PIC_DIR, filename)
        file.save(save_path)

        conn = db(USR_DB)
        conn.execute("UPDATE admin_account SET profile_pic = ? WHERE id = ?", (filename, admin_id))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "filename": filename})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/auth/verify", methods=["POST"])
def verify_user():
    """Use this endpoint when a user tries to sign in/tap ID."""
    id_num = request.json.get("idnumber")
    conn = db(USR_DB)
    user = conn.execute("SELECT * FROM users WHERE idnumber = ?", (id_num,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"allowed": False, "message": "User not found."})
    

    if user["ban_start"] and user["ban_end"]:
        now = datetime.now()
        try:
            start = datetime.strptime(user["ban_start"], "%Y-%m-%dT%H:%M")
            end = datetime.strptime(user["ban_end"], "%Y-%m-%dT%H:%M")
            if start <= now <= end:
                return jsonify({
                    "allowed": False, 
                    "message": f"Access Denied. Banned until {end.strftime('%b %d, %Y %I:%M %p')}"
                })
        except:
            pass
            
    return jsonify({"allowed": True, "name": user["fullname"]})

@app.route("/api/users/ban", methods=["POST"])
def ban_user():
    err = require_superadmin()
    if err: return err
    d = request.json
    conn = db(USR_DB)

    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route("/api/management/data")
def management():
    try:

        conn_usr = db(USR_DB)
        users = conn_usr.execute("SELECT fullname, email, idnumber, role, course, year_level, ban_start, ban_end, violation_count FROM users").fetchall()
        conn_usr.close()
        
        now = datetime.now()
        user_list = []
        for u in users:
            status = "Active"
            if u["ban_start"] and u["ban_end"]:
                try:
                    start = datetime.strptime(u["ban_start"], "%Y-%m-%dT%H:%M")
                    end = datetime.strptime(u["ban_end"], "%Y-%m-%dT%H:%M")
                    if start <= now <= end: status = "Banned"
                except: pass
            
            user_list.append({
                "id": u["idnumber"], "name": u["fullname"], 
                "email": u["email"], "role": u["role"],
                "course": u["course"] or "", "year": u["year_level"] or "",
                "status": status, "ban_start": u["ban_start"], "ban_end": u["ban_end"], "violation": u["violation_count"] or 0
            })

        conn_trx = db(TRX_DB)
        active_borrows = conn_trx.execute("SELECT equipment_label FROM transactions WHERE return_time IS NULL OR return_time = ''").fetchall()

        item_reports_rows = conn_trx.execute("SELECT equipment_label, report_type FROM item_reports").fetchall()
        conn_trx.close()

        borrowed_items = {row["equipment_label"].strip().lower() for row in active_borrows if row["equipment_label"]}

        flagged_reports = {}
        for row in item_reports_rows:
            lbl = row["equipment_label"].strip().lower()
            if lbl not in flagged_reports:
                flagged_reports[lbl] = []
            if row["report_type"] not in flagged_reports[lbl]:
                flagged_reports[lbl].append(row["report_type"])

        date_key = request.args.get('date_key', '')
        current_time = request.args.get('current_time', '')

        now_dt = datetime.now()
        today_str = now_dt.strftime("%Y-%m-%d")
        now_time_str = now_dt.strftime("%H:%M")

        conn_res = db(USR_DB)

        lookup_date = date_key if date_key else today_str
        lookup_time = current_time if current_time else now_time_str

        if lookup_date == today_str:
            res_rows = conn_res.execute(
                "SELECT equipment_label FROM reservations WHERE date_key = ? AND end_time > ?",
                (lookup_date, lookup_time)
            ).fetchall()
        else:
            res_rows = conn_res.execute(
                "SELECT equipment_label FROM reservations WHERE date_key = ?", (lookup_date,)
            ).fetchall()
        conn_res.close()
        reserved_items = {r["equipment_label"].strip().lower() for r in res_rows}

        equipment_list = []
        if os.path.exists(EQP_CSV):
            with open(EQP_CSV, newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    qr_token = row.get("qr_token", "N/A")
                    label = row.get("label", "Unknown")
                    label_lower = label.strip().lower()
                    reports = flagged_reports.get(label_lower, [])

                    if label_lower in borrowed_items:
                        status = "Borrowed"
                    elif "no_item" in reports:
                        status = "Missing"
                    elif "locked" in reports:
                        status = "Locked"
                    elif "physical_damage" in reports and "not_working" in reports:
                        status = "In Vault - Physical Damage & Not Working"
                    elif "physical_damage" in reports:
                        status = "In Vault - Physical Damage"
                    elif "not_working" in reports:
                        status = "In Vault - Not Working"
                    elif label_lower in reserved_items:
                        status = "Reserved"
                    else:
                        status = "In Vault"

                    equipment_list.append({
                        "id": qr_token,
                        "name": label,
                        "status": status,
                        "image_url": f"/static/img/{EQUIPMENT_IMAGE_MAP[label]}" if label in EQUIPMENT_IMAGE_MAP else ""
                    })

        return jsonify({"users": user_list, "equipment": equipment_list})
        
    except Exception as e:
        print(f"Error in management: {e}")
        return jsonify({"error": str(e), "users":[], "equipment":[]})
    

@app.route("/api/unban_user", methods=["POST"])
def unban_user():
    err = require_superadmin()
    if err: return err
    try:
        data = request.json
        id_number = data.get("idnumber")
        
        conn = db(USR_DB)
        conn.execute("UPDATE users SET ban_start = NULL, ban_end = NULL, violation_count = 0 WHERE idnumber = ?", (id_number,))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "User unbanned and violation count reset."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/admin_kiosk/get", methods=["GET"])
def get_admin_kiosk():
    try:
        conn = db(USR_DB)
        row = conn.execute("SELECT admin_idnumber, admin_name FROM admin_kiosk WHERE id = 1").fetchone()
        conn.close()
        if row:
            return jsonify({"admin_idnumber": row["admin_idnumber"], "admin_name": row["admin_name"]})
        return jsonify({"admin_idnumber": "", "admin_name": ""})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/api/admin_kiosk/save", methods=["POST"])
def save_admin_kiosk():
    try:
        data = request.json
        idnumber = data.get("admin_idnumber", "").strip()
        name = data.get("admin_name", "").strip()

        conn = db(USR_DB)
        conn.execute(
            "UPDATE admin_kiosk SET admin_idnumber = ?, admin_name = ? WHERE id = 1",
            (idnumber, name)
        )
        conn.commit()
        conn.close()
        print(f"🔑 Admin kiosk ID updated: [{idnumber}] — {name}")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/admin_kiosk/verify", methods=["POST"])
def verify_admin_kiosk():
    """Tinatawag ng kiosk para i-check kung admin ID ang na-scan"""
    try:
        data = request.json
        scanned_id = data.get("id_number", "").strip()

        conn = db(USR_DB)
        row = conn.execute("SELECT admin_idnumber, admin_name FROM admin_kiosk WHERE id = 1").fetchone()
        conn.close()

        if not row or not row["admin_idnumber"]:
            return jsonify({"is_admin": False, "message": "No admin kiosk ID configured"})

        if scanned_id == row["admin_idnumber"]:
            print(f"🔑 Admin kiosk access: [{scanned_id}]")
            return jsonify({"is_admin": True, "admin_name": row["admin_name"]})

        return jsonify({"is_admin": False})
    except Exception as e:
        return jsonify({"is_admin": False, "message": str(e)})

@app.route("/api/equipment/reset_vault", methods=["POST"])
def reset_vault():
    try:
        data = request.json
        equipment_label = data.get("equipment_label")
        if not equipment_label:
            return jsonify({"success": False, "message": "No equipment_label provided"})

        conn = db(TRX_DB)
        conn.execute("DELETE FROM item_reports WHERE equipment_label = ?", (equipment_label,))
        conn.commit()
        conn.close()

        print(f"✅ Vault reset: [{equipment_label}]")
        return jsonify({"success": True, "message": f"Reports cleared for {equipment_label}"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/equipment/lock", methods=["POST"])
def lock_equipment():

    try:
        equipment_label = request.json.get("equipment_label", "").strip()
        if not equipment_label:
            return jsonify({"success": False, "message": "No equipment_label provided"})

        conn = db(TRX_DB)

        existing = conn.execute(
            "SELECT id FROM item_reports WHERE equipment_label = ? AND report_type = 'locked'",
            (equipment_label,)
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({"success": False, "message": "Already locked"})

        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(

            (equipment_label, timestamp)
        )
        conn.commit()
        conn.close()

        print(f"🔒 Equipment locked by admin: [{equipment_label}]")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

EQUIPMENT_IMAGE_MAP = {
    "Calculator 1":  "scical1.jpg",
    "Calculator 2":  "scical2.jpg",
    "Calculator 3":  "scical3.jpg",
    "Calculator 4":  "scical4.jpg",
    "Calculator 5":  "scical5.jpg",
    "Calculator 6":  "scical6.jpg",
    "Calculator 7":  "scical7.jpg",
    "Projector 1":   "projector1.jpg",
    "Projector 2":   "projector2.jpg",
    "Projector 3":   "projector3.jpg",
    "Projector 4":   "projector4.jpg",
    "HDMI 1":        "HDMI1.jpg",
    "HDMI 2":        "HDMI2.jpg",
    "HDMI 3":        "HDMI3.jpg",
    "HDMI 4":        "HDMI4.jpg",
    "Extension 1":   "ext1.jpg",
    "Extension 2":   "ext2.jpg",
    "Extension 3":   "ext3.jpg",
    "Extension 4":   "ext4.jpg",
}

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/api/equipment/change_picture", methods=["POST"])
def change_picture():
    err = require_superadmin()
    if err: return err
    try:
        equipment_label = request.form.get("equipment_label")
        if not equipment_label:
            return jsonify({"success": False, "message": "No equipment_label provided"})

        if equipment_label not in EQUIPMENT_IMAGE_MAP:
            return jsonify({"success": False, "message": f"Unknown equipment: {equipment_label}"})

        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image file provided"})

        file = request.files['image']
        if file.filename == '':
            return jsonify({"success": False, "message": "No file selected"})

        if not allowed_file(file.filename):
            return jsonify({"success": False, "message": "Invalid file type. Use JPG, PNG, WEBP, or GIF."})

        target_filename = EQUIPMENT_IMAGE_MAP[equipment_label]
        img_dir = os.path.join(BASE, "static", "img")
        target_path = os.path.join(img_dir, target_filename)

        file.save(target_path)

        print(f"🖼️  Picture changed: [{equipment_label}] → {target_filename}")
        return jsonify({
            "success": True,
            "message": f"Picture updated for {equipment_label}",
            "filename": target_filename
        })

    except Exception as e:
        print(f"❌ Change picture error: {e}")
        return jsonify({"success": False, "message": str(e)})
    

@app.route("/api/equipment/labels", methods=["GET"])
def get_labels():
    """Returns all display-name overrides for kiosk & admin."""
    return jsonify(load_labels())

@app.route("/api/equipment/rename_item", methods=["POST"])
def rename_item():
    """Rename the display name of an individual item (e.g. Calculator 1)."""
    err = require_superadmin()
    if err: return err
    try:
        data = request.json or {}
        item_key    = data.get("item_key", "").strip()
        new_display = data.get("new_display", "").strip()
        if not item_key or not new_display:
            return jsonify({"success": False, "message": "item_key and new_display are required"})
        if item_key not in _ALL_ITEM_KEYS:
            return jsonify({"success": False, "message": f"Unknown item key: {item_key}"})
        labels = load_labels()
        labels["items"][item_key] = new_display
        save_labels(labels)
        print(f"✏️  Item renamed: [{item_key}] → [{new_display}]")
        return jsonify({"success": True, "message": f"Renamed to {new_display}"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/equipment/rename_category", methods=["POST"])
def rename_category():
    """Rename the display name of a category (calculator/projector/extension/hdmi)."""
    err = require_superadmin()
    if err: return err
    try:
        data = request.json or {}
        cat_key  = data.get("category_key", "").strip().lower()
        new_name = data.get("new_name", "").strip()
        if cat_key not in ["calculator", "projector", "extension", "hdmi"]:
            return jsonify({"success": False, "message": f"Unknown category: {cat_key}"})
        if not new_name:
            return jsonify({"success": False, "message": "new_name is required"})
        labels = load_labels()
        labels["categories"][cat_key]["display_name"] = new_name
        save_labels(labels)
        print(f"✏️  Category renamed: [{cat_key}] → [{new_name}]")
        return jsonify({"success": True, "message": f"Category renamed to {new_name}"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/equipment/change_category_image", methods=["POST"])
def change_category_image():
    """Upload a new icon image for a category on the borrow page."""
    err = require_superadmin()
    if err: return err
    try:
        cat_key = request.form.get("category_key", "").strip().lower()
        if cat_key not in ["calculator", "projector", "extension", "hdmi"]:
            return jsonify({"success": False, "message": f"Unknown category: {cat_key}"})
        if "image" not in request.files:
            return jsonify({"success": False, "message": "No image file provided"})
        file = request.files["image"]
        if file.filename == "":
            return jsonify({"success": False, "message": "No file selected"})
        if not allowed_file(file.filename):
            return jsonify({"success": False, "message": "Invalid file type. Use JPG, PNG, WEBP, or GIF."})

        labels = load_labels()

        existing_filename = labels["categories"][cat_key].get("image", _DEFAULT_CATEGORY_IMAGES[cat_key])
        img_dir = os.path.join(BASE, "static", "img")
        os.makedirs(img_dir, exist_ok=True)
        target_path = os.path.join(img_dir, existing_filename)
        file.save(target_path)
        labels["categories"][cat_key]["image"] = existing_filename
        save_labels(labels)
        print(f"🖼️  Category image changed: [{cat_key}] → {existing_filename}")
        return jsonify({"success": True, "message": f"Category image updated", "filename": existing_filename})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/users/save", methods=["POST"])
def save_user():
    d = request.json
    role = d.get("role", "Student")
    course = d.get("course", "") if role == "Student" else ""
    year_level = d.get("year", "") if role == "Student" else ""
    conn = db(USR_DB)
    conn.execute(
        "INSERT OR REPLACE INTO users (fullname, email, idnumber, role, course, year_level) VALUES (?, ?, ?, ?, ?, ?)",
        (d["name"], d["email"], d["id"], role, course, year_level)
    )
    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route("/api/users/delete", methods=["POST"])
def delete_user():
    conn = db(USR_DB)
    conn.execute("DELETE FROM users WHERE idnumber=?", (request.json["id"],))
    conn.commit()
    conn.close()
    return jsonify(ok=True)

from datetime import datetime

@app.route("/api/reservations/save", methods=["POST"])
def save_reservation():
    d = request.json
    user_name = d.get("name")
    

    raw_date = d.get("date_key")
    formatted_date = raw_date
    

    if raw_date and len(raw_date.split('-')[1]) == 1 or len(raw_date.split('-')[2]) == 1:
        try:

            dt_obj = datetime.strptime(raw_date, "%Y-%m-%d" if "-" in raw_date else "%Y/%m/%d")
            formatted_date = dt_obj.strftime("%Y-%m-%d")
        except:
            formatted_date = raw_date

    conn = db(USR_DB)
    user_data = conn.execute("SELECT idnumber FROM users WHERE fullname = ?", (user_name,)).fetchone()
    user_id_from_db = user_data["idnumber"] if user_data else "Unknown"
    
    if d.get("res_id"):

    else:

        
    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route("/api/reservations/delete", methods=["POST"])
def delete_res():
    conn = db(USR_DB)
    conn.execute("DELETE FROM reservations WHERE id=?", (request.json["id"],))
    conn.commit()
    conn.close()
    return jsonify(ok=True)

@app.route("/api/reservations/list")
def list_reservations():
    conn = db(USR_DB)
    rows = conn.execute("SELECT * FROM reservations").fetchall()
    conn.close()
    data = defaultdict(list)
    for r in rows:
        data[r["date_key"]].append({
            "id": r["id"], "name": r["user_name"], "equip": r["equipment_label"],
            "start": r["start_time"], "end": r["end_time"]
        })
    return jsonify(data)

@app.route("/api/stats")
def stats():
    period = request.args.get('period', 'today')
    conn = db(TRX_DB)
    now = datetime.now()
    

    if period == 'today':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'month':
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime(2000, 1, 1)

    rows = conn.execute("SELECT borrow_time, return_time, equipment_label FROM transactions").fetchall()
    conn.close()

    borrowed_count = 0
    returned_count = 0
    overdue_count = 0
    total_visits = 0
    item_counts = defaultdict(int)

    for r in rows:
        try:
            if not r["borrow_time"] or r["borrow_time"] == "---":
                continue
                
            b_dt = datetime.strptime(r["borrow_time"], "%Y-%m-%d %H:%M:%S")
            is_in_use = not r["return_time"] or r["return_time"] == "In Use"

            

            if is_in_use:
                borrowed_count += 1

            diff_minutes = (now - b_dt).total_seconds() / 60
            if is_in_use and diff_minutes > 240:
                overdue_count += 1

            
            if b_dt >= start_date:

                total_visits += 1
                

                if r["equipment_label"]:
                    item_counts[r["equipment_label"].strip().title()] += 1
                

                if r["return_time"] and r["return_time"] not in ["In Use", "---"]:

                    returned_count += 1

        except Exception as e:
            continue

    return jsonify({
        "visits": total_visits,
        "borrowed": borrowed_count,
        "returned": returned_count,
        "overdue": overdue_count,
        "top_items": [{"name": k, "count": v} for k, v in sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:5]]
    })

    
from datetime import datetime, timedelta

def send_overdue_email(user_email, user_name, equipment, borrow_time_str):
    """Function to send an overdue notification based on fixed borrow time"""

    with app.app_context():
        try:

            borrow_dt = datetime.strptime(borrow_time_str, "%Y-%m-%d %H:%M:%S")
            

            deadline_dt = borrow_dt + timedelta(hours=3, minutes=30)
            

            deadline_time = deadline_dt.strftime("%I:%M %p")
            deadline_date = deadline_dt.strftime("%b %d, %Y")
            

            time_status = "today" if deadline_dt.date() == datetime.now().date() else "on"

            msg = Message("EQUILOCK: Overdue Equipment Notice",
                          sender=app.config['MAIL_USERNAME'],
                          recipients=[user_email])
            
            msg.body = (
                f"Good day, {user_name}!\n\n"
                f"Our records show that the equipment you borrowed ({equipment}) "
                f"on {borrow_dt.strftime('%b %d at %I:%M %p')} has exceeded the 3.5 hour usage limit.\n"
                f"Based on your borrow time, your deadline for return was {deadline_time} {time_status} ({deadline_date}).\n"
                f"Please return the item to the vault immediately. Failure to return the equipment "
                f"within the 30-minute grace period results in automatic account suspension.\n\n"
                f"If you have already returned the item, please ignore this message.\n\n"
                f"Thank you,\n"
                f"EquiLock Admin"
            )
            
            mail.send(msg)
            print(f"✅ Email notification sent to {user_email}. Fixed Deadline based on borrow time: {deadline_time}")
            return True
        except Exception as e:
            print(f"❌ Failed to send email to {user_email}: {e}")
            return False

def send_queue_notification_email(user_email, user_name, equipment_label, minutes_to_claim=30):
    """Mag-send ng email sa naka-queue na user na available na ang item"""
    with app.app_context():
        try:
            deadline_dt = datetime.now() + timedelta(minutes=minutes_to_claim)
            deadline_str = deadline_dt.strftime("%I:%M %p")

            msg = Message(
                "EQUILOCK: Your Queued Item is Now Available!",
                sender=app.config['MAIL_USERNAME'],
                recipients=[user_email]
            )

            msg.body = (
                f"Good day, {user_name}!\n\n"
                f"Great news! The item you have been waiting for is now available:\n\n"
                f"  Equipment: {equipment_label}\n\n"
                f"You have {minutes_to_claim} minutes to claim it at the kiosk before your queue expires.\n"
                f"Please claim before: {deadline_str}\n\n"
                f"If you no longer need the item, you may ignore this message and your queue will expire automatically.\n\n"
                f"Thank you,\n"
                f"EquiLock"
            )

            mail.send(msg)
            print(f"✅ Queue notification sent to {user_email} for [{equipment_label}]")
            return True
        except Exception as e:
            print(f"❌ Failed to send queue notification to {user_email}: {e}")
            return False

@app.route("/api/send_queue_email", methods=["POST"])
def send_queue_email():
    """Tinatawag ng server.js kapag naireturna ang item at may naka-queue"""
    try:
        data = request.json
        equipment_label = data.get("equipment_label")

        if not equipment_label:
            return jsonify({"success": False, "message": "No equipment_label"})

        conn_trx = db(TRX_DB)
        queue_entry = conn_trx.execute(
            "SELECT user_id, user_name FROM item_queue WHERE equipment_label = ? ORDER BY id ASC LIMIT 1",
            (equipment_label,)
        ).fetchone()
        conn_trx.close()

        if not queue_entry:
            return jsonify({"success": False, "message": "No queue entry found"})

        user_id = queue_entry["user_id"]
        user_name = queue_entry["user_name"]

        conn_usr = db(USR_DB)
        user = conn_usr.execute(
            "SELECT email, fullname FROM users WHERE idnumber = ?",
            (user_id,)
        ).fetchone()
        conn_usr.close()

        if not user or not user["email"]:
            print(f"⚠️  No email found for user_id: {user_id}")
            return jsonify({"success": False, "message": "No email found for queued user"})

        success = send_queue_notification_email(user["email"], user_name or user["fullname"], equipment_label)
        return jsonify({"success": success, "notified_user": user_name})

    except Exception as e:
        print(f"❌ send_queue_email error: {e}")
        return jsonify({"success": False, "message": str(e)})

def notify_pending_reports():

    with app.app_context():
        try:
            conn = db(TRX_DB)

            if not rows:
                print("✅ No pending admin report notifications.")
                conn.close()
                return

            from collections import defaultdict
            grouped = defaultdict(lambda: {"report_types": [], "user_id": "", "user_name": "", "ids": []})
            for row in rows:
                key = (row["equipment_label"], row["reported_at"] or "")
                grouped[key]["report_types"].append(row["report_type"])
                grouped[key]["user_id"]   = row["user_id"]   or ""
                grouped[key]["user_name"] = row["user_name"] or ""
                grouped[key]["ids"].append(row["id"])

            notified_ids = []
            for (equip_label, reported_at), data in grouped.items():
                success = send_admin_report_email(
                    equip_label,
                    data["report_types"],
                    data["user_name"],
                    data["user_id"],
                    reported_at
                )
                if success:
                    notified_ids.extend(data["ids"])

            if notified_ids:
                placeholders = ",".join("?" * len(notified_ids))
                conn.execute(
                    f"UPDATE item_reports SET admin_notified = 1 WHERE id IN ({placeholders})",
                    notified_ids
                )
                conn.commit()
                print(f"📧 Startup: sent pending report notifications for {len(grouped)} report event(s).")

            conn.close()
        except Exception as e:
            print(f"❌ notify_pending_reports error: {e}")

def auto_overdue_checker():
    """Background task to check overdue items, send notifications, and apply bans"""
    with app.app_context():
        try:
            print("🔄 Running auto overdue checker...")
            conn = db(TRX_DB)
            conn_usr = db(USR_DB)
            now = datetime.now()

            for r in rows:
                if not r["borrow_time"] or r["borrow_time"] == "---":
                    continue

                borrow_dt = datetime.strptime(r["borrow_time"], "%Y-%m-%d %H:%M:%S")
                diff_now = (now - borrow_dt).total_seconds() / 60

                user_name = r["user_name"]
                equip = r["equipment_label"]
                trx_id = r["id"]

                if diff_now >= 210:
                    user = conn_usr.execute(
                        "SELECT email FROM users WHERE fullname=?",
                        (user_name,)
                    ).fetchone()

                    if user and user["email"]:

                        success = send_overdue_email(user["email"], user_name, equip, r["borrow_time"])
                        
                        if success:

                            conn.execute("UPDATE transactions SET notified = 'Yes' WHERE id = ?", (trx_id,))
                            conn.commit()
                            print(f"📧 Notification recorded for {user_name}")

            for rr in returned_rows:
                borrow_dt = datetime.strptime(rr["borrow_time"], "%Y-%m-%d %H:%M:%S")
                return_dt = datetime.strptime(rr["return_time"], "%Y-%m-%d %H:%M:%S")
                diff = (return_dt - borrow_dt).total_seconds() / 60

                if diff > 240:
                    ban_start = return_dt.strftime("%Y-%m-%dT%H:%M")
                    ban_end = (return_dt + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M")

                    conn_usr.execute("UPDATE users SET ban_start=?, ban_end=?, violation_count = violation_count + 1 WHERE fullname=?", 
                                     (ban_start, ban_end, rr["user_name"]))
                    conn.execute("UPDATE transactions SET ban_applied = 'Yes' WHERE id=?", (rr["id"],))

            conn_usr.commit()
            conn.commit()
            conn_usr.close()
            conn.close()
            print("✅ Auto checker done")

        except Exception as e:
            print(f"❌ Auto checker error: {e}")

import hashlib
import time as _time

def _get_data_fingerprint():

    try:
        conn_t = sqlite3.connect(TRX_DB)
        conn_t.row_factory = sqlite3.Row
        trx_rows = conn_t.execute(
            "SELECT id, return_time, condition, notified, ban_applied FROM transactions ORDER BY id DESC LIMIT 50"
        ).fetchall()
        reports = conn_t.execute(
            "SELECT id, equipment_label, report_type FROM item_reports ORDER BY id DESC LIMIT 20"
        ).fetchall()
        conn_t.close()

        conn_u = sqlite3.connect(USR_DB)
        conn_u.row_factory = sqlite3.Row
        user_rows = conn_u.execute(
            "SELECT idnumber, ban_start, ban_end, violation_count FROM users ORDER BY id DESC LIMIT 50"
        ).fetchall()
        conn_u.close()

        parts = (
            [f"{r['id']}{r['return_time']}{r['condition']}{r['notified']}{r['ban_applied']}" for r in trx_rows] +
            [f"{r['id']}{r['equipment_label']}{r['report_type']}" for r in reports] +
            [f"{u['idnumber']}{u['ban_start']}{u['ban_end']}{u['violation_count']}" for u in user_rows]
        )
        return hashlib.md5("".join(parts).encode()).hexdigest()
    except Exception as e:
        return str(_time.time())

@app.route("/api/download-db/<db_name>")
def download_db(db_name):
    """Allow admin to download a raw SQLite .db file."""
    if db_name == "transactions":
        path = TRX_DB
        filename = "transaction.db"
    elif db_name == "users":
        path = USR_DB
        filename = "users.db"
    else:
        return jsonify(error="Unknown database"), 404

    if not os.path.exists(path):
        return jsonify(error="File not found"), 404

    return send_file(
        path,
        as_attachment=True,
        download_name=filename,
        mimetype="application/octet-stream"
    )

@app.route("/api/stream")
def sse_stream():

    from flask import Response, stream_with_context

    def generate():
        last_fingerprint = _get_data_fingerprint()
        last_heartbeat = _time.time()

        yield "event: heartbeat\ndata: ok\n\n"

        while True:
            _time.sleep(1)

            now = _time.time()

            if now - last_heartbeat >= 25:
                yield "event: heartbeat\ndata: ok\n\n"
                last_heartbeat = now

            current = _get_data_fingerprint()
            if current != last_fingerprint:
                last_fingerprint = current
                yield "event: update\ndata: changed\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.route("/api/notifications/unread")
def unread_notifications():
    try:
        conn = db(TRX_DB)

        count = conn.execute("SELECT COUNT(*) FROM transactions WHERE condition LIKE 'No%' AND notified = 'No'").fetchone()[0]
        conn.close()
        return jsonify({"count": count})
    except:
        return jsonify({"count": 0})

@app.route("/api/notifications/mark_read", methods=["POST"])
def mark_read():
    try:
        conn = db(TRX_DB)

        conn.execute("UPDATE transactions SET notified = 'Yes' WHERE condition LIKE 'No%' AND notified = 'No'")
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except:
        return jsonify({"status": "error"}), 500

@app.route("/api/transactions")
def transactions():
    try:
        conn = db(TRX_DB)
        rows = conn.execute("SELECT id, user_name, equipment_label, borrow_time, return_time, duration, condition, ban_applied FROM transactions ORDER BY id DESC").fetchall()
        
        data = []
        now = datetime.now()
        conn_usr = db(USR_DB)
        
        for r in rows:
            b_time_str = r["borrow_time"]
            r_time_str = r["return_time"]
            user_name = r["user_name"]
            equip_label = r["equipment_label"]
            current_condition = r["condition"] if r["condition"] else "Good"
            trx_id = r["id"]
            db_duration = r["duration"]
            
            original_condition = r["condition"] if r["condition"] else ""
            current_condition = original_condition
            status = "Pending"
            color = "text-slate-400"
            
            if b_time_str and b_time_str != "---":
                try:
                    borrow_dt = datetime.strptime(b_time_str, "%Y-%m-%d %H:%M:%S")
                    is_returned = r_time_str and r_time_str not in ["In Use", "---", ""]
                    
                    if is_returned:
                        return_dt = datetime.strptime(r_time_str, "%Y-%m-%d %H:%M:%S")
                        diff = return_dt - borrow_dt
                        minutes_elapsed = int(diff.total_seconds() / 60)
                        

                        formatted_duration = f"{minutes_elapsed} mins"
                        if not db_duration or db_duration in ["---", "0", "0 min", "0 mins"]:
                            conn.execute("UPDATE transactions SET duration = ? WHERE id = ?", (formatted_duration, trx_id))
                            db_duration = formatted_duration
                        
                        if minutes_elapsed <= 240:
                            status = "Returned"
                            color = "text-green-600"
                        else:
                            status = "Overdue"
                            color = "text-[#9F2B68]" 
                            
                            if r["ban_applied"] != 'Yes':
                                ban_start_val = return_dt.strftime("%Y-%m-%dT%H:%M")
                                ban_end_val = (return_dt + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M")
                                

                                
                                conn.execute("UPDATE transactions SET ban_applied = 'Yes' WHERE id = ?", (trx_id,))
                    else:
                        diff_now = (now - borrow_dt).total_seconds() / 60
                        if diff_now <= 240:
                            status = "In Use"
                            color = "text-yellow-500"
                        else:
                            status = "Overdue"
                            color = "text-red-600"

                except Exception as e:
                    print(f"Row Error: {e}")

            data.append({
                "user_name": user_name,
                "equipment_label": equip_label,
                "borrow_time": b_time_str,
                "return_time": r_time_str,
                "duration": db_duration if db_duration else "---",
                "report": current_condition,
                "calculated_status": status,
                "color_class": color
            })
        
        conn_usr.commit()
        conn.commit()
        conn_usr.close()
        conn.close()
        return jsonify(data)
    except Exception as e:
        print(f"Global API Error: {e}")
        return jsonify([])

@app.route("/api/transactions/export")
def export_transactions():
    try:
        import csv, io
        conn = db(TRX_DB)
        rows = conn.execute(
            "SELECT user_name, equipment_label, borrow_time, return_time, duration, condition FROM transactions ORDER BY id DESC"
        ).fetchall()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Borrower", "Equipment", "Time Borrowed", "Time Returned", "Duration", "Condition"])
        for r in rows:
            writer.writerow([r["user_name"], r["equipment_label"], r["borrow_time"], r["return_time"], r["duration"], r["condition"]])

        output.seek(0)
        from flask import Response
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=activity_logs.csv"}
        )
    except Exception as e:
        print(f"Export error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/transactions/clear", methods=["POST"])
def clear_transactions():
    err = require_superadmin()
    if err: return err
    try:
        conn = db(TRX_DB)
        conn.execute("DELETE FROM transactions")
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Clear logs error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/analytics")
def analytics():
    try:
        conn = db(TRX_DB)
        rows = conn.execute("SELECT borrow_time, return_time FROM transactions").fetchall()
        conn.close()
        
        b_map, r_map = defaultdict(int), defaultdict(int)
        
        for r in rows:

            b_time = r["borrow_time"]
            if b_time and len(b_time) >= 10 and b_time[0].isdigit():
                b_map[b_time[:10]] += 1
            
            r_time = r["return_time"]
            if r_time and len(r_time) >= 10 and r_time[0].isdigit():
                r_map[r_time[:10]] += 1
        

        labels = sorted(set(b_map.keys()) | set(r_map.keys()))
        
        return jsonify({
            "labels": labels, 
            "borrowData": [b_map[d] for d in labels], 
            "returnData": [r_map[d] for d in labels]
        })
    except Exception as e:
        print(f"Analytics Error: {e}")
        return jsonify({"labels":[], "borrowData":[], "returnData":[]})
@app.route("/api/dashboard_reports")
def dashboard_reports():
    """Ibalik ang lahat ng active item reports para sa dashboard — kasama ang details"""
    try:
        conn = db(TRX_DB)

        result = []
        for r in rows:
            equip = r["equipment_label"] or ""
            reporter = r["user_name"] or ""
            reported_at = r["reported_at"] or ""

            result.append({
                "id": r["id"],
                "equipment_label": equip,
                "report_type": r["report_type"] or "",
                "reported_by": reporter or "Unknown",
                "report_time": reported_at,
                "last_borrower": last_borrow["user_name"] if last_borrow else "No borrow record",
                "last_borrow_time": last_borrow["borrow_time"] if last_borrow else ""
            })

        conn.close()
        return jsonify(result)
    except Exception as e:
        print(f"Dashboard reports error: {e}")
        return jsonify([])

@app.route("/api/dashboard_reports/dismiss", methods=["POST"])
def dismiss_report():
    """I-dismiss ang isang report — hindi na lalabas sa dashboard kahit mag-restart"""
    try:
        report_id = request.json.get("report_id")
        if not report_id:
            return jsonify({"success": False, "message": "No report_id"})

        conn = db(TRX_DB)

        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/item_reports/delete", methods=["POST"])
def delete_item_report():
    try:
        report_id = request.json.get("report_id")
        if not report_id:
            return jsonify({"success": False, "message": "No report_id"})
        conn = db(TRX_DB)
        conn.execute("DELETE FROM item_reports WHERE id = ?", (report_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

def get_admin_email():
    """Ibabalik ang lahat ng admin emails (list). Para ma-send sa lahat ng admins."""
    try:
        conn = db(USR_DB)
        rows = conn.execute("SELECT email FROM admin_account WHERE email != '' AND email IS NOT NULL").fetchall()
        conn.close()
        emails = [r["email"].strip() for r in rows if r["email"] and r["email"].strip()]
        return emails if emails else None
    except:
        pass
    return None

def send_admin_report_email(equipment_label, report_types, reporter_name, reporter_id, reported_at):

    with app.app_context():
        try:
            admin_email = get_admin_email()
            if not admin_email:
                print("⚠️  Walang admin email na naka-set sa profile. Hindi naipadala ang report notification.")
                return False

            type_labels = {
                'no_item': 'MISSING ITEM',
                'physical_damage': 'Physical Damage',
                'not_working': 'Not Working'
            }
            types_str = ", ".join([type_labels.get(t, t) for t in report_types])
            severity = "🚨 URGENT —" if 'no_item' in report_types else "⚠️"

            recipients = admin_email if isinstance(admin_email, list) else [admin_email]
            msg = Message(
                f"{severity} EquiLock Equipment Report: {equipment_label}",
                sender=app.config['MAIL_USERNAME'],
                recipients=recipients
            )
            msg.body = (
                f"Hello Admin,\n\n"
                f"A new equipment report has been submitted at the kiosk.\n\n"
                f"  Equipment   : {equipment_label}\n"
                f"  Report Type : {types_str}\n"
                f"  Reported by : {reporter_name} (ID: {reporter_id})\n"
                f"  Time        : {reported_at}\n\n"
                f"Please check the EquiLock dashboard for more details.\n\n"
                f"— EquiLock System"
            )
            mail.send(msg)
            print(f"📧 Admin report email sent to {admin_email} for [{equipment_label}]")
            return True
        except Exception as e:
            print(f"❌ Failed to send admin report email: {e}")
            return False

@app.route("/api/item_reports/submit", methods=["POST"])
def submit_item_report():

    try:
        data = request.json
        equipment_label = data.get("equipment_label", "").strip()
        report_types = data.get("report_types", [])
        user_id = data.get("user_id", "")
        user_name = data.get("user_name", "")
        reported_at = data.get("reported_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if not equipment_label or not report_types:
            return jsonify({"success": False, "message": "Missing required fields"})

        conn = db(TRX_DB)
        for rtype in report_types:
            conn.execute(
                "INSERT INTO item_reports (equipment_label, report_type, user_id, user_name, reported_at) VALUES (?, ?, ?, ?, ?)",
                (equipment_label, rtype, user_id, user_name, reported_at)
            )
        conn.commit()
        conn.close()

        email_sent = send_admin_report_email(equipment_label, report_types, user_name, user_id, reported_at)

        if email_sent:
            conn2 = db(TRX_DB)

            conn2.commit()
            conn2.close()

        return jsonify({"success": True})
    except Exception as e:
        print(f"submit_item_report error: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/item_reports")
def get_item_reports():
    try:
        conn = db(TRX_DB)

        conn.commit()

        reports_map = {}
        for row in rows:
            lbl = row["equipment_label"]
            if lbl not in reports_map:
                reports_map[lbl] = {
                    "id":               row["id"],
                    "equipment_label":  lbl,
                    "report_types":     [],
                    "reported_by_name": row["user_name"]   or "Unknown",
                    "reported_by_id":   row["user_id"]     or "",
                    "reported_at":      row["reported_at"] or "---",
                    "last_borrower":    None,
                    "last_borrow_time": None,
                }
            if row["report_type"] not in reports_map[lbl]["report_types"]:
                reports_map[lbl]["report_types"].append(row["report_type"])

        for lbl, report in reports_map.items():
            reporter = report["reported_by_name"] or ""
            reported_at = report["reported_at"] if report["reported_at"] != "---" else ""

            if last_trx:
                report["last_borrower"]    = last_trx["user_name"]
                report["last_borrow_time"] = last_trx["borrow_time"]

        conn.close()
        return jsonify(list(reports_map.values()))

    except Exception as e:
        print(f"item_reports error: {e}")
        return jsonify([])

def auto_report_notifier():

    with app.app_context():
        try:
            conn = db(TRX_DB)

            if not rows:
                conn.close()
                return

            from collections import defaultdict
            grouped = defaultdict(lambda: {"report_types": [], "user_id": "", "user_name": "", "ids": []})
            for row in rows:
                key = (row["equipment_label"], row["reported_at"] or "")
                grouped[key]["report_types"].append(row["report_type"])
                grouped[key]["user_id"]   = row["user_id"]   or ""
                grouped[key]["user_name"] = row["user_name"] or ""
                grouped[key]["ids"].append(row["id"])

            notified_ids = []
            for (equip_label, reported_at), data in grouped.items():
                success = send_admin_report_email(
                    equip_label,
                    data["report_types"],
                    data["user_name"],
                    data["user_id"],
                    reported_at
                )
                if success:
                    notified_ids.extend(data["ids"])

            if notified_ids:
                placeholders = ",".join("?" * len(notified_ids))
                conn.execute(
                    f"UPDATE item_reports SET admin_notified = 1 WHERE id IN ({placeholders})",
                    notified_ids
                )
                conn.commit()
                print(f"📧 auto_report_notifier: notified admin for {len(grouped)} report event(s).")

            conn.close()
        except Exception as e:
            print(f"❌ auto_report_notifier error: {e}")

scheduler = BackgroundScheduler()

if __name__ == "__main__":

    scheduler.add_job(auto_overdue_checker, 'interval', seconds=60, id='overdue_job', replace_existing=True)
    scheduler.add_job(run_ngrok_service, 'interval', hours=3, id='ngrok_job', replace_existing=True)
    scheduler.add_job(auto_report_notifier, 'interval', seconds=30, id='report_notif_job', replace_existing=True)

    print("🚀 Initializing Ngrok and Scheduler...")
    run_ngrok_service()
    notify_pending_reports()
    scheduler.start() 

    app.run(debug=True, host="0.0.0.0", port=5000, use_reloader=False)