document.addEventListener('DOMContentLoaded', () => {
/**
 * NYC Building Permit Finder
 * Main application JavaScript
 */

// DOM Elements
const permitForm = document.getElementById('permitForm');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingText = document.getElementById('loadingText');
const messageArea = document.getElementById('messageArea');
const resultsContainer = document.getElementById('resultsContainer');
const resultsThead = document.getElementById('resultsThead');
const resultsBody = document.getElementById('resultsBody');
const resultsTitle = document.getElementById('resultsTitle');
const breadcrumbContainer = document.getElementById('breadcrumbContainer');

const toggleColumnFilterButton = document.getElementById('toggleColumnFilterButton');
const columnFilterControls = document.getElementById('columnFilterControls');
const toggleDataFilterButton = document.getElementById('toggleDataFilterButton');
const dataFilterContainer = document.getElementById('dataFilterContainer');
const dataFilterControls = document.getElementById('dataFilterControls');
const clearDataFiltersButton = document.getElementById('clearDataFiltersButton');

const mainContentArea = document.getElementById('mainContentArea'); 
const detailsPanel = document.getElementById('detailsPanel');
const panelTitle = document.getElementById('panelTitle'); 
const panelBody = document.getElementById('panelBody');
const panelExternalLinks = document.getElementById('panelExternalLinks');
const closePanelButton = document.getElementById('closePanelButton');

// Configuration
const API_BASE_URL = 'https://data.cityofnewyork.us/resource/rbx6-tga4.json';
let allFetchedPermits = []; 
let searchHistory = [];
let activeDataFilters = {}; 

// Utility Functions
const getField = (obj, path, defaultValue = 'N/A') => {
    const value = path.split('.').reduce((o, k) => (o && typeof o === 'object' && k in o) ? o[k] : undefined, obj);
    return value !== undefined && value !== null && value !== '' ? value : defaultValue;
};

// Column Configuration
let columnConfig = [
    { id: 'job_filing_number', label: 'Job Filing #', visible: true, alwaysVisible: true, dataKey: 'job_filing_number', filterable: false },
    { id: 'borough', label: 'Borough', visible: true, alwaysVisible: false, dataKey: 'borough', filterable: true },
    { id: 'house_no', label: 'House No', visible: true, alwaysVisible: false, dataKey: 'house_no', filterable: false },
    { id: 'street_name', label: 'Street Name', visible: true, alwaysVisible: false, dataKey: 'street_name', filterable: false },
    { id: 'work_type', label: 'Work Type', visible: true, alwaysVisible: false, dataKey: 'work_type', filterable: true },
    { id: 'issued_date', label: 'Issuance Date', visible: true, alwaysVisible: false, dataKey: 'issued_date', isDate: true, filterable: false },
    { id: 'permittee', label: 'Permittee', visible: true, alwaysVisible: false, customRender: (permit) => `${getField(permit, 'permittee_s_first_name', '')} ${getField(permit, 'permittee_s_last_name', '')}`.trim() || 'N/A', filterable: false },
    { id: 'permit_status', label: 'Status', visible: true, alwaysVisible: false, dataKey: 'permit_status', filterable: true },
];

// Borough Code Mapping
function getBoroughCode(boroughName) {
    if (!boroughName) return null;
    const name = String(boroughName).toUpperCase();
    switch (name) {
        case 'MANHATTAN': return '1';
        case 'BRONX': return '2';
        case 'BROOKLYN': return '3';
        case 'QUEENS': return '4';
        case 'STATEN ISLAND': return '5';
        default: return null; 
    }
}

// Column Filter Functions
function populateColumnFilters() {
    columnFilterControls.innerHTML = '';
    columnConfig.forEach(col => {
        const div = document.createElement('div');
        div.className = 'flex items-center';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `filter-col-${col.id}`;
        input.checked = col.visible;
        input.className = 'h-4 w-4 text-sky-500 border-slate-500 rounded focus:ring-sky-500 bg-slate-700 focus:ring-offset-slate-600';
        if (col.alwaysVisible) input.disabled = true;
        input.addEventListener('change', () => {
            col.visible = input.checked;
            if (allFetchedPermits.length > 0 || (searchHistory.length > 0 && searchHistory[searchHistory.length - 1].results.length > 0) ) {
                 const lastSearchState = searchHistory.length > 0 ? searchHistory[searchHistory.length - 1] : { results: allFetchedPermits, type: 'unknown', displayCriteria: 'Current View' };
                 displayResults(lastSearchState.results, lastSearchState.type, lastSearchState.displayCriteria);
            }
        });
        const label = document.createElement('label');
        label.htmlFor = `filter-col-${col.id}`;
        label.textContent = col.label;
        label.className = 'ml-2 block text-sm text-slate-200';
        div.appendChild(input);
        div.appendChild(label);
        columnFilterControls.appendChild(div);
    });
}

// Event Listeners for Filter Toggles
toggleColumnFilterButton.addEventListener('click', () => columnFilterControls.classList.toggle('hidden'));
toggleDataFilterButton.addEventListener('click', () => dataFilterContainer.classList.toggle('hidden'));

// Data Filter Functions
function populateDataFilters() {
    dataFilterControls.innerHTML = ''; 
    const sourcePermits = (searchHistory.length > 0 && searchHistory[searchHistory.length - 1].results) ? searchHistory[searchHistory.length - 1].results : allFetchedPermits;

    if (!sourcePermits || sourcePermits.length === 0) {
        dataFilterControls.innerHTML = '<p class="text-slate-400 col-span-full text-center py-2">No data to filter. Perform a search first.</p>';
        return;
    }

    columnConfig.filter(col => col.filterable).forEach(filterCol => {
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = filterCol.label;
        fieldset.appendChild(legend);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'filter-options-container space-y-1.5';

        const uniqueValues = [...new Set(sourcePermits.map(permit => getField(permit, filterCol.dataKey)).filter(val => val !== 'N/A' && val !== ''))].sort();

        if (uniqueValues.length === 0) {
            const noOptionsMsg = document.createElement('p');
            noOptionsMsg.className = 'text-xs text-slate-400 italic';
            noOptionsMsg.textContent = 'No filterable values in current results.';
            optionsContainer.appendChild(noOptionsMsg);
        } else {
            uniqueValues.forEach(value => {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `data-filter-${filterCol.id}-${value.replace(/\s+/g, '-')}`;
                input.value = value;
                input.className = 'h-4 w-4 text-sky-500 border-slate-500 rounded focus:ring-sky-500 bg-slate-700 focus:ring-offset-slate-600';
                if (activeDataFilters[filterCol.dataKey] && activeDataFilters[filterCol.dataKey].includes(value)) {
                    input.checked = true;
                }
                input.addEventListener('change', () => {
                    if (!activeDataFilters[filterCol.dataKey]) { 
                        activeDataFilters[filterCol.dataKey] = [];
                    }
                    if (input.checked) {
                        activeDataFilters[filterCol.dataKey].push(value);
                    } else {
                        activeDataFilters[filterCol.dataKey] = activeDataFilters[filterCol.dataKey].filter(v => v !== value);
                        if (activeDataFilters[filterCol.dataKey].length === 0) {
                            delete activeDataFilters[filterCol.dataKey];
                        }
                    }
                    const lastSearchState = searchHistory.length > 0 ? searchHistory[searchHistory.length - 1] : { results: allFetchedPermits, type: 'unknown', displayCriteria: 'Current Results' };
                    displayResults(lastSearchState.results, lastSearchState.type, lastSearchState.displayCriteria);
                });

                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.textContent = value;
                label.className = 'ml-2 block text-sm text-slate-200';
                
                div.appendChild(input);
                div.appendChild(label);
                optionsContainer.appendChild(div);
            });
        }
        fieldset.appendChild(optionsContainer);
        dataFilterControls.appendChild(fieldset);
    });
}

// Clear Data Filters
clearDataFiltersButton.addEventListener('click', () => {
    activeDataFilters = {};
    populateDataFilters(); 
    const lastSearchState = searchHistory.length > 0 ? searchHistory[searchHistory.length - 1] : { results: allFetchedPermits, type: 'unknown', displayCriteria: 'Current Results' };
    displayResults(lastSearchState.results, lastSearchState.type, lastSearchState.displayCriteria); 
});

// Breadcrumb Navigation
function renderBreadcrumbs() {
    breadcrumbContainer.innerHTML = '';
    if (searchHistory.length === 0) return;

    searchHistory.forEach((state, index) => {
        const breadcrumbSpan = document.createElement('span');
        if (index < searchHistory.length - 1) { 
            const anchor = document.createElement('a');
            anchor.href = '#';
            anchor.textContent = state.displayCriteria;
            anchor.className = 'breadcrumb-item text-sky-500 hover:text-sky-400';
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                searchHistory = searchHistory.slice(0, index + 1);
                const restoredState = searchHistory[searchHistory.length - 1];
                allFetchedPermits = restoredState.results; 
                activeDataFilters = {}; 
                populateDataFilters(); 
                displayResults(restoredState.results, restoredState.type, restoredState.displayCriteria);
                renderBreadcrumbs(); 
            });
            breadcrumbSpan.appendChild(anchor);
        } else { 
            breadcrumbSpan.textContent = state.displayCriteria;
            breadcrumbSpan.className = 'breadcrumb-item active text-slate-300';
        }
        breadcrumbContainer.appendChild(breadcrumbSpan);

        if (index < searchHistory.length - 1) {
            const separator = document.createElement('span');
            separator.textContent = ' > ';
            separator.className = 'mx-1.5 text-slate-500';
            breadcrumbContainer.appendChild(separator);
        }
    });
}

// Main Form Submit Handler
document.addEventListener('DOMContentLoaded', () => {
    populateColumnFilters();
    populateDataFilters();
    permitForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        searchHistory = []; 
        allFetchedPermits = []; 
        activeDataFilters = {}; 
        resultsBody.innerHTML = '';
        resultsContainer.classList.add('hidden');
        messageArea.textContent = '';
        messageArea.className = 'text-center my-6 text-slate-300'; 
        resultsTitle.textContent = 'Permit Results'; 
        renderBreadcrumbs(); 

        loadingText.textContent = 'Fetching permits...';
        loadingIndicator.classList.remove('hidden');

        const houseNumberInput = document.getElementById('houseNumber').value.trim();
        const streetNameInputRaw = document.getElementById('streetName').value.trim(); 
        const startDate = document.getElementById('startDate').value;

        if (!houseNumberInput || !streetNameInputRaw) {
            showMessage('House Number and Street Name are required.', 'error');
            loadingIndicator.classList.add('hidden');
            return;
        }
        
        const houseNumberForQuery = houseNumberInput.replace(/'/g, "''");
        const streetNameForQuery = streetNameInputRaw.toUpperCase().replace(/'/g, "''");

        let queryParams = `$where=house_no='${houseNumberForQuery}' AND upper(street_name)='${streetNameForQuery}'`;
        if (startDate) {
            const formattedStartDate = `${startDate}T00:00:00.000`;
            queryParams += ` AND issued_date>='${formattedStartDate}'`;
        }
        queryParams += `&$order=issued_date DESC, job_filing_number DESC&$limit=500`;
        const fullUrl = `${API_BASE_URL}?${queryParams}`;
        
        console.log('Requesting Exact URL:', fullUrl);
        const currentDisplayCriteria = `Address: ${houseNumberInput} ${streetNameInputRaw}`;

        let nearbySearchTriggered = false;
        try {
            const response = await fetch(fullUrl, { headers: { 'Accept': 'application/json' } });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('API Error Response (Exact):', errorData);
                let errorMsg = `Error fetching data: ${response.status} ${response.statusText}`;
                if (errorData && errorData.message) errorMsg += ` - ${errorData.message}`;
                throw new Error(errorMsg);
            }
            const data = await response.json();
            allFetchedPermits = data; 
            searchHistory.push({ type: 'exactAddress', criteria: { houseNumberInput, streetNameInputRaw, startDate }, displayCriteria: currentDisplayCriteria, results: data });

            if (data && data.length > 0) {
                displayResults(data, 'exactAddress', currentDisplayCriteria);
            } else {
                nearbySearchTriggered = true;
                showMessage(`No exact match for ${houseNumberInput} ${streetNameInputRaw}. Searching nearby...`, 'info');
                loadingText.textContent = 'Searching nearby addresses...'; 
                loadingIndicator.classList.remove('hidden'); 
                await searchNearby(houseNumberInput, streetNameForQuery, startDate, streetNameInputRaw);
            }
        } catch (error) {
            console.error('Fetch error (Exact):', error);
            showMessage(`Failed to fetch permits for exact address: ${error.message}. Check console.`, 'error');
            searchHistory.push({ type: 'exactAddress', criteria: { houseNumberInput, streetNameInputRaw, startDate }, displayCriteria: currentDisplayCriteria, results: [] });
            if (!navigator.onLine) { 
                 showMessage('Network offline. Cannot fetch permits.', 'error');
            } else if (error.message.toLowerCase().includes('failed to fetch')) { 
                 showMessage('Failed to connect to the server. Please check your internet connection.', 'error');
            } else { 
                nearbySearchTriggered = true;
                showMessage(`Error on exact match for ${houseNumberInput} ${streetNameInputRaw}. Trying nearby...`, 'info');
                loadingText.textContent = 'Searching nearby addresses...';
                loadingIndicator.classList.remove('hidden');
                await searchNearby(houseNumberInput, streetNameForQuery, startDate, streetNameInputRaw);
            }
        } finally {
            renderBreadcrumbs();
            if (!nearbySearchTriggered) {
                loadingIndicator.classList.add('hidden');
            }
        }
    });
});

// Nearby Search Function
async function searchNearby(originalHouseNumberStr, streetNameForQuery, startDate, originalStreetNameForDisplay) {
    const parsedOriginalHouseNumber = parseInt(originalHouseNumberStr);
    if (isNaN(parsedOriginalHouseNumber)) console.warn('Original house number is not a simple integer, nearby search might not be effective:', originalHouseNumberStr);
    
    activeDataFilters = {}; 

    const searchRadius = 2;
    let nearbyPermitsAccumulator = [];
    const promises = [];
    
    if (!isNaN(parsedOriginalHouseNumber)) {
        for (let i = -searchRadius; i <= searchRadius; i++) {
            if (i === 0) continue; 
            const currentHouseNumber = parsedOriginalHouseNumber + i;
            if (currentHouseNumber <= 0) continue; 
            const currentHouseNumberForQuery = String(currentHouseNumber).replace(/'/g, "''");
            let queryParams = `$where=house_no='${currentHouseNumberForQuery}' AND upper(street_name)='${streetNameForQuery}'`;
            if (startDate) {
                const formattedStartDate = `${startDate}T00:00:00.000`;
                queryParams += ` AND issued_date>='${formattedStartDate}'`;
            }
            queryParams += `&$order=issued_date DESC, job_filing_number DESC&$limit=50`; 
            const nearbyUrl = `${API_BASE_URL}?${queryParams}`;
            promises.push(
                fetch(nearbyUrl, { headers: { 'Accept': 'application/json' } })
                    .then(response => response.ok ? response.json() : Promise.resolve([])) 
                    .catch(err => { console.error(`Fetch error for nearby ${currentHouseNumber} ${originalStreetNameForDisplay}:`, err); return []; })
            );
        }
    }
    
    const currentDisplayCriteria = `Nearby: ${originalHouseNumberStr} ${originalStreetNameForDisplay}`;
    try {
        const resultsFromPromises = await Promise.all(promises);
        resultsFromPromises.forEach(resultArray => { if (Array.isArray(resultArray)) nearbyPermitsAccumulator.push(...resultArray); });
        const uniqueNearbyPermitsMap = new Map();
        nearbyPermitsAccumulator.forEach(permit => { if (permit.job_filing_number && !uniqueNearbyPermitsMap.has(permit.job_filing_number)) uniqueNearbyPermitsMap.set(permit.job_filing_number, permit); });
        const uniqueNearbyPermits = Array.from(uniqueNearbyPermitsMap.values());
        uniqueNearbyPermits.sort((a, b) => new Date(b.issued_date) - new Date(a.issued_date));
        allFetchedPermits = uniqueNearbyPermits; 
        if(searchHistory.length > 0 && searchHistory[searchHistory.length-1].type === 'exactAddress' && searchHistory[searchHistory.length-1].results.length === 0) searchHistory.pop(); 
        searchHistory.push({ type: 'nearbyAddress', criteria: { originalHouseNumberStr, streetNameForQuery, startDate }, displayCriteria: currentDisplayCriteria, results: uniqueNearbyPermits });
        if (uniqueNearbyPermits.length > 0) displayResults(uniqueNearbyPermits, 'nearbyAddress', currentDisplayCriteria);
        else {
             if (isNaN(parsedOriginalHouseNumber) && promises.length === 0) showMessage(`No permits found for ${originalHouseNumberStr} ${originalStreetNameForDisplay}. Nearby search not applicable for this house number format.`, 'info');
            else showMessage(`No permits found for ${originalHouseNumberStr} ${originalStreetNameForDisplay} or the immediate nearby addresses searched.`, 'info');
        }
    } catch (error) {
        console.error('Error processing nearby searches:', error);
        showMessage('An error occurred while searching nearby addresses.', 'error');
        searchHistory.push({ type: 'nearbyAddress', criteria: { originalHouseNumberStr, streetNameForQuery, startDate }, displayCriteria: currentDisplayCriteria, results: [] });
    } finally {
        renderBreadcrumbs();
        loadingIndicator.classList.add('hidden');
    }
}

// Parameter Search Function
async function initiateParameterSearch(searchKey, rawSearchValue, displaySearchValueForTitle) {
    activeDataFilters = {}; 
    resultsBody.innerHTML = '';
    resultsContainer.classList.add('hidden');
    messageArea.textContent = '';
    messageArea.className = 'text-center my-6 text-slate-300';

    const searchKeyDisplay = searchKey.replace(/_/g, ' ');
    const currentDisplayCriteria = `Parameter: ${searchKeyDisplay} = ${displaySearchValueForTitle}`;
    resultsTitle.textContent = `Permits for ${searchKeyDisplay}: ${displaySearchValueForTitle}`; 
    loadingText.textContent = `Fetching permits with ${searchKeyDisplay}: ${displaySearchValueForTitle}...`;
    loadingIndicator.classList.remove('hidden');

    const soqlSearchValue = String(rawSearchValue).replace(/'/g, "''");
    let queryParams = `$where=${searchKey}='${soqlSearchValue}'`;
    const lastSearchState = searchHistory.length > 0 ? searchHistory[searchHistory.length - 1] : null;
    const activeStartDate = lastSearchState && lastSearchState.criteria && lastSearchState.criteria.startDate ? lastSearchState.criteria.startDate : null;
    if (activeStartDate) {
         const formattedStartDate = `${activeStartDate}T00:00:00.000`;
         queryParams += ` AND issued_date>='${formattedStartDate}'`;
    }
    queryParams += `&$order=issued_date DESC, job_filing_number DESC&$limit=500`; 
    const fullUrl = `${API_BASE_URL}?${queryParams}`;
    console.log(`Requesting Parameter URL (${searchKey}=${rawSearchValue}):`, fullUrl);

    try {
        const response = await fetch(fullUrl, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error(`API Error Response (Parameter Search ${searchKey}):`, errorData);
            let errorMsg = `Error fetching data: ${response.status} ${response.statusText}`;
            if (errorData && errorData.message) errorMsg += ` - ${errorData.message}`;
            throw new Error(errorMsg);
        }
        const data = await response.json();
        allFetchedPermits = data; 
        searchHistory.push({ type: 'parameter', criteria: { searchKey, rawSearchValue, activeStartDate }, displayCriteria: currentDisplayCriteria, results: data });
        if (data && data.length > 0) displayResults(data, 'parameter', currentDisplayCriteria);
        else showMessage(`No permits found with ${searchKeyDisplay}: ${displaySearchValueForTitle}.`, 'info');
    } catch (error) {
        console.error(`Fetch error (Parameter Search ${searchKey}):`, error);
        showMessage(`Failed to fetch permits for ${searchKeyDisplay} (${displaySearchValueForTitle}): ${error.message}. Check console.`, 'error');
        searchHistory.push({ type: 'parameter', criteria: { searchKey, rawSearchValue, activeStartDate }, displayCriteria: currentDisplayCriteria, results: [] });
    } finally {
        renderBreadcrumbs();
        loadingIndicator.classList.add('hidden');
    }
}

// Data Filter Application
function applyActiveDataFilters(permitsToFilter) {
    if (Object.keys(activeDataFilters).length === 0) {
        return permitsToFilter; 
    }
    return permitsToFilter.filter(permit => {
        for (const columnKey in activeDataFilters) { 
            const filterValues = activeDataFilters[columnKey];
            if (filterValues.length === 0) continue; 

            const permitValue = getField(permit, columnKey); 
            if (!filterValues.includes(String(permitValue))) {
                return false; 
            }
        }
        return true; 
    });
}

// Display Results Function
function displayResults(rawPermits, searchType = 'exactAddress', searchCriteriaDisplay = "") {
    resultsThead.innerHTML = ''; 
    resultsBody.innerHTML = ''; 

    const filteredPermits = applyActiveDataFilters(rawPermits);
    populateDataFilters(); 

    if (!filteredPermits || filteredPermits.length === 0) {
        resultsContainer.classList.add('hidden');
         if (Object.keys(activeDataFilters).length > 0) {
            showMessage(`No permits match the current data filters for "${searchCriteriaDisplay}". Try adjusting data filters.`, 'info');
        } else {
            showMessage(`No permits found for "${searchCriteriaDisplay}".`, 'info');
        }
        return;
    }

    resultsContainer.classList.remove('hidden');
    resultsTitle.textContent = searchCriteriaDisplay; 

    const headerRow = resultsThead.insertRow();
    columnConfig.forEach(col => {
        if (col.visible) {
            const th = document.createElement('th');
            th.scope = 'col';
            th.className = 'px-3 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider';
            th.textContent = col.label;
            headerRow.appendChild(th);
        }
    });

    filteredPermits.forEach((permit) => { 
        const row = resultsBody.insertRow();
        row.className = 'hover:bg-slate-500 transition-colors duration-150'; 
        
        const formatDate = (dateString) => { 
            if (!dateString || dateString === 'N/A') return 'N/A';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return dateString;
                if (date.toISOString().endsWith("T00:00:00.000Z") || dateString.length === 10) { 
                     return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
                }
                return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            } catch (e) { return dateString; }
        };
        
        columnConfig.forEach(col => {
            if (col.visible) {
                const cell = row.insertCell();
                cell.className = 'px-3 py-3 whitespace-nowrap text-sm text-slate-200'; 
                if (col.id === 'job_filing_number') {
                    const jobFilingLink = document.createElement('a');
                    jobFilingLink.href = '#';
                    jobFilingLink.textContent = getField(permit, col.dataKey); 
                    jobFilingLink.className = 'job-filing-link text-sky-400 hover:text-sky-300';
                    const originalPermitIndex = allFetchedPermits.findIndex(p => p.job_filing_number === permit.job_filing_number);
                    jobFilingLink.setAttribute('data-permit-index', originalPermitIndex);

                    jobFilingLink.addEventListener('click', function(e) {
                        e.preventDefault();
                        const permitIndexToOpen = parseInt(this.getAttribute('data-permit-index'));
                        if (permitIndexToOpen !== -1 && allFetchedPermits[permitIndexToOpen]) {
                            openDetailsPanel(allFetchedPermits[permitIndexToOpen]);
                        } else {
                            console.error("Could not find permit in allFetchedPermits for panel. Using current permit from filtered list.");
                            openDetailsPanel(permit);
                        }
                    });
                    cell.appendChild(jobFilingLink);
                } else if (col.customRender) {
                    cell.textContent = col.customRender(permit); 
                } else if (col.isDate) {
                    cell.textContent = formatDate(getField(permit, col.dataKey)); 
                } else {
                    cell.textContent = getField(permit, col.dataKey); 
                }
            }
        });
    });
    
    const maxResults = 500; 
    const baseMessage = `${filteredPermits.length} permit(s) found for ${searchCriteriaDisplay}.`;
    const filterMessage = Object.keys(activeDataFilters).length > 0 ? ` (after applying data filters)` : '';
    
    if (searchType === 'parameter') {
        showMessage(`${baseMessage}${filterMessage} Displaying up to ${maxResults}.`, 'success');
    } else if (searchType === 'nearbyAddress') {
         showMessage(`${baseMessage}${filterMessage} Each nearby address scanned for up to 50 permits.`, 'success');
    } else { 
        showMessage(`${baseMessage}${filterMessage} Displaying up to ${maxResults} newest.`, 'success');
    }
}

// Searchable Parameter Check
function isSearchableParameter(key, value) {
    if (value === 'N/A' || value === null || String(value).trim() === '') return false;
    const nonSearchableKeys = [
        'job_filing_number', 'bin', 'block', 'lot', 
        'job_description', 
        'issued_date', 'expired_date', 'approved_date', 
        'house_no', 
    ];
    if (nonSearchableKeys.includes(key)) return false;
    if (String(value).length > 75) return false; 
    return true; 
}

// Details Panel Functions
function openDetailsPanel(permit) { 
    panelBody.innerHTML = ''; 
    panelExternalLinks.innerHTML = ''; 
    panelTitle.textContent = `Details: ${getField(permit, 'job_filing_number', 'Permit')}`;

    const detailsFragment = document.createDocumentFragment();
    const importantKeys = [
        'job_filing_number', 'borough', 'house_no', 'street_name', 'block', 'lot', 'bin',
        'work_type', 'job_description', 'permit_status', 'issued_date', 'expired_date',
        'permittee_s_first_name', 'permittee_s_last_name', 'permittee_s_business_name', 'permittee_s_license_type',
        'owner_name', 'owner_business_name' 
    ];
    
    const displayedKeys = new Set();
    importantKeys.forEach(key => {
        if (Object.hasOwnProperty.call(permit, key)) {
            addDetailItemToFragment(detailsFragment, key, permit[key], permit);
            displayedKeys.add(key);
        }
    });
    for (const key in permit) {
        if (Object.hasOwnProperty.call(permit, key) && !displayedKeys.has(key)) {
             addDetailItemToFragment(detailsFragment, key, permit[key], permit);
        }
    }
    panelBody.appendChild(detailsFragment);

    const jobFilingNumber = permit.job_filing_number;
    const binFromPermit = permit.bin;
    const boroughNameFromPermit = permit.borough;
    const blockFromPermit = permit.block;
    const lotFromPermit = permit.lot;

    if (jobFilingNumber && jobFilingNumber !== 'N/A') {
        addExternalLinkToPanel(`https://a810-dobnow.nyc.gov/publish/Index.html#!/search?tab=Job`, `DOB NOW Public Portal (Search Job #: ${jobFilingNumber})`);
        addExternalLinkToPanel(`https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${encodeURIComponent(jobFilingNumber)}&allbin=&allcount=1`, `BIS: Job Details (Job #: ${jobFilingNumber})`);
    }
    if (binFromPermit && binFromPermit !== 'N/A') {
        addExternalLinkToPanel(`https://a810-dobnow.nyc.gov/publish/Index.html#!/search?tab=Address`, `DOB NOW Public Portal (Search BIN: ${binFromPermit})`);
        addExternalLinkToPanel(`https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin=${encodeURIComponent(binFromPermit)}&bbl=&requestid=0`, `BIS: Property Profile (BIN: ${binFromPermit})`);
    }
    const boroughCodeForZoLa = getBoroughCode(boroughNameFromPermit);
    if (boroughCodeForZoLa && blockFromPermit && blockFromPermit !== 'N/A' && lotFromPermit && lotFromPermit !== 'N/A') {
        addExternalLinkToPanel(`https://zola.planning.nyc.gov/lot/${boroughCodeForZoLa}/${blockFromPermit}/${lotFromPermit}`, `ZoLa: Zoning & Land Use (Lot: ${boroughNameFromPermit} B:${blockFromPermit} L:${lotFromPermit})`);
    } else if (binFromPermit && binFromPermit !== 'N/A') {
        addExternalLinkToPanel(`https://zola.planning.nyc.gov/`, `ZoLa: Zoning & Land Use (Search by BIN: ${binFromPermit} or address)`);
    } else {
        addExternalLinkToPanel(`https://zola.planning.nyc.gov/`, `ZoLa: Zoning & Land Use (Search by address)`);
    }
    if (panelExternalLinks.children.length === 0) {
        panelExternalLinks.textContent = "No specific identifiers (Job # or BIN) available for direct linking to all portals.";
    }

    detailsPanel.classList.add('active');
}

function addDetailItemToFragment(fragment, key, rawValue, permitObject) { 
    const detailItem = document.createElement('div');
    detailItem.className = 'grid grid-cols-3 gap-x-2 gap-y-1 py-1.5 border-b border-slate-700 last:border-b-0';
    
    const keySpan = document.createElement('span');
    keySpan.className = 'font-medium text-slate-400 col-span-1 capitalize truncate';
    const displayKey = key.replace(/_/g, ' ');
    keySpan.textContent = displayKey;
    keySpan.title = displayKey; 
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'text-slate-100 col-span-2 break-words'; 
    let displayValue = (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') ? 'N/A' : String(rawValue);
    
    if (key.includes('date') && displayValue !== 'N/A' && displayValue.match(/^\d{4}-\d{2}-\d{2}/)) {
         try {
            displayValue = new Date(displayValue).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
         } catch (e) { /* ignore, use original */ }
    }
    valueSpan.textContent = displayValue;

    if (isSearchableParameter(key, rawValue)) {
        valueSpan.classList.add('clickable-value');
        valueSpan.title = `Search for other permits with ${displayKey}: ${displayValue}`;
        valueSpan.addEventListener('click', () => {
            closeDetailsPanel(); 
            initiateParameterSearch(key, rawValue, displayValue); 
        });
    }
    
    detailItem.appendChild(keySpan);
    detailItem.appendChild(valueSpan);
    fragment.appendChild(detailItem);
}

function addExternalLinkToPanel(href, text) { 
    const link = document.createElement('a');
    link.href = href;
    link.textContent = text;
    link.className = 'block text-sky-400 hover:text-sky-300 hover:underline text-sm'; 
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    panelExternalLinks.appendChild(link);
}

function closeDetailsPanel() { 
    detailsPanel.classList.remove('active');
}

closePanelButton.addEventListener('click', closeDetailsPanel);
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && detailsPanel.classList.contains('active')) {
        closeDetailsPanel();
    }
});

function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.classList.remove('text-red-400', 'text-green-400', 'text-sky-400');
    if (type === 'error') {
        messageArea.classList.add('text-red-400');
    } else if (type === 'success') {
        messageArea.classList.add('text-green-400');
    } else { 
        messageArea.classList.add('text-sky-400');
    }
}

    // Initialize
    populateColumnFilters();
    populateDataFilters();

    permitForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        searchHistory = []; 
        allFetchedPermits = []; 
        activeDataFilters = {}; 
        resultsBody.innerHTML = '';
        resultsContainer.classList.add('hidden');
        messageArea.textContent = '';
        messageArea.className = 'text-center my-6 text-slate-300'; 
        resultsTitle.textContent = 'Permit Results'; 
        renderBreadcrumbs(); 

        loadingText.textContent = 'Fetching permits...';
        loadingIndicator.classList.remove('hidden');

        const houseNumberInput = document.getElementById('houseNumber').value.trim();
        const streetNameInputRaw = document.getElementById('streetName').value.trim(); 
        const startDate = document.getElementById('startDate').value;

        if (!houseNumberInput || !streetNameInputRaw) {
            showMessage('House Number and Street Name are required.', 'error');
            loadingIndicator.classList.add('hidden');
            return;
        }
        
        const houseNumberForQuery = houseNumberInput.replace(/'/g, "''");
        const streetNameForQuery = streetNameInputRaw.toUpperCase().replace(/'/g, "''");

        let queryParams = `$where=house_no='${houseNumberForQuery}' AND upper(street_name)='${streetNameForQuery}'`;
        if (startDate) {
            const formattedStartDate = `${startDate}T00:00:00.000`;
            queryParams += ` AND issued_date>='${formattedStartDate}'`;
        }
        queryParams += `&$order=issued_date DESC, job_filing_number DESC&$limit=500`;
        const fullUrl = `${API_BASE_URL}?${queryParams}`;
        
        console.log('Requesting Exact URL:', fullUrl);
        const currentDisplayCriteria = `Address: ${houseNumberInput} ${streetNameInputRaw}`;

        let nearbySearchTriggered = false;
        try {
            const response = await fetch(fullUrl, { headers: { 'Accept': 'application/json' } });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('API Error Response (Exact):', errorData);
                let errorMsg = `Error fetching data: ${response.status} ${response.statusText}`;
                if (errorData && errorData.message) errorMsg += ` - ${errorData.message}`;
                throw new Error(errorMsg);
            }
            const data = await response.json();
            allFetchedPermits = data; 
            searchHistory.push({ type: 'exactAddress', criteria: { houseNumberInput, streetNameInputRaw, startDate }, displayCriteria: currentDisplayCriteria, results: data });

            if (data && data.length > 0) {
                displayResults(data, 'exactAddress', currentDisplayCriteria);
            } else {
                nearbySearchTriggered = true;
                showMessage(`No exact match for ${houseNumberInput} ${streetNameInputRaw}. Searching nearby...`, 'info');
                loadingText.textContent = 'Searching nearby addresses...'; 
                loadingIndicator.classList.remove('hidden'); 
                await searchNearby(houseNumberInput, streetNameForQuery, startDate, streetNameInputRaw);
            }
        } catch (error) {
            console.error('Fetch error (Exact):', error);
            showMessage(`Failed to fetch permits for exact address: ${error.message}. Check console.`, 'error');
            searchHistory.push({ type: 'exactAddress', criteria: { houseNumberInput, streetNameInputRaw, startDate }, displayCriteria: currentDisplayCriteria, results: [] });
            if (!navigator.onLine) { 
                 showMessage('Network offline. Cannot fetch permits.', 'error');
            } else if (error.message.toLowerCase().includes('failed to fetch')) { 
                 showMessage('Failed to connect to the server. Please check your internet connection.', 'error');
            } else { 
                nearbySearchTriggered = true;
                showMessage(`Error on exact match for ${houseNumberInput} ${streetNameInputRaw}. Trying nearby...`, 'info');
                loadingText.textContent = 'Searching nearby addresses...';
                loadingIndicator.classList.remove('hidden');
                await searchNearby(houseNumberInput, streetNameForQuery, startDate, streetNameInputRaw);
            }
        } finally {
            renderBreadcrumbs();
            if (!nearbySearchTriggered) {
                loadingIndicator.classList.add('hidden');
            }
        }
    });
});
