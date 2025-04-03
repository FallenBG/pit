// 2. main.js - Electron Main Process (runs in Node.js environment)
    // *** Includes python-shell integration - UNFOLDED ***

    const { app, BrowserWindow, ipcMain } = require('electron');
    const path = require('path');
    const { PythonShell } = require('python-shell'); // Import python-shell
    const fs = require('fs'); // Import fs for path checking

    // --- Python Interaction Setup ---

    // Determine the base path for the backend relative to the Electron app root
    const backendBasePath = path.join(__dirname, 'pit_backend');
    const backendSrcPath = path.join(backendBasePath, 'src');

    // Function to determine the Python executable path within the virtual environment
    const getPythonPath = () => {
        const venvDir = '.venv'; // Assuming venv is named '.venv' inside backendBasePath
        let pyPath;

        if (process.platform === 'win32') {
            pyPath = path.join(backendBasePath, venvDir, 'Scripts', 'python.exe');
        } else { // macOS or Linux
            pyPath = path.join(backendBasePath, venvDir, 'bin', 'python');
        }

        // Basic check if the path exists
        if (!fs.existsSync(pyPath)) {
             console.warn(`[Main Process] Warning: Python path ${pyPath} does not seem to exist. Falling back to default 'python'. Ensure venv is set up correctly in ${backendBasePath}`);
             // Fallback or throw error - using 'python' might pick up global python
             return 'python';
        }
        return pyPath;
    };
    const pythonExecutablePath = getPythonPath();

    console.log(`[Main Process] Using Python Path: ${pythonExecutablePath}`);
    console.log(`[Main Process] Using Backend Src Path: ${backendSrcPath}`);

    // Function to call Python script using python-shell
    async function callPython(functionName, args = []) {
        console.log(`[Main Process] Calling Python function: ${functionName} with args:`, args);

        const options = {
            mode: 'json', // Send/receive data as JSON
            pythonPath: pythonExecutablePath, // Path to venv python executable
            scriptPath: backendSrcPath, // Path to the directory containing python scripts
            args: [
                functionName,          // Argument 1: Function name to call in Python
                JSON.stringify(args)   // Argument 2: Arguments for the Python function (as JSON string)
            ]
        };

        try {
             // Run the dedicated IPC handler script
            const results = await PythonShell.run('ipc_handler.py', options);
            console.log('[Main Process] Python result:', results);
            if (results && results.length > 0) {
                // python-shell returns an array of JSON objects sent from Python's stdout
                // Assuming our handler script prints one JSON result line
                if (results[0].error) {
                    // If the Python script returned an error structure
                    throw new Error(`Python Error (${functionName}): ${results[0].error}`);
                }
                return results[0].data; // Return the actual data payload
            }
            // Handle cases where Python script might not return anything or expected structure
            console.warn(`[Main Process] Unexpected or empty result from Python for ${functionName}`);
            return null; // Or return an appropriate default/error structure
        } catch (err) {
            console.error(`[Main Process] Error executing PythonShell for ${functionName}:`, err);
            // Rethrow a more specific error or return an error structure
            throw new Error(`Failed to execute Python backend (${functionName}): ${err.message || err}`);
        }
    }
    // --- End Python Interaction Setup ---


    function createWindow() {
      // Create the browser window.
      const mainWindow = new BrowserWindow({
        width: 1200, // Initial window width
        height: 800, // Initial window height
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'), // Path to preload script
          contextIsolation: true, // Recommended for security
          nodeIntegration: false, // Disable Node.js integration in renderer for security
          spellcheck: false // Optional: disable spellcheck in inputs
        },
        show: false // Don't show immediately
      });

      // Load the index.html of the app.
      mainWindow.loadFile('index.html');

       // Show window once it's ready to avoid blank screen
       mainWindow.once('ready-to-show', () => {
           mainWindow.show();
       });

      // Open the DevTools automatically (useful for development)
      mainWindow.webContents.openDevTools();
    }

    app.whenReady().then(() => {
      // --- IPC Handlers ---
      // Settings
      ipcMain.handle('db:get-setting', async (event, key) => { console.log(`[IPC] Handling db:get-setting for key: ${key}`); try { const value = await callPython('get_setting', [key]); return value; } catch (error) { console.error(`[IPC Error] db:get-setting:`, error); return { error: error.message }; } });
      ipcMain.handle('db:set-setting', async (event, key, value) => { console.log(`[IPC] Handling db:set-setting for key: ${key}`); try { const result = await callPython('set_setting', [key, value]); return result; } catch (error) { console.error(`[IPC Error] db:set-setting:`, error); return { error: error.message }; } });
      // Assets
      ipcMain.handle('db:add-asset', async (event, assetData) => { console.log(`[IPC] Handling db:add-asset:`, assetData); try { const result = await callPython('add_asset', [ assetData.ticker, assetData.name, assetData.assetType, assetData.currency, assetData.isin ]); return result; } catch (error) { console.error(`[IPC Error] db:add-asset:`, error); return { error: error.message }; } });
      ipcMain.handle('db:get-all-assets', async (event) => { console.log(`[IPC] Handling db:get-all-assets`); try { const assets = await callPython('get_all_assets'); return assets; } catch (error) { console.error(`[IPC Error] db:get-all-assets:`, error); return { error: error.message }; } });
      // Transactions
      ipcMain.handle('db:add-transaction', async (event, txData) => { console.log(`[IPC] Handling db:add-transaction:`, txData); try { const result = await callPython('add_transaction', [ null, txData.txType, txData.date, txData.quantity, txData.price, txData.fees, txData.currency, txData.ticker || txData.name ]); return result; } catch (error) { console.error(`[IPC Error] db:add-transaction:`, error); return { error: error.message }; } });
      ipcMain.handle('db:get-all-transactions', async (event) => { console.log(`[IPC] Handling db:get-all-transactions`); try { const transactions = await callPython('get_all_transactions'); return transactions; } catch (error) { console.error(`[IPC Error] db:get-all-transactions:`, error); return { error: error.message }; } });
      // --- End IPC Handlers ---

      createWindow();
      app.on('activate', function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    });

    app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });