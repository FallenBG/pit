# tests/test_ipc_handler.py
# *** UPDATED: Corrected assertion in test_ipc_bad_arguments ***

import pytest
import subprocess
import sys
import json
import os
from pathlib import Path
import sqlite3
import time
import logging # For debugging tests

# Add src directory to sys.path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))
import database # Import for direct verification and setup

# --- Test Setup ---
backend_base_path = Path(__file__).parent.parent
venv_dir = '.venv'
# Check if python executable exists, provide warning if not
if sys.platform == 'win32': PYTHON_EXECUTABLE_PATH = backend_base_path / venv_dir / 'Scripts' / 'python.exe'
else: PYTHON_EXECUTABLE_PATH = backend_base_path / venv_dir / 'bin' / 'python'
if not PYTHON_EXECUTABLE_PATH.is_file():
    logging.warning(f"Test Python executable not found at {PYTHON_EXECUTABLE_PATH}. Using system 'python'.")
    PYTHON_EXECUTABLE = "python" # Fallback
else:
    PYTHON_EXECUTABLE = str(PYTHON_EXECUTABLE_PATH)

IPC_HANDLER_SCRIPT = src_path / "ipc_handler.py"
TEST_DB_DIR = Path(__file__).parent / "test_data_ipc" # Use separate dir for IPC tests
TEST_DB_PATH = TEST_DB_DIR / "test_ipc_pit.db"

@pytest.fixture(scope="function")
def setup_test_db():
    """ Fixture to create/cleanup a temporary FILE database for IPC tests """
    TEST_DB_DIR.mkdir(parents=True, exist_ok=True)
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except OSError as e:
            print(f"Warning: Could not delete existing test DB {TEST_DB_PATH}: {e}")
            # Attempt to proceed anyway

    # Initialize the schema in the test database file
    database.initialize_database(db_path=TEST_DB_PATH)

    # Add default setting directly for convenience in tests
    conn_setup = None
    try:
        conn_setup = sqlite3.connect(TEST_DB_PATH)
        conn_setup.execute("PRAGMA foreign_keys = ON;")
        conn_setup.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ('base_currency', 'USD'))
        conn_setup.commit()
    except Exception as e:
            pytest.fail(f"Failed to connect to or setup test DB during fixture setup: {e}")
    finally:
        if conn_setup: conn_setup.close()

    yield TEST_DB_PATH # Provide the path

    # Teardown
    time.sleep(0.1)
    try:
        if TEST_DB_PATH.exists(): TEST_DB_PATH.unlink()
        try: TEST_DB_DIR.rmdir()
        except OSError: pass
    except OSError as e:
            print(f"Warning: Could not delete test DB {TEST_DB_PATH} or dir: {e}")


def run_ipc_handler(function_name, args_list):
    """ Helper function to run the ipc_handler script as a subprocess """
    args_json = json.dumps(args_list)
    command = [ PYTHON_EXECUTABLE, str(IPC_HANDLER_SCRIPT), function_name, args_json ]
    env = os.environ.copy()
    env["PIT_DATABASE_PATH"] = str(TEST_DB_PATH)
    env["PYTHONPATH"] = str(src_path.parent) + os.pathsep + env.get("PYTHONPATH", "")

    process = subprocess.run(command, capture_output=True, text=True, check=False, cwd=backend_base_path, env=env)

    print(f"\n--- IPC Call ---")
    print(f"Command: {' '.join(command)}")
    print(f"Exit Code: {process.returncode}")
    print(f"Stdout:\n{process.stdout}")
    print(f"Stderr:\n{process.stderr}")
    print(f"--- End IPC Call ---")

    if process.returncode != 0:
            # Try parsing stderr first for JSON error reported by handler's logging
        try:
            error_output = process.stderr.strip()
            last_line = error_output.splitlines()[-1] if error_output else ""
            # Check if last line looks like our logged JSON error
            if last_line.startswith('{') and 'error' in last_line:
                    parsed_error = json.loads(last_line)
                    if 'error' in parsed_error:
                        raise RuntimeError(f"ipc_handler.py failed: {parsed_error['error']}")
        except (json.JSONDecodeError, IndexError):
            pass # Fall through if stderr parsing fails
        # Fallback to generic error
        raise RuntimeError(f"ipc_handler.py failed with exit code {process.returncode}:\n{process.stderr}")

    try:
        output = process.stdout.strip()
        if not output:
                if process.stderr.strip(): raise ValueError(f"ipc_handler.py returned empty stdout but had stderr output:\n{process.stderr}")
                return {}
        return json.loads(output)
    except json.JSONDecodeError:
        raise ValueError(f"ipc_handler.py did not return valid JSON:\n{process.stdout}")

# --- Integration Tests (Assertions Adjusted) ---

def test_ipc_get_setting_success(setup_test_db):
    result = run_ipc_handler("get_setting", ["base_currency"])
    assert "error" not in result, f"Expected no error, got: {result.get('error')}"
    assert "data" in result, "Expected 'data' key in result"
    assert result["data"] == "USD"

def test_ipc_get_setting_not_found(setup_test_db):
        result = run_ipc_handler("get_setting", ["non_existent"])
        assert "error" not in result, f"Expected no error, got: {result.get('error')}"
        assert "data" in result, "Expected 'data' key in result"
        assert result["data"] is None

def test_ipc_set_setting_success(setup_test_db):
    result = run_ipc_handler("set_setting", ["new_key", "new_value"])
    assert "error" not in result, f"Expected no error, got: {result.get('error')}"
    assert result.get("data") == True
    verify_result = run_ipc_handler("get_setting", ["new_key"])
    assert verify_result.get("data") == "new_value"

def test_ipc_add_asset_success(setup_test_db):
    result = run_ipc_handler("add_asset", ["NVDA", "Nvidia", "Stock", "USD", None])
    assert "error" not in result, f"Expected no error, got: {result.get('error')}"
    assert "data" in result, "Expected 'data' key in result"
    assert isinstance(result["data"], int), f"Expected data to be an int (asset ID), got: {result['data']}"
    new_id = result["data"]
    conn = sqlite3.connect(TEST_DB_PATH); conn.row_factory = sqlite3.Row
    asset = database.get_asset_by_id(new_id, conn=conn); conn.close()
    assert asset is not None; assert asset["ticker"] == "NVDA"

def test_ipc_add_asset_duplicate_ticker(setup_test_db):
    run_ipc_handler("add_asset", ["AMD", "AMD", "Stock", "USD", None])
    result = run_ipc_handler("add_asset", ["AMD", "AMD Duplicate", "Stock", "USD", None])
    assert "error" not in result, f"Expected no error, got: {result.get('error')}"
    assert "data" in result, "Expected 'data' key in result"
    assert result["data"] is None

def test_ipc_get_all_assets_success(setup_test_db):
    run_ipc_handler("add_asset", ["GOOG", "Alphabet", "Stock", "USD", None])
    run_ipc_handler("add_asset", ["META", "Meta", "Stock", "USD", None])
    result = run_ipc_handler("get_all_assets", [])
    assert "error" not in result, f"Expected no error, got: {result.get('error')}"
    assert "data" in result, "Expected 'data' key in result"
    assert isinstance(result["data"], list)
    assert len(result["data"]) == 2, f"Expected 2 assets, found {len(result['data'])}"
    assert result["data"][0]["ticker"] == "GOOG"; assert result["data"][1]["ticker"] == "META"

def test_ipc_add_transaction_success(setup_test_db):
    asset_result = run_ipc_handler("add_asset", ["IBM", "IBM", "Stock", "USD", None])
    asset_id = asset_result["data"]
    assert asset_id is not None, "Failed to add asset needed for transaction test"
    result = run_ipc_handler("add_transaction", [ asset_id, "Buy", "2025-04-03", 10, 125.0, 1.0, "USD", "Test Note via IPC" ])
    assert "error" not in result, f"Expected no error, got: {result.get('error')}"
    assert "data" in result, "Expected 'data' key in result"
    assert isinstance(result["data"], int), f"Expected data to be an int (tx ID), got: {result['data']}"
    new_tx_id = result["data"]
    conn = sqlite3.connect(TEST_DB_PATH); conn.row_factory = sqlite3.Row
    txs = database.get_transactions_for_asset(asset_id, conn=conn); conn.close()
    assert len(txs) == 1; assert txs[0]["id"] == new_tx_id

def test_ipc_unknown_function(setup_test_db):
    result = run_ipc_handler("non_existent_function", [])
    assert "data" not in result
    assert "error" in result
    assert "Unknown function" in result["error"]

def test_ipc_bad_arguments(setup_test_db):
    # get_setting expects one argument in the list ([key])
    result = run_ipc_handler("get_setting", ["key1", "extra_arg"])
    assert "data" not in result
    assert "error" in result
    # *** Corrected Assertion: Check for TypeError related substrings ***
    error_msg = result.get("error", "").lower() # Get error message safely
    print(f"Error message: {error_msg}") # Debugging output
    assert "typeerror" in error_msg or "positional argument" in error_msg or "takes" in error_msg

