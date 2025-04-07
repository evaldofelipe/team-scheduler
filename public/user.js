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
let unavailableEntries = []; // Stores ALL fetched entries
let overrideDays = []; // Stores ALL fetched override date strings YYYY-MM-DD
let specialAssignments = []; // <<< NEW: Stores ALL fetched special assignments
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
function formatDateYYYYMMDD(dateInput) {
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    console.log("Fetching data for user view (including special assignments)...");
    try {
        // <<< UPDATED: Fetch all data including special assignments >>>
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments') // <<< FETCH NEW ENDPOINT
        ]);

        // Check for 401 Unauthorized first
        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes]; // <<< ADDED specialAssignRes
         if (responses.some(res => res.status === 401)) {
             console.warn("User session expired or unauthorized. Redirecting to login.");
             window.location.href = '/login.html?message=Session expired. Please log in.';
             return false;
         }

         // Check for other errors
        const errors = [];
        if (!membersRes.ok) errors.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
        if (!unavailRes.ok) errors.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
        if (!positionsRes.ok) errors.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`);
        if (!overridesRes.ok) errors.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
        if (!specialAssignRes.ok) errors.push(`Special Assignments: ${specialAssignRes.status} ${specialAssignRes.statusText}`); // <<< CHECK new response

        if (errors.length > 0) {
            throw new Error(`HTTP error fetching data! Statuses - ${errors.join(', ')}`);
         }

        // Store all fetched data
        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json(); // Expecting {id, name}
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json(); // <<< STORE new data

        console.log("User View Fetched Team Members:", teamMembers);
        console.log("User View Fetched Positions:", positions);
        console.log("User View Fetched Unavailability (All):", unavailableEntries);
        console.log("User View Fetched Override Days (All):", overrideDays);
        console.log("User View Fetched Special Assignments (All):", specialAssignments); // <<< LOG new data
        return true; // Indicate success

    } catch (error) {
        console.error("Failed to fetch initial data for user view:", error);
        // Avoid alert loops
        if (!document.body.dataset.fetchErrorShown) {
             alert("Failed to load schedule data. Please check the console and try refreshing.");
             document.body.dataset.fetchErrorShown = "true";
        }
        return false; // Indicate failure
    }
}

// --- UI Rendering ---

// Check unavailability against the FULL list
function isMemberUnavailable(memberName, dateYYYYMMDD) {
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

// Check if assignments should happen (default days OR override day) against FULL lists
function shouldAssignOnDate(dayOfWeek, dateStr) {
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// <<< REPLACED renderCalendar with the IDENTICAL version from admin.js >>>
function renderCalendar(year, month, membersToAssign = teamMembers) {
    calendarBody.innerHTML = '';
    monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 6=Sat
    assignmentCounter = 0; // Reset assignment counter for consistent rendering
    let date = 1;
    const canAssign = membersToAssign && membersToAssign.length > 0;
    // Removed hasPositions check here, as special assignments might exist even if standard positions are empty

    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            if (week === 0 && dayOfWeek < startDayOfWeek) {
                cell.classList.add('other-month');
            } else if (date > daysInMonth) {
                cell.classList.add('other-month');
            } else {
                // Valid day cell
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                // --- Determine ALL positions to be assigned for THIS specific day ---
                let positionsForThisDay = [];
                // 1. Add standard positions if it's a standard assignment day or override day
                if (shouldAssignOnDate(dayOfWeek, currentCellDateStr)) {
                    positionsForThisDay = positionsForThisDay.concat(positions); // positions contains {id, name}
                }
                // 2. Add any special assignment slots for this date
                const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);
                todaysSpecialAssignments.forEach(sa => {
                    // Find the full position object (we need id and name)
                    const positionInfo = positions.find(p => p.id === sa.position_id);
                    if (positionInfo) {
                        positionsForThisDay.push(positionInfo); // Add {id, name}
                    } else {
                        // This shouldn't ideally happen if data is consistent, but good to log
                        console.warn(`(User View) Could not find position details for special assignment ID ${sa.id} (position ID ${sa.position_id})`);
                    }
                });

                // Sort the combined list (optional, but good for consistency if duplicates exist)
                positionsForThisDay.sort((a, b) => (positions.find(p => p.id === a.id)?.display_order || 0) - (positions.find(p => p.id === b.id)?.display_order || 0) || a.name.localeCompare(b.name));


                // --- Assign members to the determined positions for the day ---
                if (canAssign && positionsForThisDay.length > 0) {
                    cell.classList.add('assignment-day'); // Mark cell visually

                    positionsForThisDay.forEach(position => { // Iterate over the combined list
                        let assignedMemberName = null;
                        let attempts = 0;
                        // Try to find an available member using round-robin
                        while (assignedMemberName === null && attempts < membersToAssign.length) {
                            const potentialMemberIndex = (assignmentCounter + attempts) % membersToAssign.length;
                            const potentialMemberName = membersToAssign[potentialMemberIndex];

                            if (!isMemberUnavailable(potentialMemberName, currentCellDateStr)) {
                                assignedMemberName = potentialMemberName;
                                assignmentCounter = (assignmentCounter + attempts + 1); // Increment counter *after* successful assignment
                            } else {
                                attempts++; // Member unavailable, try next
                            }
                        } // End while loop

                        const assignmentDiv = document.createElement('div');
                        if (assignedMemberName) {
                            assignmentDiv.classList.add('assigned-position');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                        } else {
                            // No available member found
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`;
                            // Ensure counter advances even if skipped
                            if (attempts === membersToAssign.length) {
                                assignmentCounter++;
                            }
                        }
                        cell.appendChild(assignmentDiv);
                    }); // End positionsForThisDay.forEach

                    // Ensure counter wraps around correctly
                     if (membersToAssign.length > 0) {
                         assignmentCounter %= membersToAssign.length;
                     } else {
                         assignmentCounter = 0;
                     }
                } // End if (canAssign && positionsForThisDay.length > 0)

                date++; // Move to the next date
            } // End else (valid day cell)
            row.appendChild(cell);
        } // End dayOfWeek loop
        calendarBody.appendChild(row);
        if (date > daysInMonth && week > 0) break; // Optimization
    } // End week loop
}


// --- Logout ---
 async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login.html';
        } else {
             const result = await response.json();
             alert(`Logout failed: ${result.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout request failed. Check console.');
    }
}

// --- Event Listeners ---
 prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    // Only need to re-render calendar, user view doesn't have sidebar lists
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
 });
 nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    // Only need to re-render calendar
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
 });
 logoutBtn.addEventListener('click', logout);

 // --- Theme Toggle ---
 function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
     themeToggleBtn.addEventListener('click', toggleTheme);
} else {
    console.warn("Theme toggle button not found in the DOM.");
}

// --- Initial Load ---
async function initializeUserView() {
    console.log("Initializing User View...");
    initializeTheme(); // Set theme early
    if(await fetchData()){ // Fetch all data needed for calendar rendering
        console.log("Data fetch successful. Rendering calendar.");
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Then render calendar
    } else {
        console.error("Initialization failed due to data fetch error.");
        // Display error message if fetch fails
        document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load schedule data. Please try refreshing the page. Check console for details.</p>';
    }
}

// Start the application
initializeUserView();
