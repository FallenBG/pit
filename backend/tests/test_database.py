# tests/test_database.py
# *** UPDATED: Simplified fixture, tests pass connection ***

import pytest
import sqlite3
import sys
from pathlib import Path

# Add src directory to sys.path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))
import database

# Pytest fixture to set up a clean in-memory database for each test function
@pytest.fixture
def db_conn():
    """ Fixture to set up and tear down an in-memory database """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON") # Enable FK enforcement

    # Create schema directly on this connection
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE assets (id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT UNIQUE, name TEXT NOT NULL, asset_type TEXT NOT NULL, currency TEXT NOT NULL, isin TEXT UNIQUE);")
    cursor.execute("CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id INTEGER, transaction_type TEXT NOT NULL, date TEXT NOT NULL, quantity REAL, price REAL, fees REAL DEFAULT 0.0, currency TEXT NOT NULL, notes TEXT, FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL);")
    cursor.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);")
    conn.commit()

    yield conn # Provide the connection to the test function

    # Teardown: Close the connection after the test runs
    conn.close()


# --- Test Settings ---
def test_set_and_get_setting(db_conn):
    """ Test setting and retrieving a setting using the fixture connection """
    # Pass the connection explicitly
    assert database.set_setting('base_currency', 'EUR', conn=db_conn) == True
    assert database.get_setting('base_currency', conn=db_conn) == 'EUR'
    assert database.set_setting('base_currency', 'GBP', conn=db_conn) == True # Test replace
    assert database.get_setting('base_currency', conn=db_conn) == 'GBP'
    assert database.get_setting('non_existent_key', conn=db_conn) is None

# --- Test Assets ---
def test_add_and_get_asset(db_conn):
    """ Test adding and retrieving an asset using the fixture connection """
    asset_id = database.add_asset("AAPL", "Apple Inc.", "Stock", "USD", "US0378331005", conn=db_conn)
    assert asset_id is not None
    assert isinstance(asset_id, int)

    asset = database.get_asset_by_id(asset_id, conn=db_conn)
    assert asset is not None
    assert asset['id'] == asset_id
    assert asset['ticker'] == "AAPL"
    assert asset['name'] == "Apple Inc." # Added assertion
    assert asset['asset_type'] == "Stock" # Added assertion
    assert asset['currency'] == "USD" # Added assertion
    assert asset['isin'] == "US0378331005" # Added assertion

    asset_ticker = database.get_asset_by_ticker("AAPL", conn=db_conn)
    assert asset_ticker is not None
    assert asset_ticker['id'] == asset_id

    assert database.get_asset_by_id(999, conn=db_conn) is None
    assert database.get_asset_by_ticker("GOOG", conn=db_conn) is None

def test_add_duplicate_asset_ticker(db_conn):
    """ Test adding an asset with a duplicate ticker fails """
    database.add_asset("MSFT", "Microsoft", "Stock", "USD", conn=db_conn)
    # Adding again should return None because of IntegrityError
    assert database.add_asset("MSFT", "Microsoft Duplicate", "Stock", "USD", conn=db_conn) is None

def test_add_asset_no_ticker(db_conn):
    """ Test adding an asset without a ticker """
    asset_id = database.add_asset(None, "My Savings", "Savings", "GBP", conn=db_conn)
    assert asset_id is not None
    asset = database.get_asset_by_id(asset_id, conn=db_conn)
    assert asset is not None # Check asset exists before subscripting
    assert asset['ticker'] is None
    assert asset['name'] == "My Savings"

def test_get_all_assets(db_conn):
    """ Test retrieving all assets """
    assert database.get_all_assets(conn=db_conn) == []
    id1 = database.add_asset("TSLA", "Tesla", "Stock", "USD", conn=db_conn)
    id2 = database.add_asset("BTC-USD", "Bitcoin", "Crypto", "USD", conn=db_conn)
    assets = database.get_all_assets(conn=db_conn)
    assert len(assets) == 2
    assert isinstance(assets[0], dict)
    # Order by name: Bitcoin, Tesla
    assert assets[0]['id'] == id2
    assert assets[1]['id'] == id1


# --- Test Transactions ---
def test_add_and_get_transaction(db_conn):
    """ Test adding and retrieving transactions """
    asset_id = database.add_asset("GM", "General Motors", "Stock", "USD", conn=db_conn)
    assert asset_id is not None

    tx_id = database.add_transaction(asset_id, "Buy", "2025-04-01", 100, 35.50, 1.50, "USD", "Initial purchase", conn=db_conn)
    assert tx_id is not None
    assert isinstance(tx_id, int)

    txs = database.get_transactions_for_asset(asset_id, conn=db_conn)
    assert len(txs) == 1
    assert isinstance(txs[0], dict)
    assert txs[0]['id'] == tx_id
    assert txs[0]['asset_id'] == asset_id # Added assertion
    assert txs[0]['transaction_type'] == "Buy" # Added assertion
    assert txs[0]['date'] == "2025-04-01" # Added assertion
    assert txs[0]['quantity'] == 100
    assert txs[0]['price'] == 35.50 # Added assertion
    assert txs[0]['fees'] == 1.50 # Added assertion
    assert txs[0]['currency'] == "USD" # Added assertion
    assert txs[0]['notes'] == "Initial purchase" # Added assertion

def test_get_all_transactions(db_conn):
    """ Test retrieving all transactions """
    assert database.get_all_transactions(conn=db_conn) == []
    asset_id1 = database.add_asset("X", "X Corp", "Stock", "USD", conn=db_conn)
    asset_id2 = database.add_asset("Y", "Y Corp", "Stock", "USD", conn=db_conn)

    database.add_transaction(asset_id1, "Buy", "2025-01-10", 50, 10.0, 1.0, "USD", conn=db_conn)
    database.add_transaction(asset_id2, "Buy", "2025-01-15", 20, 25.0, 1.0, "USD", conn=db_conn)
    database.add_transaction(asset_id1, "Sell", "2025-02-01", 10, 12.0, 1.0, "USD", conn=db_conn)

    all_txs = database.get_all_transactions(conn=db_conn)
    assert len(all_txs) == 3
    assert all_txs[0]['date'] == "2025-02-01" # Order DESC
    assert 'asset_name' in all_txs[0]
    assert all_txs[0]['asset_name'] == "X Corp"
    assert all_txs[1]['asset_name'] == "Y Corp" # Added assertion

def test_add_fee_transaction(db_conn):
    """ Test adding a transaction with no asset_id (Fee) """
    tx_id = database.add_transaction(None, "Fee", "2025-03-31", None, 5.00, 0.0, "USD", "Monthly fee", conn=db_conn)
    assert tx_id is not None

    all_txs = database.get_all_transactions(conn=db_conn)
    fee_tx = next((tx for tx in all_txs if tx['id'] == tx_id), None)
    assert fee_tx is not None
    assert fee_tx['asset_id'] is None
    assert fee_tx['transaction_type'] == "Fee"
    assert fee_tx['quantity'] is None # Added assertion
    assert fee_tx['price'] == 5.00 # Added assertion
    assert fee_tx['notes'] == "Monthly fee" # Added assertion

