    // main.js - Electron Main Process (runs in Node.js environment)
    // *** UPDATED: Path/Size correction, Asset ID lookup in add transaction ***

    const { app, BrowserWindow, ipcMain } = require('electron');
    const path = require('path');
    const { PythonShell } = require('python-shell'); // Import python-shell
    const fs = require('fs'); // Import fs for path checking

    // --- Python Interaction Setup ---

    // *** Corrected backend path ***
    const backendBasePath = path.join(__dirname, '../backend'); // Assumes backend is one level up from electron app root
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
            const results = await PythonShell.run('ipc_handler.py', options);
            console.log('[Main Process] Python raw result:', results); // Log raw result
            if (results && results.length > 0) {
                // Ensure result is parsed correctly if it's already an object
                const resultData = (typeof results[0] === 'string') ? JSON.parse(results[0]) : results[0];
                if (resultData.error) { throw new Error(`Python Error (${functionName}): ${resultData.error}`); }
                console.log('[Main Process] Python parsed data:', resultData.data);
                return resultData.data; // Return the actual data payload
            }
            console.warn(`[Main Process] Unexpected or empty result from Python for ${functionName}`);
            return null;
        } catch (err) {
            console.error(`[Main Process] Error executing PythonShell for ${functionName}:`, err);
            // Check if the error message is already JSON from python-shell
            let errorMessage = err.message || err;
             try {
                 // Attempt to parse potential JSON error string from PythonShell/Python script
                 const errorPrefix = "Error: ";
                 const jsonErrorIndex = errorMessage.indexOf('{');
                 if (jsonErrorIndex > -1) {
                     const jsonString = errorMessage.substring(jsonErrorIndex);
                     const parsedError = JSON.parse(jsonString);
                     if(parsedError && parsedError.error) {
                        errorMessage = parsedError.error; // Use the error message from Python if available
                     }
                 } else if (errorMessage.startsWith(errorPrefix)) {
                     // Clean up generic PythonShell error prefix if not JSON
                     errorMessage = errorMessage.substring(errorPrefix.length);
                 }
             } catch(parseErr) { /* Ignore if not JSON */ }

            throw new Error(`Failed to execute Python backend (${functionName}): ${errorMessage}`);
        }
    }
    // --- End Python Interaction Setup ---


    function createWindow() {
      // Create the browser window.
      const mainWindow = new BrowserWindow({
        // *** Updated window size ***
        width: 2400,
        height: 2400,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true, nodeIntegration: false, spellcheck: false
        },
        show: false
      });
      mainWindow.loadFile('index.html');
      mainWindow.once('ready-to-show', () => { mainWindow.show(); });
      mainWindow.webContents.openDevTools();
    }

    app.whenReady().then(() => {
      // --- IPC Handlers ---
      // Settings
      ipcMain.handle('db:get-setting', async (event, key) => { console.log(`[IPC] Handling db:get-setting for key: ${key}`); try { const value = await callPython('get_setting', [key]); return value; } catch (error) { console.error(`[IPC Error] db:get-setting:`, error); return { error: error.message }; } });
      ipcMain.handle('db:set-setting', async (event, key, value) => { console.log(`[IPC] Handling db:set-setting for key: ${key}`); try { const result = await callPython('set_setting', [key, value]); return { success: result }; } catch (error) { console.error(`[IPC Error] db:set-setting:`, error); return { error: error.message }; } }); // Return success explicitly

      // Assets
      ipcMain.handle('db:add-asset', async (event, assetData) => { console.log(`[IPC] Handling db:add-asset:`, assetData); try { const newAssetId = await callPython('add_asset', [ assetData.ticker, assetData.name, assetData.assetType, assetData.currency, assetData.isin ]); return { success: true, id: newAssetId }; } catch (error) { console.error(`[IPC Error] db:add-asset:`, error); return { error: error.message }; } }); // Return success/id
      ipcMain.handle('db:get-all-assets', async (event) => { console.log(`[IPC] Handling db:get-all-assets`); try { const assets = await callPython('get_all_assets'); return assets; } catch (error) { console.error(`[IPC Error] db:get-all-assets:`, error); return { error: error.message }; } });

      // Transactions
       ipcMain.handle('db:add-transaction', async (event, txData) => {
          console.log(`[IPC] Handling db:add-transaction:`, txData);
           try {
                let asset_id = null;
                // For non-Fee transactions, find the asset by ticker
                if (txData.txType !== 'Fee' && txData.ticker) {
                    console.log(`[IPC] Looking up asset_id for ticker: ${txData.ticker}`);
                    // IMPORTANT: Make sure get_asset_by_ticker exists and is callable via callPython
                    const asset = await callPython('get_asset_by_ticker', [txData.ticker]);
                    if (!asset) {
                         // Important: Throw error back to frontend if asset not found
                         throw new Error(`Asset with ticker '${txData.ticker}' not found in database. Please add the asset first.`);
                    }
                    asset_id = asset.id;
                    console.log(`[IPC] Found asset_id: ${asset_id}`);
                } else if (txData.txType === 'Fee') {
                     // For Fee type, asset_id can be null, name is in txData.name (passed as ticker/name)
                     console.log(`[IPC] Handling Fee transaction: ${txData.name}`);
                } else if (!txData.ticker && txData.txType !== 'Fee') {
                     // Should not happen if form validation is correct, but good to check
                     throw new Error(`Ticker symbol is required for ${txData.txType} transactions.`);
                }

               // Call Python add_transaction with the found asset_id
               // Arguments need to match the order in database.py:
               // asset_id, transaction_type, date, quantity, price, fees, currency, notes=None
               const newTxId = await callPython('add_transaction', [
                   asset_id, // Pass the found ID (or null for fees)
                   txData.txType,
                   txData.date,
                   txData.quantity,
                   txData.price,
                   txData.fees,
                   txData.currency,
                   null // Placeholder for notes, add if needed in form/txData
               ]);
              return { success: true, id: newTxId }; // Return success/id
          } catch (error) {
              console.error(`[IPC Error] db:add-transaction:`, error);
              return { error: error.message }; // Return error message to frontend
          }
      });
       ipcMain.handle('db:get-all-transactions', async (event) => { console.log(`[IPC] Handling db:get-all-transactions`); try { const transactions = await callPython('get_all_transactions'); return transactions; } catch (error) { console.error(`[IPC Error] db:get-all-transactions:`, error); return { error: error.message }; } });
      // --- End IPC Handlers ---

      createWindow();
      app.on('activate', function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    });

    app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });
    