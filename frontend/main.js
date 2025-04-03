// 2. main.js - Electron Main Process (runs in Node.js environment)
    // *** UPDATED for IPC ***

    const { app, BrowserWindow, ipcMain } = require('electron');
    const path = require('path');
    // const { PythonShell } = require('python-shell'); // Example if using python-shell

    // --- Placeholder for Python Interaction ---
    // In a real scenario, you'd call your Python functions here.
    // This might involve spawning a child process or using python-shell.
    async function callPython(scriptPath, functionName, args = []) {
        console.log(`[Main Process] Mock callPython: ${functionName} with args:`, args);
        // Example using python-shell (requires installation: npm install python-shell)
        /*
        try {
            const options = {
                mode: 'json', // Send/receive data as JSON
                pythonPath: 'path/to/your/venv/python', // IMPORTANT: Point to venv python
                scriptPath: path.join(__dirname, 'pit_backend/src'), // Path to python scripts
                args: [functionName, JSON.stringify(args)] // Pass function name and args
            };
            // Assume a wrapper script 'bridge.py' that calls the correct function
            const results = await PythonShell.run('bridge.py', options);
            console.log('[Main Process] Python result:', results);
            if (results && results.length > 0) {
                return results[0]; // Assuming the first result is the main one
            }
            return null;
        } catch (err) {
            console.error("[Main Process] Error calling Python:", err);
            throw err; // Re-throw error to be caught by IPC handler
        }
        */

        // ** Mock Implementation (Replace with actual Python calls) **
        // Simulate database interactions based on function name
        // IMPORTANT: These mocks DO NOT interact with the actual DB yet.
        if (functionName === 'add_asset') {
            return { success: true, id: Math.floor(Math.random() * 1000) }; // Return mock ID
        } else if (functionName === 'add_transaction') {
            return { success: true, id: Math.floor(Math.random() * 10000) }; // Return mock ID
        } else if (functionName === 'get_all_assets') {
            return [ // Return mock asset list
                { id: 1, ticker: 'AAPL', name: 'Apple Inc.', asset_type: 'Stock', currency: 'USD' },
                { id: 2, ticker: 'MSFT', name: 'Microsoft Corp.', asset_type: 'Stock', currency: 'USD' },
            ];
        } else if (functionName === 'get_all_transactions') {
             return [ // Return mock transaction list
                { id: 't1', date: '2025-03-15', type: 'Buy', ticker: 'AAPL', asset_id: 1, quantity: 10, price: 170.50, fees: 1.00, currency: 'USD' },
                { id: 't7', date: '2025-02-10', type: 'Buy', ticker: 'MSFT', asset_id: 2, quantity: 20, price: 275.00, fees: 1.00, currency: 'USD' },
            ];
        } else if (functionName === 'get_setting') {
            if (args[0] === 'base_currency') return 'USD'; // Mock setting
            return null;
        } else if (functionName === 'set_setting') {
            return { success: true };
        }
        // Default mock response
        return { success: false, message: `Mock function ${functionName} not fully implemented.` };
    }
    // --- End Placeholder ---


    function createWindow() {
      const mainWindow = new BrowserWindow({
        width: 2400, height: 2400,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true, nodeIntegration: false,
        },
      });
      mainWindow.loadFile('index.html');
      mainWindow.webContents.openDevTools();
    }

    app.whenReady().then(() => {
      // --- IPC Handlers ---
      // These listen for 'invoke' calls from the renderer process via preload.js

      // Settings
      ipcMain.handle('db:get-setting', async (event, key) => {
          console.log(`[IPC] Received db:get-setting for key: ${key}`);
          try {
              // TODO: Replace mock with actual callPython('database.py', 'get_setting', [key])
              const value = await callPython(null, 'get_setting', [key]);
              return value;
          } catch (error) { return { error: error.message }; }
      });
      ipcMain.handle('db:set-setting', async (event, key, value) => {
          console.log(`[IPC] Received db:set-setting for key: ${key}`);
           try {
              // TODO: Replace mock with actual callPython('database.py', 'set_setting', [key, value])
              const result = await callPython(null, 'set_setting', [key, value]);
              return result;
          } catch (error) { return { error: error.message }; }
      });

      // Assets
      ipcMain.handle('db:add-asset', async (event, assetData) => {
          console.log(`[IPC] Received db:add-asset:`, assetData);
           try {
               // TODO: Replace mock with actual callPython('database.py', 'add_asset', [assetData.ticker, ...])
              const result = await callPython(null, 'add_asset', [assetData]); // Pass whole object for mock simplicity
              return result;
          } catch (error) { return { error: error.message }; }
      });
       ipcMain.handle('db:get-all-assets', async (event) => {
          console.log(`[IPC] Received db:get-all-assets`);
           try {
              // TODO: Replace mock with actual callPython('database.py', 'get_all_assets')
              const assets = await callPython(null, 'get_all_assets');
              return assets;
          } catch (error) { return { error: error.message }; }
      });

      // Transactions
       ipcMain.handle('db:add-transaction', async (event, txData) => {
          console.log(`[IPC] Received db:add-transaction:`, txData);
           try {
               // TODO: Need to get asset_id first if ticker is provided
               // let asset = await callPython(null, 'get_asset_by_ticker', [txData.ticker]);
               // let asset_id = asset ? asset.id : null;
               // if (!asset_id && txData.type !== 'Fee') throw new Error('Asset not found');
               // TODO: Replace mock with actual callPython('database.py', 'add_transaction', [asset_id, ...])
              const result = await callPython(null, 'add_transaction', [txData]); // Pass whole object for mock simplicity
              return result;
          } catch (error) { return { error: error.message }; }
      });
       ipcMain.handle('db:get-all-transactions', async (event) => {
          console.log(`[IPC] Received db:get-all-transactions`);
           try {
              // TODO: Replace mock with actual callPython('database.py', 'get_all_transactions')
              const transactions = await callPython(null, 'get_all_transactions');
              return transactions;
          } catch (error) { return { error: error.message }; }
      });
      // --- End IPC Handlers ---

      createWindow();
      app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    });

    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') app.quit();
    });