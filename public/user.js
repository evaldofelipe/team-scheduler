// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const logoutBtn = document.getElementById('logoutBtn');

// --- State Variables ---
let currentDate = new Date();
let teamMembers = []; // Populated from API
let unavailableEntries = []; // Populated from API
let assignmentCounter = 0; // Still used for rendering logic

// --- Configuration ---
const assignmentDaysOfWeek = [0, 3, 6]; // Sun, Wed, Sat
const positions = ['Sound', 'Media', 'Live'];

// --- Helper Functions ---
 function formatDateYYYYMMDD(dateInput) { /* ... (same as before) ... */
     try {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
         if (typeof dateInput === 'string' && dateInput.includes('T')) {
            return date.toISOString().slice(0, 10);
         } else {
             return `${year}-${month}-${day}`;
         }
    } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    try {
        const [membersRes, unavailRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability')
        ]);

         if (!membersRes.ok || !unavailRes.ok) {
             if (membersRes.status === 401 || unavailRes.status === 401) {
                 window.location.href = '/login.html?message=Session expired. Please log in.';
                 return; // Stop execution
             }
            throw new Error(`HTTP error! status: ${membersRes.status} or ${unavailRes.status}`);
        }

        teamMembers = await membersRes.json();
         // User view also needs unavailability data for correct rendering
        unavailableEntries = await unavailRes.json();

        console.log("User View Fetched Team Members:", teamMembers);
        console.log("User View Fetched Unavailability:", unavailableEntries);

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alert("Failed to load data. Please check the console and try refreshing.");
    }
}

// --- UI Rendering ---
function isMemberUnavailable(memberName, dateYYYYMMDD) {
    // Ensure unavailableEntries is loaded before checking
    if (!unavailableEntries) return false;
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

function renderCalendar(year, month, membersToAssign = teamMembers) {
    // ... (renderCalendar logic is IDENTICAL to admin.js) ...
    // ... (It reads from the fetched teamMembers and unavailableEntries) ...
     calendarBody.innerHTML = '';
    monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    assignmentCounter = 0;
    let date = 1;
    const canAssign = membersToAssign && membersToAssign.length > 0;

    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');

            if (week === 0 && dayOfWeek < startDayOfWeek) { cell.classList.add('other-month'); }
            else if (date > daysInMonth) { cell.classList.add('other-month'); }
            else {
                const currentCellDate = new Date(Date.UTC(year, month, date)); // Use UTC date
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                if (canAssign && assignmentDaysOfWeek.includes(dayOfWeek)) {
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
                            assignmentDiv.innerHTML = `<strong>${position}:</strong> ${assignedMemberName}`;
                        } else {
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position}:</strong> (Unavailable)`;
                            if (attempts === membersToAssign.length) { assignmentCounter++; }
                        }
                        cell.appendChild(assignmentDiv);
                    });
                    assignmentCounter %= membersToAssign.length;
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
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('An error occurred during logout.');
    }
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
    await fetchData(); // Fetch data first
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Then render calendar
}

initializeUserView(); // Start the process
