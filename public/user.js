// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const logoutBtn = document.getElementById('logoutBtn');

// --- State Variables ---
let currentDate = new Date();
let teamMembers = []; // Populated from API
let positions = [];   // Populated from API {id, name}
let unavailableEntries = []; // Populated from API {id, member, date}
let assignmentCounter = 0;

// --- Configuration ---
const assignmentDaysOfWeek = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
 function formatDateYYYYMMDD(dateInput) {
    try {
        const date = new Date(dateInput);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    try {
        const [membersRes, unavailRes, positionsRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions') // Fetch positions for rendering
        ]);

         if ([membersRes.status, unavailRes.status, positionsRes.status].includes(401)) {
             window.location.href = '/login.html?message=Session expired. Please log in.';
             return false; // Indicate failure
         }
         if (!membersRes.ok || !unavailRes.ok || !positionsRes.ok) {
            let errorStatuses = [];
            if (!membersRes.ok) errorStatuses.push(`Members: ${membersRes.status}`);
            if (!unavailRes.ok) errorStatuses.push(`Unavailability: ${unavailRes.status}`);
            if (!positionsRes.ok) errorStatuses.push(`Positions: ${positionsRes.status}`);
            throw new Error(`HTTP error! Statuses - ${errorStatuses.join(', ')}`);
         }

        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json(); // Store fetched positions

        console.log("User View Fetched Team Members:", teamMembers);
        console.log("User View Fetched Unavailability:", unavailableEntries);
        console.log("User View Fetched Positions:", positions);
        return true; // Indicate success

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alert("Failed to load data. Please check the console and try refreshing.");
        return false; // Indicate failure
    }
}

// --- UI Rendering ---
function isMemberUnavailable(memberName, dateYYYYMMDD) {
    // Ensure unavailableEntries is loaded before checking
    if (!unavailableEntries) return false;
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

function renderCalendar(year, month, membersToAssign = teamMembers) {
    // Calendar rendering logic is identical to admin.js, using fetched positions
    calendarBody.innerHTML = '';
    monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    assignmentCounter = 0;
    let date = 1;
    const canAssign = membersToAssign && membersToAssign.length > 0;
    const hasPositions = positions && positions.length > 0; // Use fetched positions

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

                if (canAssign && hasPositions && assignmentDaysOfWeek.includes(dayOfWeek)) { // Use hasPositions
                    cell.classList.add('assignment-day');
                    positions.forEach(position => { // Use fetched positions
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
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`; // Use position.name
                        } else {
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`; // Use position.name
                            if (attempts === membersToAssign.length) { assignmentCounter++; }
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
        if (response.ok) { window.location.href = '/login.html'; }
        else { alert('Logout failed.'); }
    } catch (error) { console.error('Logout error:', error); alert('An error occurred during logout.'); }
}

// --- Event Listeners ---
 prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
});
nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
});
 logoutBtn.addEventListener('click', logout);

// --- Initial Load ---
async function initializeUserView() {
    if(await fetchData()){ // Fetch data first and check success
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Then render calendar
    }
}

initializeUserView(); // Start the process
