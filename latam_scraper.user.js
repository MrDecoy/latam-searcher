// ==UserScript==
// @name         LATAM Flight Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrape LATAM Airlines flight information
// @author       Your Name
// @match        https://www.latamairlines.com/*/*
// @match        https://www.latamairlines.com/*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.13.2/jquery-ui.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js
// @require      https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.min.js
// @resource     DATERANGEPICKER_CSS https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.css
// @resource     JQUERYUI_CSS https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css
// ==/UserScript==

(function() {
    'use strict';

    // Add daterangepicker and jQuery UI CSS
    GM_addStyle(GM_getResourceText('DATERANGEPICKER_CSS'));
    GM_addStyle(GM_getResourceText('JQUERYUI_CSS'));
    
    // Add custom CSS for z-index fixes and resizable styles
    GM_addStyle(`
        .daterangepicker {
            z-index: 100000 !important;
        }
        .ui-resizable-handle {
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 3px;
        }
        .ui-resizable-se {
            width: 12px;
            height: 12px;
            right: -5px;
            bottom: -5px;
            background-color: #fff;
            box-shadow: 0 0 3px rgba(0,0,0,0.2);
        }
        #scraper-container {
            min-width: 300px;
            min-height: 400px;
            resize: both;
            overflow: auto;
        }
        .scraper-header {
            cursor: move;
            padding: 8px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            margin: -15px -15px 15px -15px;
            border-radius: 5px 5px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .scraper-header h3 {
            margin: 0;
            font-size: 16px;
            color: #495057;
        }
        .form-content {
            overflow-y: auto;
            height: calc(100% - 50px);
            padding-right: 5px;
        }
        .form-content::-webkit-scrollbar {
            width: 8px;
        }
        .form-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        .form-content::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        .form-content::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        .status-section {
            position: fixed;
            bottom: 10px;
            left: 10px;
            z-index: 9999;
            background: white;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            width: 300px;
            font-family: Arial, sans-serif;
        }
        .status-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ccc;
        }
        .status-content {
            max-height: 200px;
            overflow-y: auto;
        }
        .status-item {
            margin: 5px 0;
            padding: 5px;
            border-radius: 3px;
        }
        .status-success {
            background-color: #d4edda;
            color: #155724;
        }
        .status-error {
            background-color: #f8d7da;
            color: #721c24;
        }
        .status-warning {
            background-color: #fff3cd;
            color: #856404;
        }
        .status-info {
            background-color: #cce5ff;
            color: #004085;
        }
        .step-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .step-success { background-color: #28a745; }
        .step-error { background-color: #dc3545; }
        .step-pending { background-color: #ffc107; }
        .step-inactive { background-color: #6c757d; }
    `);

    // Ensure jQuery is loaded and available
    let $ = window.jQuery || unsafeWindow.jQuery;

    // Configuration object to store search parameters
    const config = {
        searches: [],
        currentSearchIndex: 0,
        currentDateIndex: 0,
        isProcessing: false,
        results: []
    };

    // Load saved state
    function loadState() {
        const savedState = GM_getValue('scraperState');
        if (savedState) {
            Object.assign(config, JSON.parse(savedState));
            logger.log('Loaded saved state', 'info');
            logger.log(`Current search: ${config.currentSearchIndex}, Current date: ${config.currentDateIndex}`);
            logger.log(`Results collected so far: ${config.results.length}`);
        }
    }

    // Save current state
    function saveState() {
        GM_setValue('scraperState', JSON.stringify(config));
        logger.log('State saved', 'info');
    }

    // Clear saved state
    function clearState() {
        GM_deleteValue('scraperState');
        Object.assign(config, {
            searches: [],
            currentSearchIndex: 0,
            currentDateIndex: 0,
            isProcessing: false,
            results: []
        });
        logger.log('State cleared', 'info');
    }

    // Logger class for tracking progress and issues
    class Logger {
        constructor() {
            this.container = null;
            this.logArea = null;
            this.maxLogs = 100;
            this.setupLogger();
        }

        setupLogger() {
            // Create logger container
            this.container = document.createElement('div');
            this.container.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                z-index: 9999;
                background: white;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                width: 400px;
                max-height: 300px;
                display: flex;
                flex-direction: column;
            `;

            // Add header
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                border-bottom: 1px solid #ccc;
                padding-bottom: 5px;
            `;
            
            const title = document.createElement('span');
            title.textContent = 'Scraper Log';
            title.style.fontWeight = 'bold';

            const clearButton = document.createElement('button');
            clearButton.textContent = 'Clear';
            clearButton.style.cssText = `
                padding: 2px 8px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
            `;
            clearButton.onclick = () => this.clear();

            header.appendChild(title);
            header.appendChild(clearButton);
            this.container.appendChild(header);

            // Create log area
            this.logArea = document.createElement('div');
            this.logArea.style.cssText = `
                overflow-y: auto;
                font-family: monospace;
                font-size: 12px;
                white-space: pre-wrap;
                flex-grow: 1;
            `;
            this.container.appendChild(this.logArea);

            // Add to document
            document.body.appendChild(this.container);
        }

        log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.style.cssText = `
                margin: 2px 0;
                padding: 2px 5px;
                border-radius: 3px;
            `;

            switch(type) {
                case 'error':
                    logEntry.style.backgroundColor = '#ffebee';
                    logEntry.style.color = '#c62828';
                    break;
                case 'success':
                    logEntry.style.backgroundColor = '#e8f5e9';
                    logEntry.style.color = '#2e7d32';
                    break;
                case 'warning':
                    logEntry.style.backgroundColor = '#fff3e0';
                    logEntry.style.color = '#ef6c00';
                    break;
                default:
                    logEntry.style.backgroundColor = '#e3f2fd';
                    logEntry.style.color = '#1565c0';
            }

            logEntry.textContent = `[${timestamp}] ${message}`;
            this.logArea.appendChild(logEntry);
            this.logArea.scrollTop = this.logArea.scrollHeight;

            // Limit the number of log entries
            while (this.logArea.children.length > this.maxLogs) {
                this.logArea.removeChild(this.logArea.firstChild);
            }

            // Also log to console for debugging
            console.log(`[${type.toUpperCase()}] ${message}`);
        }

        clear() {
            while (this.logArea.firstChild) {
                this.logArea.removeChild(this.logArea.firstChild);
            }
        }
    }

    // Create logger instance
    const logger = new Logger();

    // Helper function to format dates
    function formatDate(date) {
        // Ensure we're working with a valid date string in YYYY-MM-DD format
        if (typeof date === 'string') {
            // If it's already in YYYY-MM-DD format, return as is
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return date;
            }
            // If it's a Date object, convert to YYYY-MM-DD
            date = new Date(date);
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Generate array of dates between start and end
    function generateDateRange(startDate, endDate) {
        const dates = [];
        const start = moment(startDate).startOf('day');
        const end = moment(endDate).endOf('day');
        
        const current = start.clone();
        while (current.isSameOrBefore(end, 'day')) {
            dates.push(current.format('YYYY-MM-DD'));
            current.add(1, 'days');
        }

        return dates;
    }

    // Generate all possible date combinations for round trips
    function generateDateCombinations(outboundDates, returnDates) {
        const combinations = [];
        
        const outboundRange = generateDateRange(outboundDates.start, outboundDates.end);
        const returnRange = generateDateRange(returnDates.start, returnDates.end);
        
        for (const outboundDate of outboundRange) {
            const outboundDateTime = new Date(outboundDate);
            outboundDateTime.setUTCHours(0, 0, 0, 0);
            
            for (const returnDate of returnRange) {
                const returnDateTime = new Date(returnDate);
                returnDateTime.setUTCHours(0, 0, 0, 0);
                
                if (returnDateTime > outboundDateTime) {
                    combinations.push({
                        outbound: outboundDate,
                        return: returnDate
                    });
                }
            }
        }
        
        combinations.sort((a, b) => {
            const dateCompare = new Date(a.outbound) - new Date(b.outbound);
            if (dateCompare === 0) {
                return new Date(a.return) - new Date(b.return);
            }
            return dateCompare;
        });

        return combinations;
    }

    // Function to check if flight cards are present
    function waitForFlightCards(maxAttempts = 10) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            
            const checkForCards = () => {
                const flightCards = document.querySelectorAll('[data-testid^="flight-card-"], [data-testid^="flight-info-"]');
                
                if (flightCards.length > 0) {
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    resolve(false);
                } else {
                    attempts++;
                    setTimeout(checkForCards, 2000);
                }
            };
            
            checkForCards();
        });
    }

    // Helper function to parse price values
    function parsePriceValue(price) {
        if (!price) return Infinity;
        
        if (price.includes('pontos')) {
            // Handle points format: "130.000 pontos + R$ 63,90"
            const pointsMatch = price.match(/(\d+[\d,.]*)\s*pontos/);
            return pointsMatch ? parseFloat(pointsMatch[1].replace(/[.,]/g, '')) : Infinity;
        } else {
            // Handle regular price format: "R$ 2.530,90"
            const priceMatch = price.match(/R\$\s*(\d+[\d,.]*)/);
            return priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : Infinity;
        }
    }

    // Extract flight information from the page
    function extractFlightInfo() {
        const flights = [];
        const currentSearch = config.searches[config.currentSearchIndex];

        logger.log(`Attempting to extract flights for ${currentSearch.origin} to ${currentSearch.destination} on ${currentSearch.currentDate}`);

        // Check if we're on the return flight page
        const returnTitle = document.querySelector('#titleSelectFlightDesktop .route-title');
        const isReturnPage = returnTitle && returnTitle.textContent.trim().toLowerCase() === 'voo de volta';

        // Try both possible selectors for flight cards
        const flightCards = document.querySelectorAll('[data-testid^="flight-card-"], [data-testid^="flight-info-"], [data-testid^="wrapper-card-flight-"]');
        if (!flightCards.length) {
            return null;
        }

        // For round trips, we need to handle both outbound and inbound flights
        const isRoundTrip = currentSearch.trip_type === 'round_trip';
        const flightType = isRoundTrip ? (isReturnPage ? 'return' : 'outbound') : 'one_way';

        // Generate a unique ID for this flight combination
        let combinationId;
        if (isRoundTrip) {
            // For round trips, use both outbound and return dates in the combination ID
            combinationId = `${currentSearch.origin}_${currentSearch.destination}_${currentSearch.currentDate}_${currentSearch.currentReturnDate}_${currentSearch.use_points ? 'points' : 'cash'}_${currentSearch.trip_type}`;
        } else {
            // For one-way flights
            combinationId = `${currentSearch.origin}_${currentSearch.destination}_${currentSearch.currentDate}_${currentSearch.use_points ? 'points' : 'cash'}_${currentSearch.trip_type}`;
        }

        logger.log(`Processing combination ID: ${combinationId}`, 'info');

        flightCards.forEach((card, index) => {
            try {
                // Extract origin info
                const originInfo = card.querySelector('[data-testid$="-origin"]');
                const departureTime = originInfo?.querySelector('.flightInfostyles__TextHourFlight-sc__sc-edlvrg-4')?.textContent.trim();
                const originAirport = originInfo?.querySelector('.flightInfostyles__TextIATA-sc__sc-edlvrg-5')?.textContent.trim();

                // Extract destination info
                const destinationInfo = card.querySelector('[data-testid$="-destination"]');
                const arrivalTimeElement = destinationInfo?.querySelector('.flightInfostyles__TextHourFlight-sc__sc-edlvrg-4');
                let arrivalTime = arrivalTimeElement?.textContent.trim();
                const nextDayIndicator = arrivalTimeElement?.querySelector('.flightInfostyles__TextDaysDifference-sc__sc-edlvrg-6')?.textContent.trim();
                const destinationAirport = destinationInfo?.querySelector('.flightInfostyles__TextIATA-sc__sc-edlvrg-5')?.textContent.trim();

                // Extract duration
                const duration = card.querySelector('[data-testid$="-duration"] span:last-child')?.textContent.trim();

                // Extract price information
                const priceInfo = card.querySelector('[data-testid$="-amount"]');
                let price = '';
                let taxInfo = '';

                if (currentSearch.use_points) {
                    // Points format
                    const pointsAmount = priceInfo?.querySelector('.displayCurrencystyle__CurrencyAmount-sc__sc-hel5vp-2')?.textContent.trim();
                    const additionalFees = priceInfo?.querySelector('.displayCurrencystyle__Description-sc__sc-hel5vp-5')?.textContent.trim();
                    price = `${pointsAmount || ''} ${additionalFees || ''}`.trim();
                } else {
                    // Regular price format
                    price = priceInfo?.querySelector('.displayCurrencystyle__CurrencyAmount-sc__sc-hel5vp-2')?.textContent.trim() || '';
                }

                // Get taxes info if available
                taxInfo = priceInfo?.querySelector('.flightInfostyles__TaxesFeesIncludedText-sc__sc-edlvrg-10')?.textContent.trim();

                const flightInfo = {
                    combination_id: combinationId,
                    trip_type: currentSearch.trip_type,
                    flight_type: flightType,
                    outbound_date: currentSearch.currentDate,
                    return_date: isRoundTrip ? currentSearch.currentReturnDate : '',
                    date: isReturnPage ? currentSearch.currentReturnDate : currentSearch.currentDate,
                    origin: originAirport || (isReturnPage ? currentSearch.destination : currentSearch.origin),
                    destination: destinationAirport || (isReturnPage ? currentSearch.origin : currentSearch.destination),
                    departure_time: departureTime,
                    arrival_time: arrivalTime,
                    next_day: nextDayIndicator ? true : false,
                    duration: duration,
                    price: price,
                    taxes_included: taxInfo ? true : false,
                    use_points: currentSearch.use_points,
                    raw_price_value: parsePriceValue(price)
                };

                flights.push(flightInfo);
            } catch (e) {
                logger.log(`Error extracting flight ${index + 1}: ${e.message}`, 'error');
            }
        });

        // Sort flights by price and get only the cheapest one
        if (flights.length > 0) {
            const cheapestFlight = flights
                .sort((a, b) => a.raw_price_value - b.raw_price_value)[0];
            
                // Remove the raw_price_value before returning
            const { raw_price_value, ...cleanFlight } = cheapestFlight;
            
            logger.log(`Selected cheapest ${flightType} flight: ${cleanFlight.departure_time} -> ${cleanFlight.arrival_time} - ${cleanFlight.price}`, 'success');
            
            return [cleanFlight]; // Return array with single cheapest flight
        }

        return null;
    }

    // Save results to CSV file
    function saveToCSV() {
        if (!config.results.length) {
            logger.log('No results to save', 'warning');
            return;
        }

        logger.log(`Preparing to save ${config.results.length} flights to CSV`);

        try {
            // Define headers for both outbound and return flights
            const headers = [
                'combination_id',
                'trip_type',
                'use_points',
                'status',
                'retries',
                'total_price',
                // Outbound flight fields
                'outbound_date',
                'outbound_origin',
                'outbound_destination',
                'outbound_departure_time',
                'outbound_arrival_time',
                'outbound_next_day',
                'outbound_duration',
                'outbound_price',
                'outbound_taxes_included',
                // Return flight fields
                'return_date',
                'return_origin',
                'return_destination',
                'return_departure_time',
                'return_arrival_time',
                'return_next_day',
                'return_duration',
                'return_price',
                'return_taxes_included'
            ];
            
            // Create CSV content with proper line endings
            let csvRows = [];
            
            // Add headers
            csvRows.push(headers.join(','));
            
            // Group flights by combination_id
            const flightGroups = {};
            config.results.forEach(flight => {
                if (!flightGroups[flight.combination_id]) {
                    flightGroups[flight.combination_id] = {
                        outbound: null,
                        return: null,
                        status: flight.status || 'success',
                        retries: flight.retries || 0,
                        trip_type: flight.trip_type,
                        use_points: flight.use_points
                    };
                }
                
                if (flight.status === 'failed') {
                    flightGroups[flight.combination_id].status = 'failed';
                    flightGroups[flight.combination_id].retries = flight.retries;
                } else if (flight.flight_type === 'outbound' || flight.flight_type === 'one_way') {
                    flightGroups[flight.combination_id].outbound = flight;
                } else if (flight.flight_type === 'return') {
                    flightGroups[flight.combination_id].return = flight;
                }
            });

            // Process each flight group into a single row
            Object.entries(flightGroups).forEach(([combinationId, group]) => {
                const outbound = group.outbound;
                const return_flight = group.return;
                const status = group.status;
                const retries = group.retries;
                
                // Calculate total price only for successful searches
                let total_price = '';
                if (status === 'success' && outbound?.price) {
                    if (outbound.trip_type === 'one_way' || return_flight?.price) {
                        if (outbound.trip_type === 'one_way') {
                            total_price = outbound.price;
                        } else {
                            // For round trips, combine prices if both are available
                            const outPrice = parsePriceValue(outbound.price);
                            const returnPrice = parsePriceValue(return_flight.price);
                            if (outbound.use_points) {
                                total_price = `${outPrice + returnPrice} pontos`;
                            } else {
                                total_price = `R$ ${(outPrice + returnPrice).toFixed(2)}`;
                            }
                        }
                    }
                }

                const row = [
                    combinationId,
                    group.trip_type || '',
                    group.use_points ? 'Yes' : 'No',
                    status,
                    retries,
                    total_price,
                    // Outbound flight data (empty if failed)
                    status === 'success' ? (outbound?.date || '') : '',
                    status === 'success' ? (outbound?.origin || '') : '',
                    status === 'success' ? (outbound?.destination || '') : '',
                    status === 'success' ? (outbound?.departure_time || '') : '',
                    status === 'success' ? (outbound?.arrival_time || '') : '',
                    status === 'success' ? (outbound?.next_day ? 'Yes' : 'No') : '',
                    status === 'success' ? (outbound?.duration || '') : '',
                    status === 'success' ? (outbound?.price || '') : '',
                    status === 'success' ? (outbound?.taxes_included ? 'Yes' : 'No') : '',
                    // Return flight data (empty if failed or one-way)
                    status === 'success' ? (return_flight?.date || '') : '',
                    status === 'success' ? (return_flight?.origin || '') : '',
                    status === 'success' ? (return_flight?.destination || '') : '',
                    status === 'success' ? (return_flight?.departure_time || '') : '',
                    status === 'success' ? (return_flight?.arrival_time || '') : '',
                    status === 'success' ? (return_flight?.next_day ? 'Yes' : 'No') : '',
                    status === 'success' ? (return_flight?.duration || '') : '',
                    status === 'success' ? (return_flight?.price || '') : '',
                    status === 'success' ? (return_flight?.taxes_included ? 'Yes' : 'No') : ''
                ].map(value => {
                    // Handle values that might contain commas
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });

                csvRows.push(row.join(','));
            });

            // Create the final CSV content with BOM for Excel
            const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const csvContent = csvRows.join('\r\n');
            const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8' });
            
            // Generate filename using the first flight's information
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const firstResult = config.results[0];
            const filename = `flights_${firstResult.origin}_${firstResult.destination}_${firstResult.use_points ? 'points' : 'cash'}_${firstResult.trip_type}_${timestamp}.csv`;

            // Create object URL and trigger download
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            logger.log(`Successfully saved results to ${filename}`, 'success');
        } catch (e) {
            logger.log(`Error saving CSV: ${e.message}`, 'error');
        }
    }

    // Process next search or date
    function processNext() {
        if (!config.isProcessing) {
            logger.log('Processing is not active', 'info');
            return;
        }

        const currentSearch = config.searches[config.currentSearchIndex];
        if (!currentSearch) {
            logger.log('All searches completed', 'success');
            config.isProcessing = false;
            saveState();
            saveToCSV();
            clearState();  // Clear state after completion
            return;
        }

        logger.log(`Processing search ${config.currentSearchIndex + 1} of ${config.searches.length}`, 'info');

        let datesToProcess;
        if (currentSearch.trip_type === 'round_trip') {
            // For round trips, generate all date combinations if not already generated
            if (!currentSearch.dateCombinations) {
                currentSearch.dateCombinations = generateDateCombinations(
                    currentSearch.outbound_dates,
                    currentSearch.return_dates
                );
                logger.log(`Generated ${currentSearch.dateCombinations.length} date combinations for round trip`, 'info');
            }
            datesToProcess = currentSearch.dateCombinations;
        } else {
            // For one-way trips, generate all dates in the range if not already generated
            if (!currentSearch.dateRange) {
                currentSearch.dateRange = generateDateRange(
                    currentSearch.outbound_dates.start,
                    currentSearch.outbound_dates.end
                );
                logger.log(`Generated ${currentSearch.dateRange.length} dates for one-way trip`, 'info');
            }
            datesToProcess = currentSearch.dateRange.map(date => ({ outbound: date }));
        }

        if (config.currentDateIndex >= datesToProcess.length) {
            logger.log(`Completed search for ${currentSearch.origin} to ${currentSearch.destination}`, 'success');
            config.currentSearchIndex++;
            config.currentDateIndex = 0;
            saveState();
            processNext();
            return;
        }

        const currentDateCombo = datesToProcess[config.currentDateIndex];
        currentSearch.currentDate = currentDateCombo.outbound;
        if (currentSearch.trip_type === 'round_trip') {
            currentSearch.currentReturnDate = currentDateCombo.return;
            logger.log(`Processing combination ${config.currentDateIndex + 1} of ${datesToProcess.length}`, 'info');
        } else {
            logger.log(`Processing date ${config.currentDateIndex + 1} of ${datesToProcess.length}`, 'info');
        }
        
        logger.log(`Processing ${currentSearch.origin} to ${currentSearch.destination}`, 'info');
        logger.log(`Outbound: ${currentSearch.currentDate}${currentSearch.trip_type === 'round_trip' ? `, Return: ${currentSearch.currentReturnDate}` : ''}`, 'info');

        // Save state before navigation
        saveState();

        // Construct URL for the current search
        const baseUrl = 'https://www.latamairlines.com/br/pt/oferta-voos';
        
        // Create params in the exact order as LATAM's website
        const params = new URLSearchParams();
        params.append('origin', currentSearch.origin);
        params.append('outbound', `${currentSearch.currentDate}T00:00:00.000Z`);
        params.append('destination', currentSearch.destination);
        
        // For round trips, add inbound date right after destination
        if (currentSearch.trip_type === 'round_trip') {
            params.append('inbound', `${currentSearch.currentReturnDate}T00:00:00.000Z`);
        }
        
        // Add remaining parameters in LATAM's order
        params.append('adt', '1');
        params.append('chd', '0');
        params.append('inf', '0');
        params.append('trip', currentSearch.trip_type === 'round_trip' ? 'RT' : 'OW');
        params.append('cabin', 'Economy');
        params.append('redemption', currentSearch.use_points.toString());
        params.append('sort', 'RECOMMENDED');

        const url = `${baseUrl}?${params.toString()}`;
        logger.log(`Navigating to: ${url}`, 'info');
        window.location.href = url;
    }

    // Main function to start scraping
    function startScraping(searchConfig) {
        logger.log('Starting new scraping session', 'info');
        logger.log(`Loaded ${searchConfig.searches.length} searches to process`);
        
        // Clear any existing state
        clearState();
        
        config.searches = searchConfig.searches;
        config.currentSearchIndex = 0;
        config.currentDateIndex = 0;
        config.isProcessing = true;
        config.results = [];

        // Save initial state
        saveState();
        
        processNext();
    }

    // Function to select the cheapest flight card
    async function selectCheapestFlightCard() {
        const flightCards = document.querySelectorAll('[data-testid^="flight-card-"], [data-testid^="flight-info-"]');
        if (!flightCards.length) {
            logger.log('No flight cards found to select', 'error');
            return false;
        }

        let cheapestCard = null;
        let cheapestPrice = Infinity;

        flightCards.forEach(card => {
            const priceInfo = card.querySelector('[data-testid$="-amount"]');
            const priceText = priceInfo?.textContent.trim() || '';
            const priceValue = parsePriceValue(priceText);
            
            if (priceValue < cheapestPrice) {
                cheapestPrice = priceValue;
                cheapestCard = card;
            }
        });

        if (cheapestCard) {
            logger.log('Found cheapest flight card, clicking to reveal tariffs...', 'info');
            cheapestCard.click();
            return true;
        }

        return false;
    }

    // Function to select the cheapest tariff option
    async function selectCheapestTariff() {
        return new Promise((resolve, reject) => {
            let navigationAttempts = 0;
            const maxNavigationAttempts = 20;
            let waitingForButton = true;
            let buttonCheckAttempts = 0;
            const maxButtonCheckAttempts = 10;

            const checkForTariffs = () => {
                // Look for the tariff list using the correct selector
                const tariffList = document.querySelector('ol');
                if (!tariffList) {
                    logger.log('Waiting for tariff list...', 'info');
                    setTimeout(checkForTariffs, 1000);
                    return;
                }

                // Find all tariff items (li elements)
                const tariffItems = tariffList.querySelectorAll('li[data-brand]');
                if (!tariffItems.length) {
                    logger.log('No tariff options found', 'error');
                    resolve(false);
                    return;
                }

                logger.log(`Found ${tariffItems.length} tariff options`, 'info');
                let cheapestTariff = null;
                let cheapestPrice = Infinity;

                tariffItems.forEach((item, index) => {
                    // Find the price element within the tariff item
                    const priceElement = item.querySelector('.displayCurrencystyle__CurrencyAmount-sc__sc-hel5vp-2');
                    if (priceElement) {
                        const priceText = priceElement.textContent.trim();
                        const priceValue = parsePriceValue(priceText);
                        logger.log(`Tariff ${index + 1} price: ${priceText} (parsed: ${priceValue})`, 'info');

                        if (priceValue < cheapestPrice) {
                            cheapestPrice = priceValue;
                            cheapestTariff = item;
                            logger.log(`New cheapest tariff found: ${priceText}`, 'info');
                        }
                    }
                });

                if (cheapestTariff) {
                    const waitForButton = () => {
                        // Find the "Escolher" button using the correct selector
                        const selectButton = cheapestTariff.querySelector('button[data-testid$="-flight-select"]');
                        
                        if (selectButton && selectButton.offsetParent !== null) {  // Check if button is visible
                            logger.log(`Found "Escolher" button with data-testid: ${selectButton.getAttribute('data-testid')}`, 'info');
                            logger.log('Clicking "Escolher" button...', 'info');
                            selectButton.click();
                            waitingForButton = false;
                            
                            // After clicking, wait for return flight page to load
                            const waitForReturnPage = () => {
                                // Check for the specific return flight title
                                const returnTitle = document.querySelector('#titleSelectFlightDesktop .route-title');
                                const hasReturnTitle = returnTitle && returnTitle.textContent.trim().toLowerCase() === 'voo de volta';
                                
                                // Check for return flight cards
                                const returnCards = document.querySelectorAll('[data-testid^="wrapper-card-flight-"]');
                                const hasReturnCards = returnCards.length > 0;
                                
                                // Check if price elements are loaded in the return cards
                                const allPricesLoaded = Array.from(returnCards).every(card => {
                                    const priceElement = card.querySelector('.displayCurrencystyle__CurrencyAmount-sc__sc-hel5vp-2');
                                    return priceElement && priceElement.textContent.trim() !== '';
                                });

                                logger.log(`Navigation attempt ${navigationAttempts + 1}:`, 'info');
                                logger.log(`- Return title found: ${hasReturnTitle}`, 'info');
                                logger.log(`- Return cards found: ${returnCards.length}`, 'info');
                                logger.log(`- All prices loaded: ${allPricesLoaded}`, 'info');

                                if (hasReturnTitle && hasReturnCards && allPricesLoaded) {
                                    logger.log('Return flight page loaded successfully with all elements', 'success');
                                    
                                    // Extract return flight information
                                    const returnFlights = extractFlightInfo();
                                    if (returnFlights && returnFlights.length) {
                                        config.results.push(...returnFlights);
                                        logger.log(`Successfully extracted ${returnFlights.length} return flights`, 'success');
                                        saveState();
                                        
                                        // Move to next date
                                        config.currentDateIndex++;
                                        logger.log('Moving to next date after saving return flight info...');
                                        saveState();
                                        setTimeout(processNext, 2000);
                                    } else {
                                        logger.log('Failed to extract return flights, moving to next date', 'error');
                                        config.currentDateIndex++;
                                        saveState();
                                        setTimeout(processNext, 2000);
                                    }
                                    
                                    resolve(true);
                                    return;
                                }

                                if (navigationAttempts >= maxNavigationAttempts) {
                                    logger.log('Max attempts reached waiting for return flight page', 'error');
                                    resolve(false);
                                    return;
                                }

                                navigationAttempts++;
                                setTimeout(waitForReturnPage, 1000);
                            };
                            
                            setTimeout(waitForReturnPage, 1000);
                            return;
                        }

                        if (buttonCheckAttempts >= maxButtonCheckAttempts) {
                            logger.log('Max attempts reached waiting for "Escolher" button', 'error');
                            resolve(false);
                            return;
                        }

                        buttonCheckAttempts++;
                        logger.log(`Waiting for "Escolher" button to be clickable (attempt ${buttonCheckAttempts})...`, 'info');
                        setTimeout(waitForButton, 1000);
                    };

                    waitForButton();
                } else {
                    logger.log('Could not find cheapest tariff', 'error');
                    resolve(false);
                }
            };

            checkForTariffs();
        });
    }

    // Function to check if we're on the return flight page and wait for it to load
    async function waitForReturnFlightPage(maxAttempts = 20) {
        return new Promise((resolve) => {
            let attempts = 0;
            
            const checkForReturnPage = () => {
                // First check for the return flight header
                const returnHeader = document.querySelector('h1, h2, h3, h4, h5, h6');
                const isReturnPage = returnHeader && returnHeader.textContent.includes('voo de volta');
                
                if (!isReturnPage) {
                    if (attempts >= maxAttempts) {
                        logger.log('Not on return flight page', 'info');
                        resolve(false);
                        return;
                    }
                    attempts++;
                    setTimeout(checkForReturnPage, 1000);
                    return;
                }

                // Then check for flight cards
                const flightCards = document.querySelectorAll('[data-testid^="wrapper-card-flight-"]');
                const hasFlightCards = flightCards.length > 0;

                // Check if price elements are loaded
                const allPricesLoaded = Array.from(flightCards).every(card => {
                    const priceElement = card.querySelector('.displayCurrencystyle__CurrencyAmount-sc__sc-hel5vp-2');
                    return priceElement && priceElement.textContent.trim() !== '';
                });

                if (hasFlightCards && allPricesLoaded) {
                    logger.log('Return flight page fully loaded with prices', 'success');
                    resolve(true);
                    return;
                }

                if (attempts >= maxAttempts) {
                    logger.log('Return flight page elements not fully loaded', 'error');
                    resolve(false);
                    return;
                }

                attempts++;
                setTimeout(checkForReturnPage, 1000);
            };
            
            checkForReturnPage();
        });
    }

    // Function to wait for tariff list to be fully loaded
    function waitForTariffList(maxAttempts = 20) {
        return new Promise((resolve) => {
            let attempts = 0;
            
            const checkForTariffList = () => {
                const tariffList = document.querySelector('ol');
                const tariffItems = tariffList?.querySelectorAll('li[data-brand]');
                
                if (tariffItems?.length > 0) {
                    // Check if all price elements are loaded
                    const allPricesLoaded = Array.from(tariffItems).every(item => {
                        const priceElement = item.querySelector('.displayCurrencystyle__CurrencyAmount-sc__sc-hel5vp-2');
                        return priceElement && priceElement.textContent.trim() !== '';
                    });

                    if (allPricesLoaded) {
                        resolve(true);
                        return;
                    }
                }
                
                if (attempts >= maxAttempts) {
                    resolve(false);
                    return;
                }
                
                attempts++;
                setTimeout(checkForTariffList, 1000);
            };
            
            checkForTariffList();
        });
    }

    // Create status display
    function createStatusDisplay() {
        const statusContainer = document.createElement('div');
        statusContainer.className = 'status-section';
        statusContainer.innerHTML = `
            <div class="status-header">
                <strong>Scraping Status</strong>
                <button class="minimize-status" style="padding: 2px 8px;">_</button>
            </div>
            <div class="status-content"></div>
        `;

        document.body.appendChild(statusContainer);

        // Add minimize functionality
        const minimizeBtn = statusContainer.querySelector('.minimize-status');
        const statusContent = statusContainer.querySelector('.status-content');
        let isMinimized = false;

        minimizeBtn.addEventListener('click', () => {
            if (isMinimized) {
                statusContent.style.display = 'block';
                minimizeBtn.textContent = '_';
            } else {
                statusContent.style.display = 'none';
                minimizeBtn.textContent = '□';
            }
            isMinimized = !isMinimized;
        });

        return statusContainer;
    }

    // Update status display
    function updateStatus(message, type = 'info', steps = null) {
        const statusContent = document.querySelector('.status-content');
        if (!statusContent) return;

        const statusItem = document.createElement('div');
        statusItem.className = `status-item status-${type}`;
        
        let stepsHtml = '';
        if (steps) {
            stepsHtml = '<div style="margin-top: 5px;">';
            const stepNames = ['Outbound Flight', 'Tariff Selection', 'Return Flight'];
            stepNames.forEach((step, index) => {
                const status = steps[index] === true ? 'success' : 
                             steps[index] === false ? 'error' : 
                             steps[index] === 'pending' ? 'pending' : 'inactive';
                stepsHtml += `
                    <div style="margin: 2px 0;">
                        <span class="step-indicator step-${status}"></span>
                        ${step}: ${steps[index] === true ? '✓' : 
                                 steps[index] === false ? '✗' : 
                                 steps[index] === 'pending' ? '...' : '-'}
                    </div>`;
            });
            stepsHtml += '</div>';
        }

        statusItem.innerHTML = `
            <div>${message}</div>
            ${stepsHtml}
        `;

        statusContent.appendChild(statusItem);
        statusContent.scrollTop = statusContent.scrollHeight;
    }

    // Modified handlePageLoad function
    async function handlePageLoad() {
        loadState();
        
        if (!config.isProcessing) return;

        // Check for error message
        const errorDiv = document.querySelector('.error-message, .error-title, .error-description');
        if (errorDiv && errorDiv.textContent.includes('Não foi possível encontrar voos')) {
            const currentSearch = config.searches[config.currentSearchIndex];
            const retryCount = currentSearch.retryCount || 0;

            updateStatus(
                `No flights found for ${currentSearch.origin} to ${currentSearch.destination} on ${currentSearch.currentDate}`,
                'error',
                [false, null, null]
            );

            if (retryCount < 3) {
                currentSearch.retryCount = retryCount + 1;
                updateStatus(`Retrying search (${retryCount + 1}/3)...`, 'warning');
                saveState();
                setTimeout(processNext, 5000);
                return;
            } else {
                updateStatus('Max retries reached, moving to next search', 'error');
                const failedFlight = {
                    combination_id: `${currentSearch.origin}_${currentSearch.destination}_${currentSearch.currentDate}_${currentSearch.currentReturnDate || ''}_${currentSearch.use_points ? 'points' : 'cash'}_${currentSearch.trip_type}`,
                    trip_type: currentSearch.trip_type,
                    flight_type: currentSearch.trip_type === 'round_trip' ? 'outbound' : 'one_way',
                    outbound_date: currentSearch.currentDate,
                    return_date: currentSearch.currentReturnDate || '',
                    date: currentSearch.currentDate,
                    origin: currentSearch.origin,
                    destination: currentSearch.destination,
                    status: 'failed',
                    retries: 3,
                    use_points: currentSearch.use_points
                };
                
                config.results.push(failedFlight);
                currentSearch.retryCount = 0;
                config.currentDateIndex++;
                saveState();
                setTimeout(processNext, 2000);
                return;
            }
        }

        // Wait for flight cards to appear
        waitForFlightCards().then(async found => {
            if (found) {
                const currentSearch = config.searches[config.currentSearchIndex];
                const isRoundTrip = currentSearch.trip_type === 'round_trip';

                currentSearch.retryCount = 0;

                if (isRoundTrip) {
                    const returnTitle = document.querySelector('#titleSelectFlightDesktop .route-title');
                    const isReturnPage = returnTitle && returnTitle.textContent.trim().toLowerCase() === 'voo de volta';

                    if (isReturnPage) {
                        updateStatus(
                            `Processing return flight for ${currentSearch.destination} to ${currentSearch.origin}`,
                            'info',
                            [true, true, 'pending']
                        );

                        await waitForFlightCards();
                        const flights = extractFlightInfo();
                        if (flights && flights.length) {
                            config.results.push(...flights);
                            updateStatus(
                                `Successfully extracted return flight information`,
                                'success',
                                [true, true, true]
                            );
                            saveState();
                            
                            config.currentDateIndex++;
                            setTimeout(processNext, 2000);
                        } else {
                            updateStatus(
                                `Failed to extract return flight information`,
                                'error',
                                [true, true, false]
                            );
                            const retryCount = currentSearch.retryCount || 0;
                            if (retryCount < 3) {
                                currentSearch.retryCount = retryCount + 1;
                                updateStatus(`Retrying search (${retryCount + 1}/3)...`, 'warning');
                                setTimeout(processNext, 5000);
                            } else {
                                config.currentDateIndex++;
                                setTimeout(processNext, 2000);
                            }
                        }
                    } else {
                        updateStatus(
                            `Processing outbound flight for ${currentSearch.origin} to ${currentSearch.destination}`,
                            'info',
                            [null, null, null]
                        );

                        const outboundFlights = extractFlightInfo();
                        if (outboundFlights && outboundFlights.length) {
                            config.results.push(...outboundFlights);
                            updateStatus(
                                `Successfully extracted outbound flight information`,
                                'success',
                                [true, 'pending', null]
                            );
                            saveState();

                            const cardSelected = await selectCheapestFlightCard();
                            if (cardSelected) {
                                updateStatus(
                                    `Selected outbound flight`,
                                    'info',
                                    [true, 'pending', null]
                                );

                                const tariffListLoaded = await waitForTariffList();
                                if (tariffListLoaded) {
                                    const tariffSelected = await selectCheapestTariff();
                                    if (tariffSelected) {
                                        updateStatus(
                                            `Selected tariff`,
                                            'success',
                                            [true, true, 'pending']
                                        );
                                    } else {
                                        updateStatus(
                                            `Failed to select tariff`,
                                            'error',
                                            [true, false, null]
                                        );
                                        const retryCount = currentSearch.retryCount || 0;
                                        if (retryCount < 3) {
                                            currentSearch.retryCount = retryCount + 1;
                                            updateStatus(`Retrying search (${retryCount + 1}/3)...`, 'warning');
                                            setTimeout(processNext, 5000);
                                        } else {
                                            config.currentDateIndex++;
                                            setTimeout(processNext, 2000);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    updateStatus(
                        `Processing one-way flight for ${currentSearch.origin} to ${currentSearch.destination}`,
                        'info',
                        [null, null, null]
                    );

                    const flights = extractFlightInfo();
                    if (flights && flights.length) {
                        config.results.push(...flights);
                        updateStatus(
                            `Successfully extracted flight information`,
                            'success',
                            [true, null, null]
                        );
                        saveState();
                    } else {
                        updateStatus(
                            `Failed to extract flight information`,
                            'error',
                            [false, null, null]
                        );
                        const retryCount = currentSearch.retryCount || 0;
                        if (retryCount < 3) {
                            currentSearch.retryCount = retryCount + 1;
                            updateStatus(`Retrying search (${retryCount + 1}/3)...`, 'warning');
                            setTimeout(processNext, 5000);
                            return;
                        }
                    }

                    config.currentDateIndex++;
                    setTimeout(processNext, 2000);
                }
            } else {
                const currentSearch = config.searches[config.currentSearchIndex];
                updateStatus(
                    `No flight cards found for ${currentSearch.origin} to ${currentSearch.destination}`,
                    'error',
                    [false, null, null]
                );

                const retryCount = currentSearch.retryCount || 0;
                if (retryCount < 3) {
                    currentSearch.retryCount = retryCount + 1;
                    updateStatus(`Retrying search (${retryCount + 1}/3)...`, 'warning');
                    setTimeout(processNext, 5000);
                } else {
                    config.currentDateIndex++;
                    setTimeout(processNext, 2000);
                }
            }
        });
    }

    // Add UI elements
    function addUI() {
        const container = document.createElement('div');
        container.id = 'scraper-container';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: white;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            width: 350px;
            height: 600px;
            font-family: Arial, sans-serif;
        `;

        // Add draggable header
        const header = document.createElement('div');
        header.className = 'scraper-header';
        header.innerHTML = `
            <h3>LATAM Flight Scraper</h3>
            <div class="header-buttons">
                <button class="minimize-btn" style="padding: 2px 8px; margin-left: 5px;">_</button>
                <button class="close-btn" style="padding: 2px 8px; margin-left: 5px;">×</button>
            </div>
        `;
        container.appendChild(header);

        // Create content wrapper for scrolling
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'form-content';
        container.appendChild(contentWrapper);

        // Create tabs
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = `
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid #ccc;
        `;

        const formTab = document.createElement('div');
        const jsonTab = document.createElement('div');
        [formTab, jsonTab].forEach(tab => {
            tab.style.cssText = `
                padding: 8px 15px;
                cursor: pointer;
                border-radius: 5px 5px 0 0;
                margin-right: 5px;
            `;
        });
        formTab.textContent = 'Form Input';
        jsonTab.textContent = 'JSON Input';

        // Content containers
        const formContent = document.createElement('div');
        const jsonContent = document.createElement('div');

        // Function to switch tabs
        function switchTab(activeTab, activeContent, inactiveTab, inactiveContent) {
            activeTab.style.backgroundColor = '#007bff';
            activeTab.style.color = 'white';
            activeContent.style.display = 'block';
            inactiveTab.style.backgroundColor = '#f8f9fa';
            inactiveTab.style.color = '#333';
            inactiveContent.style.display = 'none';
        }

        formTab.onclick = () => switchTab(formTab, formContent, jsonTab, jsonContent);
        jsonTab.onclick = () => switchTab(jsonTab, jsonContent, formTab, formContent);

        // Create form content
        const form = document.createElement('form');
        form.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 15px;
        `;

        // Basic flight info section
        const basicInfoSection = document.createElement('div');
        basicInfoSection.className = 'form-section';
        basicInfoSection.innerHTML = `
            <h4>Flight Information</h4>
            <div class="input-group-vertical">
                <div class="input-field">
                    <label for="origin">Origin Airport</label>
                    <input type="text" id="origin" placeholder="e.g., GRU" required>
                </div>
                <div class="input-field">
                    <label for="destination">Destination Airport</label>
                    <input type="text" id="destination" placeholder="e.g., MAD" required>
                </div>
            </div>
        `;
        form.appendChild(basicInfoSection);

        // Trip type radio buttons
        const tripTypeContainer = document.createElement('div');
        tripTypeContainer.className = 'form-section';
        tripTypeContainer.innerHTML = `
            <h4>Trip Type</h4>
            <div class="radio-group">
                <label class="radio-label">
                    <input type="radio" name="trip_type" value="one_way" checked>
                    <span>One Way</span>
                </label>
                <label class="radio-label">
                    <input type="radio" name="trip_type" value="round_trip">
                    <span>Round Trip</span>
                </label>
            </div>
        `;
        form.appendChild(tripTypeContainer);

        // Outbound dates section
        const outboundSection = document.createElement('div');
        outboundSection.className = 'form-section';
        outboundSection.innerHTML = `
            <h4>Outbound Flight</h4>
            <div class="date-range">
                <div class="input-field">
                    <label for="outbound_date">Select Dates</label>
                    <input type="text" id="outbound_dates" class="daterangepicker-input" placeholder="Select date range" required>
                </div>
            </div>
        `;
        form.appendChild(outboundSection);

        // Return dates section (hidden by default)
        const returnSection = document.createElement('div');
        returnSection.className = 'form-section return-section';
        returnSection.style.display = 'none';
        returnSection.innerHTML = `
            <h4>Return Flight</h4>
            <div class="date-range">
                <div class="input-field">
                    <label for="return_date">Select Dates</label>
                    <input type="text" id="return_dates" class="daterangepicker-input" placeholder="Select date range">
                </div>
            </div>
        `;
        form.appendChild(returnSection);

        // Points checkbox
        const pointsContainer = document.createElement('div');
        pointsContainer.className = 'form-section';
        pointsContainer.innerHTML = `
            <div class="checkbox-field">
                <label class="checkbox-label">
                    <input type="checkbox" id="use_points">
                    <span>Search using points</span>
                </label>
            </div>
        `;
        form.appendChild(pointsContainer);

        // Add event listener for trip type change
        const tripTypeRadios = form.querySelectorAll('input[name="trip_type"]');
        tripTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                returnSection.style.display = e.target.value === 'round_trip' ? 'block' : 'none';
                // Toggle required attribute for return date inputs
                const returnInputs = returnSection.querySelectorAll('input[type="date"]');
                returnInputs.forEach(input => {
                    input.required = e.target.value === 'round_trip';
                });
            });
        });

        // Create JSON content
        const jsonInput = document.createElement('textarea');
        jsonInput.placeholder = 'Paste your JSON configuration here or use the "Load JSON File" button';
        jsonInput.style.cssText = `
            width: 100%;
            height: 200px;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 3px;
            font-family: monospace;
        `;

        // File input for JSON
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        const fileButton = document.createElement('button');
        fileButton.textContent = 'Load JSON File';
        fileButton.style.cssText = `
            padding: 5px 10px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-bottom: 10px;
            width: 100%;
        `;

        fileButton.onclick = (e) => {
            e.preventDefault();
            fileInput.click();
        };

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        jsonInput.value = JSON.stringify(json, null, 2);
                    } catch (error) {
                        alert('Invalid JSON file');
                    }
                };
                reader.readAsText(file);
            }
        };

        // Action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 15px;
        `;

        const startButton = document.createElement('button');
        startButton.textContent = 'Start Scraping';
        startButton.style.cssText = `
            padding: 8px 15px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            flex: 1;
            font-weight: bold;
        `;

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop Scraping';
        stopButton.style.cssText = `
            padding: 8px 15px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            flex: 1;
            font-weight: bold;
        `;

        startButton.onclick = (e) => {
            e.preventDefault();
            let searchConfig;

            if (jsonContent.style.display === 'block') {
                // Use JSON input
                try {
                    searchConfig = JSON.parse(jsonInput.value);
                } catch (e) {
                    alert('Invalid JSON configuration: ' + e.message);
                    return;
                }
            } else {
                // Use form input
                const tripType = form.querySelector('input[name="trip_type"]:checked').value;
                const outboundDates = document.getElementById('outbound_dates').value.split(' - ');
                const outboundStartDate = outboundDates[0];
                const outboundEndDate = outboundDates[1];

                if (!outboundStartDate || !outboundEndDate) {
                    alert('Please select outbound date range.');
                    return;
                }

                const origin = document.getElementById('origin').value.toUpperCase();
                const destination = document.getElementById('destination').value.toUpperCase();

                if (!origin || !destination) {
                    alert('Please fill in both origin and destination airports.');
                    return;
                }

                const search = {
                    origin: origin,
                    destination: destination,
                        trip_type: tripType,
                        outbound_dates: {
                        start: outboundStartDate,
                        end: outboundEndDate
                        },
                        use_points: document.getElementById('use_points').checked
                };

                // Add return dates if round trip is selected
                if (tripType === 'round_trip') {
                    const returnDates = document.getElementById('return_dates').value.split(' - ');
                    const returnStartDate = returnDates[0];
                    const returnEndDate = returnDates[1];
                    
                    if (!returnStartDate || !returnEndDate) {
                        alert('Please select return date range for round trip flights.');
                        return;
                    }

                    search.return_dates = {
                        start: returnStartDate,
                        end: returnEndDate
                    };
                }

                // Create proper search configuration
                searchConfig = {
                    searches: [search]
                };

                // Log the search configuration for debugging
                logger.log(`Starting search with configuration: ${JSON.stringify(searchConfig)}`, 'info');
            }

            // Clear any existing state before starting
            clearState();
            startScraping(searchConfig);
        };

        stopButton.onclick = () => {
            clearState();
            logger.log('Scraping stopped by user', 'warning');
            window.location.reload();
        };

        // Assemble the UI
        buttonContainer.appendChild(startButton);
        buttonContainer.appendChild(stopButton);

        jsonContent.appendChild(fileButton);
        jsonContent.appendChild(jsonInput);

        formContent.appendChild(form);

        tabContainer.appendChild(formTab);
        tabContainer.appendChild(jsonTab);

        // Move all content into the wrapper
        contentWrapper.appendChild(tabContainer);
        contentWrapper.appendChild(formContent);
        contentWrapper.appendChild(jsonContent);
        contentWrapper.appendChild(buttonContainer);

        document.body.appendChild(container);

        // Initialize draggable and resizable
        $(container).draggable({
            handle: '.scraper-header',
            containment: 'window'
        }).resizable({
            handles: 'all',
            minWidth: 300,
            minHeight: 400,
            containment: 'window'
        });

        // Add minimize/maximize functionality
        let isMinimized = false;
        const originalHeight = container.style.height;
        const minimizeBtn = container.querySelector('.minimize-btn');
        const closeBtn = container.querySelector('.close-btn');

        minimizeBtn.addEventListener('click', () => {
            if (isMinimized) {
                contentWrapper.style.display = 'block';
                container.style.height = originalHeight;
                minimizeBtn.textContent = '_';
            } else {
                contentWrapper.style.display = 'none';
                container.style.height = 'auto';
                minimizeBtn.textContent = '□';
            }
            isMinimized = !isMinimized;
        });

        closeBtn.addEventListener('click', () => {
            container.remove();
        });

        // Save position and size
        function saveUIState() {
            const state = {
                position: $(container).position(),
                size: {
                    width: $(container).width(),
                    height: $(container).height()
                },
                isMinimized
            };
            GM_setValue('uiState', JSON.stringify(state));
        }

        // Load saved position and size
        const savedState = GM_getValue('uiState');
        if (savedState) {
            const state = JSON.parse(savedState);
            container.style.left = state.position.left + 'px';
            container.style.top = state.position.top + 'px';
            container.style.width = state.size.width + 'px';
            container.style.height = state.size.height + 'px';
            if (state.isMinimized) {
                contentWrapper.style.display = 'none';
                container.style.height = 'auto';
                minimizeBtn.textContent = '□';
                isMinimized = true;
            }
        }

        // Save state when dragged or resized
        $(container).on('dragstop resizestop', saveUIState);
    }

    // Initialize date pickers
    function initializeDatePickers() {
        try {
            const commonOptions = {
                autoApply: true,
                locale: {
                    format: 'YYYY-MM-DD'
                },
                opens: 'left',
                showDropdowns: true,
                minDate: moment(),
                maxDate: moment().add(1, 'year'),
                parentEl: 'body'
            };

            if ($('#outbound_dates').length) {
                $('#outbound_dates').daterangepicker(commonOptions);
            }

            if ($('#return_dates').length) {
                $('#return_dates').daterangepicker(commonOptions);
            }

            $('#outbound_dates').on('apply.daterangepicker', function(ev, picker) {
                const returnPicker = $('#return_dates').data('daterangepicker');
                if (returnPicker) {
                    returnPicker.minDate = picker.endDate;
                    returnPicker.startDate = picker.endDate.clone().add(1, 'day');
                    returnPicker.endDate = picker.endDate.clone().add(7, 'days');
                    $('#return_dates').val(
                        returnPicker.startDate.format('YYYY-MM-DD') + ' - ' + 
                        returnPicker.endDate.format('YYYY-MM-DD')
                    );
                }
            });
        } catch (error) {
            console.error('Error initializing date pickers:', error);
        }
    }

    // Initialize
    window.addEventListener('load', () => {
        // Wait for jQuery to be properly loaded
        const checkJQuery = setInterval(() => {
            if (window.jQuery && window.moment && window.jQuery.fn.daterangepicker) {
                clearInterval(checkJQuery);
                addUI();
                createStatusDisplay();
                handlePageLoad();
                setTimeout(initializeDatePickers, 500);
            }
        }, 100);

        // Set a timeout to prevent infinite checking
        setTimeout(() => {
            clearInterval(checkJQuery);
            if (!window.jQuery || !window.moment || !window.jQuery.fn.daterangepicker) {
                updateStatus('Failed to initialize required libraries', 'error');
            }
        }, 10000);
    });
})(); 