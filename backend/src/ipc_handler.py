# src/ipc_handler.py
# Receives function calls and arguments from Electron main process (via python-shell),
# executes the corresponding database function, and prints the result as JSON.

import sys
import json
import logging
# Import the database functions (assuming database.py is in the same directory)
try:
    import database
except ImportError:
    # Handle case where script might be run from a different working directory
    # This might need adjustment based on your final execution setup
    logging.error("Failed to import database module. Ensure ipc_handler.py is run correctly relative to database.py")
    print(json.dumps({"error": "Internal backend error: Cannot import database module."}))
    sys.exit(1)


# Setup basic logging for the handler script
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - HANDLER - %(levelname)s - %(message)s')

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
    raw_args = sys.argv[2] if len(sys.argv) > 2 else '[]' # Default to empty JSON array string
    args = []

    logging.debug(f"Received call for function: {function_name}")
    logging.debug(f"Raw arguments string: {raw_args}")

    try:
        args = json.loads(raw_args)
        if not isinstance(args, list):
            raise ValueError("Arguments must be provided as a JSON array.")
        logging.debug(f"Parsed arguments: {args}")
    except json.JSONDecodeError:
        logging.exception("Failed to parse arguments JSON.")
        print(json.dumps({"error": f"Backend Error: Invalid arguments format for {function_name}."}))
        sys.exit(1)
    except ValueError as e:
            logging.exception("Argument format error.")
            print(json.dumps({"error": f"Backend Error: {e}"}))
            sys.exit(1)


    # Map function names to actual functions in the database module
    # Ensure the function exists and call it with the parsed arguments
    result = None
    error_message = None
    try:
        target_function = getattr(database, function_name, None)
        if callable(target_function):
            logging.info(f"Calling database.{function_name} with args: {args}")
            # Use argument unpacking (*) to pass list elements as individual arguments
            result = target_function(*args)
            logging.info(f"Result from database.{function_name}: {result}")
        else:
            error_message = f"Backend Error: Unknown function '{function_name}'."
            logging.error(error_message)

    except Exception as e:
        # Catch any other exceptions during function execution
        logging.exception(f"Error executing function '{function_name}'")
        error_message = f"Backend Error executing {function_name}: {e}"

    # Prepare the JSON response
    response = {}
    if error_message:
        response["error"] = error_message
    else:
            # Wrap the actual result in a 'data' key for consistency
        response["data"] = result

    # Print the JSON response to stdout for python-shell to capture
    print(json.dumps(response))


if __name__ == "__main__":
    main()