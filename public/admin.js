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
// <<< NEW Special Assignment Selectors >>>
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
// Theme Toggle (Button itself is selected below)


// --- State Variables ---
let currentDate = new Date();
let teamMembers = [];
let positions = [];
let unavailableEntries = []; // Stores ALL fetched unavailability entries
let overrideDays = []; // Stores ALL fetched override date strings YYYY-MM-DD
let specialAssignments = []; // <<< NEW: Store special assignments for the current month
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
    console.log("Fetching data...");
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // API expects 1-indexed month

    try {
        // Add fetch for special assignments for the current month/year
        const [membersRes, unavailRes, positionsRes, overridesRes, specialRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'), // Fetches ALL unavailability
            fetch('/api/positions'),
            fetch('/api/overrides'), // Fetches ALL overrides
            fetch(`/api/special-assignments?year=${year}&month=${month}`) // <<< Fetch current month's special assignments
        ]);

        // Check for 401 Unauthorized
        if ([membersRes, unavailRes, positionsRes, overridesRes, specialRes].some(res => res.status === 401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false;
        }

        // Check for other non-OK statuses
        const responses = { membersRes, unavailRes, positionsRes, overridesRes, specialRes };
        let errorMessages = [];
        for (const key in responses) {
            if (!responses[key].ok) {
                errorMessages.push(`${key.replace('Res','')}: ${responses[key].status} ${responses[key].statusText}`);
            }
        }
        if (errorMessages.length > 0) {
            throw new Error(`HTTP error fetching data! Statuses - ${errorMessages.join(', ')}`);
        }

        // Parse and store data
        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json(); // Still need all for calendar check
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json(); // Still need all for calendar check
        specialAssignments = await specialRes.json(); // Store current month's assignments

        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Positions:", positions);
        console.log("Fetched Unavailability (All):", unavailableEntries);
        console.log("Fetched Override Days (All):", overrideDays);
        console.log(`Fetched Special Assignments (Month ${month}/${year}):`, specialAssignments);
        return true;

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        if (!document.body.dataset.fetchErrorShown) {
            alert("Failed to load critical data. Please check the console and try refreshing.");
            document.body.dataset.fetchErrorShown = "true";
        }
        return false;
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

function populateMemberDropdown() { // <<< UPDATED >>>
    // Populate BOTH unavailability and special assignment dropdowns
    const selects = [unavailabilityMemberSelect, specialDayMemberSelect];
    const currentSelections = selects.map(s => s ? s.value : ''); // Handle potential null if element missing

    selects.forEach(select => {
        if (select) select.innerHTML = '<option value="">-- Select Member --</option>';
    });

    const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach(member => {
        selects.forEach((select, index) => {
            if (select) {
                const option = document.createElement('option');
                option.value = member;
                option.textContent = member;
                if (member === currentSelections[index]) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
    });
}


function renderUnavailableList() { /* ... (no change - already filters by month) ... */
    unavailableList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth();
    const filteredEntries = unavailableEntries.filter(entry => { const entryDate = new Date(entry.date + 'T00:00:00Z'); return entryDate.getUTCFullYear() === currentYear && entryDate.getUTCMonth() === currentMonth; });
    filteredEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));
    if (filteredEntries.length === 0) { unavailableList.innerHTML = '<li class="placeholder">No unavailability entered for this month.</li>'; }
    else { filteredEntries.forEach((entry) => { const li = document.createElement('li'); const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString(); li.textContent = `${displayDate} - ${entry.member}`; const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove unavailability for ${entry.member} on ${displayDate}`; removeBtn.onclick = () => removeUnavailability(entry.id); li.appendChild(removeBtn); unavailableList.appendChild(li); }); }
    if (unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';
}
function renderOverrideDaysList() { /* ... (no change - already filters by month) ... */
    overrideDaysList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth();
    const filteredOverrideDays = overrideDays.filter(dateStr => { const overrideDate = new Date(dateStr + 'T00:00:00Z'); return overrideDate.getUTCFullYear() === currentYear && overrideDate.getUTCMonth() === currentMonth; });
    filteredOverrideDays.sort();
    if (filteredOverrideDays.length === 0) { overrideDaysList.innerHTML = '<li class="placeholder">No override days set for this month.</li>'; }
    else { filteredOverrideDays.forEach((dateStr) => { const li = document.createElement('li'); const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString(); const dateSpan = document.createElement('span'); dateSpan.textContent = displayDate; li.appendChild(dateSpan); const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove Override for ${displayDate}`; removeBtn.onclick = () => removeOverrideDay(dateStr); li.appendChild(removeBtn); overrideDaysList.appendChild(li); }); }
    if(overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
}

// <<< NEW: Render Special Assignments List (Uses data already filtered by fetch) >>>
function renderSpecialAssignmentsList() {
    specialAssignmentsList.innerHTML = '';

    // Sort assignments (e.g., by date, then position name)
    specialAssignments.sort((a, b) => a.date.localeCompare(b.date) || a.position.localeCompare(b.position));

    if (specialAssignments.length === 0) {
        specialAssignmentsList.innerHTML = '<li class="placeholder">No special positions assigned for this month.</li>';
    } else {
        specialAssignments.forEach(assignment => {
            const li = document.createElement('li');
            const displayDate = new Date(assignment.date + 'T00:00:00Z').toLocaleDateString();

            const textSpan = document.createElement('span');
            // Using innerHTML to easily apply bold to position name
            textSpan.innerHTML = `${displayDate} - <strong>${assignment.position}:</strong> ${assignment.member}`;
            li.appendChild(textSpan);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove Special Assignment (ID: ${assignment.id})`;
            removeBtn.onclick = () => removeSpecialAssignment(assignment.id);
            li.appendChild(removeBtn);

            specialAssignmentsList.appendChild(li);
        });
    }
     // Remove border from the actual last item
    if (specialAssignmentsList.lastChild) specialAssignmentsList.lastChild.style.borderBottom = 'none';
}


function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... (no change) ... */
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}
function shouldAssignOnDate(dayOfWeek, dateStr) { /* ... (no change) ... */
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// <<< UPDATE: renderCalendar to display special assignments >>>
function renderCalendar(year, month, membersToAssign = teamMembers) {
    calendarBody.innerHTML = '';
    monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();
    assignmentCounter = 0;
    let date = 1;
    const canAssign = membersToAssign && membersToAssign.length > 0;
    const hasPositions = positions && positions.length > 0;

    // Use the current month's special assignments from state
    const currentMonthSpecialAssignments = specialAssignments;

    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            if (week === 0 && dayOfWeek < startDayOfWeek) { cell.classList.add('other-month'); }
            else if (date > daysInMonth) { cell.classList.add('other-month'); }
            else {
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                // --- Regular Assignments ---
                if (canAssign && hasPositions && shouldAssignOnDate(dayOfWeek, currentCellDateStr)) {
                    cell.classList.add('assignment-day');
                    positions.forEach(position => {
                        let assignedMemberName = null;
                        let attempts = 0;
                        while (assignedMemberName === null && attempts < membersToAssign.length) {
                            const potentialMemberIndex = (assignmentCounter + attempts) % membersToAssign.length;
                            const potentialMemberName = membersToAssign[potentialMemberIndex];
                            if (!isMemberUnavailable(potentialMemberName, currentCellDateStr)) {
                                assignedMemberName = potentialMemberName;
                                assignmentCounter = (assignmentCounter + attempts + 1);
                            } else { attempts++; }
                        }
                        const assignmentDiv = document.createElement('div');
                        if (assignedMemberName) {
                            assignmentDiv.classList.add('assigned-position');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                        } else {
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`;
                            if (attempts === membersToAssign.length) { assignmentCounter++; }
                        }
                        cell.appendChild(assignmentDiv);
                    });
                    if (membersToAssign.length > 0) { assignmentCounter %= membersToAssign.length; }
                    else { assignmentCounter = 0; }
                } // End Regular Assignments

                // --- Special Assignments Display ---
                const todaysSpecialAssignments = currentMonthSpecialAssignments.filter(
                    sa => sa.date === currentCellDateStr
                );
                if (todaysSpecialAssignments.length > 0) {
                     todaysSpecialAssignments.sort((a,b) => a.position.localeCompare(b.position)); // Sort for consistent display
                     todaysSpecialAssignments.forEach(sa => {
                         const specialDiv = document.createElement('div');
                         specialDiv.classList.add('special-assignment');
                         specialDiv.innerHTML = `<strong>${sa.position}:</strong> ${sa.member}`;
                         cell.appendChild(specialDiv);
                     });
                     cell.classList.add('has-special-assignment');
                 }
                // --- End Special Assignments Display ---

                date++;
            }
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
         if (date > daysInMonth && week > 0) break;
    }
}


// --- Action Functions (Call APIs & Update UI) ---
async function apiCall(url, options, successCallback) { /* ... no change ... */ }
async function addMember() { /* ... no change ... */ }
async function removeMember(nameToRemove) { /* ... no change ... */ }
async function addPosition() { /* ... no change ... */ }
async function removePosition(positionId) { /* ... no change ... */ }
async function addUnavailability() { /* ... no change ... */ }
async function removeUnavailability(idToRemove) { /* ... no change ... */ }
async function addOverrideDay() { /* ... no change ... */ }
async function removeOverrideDay(dateStr) { /* ... no change ... */ }
async function logout() { /* ... no change ... */ }
async function addUser() { /* ... no change ... */ }


// <<< NEW: Special Assignment Actions >>>
async function addSpecialAssignment() {
    const date = specialDayDateInput.value;
    const position = specialDayPositionInput.value.trim();
    const member = specialDayMemberSelect.value;

    specialAssignmentFeedback.textContent = '';
    specialAssignmentFeedback.className = 'feedback-message';

    if (!date || !position || !member) {
        specialAssignmentFeedback.textContent = 'Please fill in date, position, and member.';
        specialAssignmentFeedback.classList.add('error');
        return;
    }

    addSpecialAssignmentBtn.disabled = true;
    addSpecialAssignmentBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/special-assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, position, member })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            specialAssignmentFeedback.textContent = `Special assignment added successfully!`;
            specialAssignmentFeedback.classList.add('success');
            specialDayDateInput.value = '';
            specialDayPositionInput.value = '';
            specialDayMemberSelect.value = '';
            // Refetch data for the current month and re-render relevant lists/calendar
            if (await fetchData()) {
                renderSpecialAssignmentsList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            }
             setTimeout(() => { specialAssignmentFeedback.textContent = ''; specialAssignmentFeedback.className = 'feedback-message';}, 5000);
        } else {
             specialAssignmentFeedback.textContent = result.message || `Error: ${response.statusText}`;
             specialAssignmentFeedback.classList.add('error');
        }

    } catch (error) {
        console.error("Error adding special assignment:", error);
        specialAssignmentFeedback.textContent = 'Network error adding special assignment.';
        specialAssignmentFeedback.classList.add('error');
    } finally {
        addSpecialAssignmentBtn.disabled = false;
        addSpecialAssignmentBtn.textContent = 'Add Special Position';
    }
}

async function removeSpecialAssignment(assignmentId) {
    if (!assignmentId || !confirm(`Remove this special assignment (ID: ${assignmentId})?`)) return;

    try {
        const response = await fetch(`/api/special-assignments/${assignmentId}`, { method: 'DELETE' });

         if (response.status === 401 || response.status === 403) {
            window.location.href = '/login.html?message=Session expired or insufficient privileges.';
            return;
        }

        if (response.ok || response.status === 404) { // Allow 404 (might be already deleted)
             // Refetch data for current month and re-render
             if (await fetchData()) {
                renderSpecialAssignmentsList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
             }
        } else {
             let errorMsg = `Failed to remove special assignment (${response.status})`;
             try { const result = await response.json(); errorMsg = result.message || errorMsg; } catch(e){}
             alert(errorMsg);
        }
    } catch (error) {
         console.error("Error removing special assignment:", error);
         alert("Network error removing special assignment.");
    }
}


// --- Event Listeners ---
prevMonthBtn.addEventListener('click', async () => { // Make async to wait for fetch
    currentDate.setMonth(currentDate.getMonth() - 1);
    if (await fetchData()) { // Refetch data for the new month
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        renderUnavailableList();
        renderOverrideDaysList();
        renderSpecialAssignmentsList(); // <<< Render special assignments for new month
    }
});

nextMonthBtn.addEventListener('click', async () => { // Make async to wait for fetch
    currentDate.setMonth(currentDate.getMonth() + 1);
    if (await fetchData()) { // Refetch data for the new month
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        renderUnavailableList();
        renderOverrideDaysList();
        renderSpecialAssignmentsList(); // <<< Render special assignments for new month
    }
});

randomizeBtn.addEventListener('click', () => { /* ... no change ... */ });
logoutBtn.addEventListener('click', logout);
// Member listeners
addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addMember(); }});
// Position listeners
addPositionBtn.addEventListener('click', addPosition);
positionNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addPosition(); }});
// Unavailability listener
addUnavailabilityBtn.addEventListener('click', addUnavailability);
// Override Day listeners
addOverrideDayBtn.addEventListener('click', addOverrideDay);
overrideDateInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addOverrideDay(); }});
// User listener
addUserBtn.addEventListener('click', addUser);
newPasswordInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addUser(); }});
// <<< NEW Special Assignment Listener >>>
addSpecialAssignmentBtn.addEventListener('click', addSpecialAssignment);


// --- Theme Toggle ---
function initializeTheme() { /* ... no change ... */ }
function toggleTheme() { /* ... no change ... */ }
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) { themeToggleBtn.addEventListener('click', toggleTheme); }
else { console.warn("Theme toggle button not found in the DOM."); }


// --- Initial Load ---
async function initializeAdminView() {
    console.log("Initializing Admin View...");
    initializeTheme();
    if (await fetchData()) { // Initial fetch uses current month
        console.log("Data fetch successful. Rendering components.");
        renderTeamList();       // Renders all team members
        renderPositionList();   // Renders all positions
        renderUnavailableList(); // Renders current month's unavailability
        renderOverrideDaysList(); // Renders current month's overrides
        renderSpecialAssignmentsList(); // <<< Render current month's special assignments
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    } else {
         console.error("Initialization failed due to data fetch error.");
         document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load application data. Please try refreshing the page. Check console for details.</p>';
    }
}

// Start the application
initializeAdminView();
