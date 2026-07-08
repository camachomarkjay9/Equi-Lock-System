import time
import threading
import numpy as np
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import cv2

app = Flask(__name__)
CORS(app)

model = None
model_type = None

def load_model():
    global model, model_type
    model_path = os.path.join(os.path.dirname(__file__), 'best.pt')
    try:
        from ultralytics import YOLO
        if os.path.exists(model_path):
            model = YOLO(model_path)
            model_type = 'pytorch (custom best.pt)'
            print(f"✅ Custom model loaded: {model_path}")
        else:
            print(f"⚠️  {model_path} not found.")
    except Exception as e:
        print(f"❌ Failed to load YOLO model: {e}")

load_model()

EQUIPMENT_CLASS_MAP = {
    "calculator 1": ["calcu"], "calculator 2": ["calcu"], "calculator 3": ["calcu"],
    "calculator 4": ["calcu"], "calculator 5": ["calcu"], "calculator 6": ["calcu"],
    "calculator 7": ["calcu"], "projector 1": ["proj"], "projector 2": ["proj"],
    "projector 3": ["proj"], "projector 4": ["proj"], "extension 1": ["ext"],
    "extension 2": ["ext"], "extension 3": ["ext"], "extension 4": ["ext"],
    "hdmi 1": ["hdmi"], "hdmi 2": ["hdmi"], "hdmi 3": ["hdmi"], "hdmi 4": ["hdmi"],
}

CONFIDENCE_THRESHOLD = 0.40
MATCH_VOTE_THRESHOLD  = 0.55
DETECTION_WINDOW      = 2.5

_frame_lock  = threading.Lock()
_result_lock = threading.Lock()

_latest_frame     = None
_latest_frame_ts  = 0.0
_latest_jpeg      = None
_latest_result    = {
    'detected': False, 'match': False, 'found_classes': [], 'boxes': []
}

_capture_active       = False
_current_expected_item = [None]
_cv_enabled           = True

_session_id = [0]

def _capture_worker():

    global _latest_frame, _latest_frame_ts, _latest_jpeg, _capture_active

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)
    cap.set(cv2.CAP_PROP_FPS,          30)

    while _capture_active:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.01)
            continue

        now = time.time()

        with _frame_lock:
            _latest_frame    = frame
            _latest_frame_ts = now

        with _result_lock:
            res_snapshot = _latest_result

        annotated = frame.copy()
        for b in res_snapshot.get('boxes', []):
            x1, y1, x2, y2 = [int(v) for v in b['box']]
            color = (34, 197, 94) if res_snapshot['match'] else (68, 68, 239)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated, f"{b['class']} {int(b['confidence']*100)}%",
                        (x1, max(y1 - 10, 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 55])
        jpeg_bytes = buf.tobytes()

        with _result_lock:
            _latest_jpeg = jpeg_bytes

    cap.release()
    print("📷 Capture worker stopped.")

def _inference_worker():

    global _latest_result, _capture_active

    while _capture_active:
        if model is None or _latest_frame is None:
            time.sleep(0.05)
            continue

        expected_item    = _current_expected_item[0]
        expected_classes = EQUIPMENT_CLASS_MAP.get(expected_item, [])
        current_session  = _session_id[0]

        FLUSH_DELAY = 0.4
        flush_deadline = time.time() + FLUSH_DELAY
        while time.time() < flush_deadline and _capture_active:
            time.sleep(0.05)

        window_start  = time.time()
        frame_results = []
        last_processed_ts = 0.0

        while (time.time() - window_start) < DETECTION_WINDOW and _capture_active:

            if _session_id[0] != current_session:
                break

            with _frame_lock:
                if _latest_frame is None or _latest_frame_ts <= last_processed_ts:
                    time.sleep(0.03)
                    continue
                img_to_proc      = _latest_frame.copy()
                last_processed_ts = _latest_frame_ts

            results = model.predict(img_to_proc, imgsz=320, conf=CONFIDENCE_THRESHOLD, verbose=False)

            frame_had_match = False
            for r in results:
                for box in r.boxes:
                    conf     = float(box.conf[0])
                    cls_id   = int(box.cls[0])
                    cls_name = r.names[cls_id].lower()
                    matched  = cls_name in expected_classes
                    if matched:
                        frame_had_match = True
                    frame_results.append({
                        'class':      cls_name,
                        'confidence': round(conf, 3),
                        'box':        [round(x, 1) for x in box.xyxy[0].tolist()],
                        'matched':    matched,
                    })

            time.sleep(0.03)

        if _session_id[0] != current_session:
            continue

        if frame_results:

            best_per_class: dict = {}
            match_frame_count = 0
            total_frames = 0

            per_call_match: list[bool] = []
            call_detections: list[list] = []

            for det in frame_results:
                cls = det['class']
                if cls not in best_per_class or det['confidence'] > best_per_class[cls]['confidence']:
                    best_per_class[cls] = det

            total_votes = len(frame_results)
            match_votes = sum(1 for d in frame_results if d['matched'])
            match       = (match_votes / total_votes) >= MATCH_VOTE_THRESHOLD if total_votes > 0 else False

            boxes_data    = list(best_per_class.values())
            found_classes = list(best_per_class.keys())
        else:

            with _result_lock:
                _latest_result['status'] = 'scanning'
            time.sleep(0.15)
            continue

        with _result_lock:
            _latest_result = {
                'detected':       len(found_classes) > 0,
                'match':          match,
                'found_classes':  found_classes,
                'boxes':          boxes_data,
                'window_frames':  len(frame_results),
                'window_ms':      int(DETECTION_WINDOW * 1000),
                'status':         'done'
            }

        time.sleep(0.15)

    print("🤖 Inference worker stopped.")

@app.route('/api/cv/set_mode', methods=['POST'])
def set_cv_mode():
    global _cv_enabled, _capture_active
    data = request.get_json() or {}
    _cv_enabled = bool(data.get('cv_enabled', False))
    if not _cv_enabled and _capture_active:
        _capture_active = False
    print(f"{'✅' if _cv_enabled else '🔴'} CV Mode: {'ENABLED' if _cv_enabled else 'DISABLED'}")
    return jsonify({'status': 'ok', 'cv_enabled': _cv_enabled})

@app.route('/api/cv/status', methods=['GET'])
def get_cv_status():
    return jsonify({
        'cv_enabled':    _cv_enabled,
        'camera_active': _capture_active,
        'model_loaded':  model is not None
    })

@app.route('/start_detection', methods=['POST'])
def start_detection():
    global _capture_active
    data = request.get_json() or {}

    if not _cv_enabled:
        return jsonify({
            'status':           'cv_disabled',
            'message':          'Computer Vision is disabled. Use QR scan only.',
            'camera_available': False,
            'model_loaded':     False
        })

    _current_expected_item[0] = data.get('expected_item', '').strip().lower()

    _session_id[0] += 1

    with _result_lock:
        _latest_result.update({
            'detected': False, 'match': False,
            'found_classes': [], 'boxes': [],
            'status': 'starting'
        })

    if not _capture_active:
        _capture_active = True
        threading.Thread(target=_capture_worker,   daemon=True).start()
        threading.Thread(target=_inference_worker, daemon=True).start()
        print(f"🎥 Camera + inference started for: '{_current_expected_item[0]}'")
    else:
        print(f"🔄 New scan session #{_session_id[0]} for: '{_current_expected_item[0]}'")

    return jsonify({
        'status':           'ok',
        'camera_available': True,
        'model_loaded':     model is not None,
        'session_id':       _session_id[0]
    })

@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    global _capture_active, _latest_jpeg
    _capture_active = False

    with _result_lock:
        _latest_result.update({
            'detected': False, 'match': False,
            'found_classes': [], 'boxes': [],
            'status': 'stopped'
        })
        _latest_jpeg = None
    print("🛑 Detection stopped.")
    return jsonify({'status': 'ok'})

@app.route('/camera_feed')
def camera_feed():
    """MJPEG stream. uses a local snapshot to avoid contention on the lock."""
    def generate():
        last_sent = None
        while True:
            with _result_lock:
                jpeg = _latest_jpeg

            if jpeg and jpeg is not last_sent:
                last_sent = jpeg
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpeg + b'\r\n')
            time.sleep(0.033)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/detect_live', methods=['GET'])
def detect_live():
    with _result_lock:
        return jsonify(_latest_result)

if __name__ == '__main__':
    print("🚀 EquiLock Optimized CV Server — Running on port 5004...")
    app.run(host='0.0.0.0', port=5004, debug=False, threaded=True)
