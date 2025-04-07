// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const logoutBtn = document.getElementById('logoutBtn');

// --- State Variables ---
let currentDate = new Date();
let teamMembers = [];
let positions = [];
let unavailableEntries = [];
let overrideDays = []; // <<< NEW: Store override date strings
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
 function formatDateYYYYMMDD(dateInput) { /* ... (no change) ... */
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    try {
        // <<< Fetch overrides along with other data >>>
        const [membersRes, unavailRes, positionsRes, overridesRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides') // <<< NEW
        ]);

         if ([membersRes.status, unavailRes.status, positionsRes.status, overridesRes.status].includes(401)) {
             window.location.href = '/login.html?message=Session expired. Please log in.';
             return false;
         }
         if (!membersRes.ok || !unavailRes.ok || !positionsRes.ok || !overridesRes.ok) { // <<< Updated check
            let errorStatuses = [];
            if (!membersRes.ok) errorStatuses.push(`Members: ${membersRes.status}`);
            if (!unavailRes.ok) errorStatuses.push(`Unavailability: ${unavailRes.status}`);
            if (!positionsRes.ok) errorStatuses.push(`Positions: ${positionsRes.status}`);
            if (!overridesRes.ok) errorStatuses.push(`Overrides: ${overridesRes.status}`); // <<< NEW
            throw new Error(`HTTP error! Statuses - ${errorStatuses.join(', ')}`);
         }

        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json(); // <<< Store fetched override dates

        console.log("User View Fetched Team Members:", teamMembers);
        console.log("User View Fetched Positions:", positions);
        console.log("User View Fetched Unavailability:", unavailableEntries);
        console.log("User View Fetched Override Days:", overrideDays); // <<< Log overrides
        return true;

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alert("Failed to load data. Please check the console and try refreshing.");
        return false;
    }
}

// --- UI Rendering ---
function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... (no change) ... */
    if (!unavailableEntries) return false; return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

// <<< NEW: Helper to check if assignments should happen >>>
function shouldAssignOnDate(dayOfWeek, dateStr) {
    // Check default days OR override list
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// <<< UPDATE: renderCalendar uses shouldAssignOnDate >>>
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

                // <<< Use the new check function >>>
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
                    if (membersToAssign.length > 0) { assignmentCounter %= membersToAssign.length; } else { assignmentCounter = 0; }
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
 async function logout() { /* ... (no change) ... */
    try { const response = await fetch('/logout', { method: 'POST' }); if (response.ok) { window.location.href = '/login.html'; } else { alert('Logout failed.'); } } catch (error) { console.error('Logout error:', error); alert('Logout error.'); }
}

// --- Event Listeners ---
 prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); });
 nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); });
 logoutBtn.addEventListener('click', logout);

// --- Initial Load ---
async function initializeUserView() {
    if(await fetchData()){ // Fetch all data (including overrides)
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Then render calendar
    }
}

// Theme Toggle functionality
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

// Add event listener for theme toggle
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
initializeTheme();

initializeUserView();
