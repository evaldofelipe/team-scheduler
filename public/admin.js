// public/admin.js (Corrected)

// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const logoutBtn = document.getElementById('logoutBtn');
// Team Members
const memberNameInput = document.getElementById('memberNameInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const teamList = document.getElementById('team-list');
// Positions
const positionNameInput = document.getElementById('positionNameInput');
const addPositionBtn = document.getElementById('addPositionBtn');
const positionList = document.getElementById('position-list');
// Unavailability
const unavailabilityDateInput = document.getElementById('unavailabilityDate');
const unavailabilityMemberSelect = document.getElementById('unavailabilityMember');
const addUnavailabilityBtn = document.getElementById('addUnavailabilityBtn');
const unavailableList = document.getElementById('unavailable-list');
// Override Days
const overrideDateInput = document.getElementById('overrideDateInput');
const addOverrideDayBtn = document.getElementById('addOverrideDayBtn');
const overrideDaysList = document.getElementById('override-days-list');
// Special Assignment Selectors
const specialDayDateInput = document.getElementById('specialDayDate');
const specialDayPositionInput = document.getElementById('specialDayPositionName');
const specialDayMemberSelect = document.getElementById('specialDayMember');
const addSpecialAssignmentBtn = document.getElementById('addSpecialAssignmentBtn');
const specialAssignmentsList = document.getElementById('special-assignments-list');
const specialAssignmentFeedback = document.getElementById('special-assignment-feedback');
// User Management Selectors
const newUsernameInput = document.getElementById('newUsername');
const newPasswordInput = document.getElementById('newPassword');
const newUserRoleSelect = document.getElementById('newUserRole');
const addUserBtn = document.getElementById('addUserBtn');
const userFeedbackMessage = document.getElementById('user-feedback-message');
// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');


// --- State Variables ---
let currentDate = new Date();
let teamMembers = [];
let positions = [];
let unavailableEntries = []; // Stores ALL fetched unavailability entries
let overrideDays = []; // Stores ALL fetched override date strings YYYY-MM-DD
let specialAssignments = []; // Stores special assignments for the current month
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
function shuffleArray(array) { /* ... no change ... */
    for(let i = array.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
}
function formatDateYYYYMMDD(dateInput) { /* ... no change ... */
     try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction Functions ---
async function fetchData() {
    console.log("Fetching data for month:", currentDate.getMonth() + 1, "/", currentDate.getFullYear());
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // API expects 1-indexed month

    try {
        // Fetch all data needed for the admin view
        const [membersRes, unavailRes, positionsRes, overridesRes, specialRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'), // Fetches ALL unavailability
            fetch('/api/positions'),
            fetch('/api/overrides'), // Fetches ALL overrides
            fetch(`/api/special-assignments?year=${year}&month=${month}`) // Fetch current month's special assignments
        ]);

        // Combine responses for easier checking
        const responses = { membersRes, unavailRes, positionsRes, overridesRes, specialRes };

        // Check for 401 Unauthorized on any response
        if (Object.values(responses).some(res => res.status === 401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false; // Indicate failure, stop further processing
        }

        // Check for other non-OK statuses
        let errorMessages = [];
        for (const key in responses) {
            if (!responses[key].ok) {
                // Add specific error handling or logging if needed for certain endpoints
                errorMessages.push(`${key.replace('Res','')}: ${responses[key].status} ${responses[key].statusText}`);
            }
        }
        if (errorMessages.length > 0) {
            throw new Error(`HTTP error fetching data! Statuses - ${errorMessages.join(', ')}`);
        }

        // Parse and store data - wrap in try...catch in case of unexpected non-JSON response
        try {
            teamMembers = await membersRes.json();
            unavailableEntries = await unavailRes.json();
            positions = await positionsRes.json();
            overrideDays = await overridesRes.json();
            specialAssignments = await specialRes.json();
        } catch (parseError) {
            console.error("Error parsing JSON response during fetchData:", parseError);
            throw new Error("Failed to parse server response. Check server logs and network tab.");
        }


        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Positions:", positions);
        console.log("Fetched Unavailability (All):", unavailableEntries);
        console.log("Fetched Override Days (All):", overrideDays);
        console.log(`Fetched Special Assignments (Month ${month}/${year}):`, specialAssignments);
        return true; // Indicate success

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        if (!document.body.dataset.fetchErrorShown) {
            alert(`Failed to load critical data: ${error.message}. Please check the console and try refreshing.`);
            document.body.dataset.fetchErrorShown = "true";
        }
        return false; // Indicate failure
    }
}

// --- UI Rendering Functions ---

function renderTeamList() { /* ... no change ... */
    teamList.innerHTML = ''; const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach((member) => { const li = document.createElement('li'); li.textContent = member; const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'x'; deleteBtn.title = `Remove ${member}`; deleteBtn.onclick = () => removeMember(member); li.appendChild(deleteBtn); teamList.appendChild(li); });
    if (teamList.lastChild) teamList.lastChild.style.borderBottom = 'none'; populateMemberDropdown();
}
function renderPositionList() { /* ... no change ... */
    positionList.innerHTML = ''; const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
    sortedPositions.forEach(position => { const li = document.createElement('li'); const nameSpan = document.createElement('span'); nameSpan.textContent = position.name; li.appendChild(nameSpan); const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'x'; deleteBtn.title = `Remove Position: ${position.name}`; deleteBtn.onclick = () => removePosition(position.id); li.appendChild(deleteBtn); positionList.appendChild(li); });
    if(positionList.lastChild) positionList.lastChild.style.borderBottom = 'none';
}

function populateMemberDropdown() { /* ... no change ... */
    const selects = [unavailabilityMemberSelect, specialDayMemberSelect];
    const currentSelections = selects.map(s => s ? s.value : '');
    selects.forEach(select => { if (select) select.innerHTML = '<option value="">-- Select Member --</option>'; });
    const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach(member => { selects.forEach((select, index) => { if (select) { const option = document.createElement('option'); option.value = member; option.textContent = member; if (member === currentSelections[index]) { option.selected = true; } select.appendChild(option); } }); });
}


function renderUnavailableList() { /* ... no change (already filters by month) ... */
    unavailableList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth();
    const filteredEntries = unavailableEntries.filter(entry => { const entryDate = new Date(entry.date + 'T00:00:00Z'); return entryDate.getUTCFullYear() === currentYear && entryDate.getUTCMonth() === currentMonth; });
    filteredEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));
    if (filteredEntries.length === 0) { unavailableList.innerHTML = '<li class="placeholder">No unavailability entered for this month.</li>'; }
    else { filteredEntries.forEach((entry) => { const li = document.createElement('li'); const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString(); li.textContent = `${displayDate} - ${entry.member}`; const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove unavailability for ${entry.member} on ${displayDate}`; removeBtn.onclick = () => removeUnavailability(entry.id); li.appendChild(removeBtn); unavailableList.appendChild(li); }); }
    if (unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';
}
function renderOverrideDaysList() { /* ... no change (already filters by month) ... */
    overrideDaysList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth();
    const filteredOverrideDays = overrideDays.filter(dateStr => { const overrideDate = new Date(dateStr + 'T00:00:00Z'); return overrideDate.getUTCFullYear() === currentYear && overrideDate.getUTCMonth() === currentMonth; });
    filteredOverrideDays.sort();
    if (filteredOverrideDays.length === 0) { overrideDaysList.innerHTML = '<li class="placeholder">No override days set for this month.</li>'; }
    else { filteredOverrideDays.forEach((dateStr) => { const li = document.createElement('li'); const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString(); const dateSpan = document.createElement('span'); dateSpan.textContent = displayDate; li.appendChild(dateSpan); const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove Override for ${displayDate}`; removeBtn.onclick = () => removeOverrideDay(dateStr); li.appendChild(removeBtn); overrideDaysList.appendChild(li); }); }
    if(overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
}

function renderSpecialAssignmentsList() { /* ... no change ... */
    specialAssignmentsList.innerHTML = ''; specialAssignments.sort((a, b) => a.date.localeCompare(b.date) || a.position.localeCompare(b.position));
    if (specialAssignments.length === 0) { specialAssignmentsList.innerHTML = '<li class="placeholder">No special positions assigned for this month.</li>'; }
    else { specialAssignments.forEach(assignment => { const li = document.createElement('li'); const displayDate = new Date(assignment.date + 'T00:00:00Z').toLocaleDateString(); const textSpan = document.createElement('span'); textSpan.innerHTML = `${displayDate} - <strong>${assignment.position}:</strong> ${assignment.member}`; li.appendChild(textSpan); const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove Special Assignment (ID: ${assignment.id})`; removeBtn.onclick = () => removeSpecialAssignment(assignment.id); li.appendChild(removeBtn); specialAssignmentsList.appendChild(li); }); }
    if (specialAssignmentsList.lastChild) specialAssignmentsList.lastChild.style.borderBottom = 'none';
}


function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... no change ... */
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}
function shouldAssignOnDate(dayOfWeek, dateStr) { /* ... no change ... */
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

function renderCalendar(year, month, membersToAssign = teamMembers) { /* ... no change ... */
    calendarBody.innerHTML = ''; monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1); const lastDayOfMonth = new Date(year, month + 1, 0); const daysInMonth = lastDayOfMonth.getDate(); const startDayOfWeek = firstDayOfMonth.getDay();
    assignmentCounter = 0; let date = 1; const canAssign = membersToAssign && membersToAssign.length > 0; const hasPositions = positions && positions.length > 0;
    const currentMonthSpecialAssignments = specialAssignments;
    for (let week = 0; week < 6; week++) { const row = document.createElement('tr'); for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) { const cell = document.createElement('td'); if (week === 0 && dayOfWeek < startDayOfWeek) { cell.classList.add('other-month'); } else if (date > daysInMonth) { cell.classList.add('other-month'); } else { const currentCellDate = new Date(Date.UTC(year, month, date)); const currentCellDateStr = formatDateYYYYMMDD(currentCellDate); const dateNumber = document.createElement('span'); dateNumber.classList.add('date-number'); dateNumber.textContent = date; cell.appendChild(dateNumber); if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); } if (canAssign && hasPositions && shouldAssignOnDate(dayOfWeek, currentCellDateStr)) { cell.classList.add('assignment-day'); positions.forEach(position => { let assignedMemberName = null; let attempts = 0; while (assignedMemberName === null && attempts < membersToAssign.length) { const potentialMemberIndex = (assignmentCounter + attempts) % membersToAssign.length; const potentialMemberName = membersToAssign[potentialMemberIndex]; if (!isMemberUnavailable(potentialMemberName, currentCellDateStr)) { assignedMemberName = potentialMemberName; assignmentCounter = (assignmentCounter + attempts + 1); } else { attempts++; } } const assignmentDiv = document.createElement('div'); if (assignedMemberName) { assignmentDiv.classList.add('assigned-position'); assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`; } else { assignmentDiv.classList.add('assignment-skipped'); assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`; if (attempts === membersToAssign.length) { assignmentCounter++; } } cell.appendChild(assignmentDiv); }); if (membersToAssign.length > 0) { assignmentCounter %= membersToAssign.length; } else { assignmentCounter = 0; } } const todaysSpecialAssignments = currentMonthSpecialAssignments.filter( sa => sa.date === currentCellDateStr ); if (todaysSpecialAssignments.length > 0) { todaysSpecialAssignments.sort((a,b) => a.position.localeCompare(b.position)); todaysSpecialAssignments.forEach(sa => { const specialDiv = document.createElement('div'); specialDiv.classList.add('special-assignment'); specialDiv.innerHTML = `<strong>${sa.position}:</strong> ${sa.member}`; cell.appendChild(specialDiv); }); cell.classList.add('has-special-assignment'); } date++; } row.appendChild(cell); } calendarBody.appendChild(row); if (date > daysInMonth && week > 0) break; }
}


// --- Action Functions (Call APIs & Update UI) ---

// <<< UPDATED apiCall Helper with Better Error Handling >>>
async function apiCall(url, options, successCallback) {
    console.log(`API Call: ${options.method || 'GET'} ${url}`);
    try {
        const response = await fetch(url, options);

        // Handle Auth errors first
        if (response.status === 401 || response.status === 403) {
            console.warn(`Unauthorized/Forbidden (${response.status}) access to ${url}. Redirecting.`);
            window.location.href = '/login.html?message=Session expired or insufficient privileges.';
            return; // Stop processing
        }

        // Check for successful responses (including expected 404 on DELETE)
        // NOTE: 201 Created is also considered 'ok' by response.ok
        if (response.ok || (options.method === 'DELETE' && response.status === 404)) {
            console.log(`API call success for ${url} (Status: ${response.status})`);
            // Attempt to refetch ALL data on success/acceptable failure (like 404 on delete)
            // If fetchData fails, an alert would have been shown inside it.
            if (await fetchData()) {
                successCallback(); // Call specific render functions only if fetch succeeded
            }
            return; // Success path finished
        }

        // --- Handle unsuccessful responses (not OK, not 401/403, not 404 on DELETE) ---
        console.error(`API Error for ${url}. Status: ${response.status} ${response.statusText}`);
        let errorMsg = `Operation failed (${response.status}).`; // Default message

        // Try to get more specific error text from the response body
        try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                // Try to parse as JSON
                const errorJson = await response.json();
                errorMsg = errorJson.message || errorJson.error || errorMsg; // Look for common error fields
            } else {
                // Otherwise, try to read as text
                const errorText = await response.text();
                // Use text response only if it's not empty and seems reasonable length
                if (errorText && errorText.length < 200) {
                     errorMsg = errorText;
                } else if (errorText){
                     errorMsg += ` Server sent non-JSON error.`; // Indicate if text was too long/unusable
                } else {
                     errorMsg += ` ${response.statusText || 'Server error'}`; // Fallback if text is empty
                }
            }
        } catch (e) {
            // This catch block handles errors during the parsing of the error response body
            console.error("Error parsing error response body:", e);
            errorMsg += ` Could not parse error details from server.`;
        }

        alert(errorMsg); // Display the best error message we could get

    } catch (error) { // Catch network errors or errors within the outer try block
        console.error(`Network or execution error for ${url}:`, error);
        alert("A network error occurred. Please check the console or try again later.");
    }
}

async function addMember() {
    console.log("Add Member button clicked"); // Debug
    const name = memberNameInput.value.trim(); if (!name) { alert('Please enter a member name.'); return; }
    memberNameInput.value = ''; // Clear input immediately
    memberNameInput.focus();
    await apiCall('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }, () => {
        renderTeamList(); // Re-renders list + calls populateMemberDropdown
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function removeMember(nameToRemove) {
    console.log("Remove Member button clicked for:", nameToRemove); // Debug
    if (!nameToRemove || !confirm(`Remove ${nameToRemove}? This also removes their unavailability & special assignments.`)) return; // Updated confirmation
    await apiCall(`/api/team-members/${encodeURIComponent(nameToRemove)}`, {
        method: 'DELETE'
    }, () => {
        renderTeamList();
        renderUnavailableList();
        renderSpecialAssignmentsList(); // Also re-render special list in case they were removed
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function addPosition() {
    console.log("Add Position button clicked"); // Debug
    const name = positionNameInput.value.trim(); if (!name) { alert('Please enter a position name.'); return; }
    positionNameInput.value = '';
    positionNameInput.focus();
    await apiCall('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }, () => {
        renderPositionList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function removePosition(positionId) {
    console.log("Remove Position button clicked for ID:", positionId); // Debug
    const positionToRemove = positions.find(p => p.id === positionId);
    if (!positionToRemove || !confirm(`Remove Position: "${positionToRemove.name}"? This also removes any special assignments with this name.`)) return; // Updated confirmation
    await apiCall(`/api/positions/${positionId}`, {
        method: 'DELETE'
    }, () => {
        renderPositionList();
        renderSpecialAssignmentsList(); // Re-render special list in case positions were removed
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function addUnavailability() {
    console.log("Add Unavailability button clicked"); // Debug
    const dateValue = unavailabilityDateInput.value;
    const memberName = unavailabilityMemberSelect.value;
    if (!dateValue || !memberName) { alert("Please select both a date and a member."); return; }
    await apiCall('/api/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: memberName, date: dateValue })
    }, () => {
        renderUnavailableList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function removeUnavailability(idToRemove) {
     console.log("Remove Unavailability button clicked for ID:", idToRemove); // Debug
     if (!idToRemove || !confirm(`Remove this unavailability entry?`)) return;
     await apiCall(`/api/unavailability/${idToRemove}`, {
        method: 'DELETE'
     }, () => {
        renderUnavailableList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
     });
}

async function addOverrideDay() {
    console.log("Add Override Day button clicked"); // Debug
    const dateValue = overrideDateInput.value;
    if (!dateValue) { alert("Please select a date to set as an override."); return; }
    overrideDateInput.value = '';
    await apiCall('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateValue })
    }, () => {
        renderOverrideDaysList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function removeOverrideDay(dateStr) {
     console.log("Remove Override Day button clicked for Date:", dateStr); // Debug
     const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString();
     if (!dateStr || !confirm(`Remove override for ${displayDate}? Assignments will revert to default logic for this day.`)) return;
     await apiCall(`/api/overrides/${dateStr}`, {
        method: 'DELETE'
     }, () => {
        renderOverrideDaysList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
     });
}

async function logout() { /* ... no change ... */ }

async function addUser() { /* ... no change ... */ }

async function addSpecialAssignment() { /* ... no change ... */ }

async function removeSpecialAssignment(assignmentId) { /* ... no change ... */ }


// --- Event Listeners ---
// Ensure elements exist before adding listeners
if (prevMonthBtn) prevMonthBtn.addEventListener('click', async () => {
    console.log("Prev Month clicked"); // Debug
    currentDate.setMonth(currentDate.getMonth() - 1);
    if (await fetchData()) { renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); }
});
if (nextMonthBtn) nextMonthBtn.addEventListener('click', async () => {
    console.log("Next Month clicked"); // Debug
    currentDate.setMonth(currentDate.getMonth() + 1);
    if (await fetchData()) { renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); }
});
if (randomizeBtn) randomizeBtn.addEventListener('click', () => { /* ... no change ... */ });
if (logoutBtn) logoutBtn.addEventListener('click', logout);
// Member listeners
if (addMemberBtn) addMemberBtn.addEventListener('click', addMember);
if (memberNameInput) memberNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addMember(); }});
// Position listeners
if (addPositionBtn) addPositionBtn.addEventListener('click', addPosition);
if (positionNameInput) positionNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addPosition(); }});
// Unavailability listener
if (addUnavailabilityBtn) addUnavailabilityBtn.addEventListener('click', addUnavailability);
// Override Day listeners
if (addOverrideDayBtn) addOverrideDayBtn.addEventListener('click', addOverrideDay);
if (overrideDateInput) overrideDateInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addOverrideDay(); }});
// User listener
if (addUserBtn) addUserBtn.addEventListener('click', addUser);
if (newPasswordInput) newPasswordInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addUser(); }});
// Special Assignment Listener
if (addSpecialAssignmentBtn) addSpecialAssignmentBtn.addEventListener('click', addSpecialAssignment);


// --- Theme Toggle ---
function initializeTheme() { /* ... no change ... */ }
function toggleTheme() { /* ... no change ... */ }
if (themeToggleBtn) { themeToggleBtn.addEventListener('click', toggleTheme); }
else { console.warn("Theme toggle button not found in the DOM."); }


// --- Initial Load ---
async function initializeAdminView() {
    console.log("Initializing Admin View...");
    initializeTheme();
    if (await fetchData()) { // Initial fetch uses current month
        console.log("Data fetch successful. Rendering components.");
        renderTeamList();
        renderPositionList();
        renderUnavailableList();
        renderOverrideDaysList();
        renderSpecialAssignmentsList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        console.log("Initial render complete.");
    } else {
         console.error("Initialization failed due to data fetch error.");
         document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load application data. Please try refreshing the page. Check console for details.</p>';
    }
}

// Start the application
initializeAdminView();
