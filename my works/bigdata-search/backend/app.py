import os
import time
import jwt
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import json
import csv

from backend.engine import BigDataEngine
from backend.ai_graph import AIGraphEngine
from backend.database import DatabaseManager

app = Flask(__name__)
CORS(app)

SECRET_KEY = "bigdata_intelligence_secure_jwt_token_key"
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize engines
db_engine = BigDataEngine()
graph_engine = AIGraphEngine(db_engine)

# ==========================================
# JWT TOKEN DECORATOR / HELPER
# ==========================================
def token_required(f):
    def decorator(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({"message": "Access token is missing"}), 401
            
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = {
                "badge_id": data["badge_id"],
                "role": data["role"],
                "name": data["name"]
            }
        except Exception:
            return jsonify({"message": "Access token is invalid or expired"}), 401
            
        return f(current_user, *args, **kwargs)
    decorator.__name__ = f.__name__
    return decorator

# ==========================================
# AUTH ENDPOINTS
# ==========================================
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    badge_id = data.get('badgeId', '').strip()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip()
    role = data.get('role', 'Investigator').strip()
    
    if not badge_id or not password or not name:
        return jsonify({"message": "Badge ID, password, and name are required"}), 400
        
    success, msg = DatabaseManager.register_user(badge_id, password, name, role)
    if success:
        return jsonify({"message": "User badge registered successfully. You can log in now."}), 201
    return jsonify({"message": msg}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    badge_id = data.get('badgeId', '').strip()
    password = data.get('password', '').strip()
    
    if not badge_id or not password:
        return jsonify({"message": "Badge ID and password are required"}), 400
        
    user_data = DatabaseManager.authenticate_user(badge_id, password)
    if not user_data:
        return jsonify({"message": "Invalid Badge ID or Password"}), 401
        
    token = jwt.encode({
        "badge_id": user_data["badge_id"],
        "role": user_data["role"],
        "name": user_data["name"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }, SECRET_KEY, algorithm="HS256")
    
    return jsonify({
        "token": token,
        "user": {
            "badgeId": user_data["badge_id"],
            "name": user_data["name"],
            "role": user_data["role"]
        }
    })

@app.route('/api/auth/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify(current_user)

# ==========================================
# INGESTION & UPLOAD ENDPOINTS
# ==========================================
@app.route('/api/ingest/upload', methods=['POST'])
@token_required
def upload_file(current_user):
    if 'file' not in request.files:
        return jsonify({"message": "No file part in request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No file selected"}), 400
        
    source_type = request.form.get('source_type', 'CDR').strip()
    filename = secure_filename(file.filename)
    dest_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(dest_path)
    
    # Process file immediately using Spark MapReduce
    spark_stats = db_engine.ingest_files_spark([dest_path])
    
    # Register file in SQLite
    file_size = os.path.getsize(dest_path)
    records_count = spark_stats.get("records_total", 0)
    DatabaseManager.register_file(filename, source_type, records_count, file_size)
    
    return jsonify({
        "message": f"Successfully ingested {filename}",
        "spark_stats": spark_stats
    })

@app.route('/api/ingest/files', methods=['GET'])
@token_required
def get_files(current_user):
    files = DatabaseManager.get_ingested_files()
    return jsonify(files)

@app.route('/api/ingest/log', methods=['POST'])
def ingest_realtime_log():
    """
    Real-time streaming ingestion API. External nodes post JSON telemetry packets here.
    Endpoint is unauthenticated or pre-shared key authenticated to simulate direct network pings.
    """
    payload = request.json or {}
    source_type = payload.get('source_type', 'API LOG').strip()
    metadata = payload.get('metadata', {})
    
    if not metadata:
        return jsonify({"message": "Log payload is missing 'metadata' content"}), 400
        
    record = {
        "id": f"API_{int(time.time() * 1000)}",
        "source_type": source_type,
        "metadata": metadata,
        "raw_text": json.dumps(metadata),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    # Push directly into the Kafka queue
    db_engine.produce_to_kafka([record])
    
    return jsonify({
        "status": "QUEUED",
        "message": "Telemetry event routed to Kafka cluster queue broker.",
        "record_id": record["id"]
    }), 202

@app.route('/api/ingest/stream', methods=['GET'])
@token_required
def get_stream_status(current_user):
    stats = db_engine.stream_stats.copy()
    stats["queue_size"] = db_engine.kafka_queue.qsize()
    stats["streaming_active"] = db_engine.streaming_active
    
    return jsonify({
        "stats": stats,
        "recent_logs": db_engine.stream_history[-15:]
    })

# ==========================================
# SEARCH WORKSPACE ENDPOINTS
# ==========================================
@app.route('/api/search', methods=['POST'])
@token_required
def perform_search(current_user):
    data = request.json or {}
    query = data.get('query', '').strip()
    query_type = data.get('type', 'natural').lower()
    
    if not query:
        return jsonify({"message": "Search query cannot be empty"}), 400
        
    # Perform core index search
    search_payload = db_engine.search(query, query_type=query_type, limit=50)
    
    # Build linkage network graph
    network_graph = graph_engine.build_network_graph(query, search_payload["results"])
    
    # Log audit trails to SQLite database (Production Requirement)
    DatabaseManager.log_audit(
        operator=current_user["name"],
        role=current_user["role"],
        query=query,
        query_type=query_type,
        hits_count=search_payload["total_hits"],
        latency_ms=search_payload["latency_ms"]
    )
        
    return jsonify({
        "results": search_payload["results"],
        "total_hits": search_payload["total_hits"],
        "latency_ms": search_payload["latency_ms"],
        "graph": network_graph
    })

# ==========================================
# ANALYTICS & ANOMALY ENDPOINTS
# ==========================================
@app.route('/api/analytics', methods=['GET'])
@token_required
def get_analytics(current_user):
    records = list(db_engine.documents.values())
    
    # Count per source database
    source_counts = {}
    for rec in records:
        src = rec["source_type"]
        source_counts[src] = source_counts.get(src, 0) + 1
        
    # Extract locations (Cell IDs, IP coordinates) to populate geographical heatmaps
    coordinates = []
    for rec in records:
        meta = rec.get("metadata", {})
        ip = meta.get("ip_address")
        cell = meta.get("cell_id")
        
        if ip:
            octets = ip.split('.')
            if len(octets) == 4:
                lat = 8 + (int(octets[1]) % 29) + (int(octets[2]) / 256.0)
                lng = 68 + (int(octets[2]) % 29) + (int(octets[3]) / 256.0)
                coordinates.append({
                    "lat": round(lat, 4),
                    "lng": round(lng, 4),
                    "label": f"IP: {ip} ({rec['source_type']})",
                    "value": 1
                })
        elif cell:
            cell_hash = hash(cell)
            lat = 12 + (abs(cell_hash) % 15) + (abs(cell_hash * 3) % 100 / 100.0)
            lng = 72 + (abs(cell_hash * 7) % 20) + (abs(cell_hash * 13) % 100 / 100.0)
            coordinates.append({
                "lat": round(lat, 4),
                "lng": round(lng, 4),
                "label": f"Cell: {cell} ({rec['source_type']})",
                "value": 1
            })
            
    # Read persistent SQLite audit history
    audit_history = DatabaseManager.get_audit_history()
                    
    stats = {
        "total_records": len(records),
        "source_counts": source_counts,
        "coordinates": coordinates[:100],
        "latency_baseline_ms": 12.5,
        "index_size_mb": round((len(db_engine.inverted_index) * 0.002) + (len(records) * 0.01), 2),
        "audit_history": audit_history
    }
    return jsonify(stats)

@app.route('/api/anomalies', methods=['GET'])
@token_required
def get_anomalies(current_user):
    anomalies = graph_engine.run_anomaly_detection()
    return jsonify(anomalies)

# ==========================================
# STARTUP UPLOADS SCANNER
# ==========================================
def scan_uploads_directory():
    """Scans uploads folder and indexes any unregistered files on startup."""
    print("[Startup Scanner] Checking uploads folder for new database files...")
    uploads_dir = app.config['UPLOAD_FOLDER']
    files_in_folder = [f for f in os.listdir(uploads_dir) if os.path.isfile(os.path.join(uploads_dir, f))]
    
    # Retrieve files registered in SQLite
    registered_filenames = [f["filename"] for f in DatabaseManager.get_ingested_files()]
    
    unregistered_files = []
    for fn in files_in_folder:
        if fn not in registered_filenames:
            unregistered_files.append(os.path.join(uploads_dir, fn))
            
    if unregistered_files:
        print(f"[Startup Scanner] Found {len(unregistered_files)} unregistered files. Commencing ingestion...")
        spark_stats = db_engine.ingest_files_spark(unregistered_files)
        
        # Register files in DB
        for fp in unregistered_files:
            fn = os.path.basename(fp)
            source_type = db_engine._deduce_source_type(fn)
            file_size = os.path.getsize(fp)
            DatabaseManager.register_file(fn, source_type, spark_stats.get("records_total", 0), file_size)
    else:
        # Check if the overall index matches the DB records; if database is empty but files exist, re-index
        if len(db_engine.documents) == 0 and files_in_folder:
            print("[Startup Scanner] Search index is empty but files exist in uploads. Force re-indexing uploads directory...")
            all_files = [os.path.join(uploads_dir, fn) for fn in files_in_folder]
            db_engine.ingest_files_spark(all_files)
        else:
            print("[Startup Scanner] Database files are fully synchronized.")
            
    # Always ensure Kafka stream is active
    if not db_engine.streaming_active:
        db_engine.start_kafka_stream()

# Scan on startup
scan_uploads_directory()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
