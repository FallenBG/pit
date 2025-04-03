    # src/database.py
    # Handles database initialization and interaction logic.

    import sqlite3
    import os
    from pathlib import Path
    import logging # Use logging for better error reporting

    # Setup basic logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    # Define the path for the database file
    DATABASE_DIR = Path(__file__).parent.parent / "data"
    DATABASE_PATH = DATABASE_DIR / "pit.db"

    def get_db_connection():
        """Establishes and returns a database connection."""
        conn = None
        try:
            conn = sqlite3.connect(DATABASE_PATH, timeout=10) # Added timeout
            # Return rows as dictionary-like objects instead of tuples
            conn.row_factory = sqlite3.Row
            logging.debug("Database connection established.")
            return conn
        except sqlite3.Error as e:
            logging.error(f"Error connecting to database at {DATABASE_PATH}: {e}")
            # If connection failed, conn is still None, which will be handled by callers
            return None


    def initialize_database():
        """
        Initializes the SQLite database and creates necessary tables if they don't exist.
        """
        logging.info(f"Initializing database at: {DATABASE_PATH}")
        DATABASE_DIR.mkdir(parents=True, exist_ok=True) # Ensure data directory exists

        conn = get_db_connection()
        if not conn:
            return # Exit if connection failed

        try:
            cursor = conn.cursor()

            # Use PRAGMA for foreign key support (recommended)
            cursor.execute("PRAGMA foreign_keys = ON;")

            # --- Create Assets Table ---
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT UNIQUE,
                name TEXT NOT NULL,
                asset_type TEXT NOT NULL,
                currency TEXT NOT NULL,
                isin TEXT UNIQUE
            );
            """)
            logging.info("Checked/Created 'assets' table.")

            # --- Create Transactions Table ---
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER,
                transaction_type TEXT NOT NULL,
                date TEXT NOT NULL,
                quantity REAL,
                price REAL,
                fees REAL DEFAULT 0.0,
                currency TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL
            );
            """)
            logging.info("Checked/Created 'transactions' table.")

            # --- Create Settings Table ---
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            """)
            logging.info("Checked/Created 'settings' table.")

            # --- Create Indexes ---
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_asset_id ON transactions (asset_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_assets_ticker ON assets (ticker);")
            logging.info("Checked/Created indexes.")

            conn.commit()
            logging.info("Database initialized successfully.")

        except sqlite3.Error as e:
            logging.error(f"An error occurred during database initialization: {e}")
        finally:
            if conn:
                conn.close()
                logging.debug("Database connection closed after initialization.")

    # --- CRUD Functions for Assets ---

    def add_asset(ticker, name, asset_type, currency, isin=None):
        """Adds a new asset to the database. Returns the new asset's ID or None on error."""
        sql = """
            INSERT INTO assets (ticker, name, asset_type, currency, isin)
            VALUES (?, ?, ?, ?, ?)
        """
        conn = get_db_connection()
        if not conn: return None
        last_id = None
        try:
            cursor = conn.cursor()
            # Handle case where ticker might be None (e.g., for Savings)
            # Ensure UNIQUE constraint on ticker doesn't block NULLs if multiple Savings accounts exist
            # (SQLite treats NULLs as distinct in UNIQUE constraints by default)
            cursor.execute(sql, (ticker if ticker else None, name, asset_type, currency, isin))
            conn.commit()
            last_id = cursor.lastrowid
            logging.info(f"Added asset '{name}' (Ticker: {ticker}) with ID: {last_id}")
        except sqlite3.IntegrityError as e:
            logging.error(f"Error adding asset '{name}' (Ticker: {ticker}). Possible duplicate ticker or ISIN? Error: {e}")
        except sqlite3.Error as e:
            logging.error(f"Database error adding asset '{name}': {e}")
        finally:
            if conn: conn.close()
        return last_id

    def get_asset_by_ticker(ticker):
        """Retrieves an asset by its ticker symbol. Returns a dict or None."""
        sql = "SELECT * FROM assets WHERE ticker = ?"
        conn = get_db_connection()
        if not conn: return None
        asset = None
        try:
            cursor = conn.cursor()
            cursor.execute(sql, (ticker,))
            result = cursor.fetchone()
            if result:
                asset = dict(result) # Convert Row object to dict
                logging.debug(f"Retrieved asset by ticker '{ticker}': {asset}")
        except sqlite3.Error as e:
            logging.error(f"Database error retrieving asset by ticker '{ticker}': {e}")
        finally:
            if conn: conn.close()
        return asset

    def get_asset_by_id(asset_id):
        """Retrieves an asset by its ID. Returns a dict or None."""
        sql = "SELECT * FROM assets WHERE id = ?"
        conn = get_db_connection()
        if not conn: return None
        asset = None
        try:
            cursor = conn.cursor()
            cursor.execute(sql, (asset_id,))
            result = cursor.fetchone()
            if result:
                asset = dict(result)
                logging.debug(f"Retrieved asset by ID '{asset_id}': {asset}")
        except sqlite3.Error as e:
            logging.error(f"Database error retrieving asset by ID '{asset_id}': {e}")
        finally:
            if conn: conn.close()
        return asset

    def get_all_assets():
        """Retrieves all assets from the database. Returns a list of dicts or empty list."""
        sql = "SELECT * FROM assets ORDER BY name"
        conn = get_db_connection()
        if not conn: return []
        assets = []
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            results = cursor.fetchall()
            assets = [dict(row) for row in results] # Convert all Row objects to dicts
            logging.debug(f"Retrieved {len(assets)} assets.")
        except sqlite3.Error as e:
            logging.error(f"Database error retrieving all assets: {e}")
        finally:
            if conn: conn.close()
        return assets

    # --- CRUD Functions for Transactions ---

    def add_transaction(asset_id, transaction_type, date, quantity, price, fees, currency, notes=None):
        """Adds a new transaction to the database. Returns the new transaction's ID or None on error."""
        sql = """
            INSERT INTO transactions (asset_id, transaction_type, date, quantity, price, fees, currency, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        conn = get_db_connection()
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
        finally:
            if conn: conn.close()
        return last_id

    def get_transactions_for_asset(asset_id):
        """Retrieves all transactions for a specific asset, ordered by date descending. Returns list of dicts."""
        sql = "SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC"
        conn = get_db_connection()
        if not conn: return []
        transactions = []
        try:
            cursor = conn.cursor()
            cursor.execute(sql, (asset_id,))
            results = cursor.fetchall()
            transactions = [dict(row) for row in results]
            logging.debug(f"Retrieved {len(transactions)} transactions for asset ID {asset_id}.")
        except sqlite3.Error as e:
            logging.error(f"Database error retrieving transactions for asset ID {asset_id}: {e}")
        finally:
            if conn: conn.close()
        return transactions

    def get_all_transactions():
        """Retrieves all transactions, ordered by date descending. Returns list of dicts."""
        # Join with assets to get asset ticker/name easily if needed
        sql = """
            SELECT t.*, a.ticker, a.name as asset_name
            FROM transactions t
            LEFT JOIN assets a ON t.asset_id = a.id
            ORDER BY t.date DESC
        """
        conn = get_db_connection()
        if not conn: return []
        transactions = []
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            results = cursor.fetchall()
            transactions = [dict(row) for row in results]
            logging.debug(f"Retrieved {len(transactions)} total transactions.")
        except sqlite3.Error as e:
            logging.error(f"Database error retrieving all transactions: {e}")
        finally:
            if conn: conn.close()
        return transactions

    # --- CRUD Functions for Settings ---

    def set_setting(key, value):
        """Inserts or replaces a setting value."""
        sql = "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
        conn = get_db_connection()
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
        finally:
            if conn: conn.close()
        return success

    def get_setting(key):
        """Retrieves a setting value. Returns the value string or None."""
        sql = "SELECT value FROM settings WHERE key = ?"
        conn = get_db_connection()
        if not conn: return None
        value = None
        try:
            cursor = conn.cursor()
            cursor.execute(sql, (key,))
            result = cursor.fetchone()
            if result:
                value = result['value']
                logging.debug(f"Retrieved setting '{key}': '{value}'")
            else:
                 logging.debug(f"Setting '{key}' not found.")
        except sqlite3.Error as e:
            logging.error(f"Database error retrieving setting '{key}': {e}")
        finally:
            if conn: conn.close()
        return value


    # --- Main execution block ---
    if __name__ == "__main__":
        initialize_database()

        # Example: Add default base currency setting if not present
        if get_setting('base_currency') is None:
             if set_setting('base_currency', 'USD'):
                 print("Default base currency set to USD.")
             else:
                 print("Failed to set default base currency.")
        else:
            print(f"Base currency already set to: {get_setting('base_currency')}")

        # --- Example Usage (for testing) ---
        # print("\n--- Testing DB Functions ---")
        # asset_id = add_asset("TEST", "Test Stock", "Stock", "USD")
        # if asset_id:
        #     print(f"Added test asset with ID: {asset_id}")
        #     add_transaction(asset_id, "Buy", "2025-04-01", 10, 100.0, 1.0, "USD", "Test buy")
        #     add_transaction(asset_id, "Sell", "2025-04-02", 5, 110.0, 1.0, "USD", "Test sell")
        #     print("Transactions for TEST asset:")
        #     for tx in get_transactions_for_asset(asset_id):
        #         print(tx)
        # print("\nAll Assets:")
        # for asset in get_all_assets():
        #     print(asset)
        # print("\nAll Transactions:")
        # for tx in get_all_transactions():
        #     print(tx)
        # print("--- End Test ---")

    