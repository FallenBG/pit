    // renderer.js - React Frontend Code (runs in the Electron Renderer process)
    // *** Includes IPC calls - UNFOLDED ***

    // --- Helper Functions ---
    const formatCurrency = (value, currency = 'USD') => { if (typeof value !== 'number' || isNaN(value)) return 'N/A'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(value); };
    const formatPercentage = (value) => { if (typeof value !== 'number' || isNaN(value)) return 'N/A'; const formatted = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100); return value > 0 ? `+${formatted}` : formatted; };
    const formatDate = (dateString) => { try { const date = new Date(dateString); if (isNaN(date.getTime())) throw new Error("Invalid date string"); return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); } catch (error) { console.error("Error formatting date:", dateString, error); return "Invalid Date"; } };
    const formatQuantity = (value) => { if (typeof value !== 'number' || isNaN(value)) return 'N/A'; const options = (value > 0 && Math.abs(value) < 1) ? { minimumFractionDigits: 2, maximumFractionDigits: 8 } : { minimumFractionDigits: 0, maximumFractionDigits: 2 }; return new Intl.NumberFormat('en-US', options).format(value); };

    // --- Dashboard Components ---
    function PortfolioValue({ data }) {
      const { totalValue, baseCurrency, changes } = data;
      return ( <div className="dashboard-card mb-6"> <h2 className="text-lg font-medium mb-2 text-gray-700">Portfolio Value</h2> <p className="text-3xl font-bold text-gray-900 mb-3">{formatCurrency(totalValue, baseCurrency)}</p> <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-sm"> {Object.entries(changes).map(([period, change]) => ( <div key={period}> <span className="text-gray-500 uppercase">{period}: </span> <span className={change.positive ? 'text-green-600' : 'text-red-600'}> {formatPercentage(change.value)} </span> </div> ))} </div> </div> );
    }
    function GainersLosers({ data, onPeriodChange }) {
        const { period, gainers, losers } = data;
        const availablePeriods = ['Daily', 'WTD', 'MTD', 'YTD', 'Overall'];
        return ( <div className="dashboard-card mb-6"> <div className="flex flex-wrap justify-between items-center mb-3 gap-2"> <h2 className="text-lg font-medium text-gray-700 whitespace-nowrap">Top Movers ({period})</h2> <div className="flex space-x-1 flex-shrink-0"> {availablePeriods.map(p => ( <button key={p} onClick={() => onPeriodChange(p)} className={`px-2 py-1 rounded text-xs font-medium transition-colors duration-150 ${ period === p ? 'bg-blue-500 text-white shadow-sm ring-1 ring-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200' }`} > {p} </button> ))} </div> </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> <div> <h3 className="text-md font-semibold mb-2 text-green-700">Top 5 Gainers</h3> <ul> {gainers.map(g => ( <li key={g.ticker} className="flex justify-between text-sm mb-1 py-1 border-b border-gray-100 last:border-b-0"> <span className="font-medium text-gray-800">{g.ticker}</span> <span className="text-green-600 font-medium">{formatPercentage(g.change)}</span> </li> ))} </ul> </div> <div> <h3 className="text-md font-semibold mb-2 text-red-700">Top 5 Losers</h3> <ul> {losers.map(l => ( <li key={l.ticker} className="flex justify-between text-sm mb-1 py-1 border-b border-gray-100 last:border-b-0"> <span className="font-medium text-gray-800">{l.ticker}</span> <span className="text-red-600 font-medium">{formatPercentage(l.change)}</span> </li> ))} </ul> </div> </div> </div> );
    }
    function AllocationChart({ data }) {
        const chartRef = React.useRef(null); const chartInstanceRef = React.useRef(null);
        React.useEffect(() => { if (chartRef.current && data && data.labels && data.values) { const ctx = chartRef.current.getContext('2d'); if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); } chartInstanceRef.current = new Chart(ctx, { type: 'doughnut', data: { labels: data.labels, datasets: [{ label: 'Portfolio Allocation %', data: data.values, backgroundColor: ['rgb(59, 130, 246)','rgb(249, 115, 22)','rgb(16, 185, 129)','rgb(107, 114, 128)','rgb(234, 179, 8)','rgb(139, 92, 246)'], borderColor: '#ffffff', borderWidth: 2, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 15 } }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null && context.parsed !== undefined) { label += new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(context.parsed / 100); } return label; } } } }, cutout: '60%' } }); } return () => { if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; } }; }, [data]);
        return ( <div className="dashboard-card mb-6"> <h2 className="text-lg font-medium mb-4 text-gray-700">Portfolio Allocation</h2> <div className="relative h-64 md:h-72"> <canvas ref={chartRef}></canvas> </div> </div> );
    }
    function UpcomingDividends({ data }) {
        const dividends = data;
        return ( <div className="dashboard-card"> <h2 className="text-lg font-medium mb-3 text-gray-700">Upcoming Dividends (Estimated)</h2> {dividends.length > 0 ? ( <ul> {dividends.map(div => ( <li key={div.ticker + div.date} className="flex justify-between items-center text-sm mb-2 pb-2 border-b border-gray-200 last:border-b-0"> <span className="font-medium text-gray-800 w-1/4">{div.ticker}</span> <span className="text-gray-600 w-1/3 text-center">{formatDate(div.date)}</span> <span className="text-gray-600 w-1/3 text-right">{formatCurrency(div.amountPerShare, div.currency)}/share</span> </li> ))} </ul> ) : ( <p className="text-gray-500 text-sm">No upcoming estimated dividends.</p> )} <p className="text-xs text-gray-400 mt-3">*Estimates based on past dividend events.</p> </div> );
    }
    function Dashboard({ portfolioData, moversData, dividendData, allocationData, onPeriodChange }) {
        return ( <div> <PortfolioValue data={portfolioData} /> <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"> <GainersLosers data={moversData} onPeriodChange={onPeriodChange} /> <AllocationChart data={allocationData} /> </div> <UpcomingDividends data={dividendData} /> </div> );
    }

    // --- Holdings View Component ---
    function HoldingsView({ data, baseCurrency }) {
        const holdings = data; // Using props data for now
        const holdingsWithCalculations = React.useMemo(() => holdings.map(holding => { const marketValue = (holding.quantity * holding.currentPrice) || 0; const costBasis = (holding.quantity * holding.avgCost) || 0; const gainLoss = marketValue - costBasis; const gainLossPercent = costBasis !== 0 ? (gainLoss / costBasis) * 100 : 0; const marketValueInBase = marketValue; const gainLossInBase = gainLoss; return { ...holding, marketValue: marketValueInBase, costBasis, gainLoss: gainLossInBase, gainLossPercent }; }), [holdings, baseCurrency]);
        return ( <div className="dashboard-card"> <h2 className="text-xl font-semibold mb-4 text-gray-800">Holdings</h2> <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-gray-200 border border-gray-200"> <thead className="bg-gray-50"> <tr> <th>Asset</th><th>Quantity</th> <th className="text-right">Avg Cost</th><th className="text-right">Current Price</th> <th className="text-right">Market Value ({baseCurrency})</th><th className="text-right">Gain/Loss ({baseCurrency})</th> <th className="text-right">Gain/Loss (%)</th><th>Type</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {holdingsWithCalculations.length > 0 ? ( holdingsWithCalculations.map((holding) => ( <tr key={holding.id} className="hover:bg-gray-50"> <td> <div className="font-medium text-gray-900">{holding.ticker || holding.name}</div> {holding.ticker && holding.name !== holding.ticker && <div className="text-xs text-gray-500">{holding.name}</div>} </td> <td className="text-gray-700">{formatQuantity(holding.quantity)}</td> <td className="text-gray-700 text-right">{formatCurrency(holding.avgCost, holding.currency)}</td> <td className="text-gray-700 text-right">{formatCurrency(holding.currentPrice, holding.currency)}</td> <td className="text-gray-700 text-right">{formatCurrency(holding.marketValue, baseCurrency)}</td> <td className={`text-right ${holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(holding.gainLoss, baseCurrency)}</td> <td className={`text-right ${holding.gainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercentage(holding.gainLossPercent)}</td> <td className="text-gray-700">{holding.assetType}</td> </tr> )) ) : ( <tr> <td colSpan="8" className="text-center text-gray-500 py-4">No holdings data available.</td> </tr> )} </tbody> </table> </div> </div> );
    }

    // --- Transactions View Component ---
    function TransactionsView({ data }) {
        const transactions = data; // Using props data for now
        const getTypeStyle = (type) => { switch (type.toLowerCase()) { case 'buy': return 'bg-green-100 text-green-800'; case 'sell': return 'bg-red-100 text-red-800'; case 'dividend': return 'bg-blue-100 text-blue-800'; case 'fee': return 'bg-yellow-100 text-yellow-800'; default: return 'bg-gray-100 text-gray-800'; } };
        const transactionsWithNetAmount = React.useMemo(() => transactions.map(tx => { let netAmount = 0; const quantity = tx.quantity || 0; const price = tx.price || 0; const fees = tx.fees || 0; switch (tx.type.toLowerCase()) { case 'buy': netAmount = -((quantity * price) + fees); break; case 'sell': netAmount = (quantity * price) - fees; break; case 'dividend': netAmount = (quantity * price) - fees; break; case 'fee': netAmount = -price; break; default: netAmount = 0; } return { ...tx, netAmount }; }).sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions]);
        return ( <div className="dashboard-card"> <h2 className="text-xl font-semibold mb-4 text-gray-800">Transaction History</h2> <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-gray-200 border border-gray-200"> <thead className="bg-gray-50"> <tr> <th>Date</th><th>Type</th><th>Asset</th> <th className="text-right">Quantity</th><th className="text-right">Price / Rate</th> <th className="text-right">Fees</th><th className="text-right">Net Amount</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {transactionsWithNetAmount.length > 0 ? ( transactionsWithNetAmount.map((tx) => ( <tr key={tx.id} className="hover:bg-gray-50"> <td className="text-gray-700">{formatDate(tx.date)}</td> <td><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeStyle(tx.type)}`}>{tx.type}</span></td> <td> <div className="font-medium text-gray-900">{tx.ticker || tx.name}</div> {tx.ticker && tx.name !== tx.ticker && <div className="text-xs text-gray-500">{tx.name}</div>} </td> <td className="text-gray-700 text-right">{tx.quantity !== null ? formatQuantity(tx.quantity) : '-'}</td> <td className="text-gray-700 text-right">{formatCurrency(tx.price, tx.currency)}</td> <td className="text-gray-700 text-right">{formatCurrency(tx.fees, tx.currency)}</td> <td className={`font-medium text-right ${tx.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.netAmount, tx.currency)}</td> </tr> )) ) : ( <tr> <td colSpan="7" className="text-center text-gray-500 py-4">No transactions available.</td> </tr> )} </tbody> </table> </div> </div> );
    }

    // --- Manual Entry Components ---
    function AddAssetForm() {
        const [assetType, setAssetType] = React.useState('Stock'); const [ticker, setTicker] = React.useState(''); const [name, setName] = React.useState(''); const [currency, setCurrency] = React.useState('USD'); const [isSubmitting, setIsSubmitting] = React.useState(false); const [feedback, setFeedback] = React.useState({ message: '', type: '' });
        const handleSubmit = async (event) => { event.preventDefault(); if (!name) { setFeedback({ message: "Asset Name is required.", type: 'error' }); return; } if (assetType !== 'Savings' && assetType !== 'Cash' && !ticker) { setFeedback({ message: "Ticker/Symbol is required for this asset type.", type: 'error' }); return; } const newAssetData = { assetType, ticker: (assetType === 'Savings' || assetType === 'Cash') ? null : ticker, name, currency }; console.log('Submitting New Asset via IPC:', newAssetData); setFeedback({ message: '', type: '' }); setIsSubmitting(true); try { const result = await window.electronAPI.addAsset(newAssetData); console.log("IPC addAsset result:", result); if (result && result.success) { setFeedback({ message: `Asset '${name}' added successfully (ID: ${result.id})!`, type: 'success' }); setAssetType('Stock'); setTicker(''); setName(''); setCurrency('USD'); /* TODO: Optionally refresh holdings view or update App state */ } else { throw new Error(result?.error || 'Failed to add asset. Unknown error.'); } } catch (error) { console.error("Error submitting asset:", error); setFeedback({ message: `Error: ${error.message}`, type: 'error' }); } finally { setIsSubmitting(false); } };
        const inputStyle = "mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"; const selectStyle = `mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${inputStyle}`;
        return ( <form onSubmit={handleSubmit} className="space-y-4 max-w-lg"> <div> <label htmlFor="assetType" className="block text-sm font-medium text-gray-700">Asset Type *</label> <select id="assetType" value={assetType} onChange={(e) => setAssetType(e.target.value)} className={selectStyle} disabled={isSubmitting}> <option>Stock</option><option>Crypto</option><option>ETF</option> <option>Savings</option><option>Cash</option> </select> </div> {assetType !== 'Savings' && assetType !== 'Cash' && ( <div> <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">Ticker / Symbol *</label> <input type="text" id="ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className={inputStyle} placeholder="e.g., AAPL, BTC-USD" disabled={isSubmitting}/> </div> )} <div> <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name *</label> <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputStyle} placeholder="e.g., Apple Inc., Bitcoin, High Yield Savings" disabled={isSubmitting}/> </div> <div> <label htmlFor="assetCurrency" className="block text-sm font-medium text-gray-700">Currency *</label> <select id="assetCurrency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectStyle} disabled={isSubmitting}> <option>USD</option><option>GBP</option><option>EUR</option> </select> </div> {feedback.message && ( <div className={`text-sm p-2 rounded ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}> {feedback.message} </div> )} <div className="pt-2"> <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"> {isSubmitting ? 'Adding...' : 'Add Asset'} </button> </div> </form> );
    }
    function AddTransactionForm() {
        const [txType, setTxType] = React.useState('Buy'); const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]); const [assetIdentifier, setAssetIdentifier] = React.useState(''); const [quantity, setQuantity] = React.useState(''); const [price, setPrice] = React.useState(''); const [fees, setFees] = React.useState(''); const [currency, setCurrency] = React.useState('USD'); const [isSubmitting, setIsSubmitting] = React.useState(false); const [feedback, setFeedback] = React.useState({ message: '', type: '' });
        const handleSubmit = async (event) => { event.preventDefault(); if (!date) { setFeedback({ message: "Date is required.", type: 'error' }); return; } if (!assetIdentifier) { setFeedback({ message: "Asset Identifier or Fee Description is required.", type: 'error' }); return; } if (txType !== 'Fee' && !quantity) { setFeedback({ message: "Quantity is required for this transaction type.", type: 'error' }); return; } if (!price) { setFeedback({ message: "Price/Amount is required.", type: 'error' }); return; } const newTransactionData = { txType, date, ...(txType === 'Fee' ? { name: assetIdentifier } : { ticker: assetIdentifier }), quantity: txType === 'Fee' ? null : parseFloat(quantity) || 0, price: parseFloat(price) || 0, fees: parseFloat(fees) || 0, currency }; console.log('Submitting New Transaction via IPC:', newTransactionData); setFeedback({ message: '', type: '' }); setIsSubmitting(true); try { const result = await window.electronAPI.addTransaction(newTransactionData); console.log("IPC addTransaction result:", result); if (result && result.success) { setFeedback({ message: `Transaction added successfully (ID: ${result.id})!`, type: 'success' }); /* Reset form? */ /* TODO: Optionally refresh transactions view or update App state */ } else { throw new Error(result?.error || 'Failed to add transaction. Unknown error.'); } } catch (error) { console.error("Error submitting transaction:", error); setFeedback({ message: `Error: ${error.message}`, type: 'error' }); } finally { setIsSubmitting(false); } };
        const priceLabel = txType === 'Dividend' ? 'Amount per Share *' : (txType === 'Fee' ? 'Amount *' : 'Price per Share/Unit *'); const assetLabel = txType === 'Fee' ? 'Fee Description *' : 'Ticker / Symbol *'; const quantityNeeded = txType !== 'Fee'; const feesNeeded = txType !== 'Fee'; const inputStyle = "mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"; const selectStyle = `mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${inputStyle}`;
        return ( <form onSubmit={handleSubmit} className="space-y-4 max-w-lg"> <div> <label htmlFor="txType" className="block text-sm font-medium text-gray-700">Transaction Type *</label> <select id="txType" value={txType} onChange={(e) => setTxType(e.target.value)} className={selectStyle} disabled={isSubmitting}> <option>Buy</option><option>Sell</option><option>Dividend</option><option>Fee</option> </select> </div> <div> <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date *</label> <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputStyle} disabled={isSubmitting}/> </div> <div> <label htmlFor="assetIdentifier" className="block text-sm font-medium text-gray-700">{assetLabel}</label> <input type="text" id="assetIdentifier" value={assetIdentifier} onChange={(e) => setAssetIdentifier(txType === 'Fee' ? e.target.value : e.target.value.toUpperCase())} required className={inputStyle} placeholder={txType === 'Fee' ? "e.g., Account Maintenance" : "e.g., AAPL, BTC-USD"} disabled={isSubmitting}/> </div> {quantityNeeded && ( <div> <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity *</label> <input type="number" step="any" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} required={quantityNeeded} className={inputStyle} placeholder="e.g., 10, 0.05" disabled={isSubmitting}/> </div> )} <div> <label htmlFor="price" className="block text-sm font-medium text-gray-700">{priceLabel}</label> <input type="number" step="any" id="price" value={price} onChange={(e) => setPrice(e.target.value)} required className={inputStyle} placeholder="e.g., 170.50" disabled={isSubmitting}/> </div> {feesNeeded && ( <div> <label htmlFor="fees" className="block text-sm font-medium text-gray-700">Fees (Optional)</label> <input type="number" step="any" id="fees" value={fees} onChange={(e) => setFees(e.target.value)} className={inputStyle} placeholder="e.g., 1.00" disabled={isSubmitting}/> </div> )} <div> <label htmlFor="txCurrency" className="block text-sm font-medium text-gray-700">Currency *</label> <select id="txCurrency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectStyle} disabled={isSubmitting}> <option>USD</option><option>GBP</option><option>EUR</option> </select> </div> {feedback.message && ( <div className={`text-sm p-2 rounded ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}> {feedback.message} </div> )} <div className="pt-2"> <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"> {isSubmitting ? 'Adding...' : 'Add Transaction'} </button> </div> </form> );
    }
    function ManualEntryView() {
        const [entryType, setEntryType] = React.useState('asset');
        return ( <div className="dashboard-card"> <h2 className="text-xl font-semibold mb-4 text-gray-800">Manual Entry</h2> <div className="mb-6 border-b border-gray-200"> <nav className="-mb-px flex space-x-8" aria-label="Tabs"> <button onClick={() => setEntryType('asset')} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors duration-150 ${ entryType === 'asset' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > Add Asset </button> <button onClick={() => setEntryType('transaction')} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors duration-150 ${ entryType === 'transaction' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > Add Transaction </button> </nav> </div> {entryType === 'asset' && <AddAssetForm />} {entryType === 'transaction' && <AddTransactionForm />} </div> );
    }

    // --- Settings View Component ---
    function SettingsView() {
        const [baseCurrency, setBaseCurrency] = React.useState('USD'); const [marketDataKey, setMarketDataKey] = React.useState(''); const [fxKey, setFxKey] = React.useState(''); const [newsKey, setNewsKey] = React.useState(''); const [isLoading, setIsLoading] = React.useState(true); const [feedback, setFeedback] = React.useState({ message: '', type: '' });
        React.useEffect(() => { const loadSettings = async () => { try { console.log("SettingsView: Calling electronAPI.getSetting"); const loadedCurrency = await window.electronAPI.getSetting('base_currency'); console.log("SettingsView: Received base_currency:", loadedCurrency); if (loadedCurrency) { setBaseCurrency(loadedCurrency); } } catch (error) { console.error("Error loading settings:", error); setFeedback({ message: `Error loading settings: ${error.message}`, type: 'error' }); } finally { setIsLoading(false); } }; loadSettings(); }, []);
        const inputStyle = "mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"; const selectStyle = `mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${inputStyle}`;
        const handleSave = async () => { console.log("Saving settings via IPC:", { baseCurrency }); setFeedback({ message: '', type: '' }); setIsLoading(true); try { const resultCurrency = await window.electronAPI.setSetting('base_currency', baseCurrency); if (resultCurrency && resultCurrency.success) { setFeedback({ message: 'Settings saved successfully!', type: 'success' }); } else { throw new Error(resultCurrency?.error || 'Failed to save settings.'); } } catch (error) { console.error("Error saving settings:", error); setFeedback({ message: `Error saving settings: ${error.message}`, type: 'error' }); } finally { setIsLoading(false); } };
        return ( <div className="dashboard-card space-y-6"> <h2 className="text-xl font-semibold text-gray-800">Settings</h2> <section> <h3 className="text-lg font-medium text-gray-700 mb-3 border-b pb-2">Preferences</h3> <div className="max-w-md space-y-4"> <div> <label htmlFor="baseCurrency" className="block text-sm font-medium text-gray-700">Base Reporting Currency</label> <select id="baseCurrency" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} className={selectStyle} disabled={isLoading}> <option>USD</option> <option>GBP</option> <option>EUR</option> <option>CAD</option> <option>AUD</option> <option>JPY</option> <option>CHF</option> </select> <p className="mt-1 text-xs text-gray-500">Select the primary currency for portfolio valuation and reporting.</p> </div> </div> </section> <section> <h3 className="text-lg font-medium text-gray-700 mb-3 border-b pb-2">API Keys</h3> <div className="max-w-md space-y-4"> <p className="text-sm text-gray-600"> Enter your personal API keys for external data services. These keys should be stored securely locally. <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline ml-1">(Learn More)</a> </p> <div> <label htmlFor="marketDataKey" className="block text-sm font-medium text-gray-700">Market Data API Key <span className="text-xs text-gray-500">(e.g., Alpha Vantage, FMP)</span></label> <input type="password" id="marketDataKey" value={marketDataKey} onChange={(e) => setMarketDataKey(e.target.value)} className={inputStyle} placeholder="Enter API Key" disabled={isLoading}/> </div> <div> <label htmlFor="fxKey" className="block text-sm font-medium text-gray-700">Exchange Rate API Key <span className="text-xs text-gray-500">(e.g., Open Exchange Rates)</span></label> <input type="password" id="fxKey" value={fxKey} onChange={(e) => setFxKey(e.target.value)} className={inputStyle} placeholder="Enter API Key" disabled={isLoading}/> </div> <div> <label htmlFor="newsKey" className="block text-sm font-medium text-gray-700">News API Key <span className="text-xs text-gray-500">(e.g., NewsAPI.org)</span></label> <input type="password" id="newsKey" value={newsKey} onChange={(e) => setNewsKey(e.target.value)} className={inputStyle} placeholder="Enter API Key" disabled={isLoading}/> </div> </div> </section> {feedback.message && ( <div className={`text-sm p-2 rounded ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}> {feedback.message} </div> )} <div className="pt-4 border-t border-gray-200"> <button onClick={handleSave} disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"> {isLoading ? 'Saving...' : 'Save Settings'} </button> </div> </div> );
    }

    // --- Main App Component ---
    function App() {
      const [activeView, setActiveView] = React.useState('dashboard');
      // --- State for Dummy Data (Will be replaced by data fetched via IPC later) ---
      const [portfolioData, setPortfolioData] = React.useState({ totalValue: 125678.90, baseCurrency: 'USD', changes: { daily: { value: 0.5, positive: true }, wtd: { value: -1.2, positive: false }, mtd: { value: 3.0, positive: true }, ytd: { value: 15.5, positive: true }, overall: { value: 25.8, positive: true } } });
      const [moversData, setMoversData] = React.useState({ period: 'Daily', gainers: [ { ticker: "AAPL", change: 3.2 }, { ticker: "TSLA", change: 2.8 }, { ticker: "MSFT", change: 1.9 }, { ticker: "GOOGL", change: 1.5 }, { ticker: "AMZN", change: 1.1 } ], losers: [ { ticker: "NVDA", change: -2.5 }, { ticker: "META", change: -1.8 }, { ticker: "BTC-USD", change: -1.2 }, { ticker: "ETH-USD", change: -0.9 }, { ticker: "JPM", change: -0.5 } ] });
      const [dividendData, setDividendData] = React.useState([ { ticker: "MSFT", date: "2025-04-15", amountPerShare: 0.75, currency: 'USD' }, { ticker: "JNJ", date: "2025-04-20", amountPerShare: 1.19, currency: 'USD' }, { ticker: "AAPL", date: "2025-05-10", amountPerShare: 0.24, currency: 'USD' }, { ticker: "KO", date: "2025-06-01", amountPerShare: 0.485, currency: 'USD' }, { ticker: "PG", date: "2025-06-15", amountPerShare: 0.94, currency: 'USD' } ]);
      const [allocationData, setAllocationData] = React.useState({ labels: ['Stocks', 'Crypto', 'Savings', 'Bonds'], values: [60, 25, 10, 5] });
      const [holdingsData, setHoldingsData] = React.useState([ { id: 1, ticker: 'AAPL', name: 'Apple Inc.', quantity: 50, avgCost: 150.00, currentPrice: 175.50, assetType: 'Stock', currency: 'USD' }, { id: 2, ticker: 'MSFT', name: 'Microsoft Corp.', quantity: 30, avgCost: 280.00, currentPrice: 310.20, assetType: 'Stock', currency: 'USD' }, { id: 3, ticker: 'BTC-USD', name: 'Bitcoin', quantity: 0.5, avgCost: 40000.00, currentPrice: 45000.00, assetType: 'Crypto', currency: 'USD' }, { id: 4, ticker: 'VUSA.L', name: 'Vanguard S&P 500 ETF', quantity: 100, avgCost: 65.00, currentPrice: 72.50, assetType: 'ETF', currency: 'GBP' }, { id: 'savings1', name: 'High Yield Savings', quantity: 10050.00, avgCost: 1.00, currentPrice: 1.00, assetType: 'Cash', currency: 'USD' } ]);
      const [transactionsData, setTransactionsData] = React.useState([ { id: 't1', date: '2025-03-15', type: 'Buy', ticker: 'AAPL', name: 'Apple Inc.', quantity: 10, price: 170.50, fees: 1.00, currency: 'USD' }, { id: 't2', date: '2025-03-20', type: 'Buy', ticker: 'BTC-USD', name: 'Bitcoin', quantity: 0.05, price: 44500.00, fees: 5.50, currency: 'USD' }, { id: 't3', date: '2025-03-25', type: 'Dividend', ticker: 'MSFT', name: 'Microsoft Corp.', quantity: 30, price: 0.75, fees: 0.00, currency: 'USD' }, { id: 't4', date: '2025-03-28', type: 'Sell', ticker: 'NVDA', name: 'NVIDIA Corp.', quantity: 5, price: 250.00, fees: 0.80, currency: 'USD' }, { id: 't5', date: '2025-04-01', type: 'Buy', ticker: 'VUSA.L', name: 'Vanguard S&P 500 ETF', quantity: 20, price: 72.00, fees: 0.50, currency: 'GBP' }, { id: 't6', date: '2025-04-02', type: 'Fee', name: 'Account Maintenance Fee', quantity: null, price: 5.00, fees: 0.00, currency: 'USD' }, { id: 't7', date: '2025-02-10', type: 'Buy', ticker: 'MSFT', name: 'Microsoft Corp.', quantity: 20, price: 275.00, fees: 1.00, currency: 'USD' } ]);
      // --- End State for Dummy Data ---

      // Function to handle period change for Movers
      const handlePeriodChange = (newPeriod) => { console.log("Changing period to:", newPeriod); setMoversData(prevData => { let newGainers = prevData.gainers; let newLosers = prevData.losers; if (newPeriod === 'WTD') { newGainers = [ { ticker: "GOOGL", change: 1.8 }, { ticker: "JPM", change: 1.5 }, { ticker: "MSFT", change: 1.1 }, { ticker: "VUSA.L", change: 0.9 }, { ticker: "KO", change: 0.5 } ]; newLosers = [ { ticker: "TSLA", change: -3.1 }, { ticker: "AMZN", change: -2.4 }, { ticker: "NVDA", change: -1.9 }, { ticker: "BTC-USD", change: -1.5 }, { ticker: "META", change: -1.0 } ]; } else if (newPeriod === 'Daily') { newGainers = [ { ticker: "AAPL", change: 3.2 }, { ticker: "TSLA", change: 2.8 }, { ticker: "MSFT", change: 1.9 }, { ticker: "GOOGL", change: 1.5 }, { ticker: "AMZN", change: 1.1 } ]; newLosers = [ { ticker: "NVDA", change: -2.5 }, { ticker: "META", change: -1.8 }, { ticker: "BTC-USD", change: -1.2 }, { ticker: "ETH-USD", change: -0.9 }, { ticker: "JPM", change: -0.5 } ]; } return { ...prevData, period: newPeriod, gainers: newGainers.slice(0, 5), losers: newLosers.slice(0, 5) }; }); };

      // --- UI Structure ---
      return ( <div className="flex flex-col h-full bg-gray-100"> <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10 border-b border-gray-200"> <h1 className="text-xl font-semibold text-gray-800">Personalized Investment Tracker (PIT)</h1> <nav> <button onClick={() => setActiveView('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium mr-2 transition-colors duration-150 ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Dashboard</button> <button onClick={() => setActiveView('holdings')} className={`px-4 py-2 rounded-md text-sm font-medium mr-2 transition-colors duration-150 ${activeView === 'holdings' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Holdings</button> <button onClick={() => setActiveView('transactions')} className={`px-4 py-2 rounded-md text-sm font-medium mr-2 transition-colors duration-150 ${activeView === 'transactions' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Transactions</button> <button onClick={() => setActiveView('add_new')} className={`px-4 py-2 rounded-md text-sm font-medium mr-2 transition-colors duration-150 ${activeView === 'add_new' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Add New</button> <button onClick={() => setActiveView('settings')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${activeView === 'settings' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Settings</button> </nav> </header> <main className="flex-grow p-6 overflow-auto"> {activeView === 'dashboard' && <Dashboard portfolioData={portfolioData} moversData={moversData} dividendData={dividendData} allocationData={allocationData} onPeriodChange={handlePeriodChange} />} {activeView === 'holdings' && <HoldingsView data={holdingsData} baseCurrency={portfolioData.baseCurrency} />} {activeView === 'transactions' && <TransactionsView data={transactionsData} />} {activeView === 'add_new' && <ManualEntryView />} {activeView === 'settings' && <SettingsView />} </main> <footer className="bg-gray-200 p-3 text-center text-sm text-gray-600 border-t border-gray-300"> Status: Ready | Base Currency: {portfolioData.baseCurrency} | Version: 1.0.0 </footer> </div> );
    }

    // Render the React app
    const container = document.getElementById('root');
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
    console.log('Renderer process script loaded and React app mounted.');
    