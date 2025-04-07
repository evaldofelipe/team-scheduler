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
let overrideDays = []; // Stores ALL fetched override date strings
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
 function formatDateYYYYMMDD(dateInput) {
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    console.log("Fetching data for user view...");
    try {
        // Fetch all data needed to render the calendar accurately
        const [membersRes, unavailRes, positionsRes, overridesRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides')
        ]);

         // Check for 401 Unauthorized first
         if ([membersRes.status, unavailRes.status, positionsRes.status, overridesRes.status].includes(401)) {
             console.warn("User session expired or unauthorized. Redirecting to login.");
             window.location.href = '/login.html?message=Session expired. Please log in.';
             return false;
         }

         // Check for other errors
         if (!membersRes.ok || !unavailRes.ok || !positionsRes.ok || !overridesRes.ok) {
            let errorStatuses = [];
            if (!membersRes.ok) errorStatuses.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
            if (!unavailRes.ok) errorStatuses.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
            if (!positionsRes.ok) errorStatuses.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`);
            if (!overridesRes.ok) errorStatuses.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
            throw new Error(`HTTP error fetching data! Statuses - ${errorStatuses.join(', ')}`);
         }

        // Store all fetched data
        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json();

        console.log("User View Fetched Team Members:", teamMembers);
        console.log("User View Fetched Positions:", positions);
        console.log("User View Fetched Unavailability (All):", unavailableEntries);
        console.log("User View Fetched Override Days (All):", overrideDays);
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
// These functions need to be IDENTICAL to admin.js to ensure consistent calendar display

function isMemberUnavailable(memberName, dateYYYYMMDD) {
    // Check against the full list of unavailable entries
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

function shouldAssignOnDate(dayOfWeek, dateStr) {
    // Check if it's one of the default assignment days OR if it's in the full override list
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// renderCalendar function is identical to admin.js version
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
    const hasPositions = positions && positions.length > 0;

    // console.log(`Rendering calendar for ${year}-${month+1}`);
    // console.log(`Using members: ${membersToAssign.join(', ')}`);

    for (let week = 0; week < 6; week++) { // Max 6 rows needed
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            if (week === 0 && dayOfWeek < startDayOfWeek) {
                cell.classList.add('other-month');
            } else if (date > daysInMonth) {
                cell.classList.add('other-month');
            } else {
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

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
                            } else {
                                attempts++;
                            }
                        }

                        const assignmentDiv = document.createElement('div');
                        if (assignedMemberName) {
                            assignmentDiv.classList.add('assigned-position');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                        } else {
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`;
                            if (attempts === membersToAssign.length) {
                                assignmentCounter++;
                            }
                        }
                        cell.appendChild(assignmentDiv);
                    });

                    if (membersToAssign.length > 0) {
                         assignmentCounter %= membersToAssign.length;
                     } else {
                         assignmentCounter = 0;
                     }
                }
                date++;
            }
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
         if (date > daysInMonth && week > 0) break;
    }
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
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    // No need to re-render sidebar lists as they don't exist here
 });
 nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
     // No need to re-render sidebar lists as they don't exist here
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
        document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load schedule data. Please try refreshing the page. Check console for details.</p>';
    }
}

// Start the application
initializeUserView();
