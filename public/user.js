// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const logoutBtn = document.getElementById('logoutBtn');
// Theme Toggle (Button itself is selected below)

// --- State Variables ---
let currentDate = new Date();
let teamMembers = [];
let positions = [];
let unavailableEntries = []; // Stores ALL fetched unavailability entries
let overrideDays = []; // Stores ALL fetched override date strings
let specialAssignments = []; // <<< NEW: Store special assignments for the current month
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
 function formatDateYYYYMMDD(dateInput) { /* ... no change ... */
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() { // <<< UPDATED >>>
    console.log("Fetching data for user view...");
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // API expects 1-indexed month

    try {
        // Fetch all data needed to render the calendar accurately
        const [membersRes, unavailRes, positionsRes, overridesRes, specialRes] = await Promise.all([ // <<< Added specialRes
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch(`/api/special-assignments?year=${year}&month=${month}`) // <<< Fetch special assignments
        ]);

         // Check for 401 Unauthorized first
         if ([membersRes, unavailRes, positionsRes, overridesRes, specialRes].some(res => res.status === 401)) { // <<< Added specialRes check
             console.warn("User session expired or unauthorized. Redirecting to login.");
             window.location.href = '/login.html?message=Session expired. Please log in.';
             return false;
         }

         // Check for other errors
        const responses = { membersRes, unavailRes, positionsRes, overridesRes, specialRes }; // <<< Added specialRes
        let errorMessages = [];
        for (const key in responses) {
            if (!responses[key].ok) {
                errorMessages.push(`${key.replace('Res','')}: ${responses[key].status} ${responses[key].statusText}`);
            }
        }
        if (errorMessages.length > 0) {
            throw new Error(`HTTP error fetching data! Statuses - ${errorMessages.join(', ')}`);
        }

        // Store all fetched data
        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json();
        specialAssignments = await specialRes.json(); // <<< Store special assignments

        console.log("User View Fetched Team Members:", teamMembers);
        console.log("User View Fetched Positions:", positions);
        console.log("User View Fetched Unavailability (All):", unavailableEntries);
        console.log("User View Fetched Override Days (All):", overrideDays);
        console.log(`User View Fetched Special Assignments (Month ${month}/${year}):`, specialAssignments); // <<< Log special assignments
        return true; // Indicate success

    } catch (error) {
        console.error("Failed to fetch initial data for user view:", error);
        if (!document.body.dataset.fetchErrorShown) {
             alert("Failed to load schedule data. Please check the console and try refreshing.");
             document.body.dataset.fetchErrorShown = "true";
        }
        return false; // Indicate failure
    }
}

// --- UI Rendering ---
// These functions need to be IDENTICAL to admin.js to ensure consistent calendar display

function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... no change ... */
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

function shouldAssignOnDate(dayOfWeek, dateStr) { /* ... no change ... */
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// renderCalendar function is identical to admin.js version <<< UPDATED >>>
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

                // --- Special Assignments Display --- <<< ADDED >>>
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

// --- Logout ---
 async function logout() { /* ... no change ... */
    try { const response = await fetch('/logout', { method: 'POST' }); if (response.ok) { window.location.href = '/login.html'; } else { const result = await response.json(); alert(`Logout failed: ${result.message || 'Unknown error'}`); } } catch (error) { console.error('Logout error:', error); alert('Logout request failed. Check console.'); }
}

// --- Event Listeners ---
 prevMonthBtn.addEventListener('click', async () => { // <<< UPDATED: Make async and call fetchData >>>
    currentDate.setMonth(currentDate.getMonth() - 1);
    if (await fetchData()) { // Refetch data for the new month
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }
 });
 nextMonthBtn.addEventListener('click', async () => { // <<< UPDATED: Make async and call fetchData >>>
    currentDate.setMonth(currentDate.getMonth() + 1);
    if (await fetchData()) { // Refetch data for the new month
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }
 });
 logoutBtn.addEventListener('click', logout);

 // --- Theme Toggle ---
 function initializeTheme() { /* ... no change ... */ }
 function toggleTheme() { /* ... no change ... */ }
 const themeToggleBtn = document.getElementById('theme-toggle');
 if (themeToggleBtn) { themeToggleBtn.addEventListener('click', toggleTheme); }
 else { console.warn("Theme toggle button not found in the DOM."); }

// --- Initial Load ---
async function initializeUserView() { // <<< UPDATED >>>
    console.log("Initializing User View...");
    initializeTheme(); // Set theme early
    if(await fetchData()){ // Initial fetch includes special assignments for current month
        console.log("Data fetch successful. Rendering calendar.");
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    } else {
        console.error("Initialization failed due to data fetch error.");
        document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load schedule data. Please try refreshing the page. Check console for details.</p>';
    }
}

// Start the application
initializeUserView();
