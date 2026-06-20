import sqlite3
import os
import hashlib
import binascii
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

class DatabaseManager:
    """
    Manages persistent SQLite storage for user accounts, file registries,
    and secure law enforcement audit logs.
    """
    
    @staticmethod
    def initialize():
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                badge_id TEXT PRIMARY KEY,
                password_hash TEXT,
                name TEXT,
                role TEXT
            )
        """)
        
        # 2. Audit Logs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                operator TEXT,
                role TEXT,
                query TEXT,
                query_type TEXT,
                hits_count INTEGER,
                latency_ms REAL
            )
        """)
        
        # 3. Ingested Files Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ingested_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE,
                source_type TEXT,
                records_count INTEGER,
                file_size INTEGER,
                uploaded_at TEXT
            )
        """)
        
        conn.commit()
        
        # Check if default admin account is seeded
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            print("[Database] Seeding default admin account (ADMIN-001 / admin_secure_pass)...")
            admin_hash = DatabaseManager.hash_password("admin_secure_pass")
            cursor.execute(
                "INSERT INTO users VALUES (?, ?, ?, ?)",
                ("ADMIN-001", admin_hash, "System Administrator", "Admin")
            )
            conn.commit()
            
        conn.close()

    @staticmethod
    def hash_password(password):
        """Hashes password using PBKDF2 with SHA-256 and salt."""
        salt = b"bigdata_secret_salt_hash_key"
        key = hashlib.pbkdf2_hmac(
            'sha256', 
            password.encode('utf-8'), 
            salt, 
            100000
        )
        return binascii.hexlify(key).decode('ascii')

    @staticmethod
    def register_user(badge_id, password, name, role):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT badge_id FROM users WHERE badge_id = ?", (badge_id,))
            if cursor.fetchone():
                return False, "Badge ID already registered"
                
            pwd_hash = DatabaseManager.hash_password(password)
            cursor.execute(
                "INSERT INTO users VALUES (?, ?, ?, ?)",
                (badge_id, pwd_hash, name, role)
            )
            conn.commit()
            return True, "User registered successfully"
        except Exception as e:
            return False, str(e)
        finally:
            conn.close()

    @staticmethod
    def authenticate_user(badge_id, password):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT badge_id, password_hash, name, role FROM users WHERE badge_id = ?", (badge_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
            
        badge_id, pwd_hash, name, role = row
        input_hash = DatabaseManager.hash_password(password)
        
        if input_hash == pwd_hash:
            return {"badge_id": badge_id, "name": name, "role": role}
        return None

    @staticmethod
    def log_audit(operator, role, query, query_type, hits_count, latency_ms):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        try:
            cursor.execute("""
                INSERT INTO audit_logs (timestamp, operator, role, query, query_type, hits_count, latency_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (timestamp, operator, role, query, query_type, hits_count, latency_ms))
            conn.commit()
        except Exception as e:
            print(f"[Database Error] Log audit failed: {e}")
        finally:
            conn.close()

    @staticmethod
    def get_audit_history():
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT timestamp, operator, role, query, query_type, hits_count, latency_ms FROM audit_logs ORDER BY id DESC LIMIT 50")
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for r in rows:
            logs.append({
                "timestamp": r[0],
                "user": r[1],
                "role": r[2],
                "query": r[3],
                "query_type": r[4],
                "hits_count": r[5],
                "latency_ms": r[6]
            })
        return logs

    @staticmethod
    def register_file(filename, source_type, records_count, file_size):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        uploaded_at = time.strftime("%Y-%m-%d %H:%M:%S")
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO ingested_files (filename, source_type, records_count, file_size, uploaded_at)
                VALUES (?, ?, ?, ?, ?)
            """, (filename, source_type, records_count, file_size, uploaded_at))
            conn.commit()
            return True
        except Exception as e:
            print(f"[Database Error] Register file failed: {e}")
            return False
        finally:
            conn.close()

    @staticmethod
    def get_ingested_files():
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT filename, source_type, records_count, file_size, uploaded_at FROM ingested_files ORDER BY id DESC")
        rows = cursor.fetchall()
        conn.close()
        
        files = []
        for r in rows:
            files.append({
                "filename": r[0],
                "source_type": r[1],
                "records_count": r[2],
                "file_size": r[3],
                "uploaded_at": r[4]
            })
        return files

# Initialize database schema on load
DatabaseManager.initialize()
