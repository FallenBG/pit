# src/database.py
# Handles database initialization and interaction logic.
# *** UPDATED: _get_db_connection prioritizes env var ***

import sqlite3
import os
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Default database path
_DEFAULT_DATABASE_DIR = Path(__file__).parent.parent / "data"
_DEFAULT_DATABASE_PATH = _DEFAULT_DATABASE_DIR / "pit.db"

def _get_database_path():
    """Gets the database path, prioritizing the environment variable."""
    env_path = os.environ.get("PIT_DATABASE_PATH")
    if env_path:
        logging.debug(f"Using database path from environment variable: {env_path}")
        return Path(env_path)
    else:
        logging.debug(f"Using default database path: {_DEFAULT_DATABASE_PATH}")
        return _DEFAULT_DATABASE_PATH

def _get_db_connection():
    """Internal helper to establish and return a database connection using the determined path."""
    db_path = _get_database_path()
    conn = None
    try:
        # Ensure parent directory exists before connecting
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        logging.debug(f"Database connection established to {db_path}.")
        return conn
    except sqlite3.Error as e:
        logging.error(f"Error connecting to database at {db_path}: {e}")
        return None

def initialize_database(db_path=None):
    """Initializes the SQLite database and creates tables if they don't exist."""
    # Use specified path or determine the path
    path_to_initialize = Path(db_path) if db_path else _get_database_path()
    target_dir = path_to_initialize.parent
    logging.info(f"Initializing database at: {path_to_initialize}")
    target_dir.mkdir(parents=True, exist_ok=True)

    # Get connection specifically for initialization using the target path
    conn = None
    try:
        conn = sqlite3.connect(path_to_initialize, timeout=10)
        conn.execute("PRAGMA foreign_keys = ON") # Ensure FKs are on for this connection too
        cursor = conn.cursor()
        # Create tables...
        cursor.execute("CREATE TABLE IF NOT EXISTS assets (id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT UNIQUE, name TEXT NOT NULL, asset_type TEXT NOT NULL, currency TEXT NOT NULL, isin TEXT UNIQUE);")
        cursor.execute("CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id INTEGER, transaction_type TEXT NOT NULL, date TEXT NOT NULL, quantity REAL, price REAL, fees REAL DEFAULT 0.0, currency TEXT NOT NULL, notes TEXT, FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL);")
        cursor.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);")
        # Create indexes...
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_asset_id ON transactions (asset_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assets_ticker ON assets (ticker);")
        conn.commit()
        logging.info("Database initialized successfully.")
    except sqlite3.Error as e:
        logging.error(f"An error occurred during database initialization: {e}")
        if conn: conn.rollback()
    finally:
        if conn:
            conn.close()
            logging.debug("Database connection closed after initialization.")

# --- CRUD Functions (Accept optional connection) ---
# Functions remain the same structure (accept conn, use _get_db_connection if None, no internal close)

def add_asset(ticker, name, asset_type, currency, isin=None, conn=None):
    """Adds a new asset. Uses provided conn or creates a new one."""
    sql = "INSERT INTO assets (ticker, name, asset_type, currency, isin) VALUES (?, ?, ?, ?, ?)"
    local_conn = False
    if conn is None:
        conn = _get_db_connection()
        if not conn: return None
        local_conn = True
    last_id = None
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (ticker if ticker else None, name, asset_type, currency, isin))
        conn.commit()
        last_id = cursor.lastrowid
        logging.info(f"Added asset '{name}' (Ticker: {ticker}) with ID: {last_id}")
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding asset '{name}' (Ticker: {ticker}). Possible duplicate? Error: {e}")
        if local_conn: conn.rollback()
    except sqlite3.Error as e:
        logging.error(f"Database error adding asset '{name}': {e}")
        if local_conn: conn.rollback()
    finally:
        if local_conn and conn: conn.close()
    return last_id

def get_asset_by_ticker(ticker, conn=None):
    """Retrieves an asset by ticker. Uses provided conn or creates a new one."""
    sql = "SELECT * FROM assets WHERE ticker = ?"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return None
    asset = None
    try:
        cursor = conn.cursor()
        result = cursor.execute(sql, (ticker,)).fetchone()
        if result: asset = dict(result)
        logging.debug(f"Retrieved asset by ticker '{ticker}': {asset}")
    except sqlite3.Error as e: logging.error(f"Database error retrieving asset by ticker '{ticker}': {e}")
    finally:
        if local_conn and conn: conn.close()
    return asset

def get_asset_by_id(asset_id, conn=None):
    """Retrieves an asset by ID. Uses provided conn or creates a new one."""
    sql = "SELECT * FROM assets WHERE id = ?"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return None
    asset = None
    try:
        cursor = conn.cursor()
        result = cursor.execute(sql, (asset_id,)).fetchone()
        if result: asset = dict(result)
        logging.debug(f"Retrieved asset by ID '{asset_id}': {asset}")
    except sqlite3.Error as e: logging.error(f"Database error retrieving asset by ID '{asset_id}': {e}")
    finally:
        if local_conn and conn: conn.close()
    return asset

def get_all_assets(conn=None):
    """Retrieves all assets. Uses provided conn or creates a new one."""
    sql = "SELECT * FROM assets ORDER BY name"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return []
    assets = []
    try:
        cursor = conn.cursor()
        results = cursor.execute(sql).fetchall()
        assets = [dict(row) for row in results]
        logging.debug(f"Retrieved {len(assets)} assets.")
    except sqlite3.Error as e: logging.error(f"Database error retrieving all assets: {e}")
    finally:
        if local_conn and conn: conn.close()
    return assets

def add_transaction(asset_id, transaction_type, date, quantity, price, fees, currency, notes=None, conn=None):
    """Adds a transaction. Uses provided conn or creates a new one."""
    sql = "INSERT INTO transactions (asset_id, transaction_type, date, quantity, price, fees, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return None
    last_id = None
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (asset_id, transaction_type, date, quantity, price, fees, currency, notes))
        conn.commit()
        last_id = cursor.lastrowid
        logging.info(f"Added transaction type '{transaction_type}' for asset ID {asset_id} with ID: {last_id}")
    except sqlite3.Error as e:
        logging.error(f"Database error adding transaction for asset ID {asset_id}: {e}")
        if local_conn: conn.rollback()
    finally:
        if local_conn and conn: conn.close()
    return last_id

def get_transactions_for_asset(asset_id, conn=None):
    """Retrieves transactions for an asset. Uses provided conn or creates a new one."""
    sql = "SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return []
    transactions = []
    try:
        cursor = conn.cursor()
        results = cursor.execute(sql, (asset_id,)).fetchall()
        transactions = [dict(row) for row in results]
        logging.debug(f"Retrieved {len(transactions)} transactions for asset ID {asset_id}.")
    except sqlite3.Error as e: logging.error(f"Database error retrieving transactions for asset ID {asset_id}: {e}")
    finally:
        if local_conn and conn: conn.close()
    return transactions

def get_all_transactions(conn=None):
    """Retrieves all transactions. Uses provided conn or creates a new one."""
    sql = "SELECT t.*, a.ticker, a.name as asset_name FROM transactions t LEFT JOIN assets a ON t.asset_id = a.id ORDER BY t.date DESC"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return []
    transactions = []
    try:
        cursor = conn.cursor()
        results = cursor.execute(sql).fetchall()
        transactions = [dict(row) for row in results]
        logging.debug(f"Retrieved {len(transactions)} total transactions.")
    except sqlite3.Error as e: logging.error(f"Database error retrieving all transactions: {e}")
    finally:
        if local_conn and conn: conn.close()
    return transactions

def set_setting(key, value, conn=None):
    """Sets a setting. Uses provided conn or creates a new one."""
    sql = "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return False
    success = False
    try:
        cursor = conn.cursor()
        cursor.execute(sql, (key, value))
        conn.commit()
        logging.info(f"Set setting '{key}' to '{value}'")
        success = True
    except sqlite3.Error as e:
        logging.error(f"Database error setting setting '{key}': {e}")
        if local_conn: conn.rollback()
    finally:
        if local_conn and conn: conn.close()
    return success

def get_setting(key, conn=None):
    """Gets a setting. Uses provided conn or creates a new one."""
    sql = "SELECT value FROM settings WHERE key = ?"
    local_conn = False
    if conn is None: conn = _get_db_connection(); local_conn = True
    if not conn: return None
    value = None
    try:
        cursor = conn.cursor()
        result = cursor.execute(sql, (key,)).fetchone()
        if result: value = result['value']
        logging.debug(f"Retrieved setting '{key}': '{value}'")
    except sqlite3.Error as e: logging.error(f"Database error retrieving setting '{key}': {e}")
    finally:
        if local_conn and conn: conn.close()
    return value

# --- Main execution block ---
if __name__ == "__main__":
    initialize_database() # Initialize using default path or env var
    main_conn = _get_db_connection() # Connect using default path or env var
    if main_conn:
        try:
            current_base = get_setting('base_currency', conn=main_conn)
            if current_base is None:
                if set_setting('base_currency', 'USD', conn=main_conn): print("Default base currency set to USD.")
                else: print("Failed to set default base currency.")
            else: print(f"Base currency already set to: {current_base}")
        finally: main_conn.close()
    else: print("Failed to connect to DB for main block check.")
