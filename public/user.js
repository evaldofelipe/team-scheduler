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
let positions = []; // Now expects {id, name, display_order, assignment_type, allowed_days}
let unavailableEntries = [];
let overrideDays = [];
let specialAssignments = [];
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat (Still needed for 'regular' type)
// const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Not strictly needed for rendering here

// --- Helper Functions ---
function formatDateYYYYMMDD(dateInput) { /* ... unchanged ... */
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    console.log("Fetching data for user view (including position config & special assignments)...");
    try {
        // Fetch all data needed, including updated positions and special assignments
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'), // <<< Will get new fields
            fetch('/api/overrides'),
            fetch('/api/special-assignments')
        ]);

        // Check for 401 Unauthorized first
        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes];
         if (responses.some(res => res.status === 401)) {
             console.warn("User session expired or unauthorized. Redirecting to login.");
             window.location.href = '/login.html?message=Session expired. Please log in.';
             return false;
         }

         // Check for other errors
        const errors = [];
        if (!membersRes.ok) errors.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
        if (!unavailRes.ok) errors.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
        if (!positionsRes.ok) errors.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`); // <<< Check positions
        if (!overridesRes.ok) errors.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
        if (!specialAssignRes.ok) errors.push(`Special Assignments: ${specialAssignRes.status} ${specialAssignRes.statusText}`);

        if (errors.length > 0) { throw new Error(`HTTP error fetching data! Statuses - ${errors.join(', ')}`); }

        // Store all fetched data
        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json(); // <<< Store positions with new fields
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json();

        console.log("User View Fetched Positions (with config):", positions); // Log updated positions
        // ... other logs ...
        return true; // Indicate success

    } catch (error) { /* ... error handling unchanged ... */
        console.error("Failed to fetch initial data for user view:", error); if (!document.body.dataset.fetchErrorShown) { alert("Failed to load schedule data..."); document.body.dataset.fetchErrorShown = "true"; } return false;
    }
}

// --- UI Rendering ---

// Check unavailability against the FULL list
function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... unchanged ... */
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

// Removed shouldAssignOnDate - logic is now within renderCalendar

// <<< REPLACED renderCalendar with the IDENTICAL version from the updated admin.js >>>
function renderCalendar(year, month, membersToAssign = teamMembers) {
    calendarBody.innerHTML = '';
    monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 6=Sat
    assignmentCounter = 0;
    let date = 1;
    const canAssign = membersToAssign && membersToAssign.length > 0;

    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            if (week === 0 && dayOfWeek < startDayOfWeek || date > daysInMonth) {
                cell.classList.add('other-month');
            } else {
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate); // YYYY-MM-DD format

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                // --- Determine ALL positions for THIS specific day based on NEW rules ---
                let positionsForThisDay = [];
                const isOverrideDay = overrideDays.includes(currentCellDateStr);

                // 1. Check each standard position based on its type
                positions.forEach(position => {
                    let shouldAdd = false;
                    if (position.assignment_type === 'regular') {
                        // Regular: Assign on default days OR on an override day
                        shouldAdd = DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || isOverrideDay;
                    } else if (position.assignment_type === 'specific_days') {
                        // Specific Days: Assign only if the current day is in its allowed list
                        const allowed = position.allowed_days ? position.allowed_days.split(',') : [];
                        shouldAdd = allowed.includes(dayOfWeek.toString());
                    }
                    if (shouldAdd) {
                        positionsForThisDay.push(position); // Add {id, name, ...}
                    }
                });

                // 2. Add any special assignment slots for this date (these are always added regardless of day rules)
                const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);
                todaysSpecialAssignments.forEach(sa => {
                    const positionInfo = positions.find(p => p.id === sa.position_id);
                    if (positionInfo) {
                        positionsForThisDay.push(positionInfo); // Add {id, name, ...}
                    } else { console.warn(`(User View) Could not find position details for special assignment ID ${sa.id}`); }
                });

                // Sort the combined list (by display_order, then name)
                positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

                // --- Assign members if applicable ---
                if (canAssign && positionsForThisDay.length > 0) {
                    cell.classList.add('assignment-day'); // Mark cell visually if any assignments happen

                    positionsForThisDay.forEach(position => {
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
                } // End if assignments needed

                date++;
            } // End else valid day cell
            row.appendChild(cell);
        } // End day loop
        calendarBody.appendChild(row);
        if (date > daysInMonth && week > 0) break;
    } // End week loop
}


// --- Logout ---
 async function logout() { /* ... unchanged ... */
    try { const response = await fetch('/logout', { method: 'POST' }); if (response.ok) { window.location.href = '/login.html'; } else { const result = await response.json(); alert(`Logout failed: ${result.message || 'Unknown error'}`); } } catch (error) { console.error('Logout error:', error); alert('Logout request failed. Check console.'); }
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
    
    // Update button text/icon based on current theme
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Update theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update button text/icon
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
}

// Add theme toggle event listener
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
} else {
    console.warn("Theme toggle button not found in the DOM.");
}

// --- Initial Load ---
async function initializeUserView() {
    console.log("Initializing User View...");
    initializeTheme();
    if(await fetchData()){ // Fetch all data including new position config
        console.log("Data fetch successful. Rendering calendar.");
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Render calendar using new logic
    } else {
        console.error("Initialization failed due to data fetch error.");
        document.getElementById('scheduler').innerHTML = '<p>Failed to load schedule data...</p>';
    }
}

// Start the application
initializeUserView();
