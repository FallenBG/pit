# src/ipc_handler.py
# *** UPDATED: Removed faulty argument count check ***

import sys
import json
import logging
import os
from pathlib import Path
# import inspect # No longer needed for basic arg check

# Setup basic logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - HANDLER - %(levelname)s - %(message)s', stream=sys.stderr)

# --- Determine Database Path ---
_db_path_override = os.environ.get("PIT_DATABASE_PATH")
if _db_path_override:
    logging.info(f"IPC Handler using database path from env var: {_db_path_override}")
else:
    logging.info("IPC Handler: PIT_DATABASE_PATH env var not set, using default path from database module.")

# Import the database functions
try:
    import database
except ImportError as e:
    logging.exception("Failed to import database module.")
    print(json.dumps({"error": f"Internal backend error: Cannot import database module. {e}"}))
    sys.exit(1)
except Exception as e:
    logging.exception("An unexpected error occurred during database module import.")
    print(json.dumps({"error": f"Internal backend error on import: {e}"}))
    sys.exit(1)


def main():
    """
    Parses command line arguments, calls the requested database function,
    and prints the result as JSON.
    """
    if len(sys.argv) < 2:
        logging.error("No function name provided.")
        print(json.dumps({"error": "Backend Error: No function name specified."}))
        sys.exit(1)

    function_name = sys.argv[1]
    raw_args = sys.argv[2] if len(sys.argv) > 2 else '[]'
    args = []

    logging.debug(f"Received call for function: {function_name}")
    logging.debug(f"Raw arguments string: {raw_args}")

    try:
        args = json.loads(raw_args)
        if not isinstance(args, list): raise ValueError("Arguments must be provided as a JSON array.")
        logging.debug(f"Parsed arguments: {args}")
    except (json.JSONDecodeError, ValueError) as e:
            logging.exception("Argument parsing error.")
            print(json.dumps({"error": f"Backend Error: Invalid arguments format for {function_name}. Details: {e}"}))
            sys.exit(1)

    result = None
    error_message = None
    try:
        target_function = getattr(database, function_name, None)
        if callable(target_function):
            # *** Removed explicit argument count check ***
            # Let Python handle argument errors during the call itself
            logging.info(f"Calling database.{function_name} with args: {args}")
            # Call the function with unpacked args; 'conn' will use its default (None)
            result = target_function(*args)
            logging.info(f"Result from database.{function_name}: {result}")
        else:
            error_message = f"Backend Error: Unknown function '{function_name}'."
            logging.error(error_message)

    except TypeError as e:
        # Catch argument count errors (or other TypeErrors during call)
        logging.exception(f"Type error executing function '{function_name}' with args {args}")
        error_message = f"Backend Error executing {function_name}: Incorrect arguments provided or type mismatch. Details: {e}"
    except Exception as e:
        # Catch any other exceptions during function execution
        logging.exception(f"Error executing function '{function_name}'")
        # Attempt to get a more specific error message if available (e.g., from sqlite3)
        error_detail = str(getattr(e, 'message', e)) # Get specific message if available
        error_message = f"Backend Error executing {function_name}: {error_detail}"

    # Prepare the JSON response
    response = {}
    if error_message:
        response["error"] = error_message
    else:
        response["data"] = result # Wrap the actual result

    # Print the JSON response to stdout
    try:
        print(json.dumps(response))
    except TypeError as e:
            logging.exception(f"Failed to serialize result for {function_name}")
            print(json.dumps({"error": f"Backend Error: Result for {function_name} is not JSON serializable. Details: {e}"}))


if __name__ == "__main__":
    main()
