# src/ipc_handler.py
# *** UPDATED: Explicit signature binding BEFORE function call ***

import sys
import json
import logging
import os
from pathlib import Path
import inspect # Import inspect module

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
    Parses command line arguments, validates arguments against function signature,
    calls the requested database function, and prints the result as JSON.
    """
    if len(sys.argv) < 2:
        logging.error("No function name provided.")
        print(json.dumps({"error": "Backend Error: No function name specified."}))
        sys.exit(1)

    function_name = sys.argv[1]
    raw_args = sys.argv[2] if len(sys.argv) > 2 else '[]'
    args = []
    error_message = None
    result = None

    logging.debug(f"Received call for function: {function_name}")
    logging.debug(f"Raw arguments string: {raw_args}")

    try:
        args = json.loads(raw_args)
        if not isinstance(args, list): raise ValueError("Arguments must be provided as a JSON array.")
        logging.debug(f"Parsed arguments: {args}")

        target_function = getattr(database, function_name, None)

        if callable(target_function):
            # === Explicit Signature Check ===
            try:
                sig = inspect.signature(target_function)
                # We only bind the arguments passed via IPC, ignoring the optional 'conn' parameter
                # Create a temporary signature excluding 'conn' for binding check
                params_to_bind = {k: v for k, v in sig.parameters.items() if k != 'conn'}
                temp_sig = inspect.Signature(parameters=params_to_bind.values())
                # Attempt to bind the provided arguments from IPC
                bound_args = temp_sig.bind(*args)
                logging.debug(f"Arguments successfully bound to signature (excluding conn).")
                # If binding succeeds, args are valid (in count/type) for the function call
            except TypeError as e_bind:
                # Binding failed - wrong number/type of args provided via IPC
                logging.exception(f"Argument binding error for {function_name} with args {args}")
                error_message = f"Backend Error calling {function_name}: Invalid arguments provided via IPC. Details: {e_bind}"
                target_function = None # Prevent calling the function later
            # === End Signature Check ===

            # === Call Function (only if signature check passed) ===
            if target_function and not error_message:
                try:
                    logging.info(f"Calling database.{function_name} with args: {args}")
                    # Call the function - arguments should now be valid for the signature
                    # The function will manage its own connection as 'conn' is not passed
                    result = target_function(*args)
                    logging.info(f"Result from database.{function_name}: {result}")
                except Exception as e_exec:
                    # Catch runtime errors *during* function execution (e.g., DB errors)
                    logging.exception(f"Error executing function '{function_name}'")
                    error_detail = str(e_exec)
                    error_message = f"Backend Error executing {function_name}: {error_detail}"
        else:
            error_message = f"Backend Error: Unknown function '{function_name}'."
            logging.error(error_message)

    except (json.JSONDecodeError, ValueError) as e:
            logging.exception("Argument parsing error.")
            error_message = f"Backend Error: Invalid arguments format for {function_name}. Details: {e}"
    except Exception as e_outer:
        # Catch any other unexpected errors
        logging.exception(f"Unexpected outer error processing {function_name}")
        error_message = f"Unexpected Backend Error processing {function_name}: {e_outer}"

    # Prepare and print JSON response
    response = {}
    if error_message:
        response["error"] = error_message
    else:
        response["data"] = result
    try:
        print(json.dumps(response))
    except TypeError as e_serialize:
            logging.exception(f"Failed to serialize result for {function_name}")
            # Try sending back just the error message if serialization failed
            print(json.dumps({"error": f"Backend Error: Result for {function_name} is not JSON serializable. Details: {e_serialize}"}))


if __name__ == "__main__":
    main()

