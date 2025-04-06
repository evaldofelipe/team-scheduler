// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const memberNameInput = document.getElementById('memberNameInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const teamList = document.getElementById('team-list');
const unavailabilityDateInput = document.getElementById('unavailabilityDate');
const unavailabilityMemberSelect = document.getElementById('unavailabilityMember');
const addUnavailabilityBtn = document.getElementById('addUnavailabilityBtn');
const unavailableList = document.getElementById('unavailable-list');
const logoutBtn = document.getElementById('logoutBtn'); // Get logout button

// --- State Variables ---
let currentDate = new Date();
let teamMembers = []; // Populated from API
let unavailableEntries = []; // Populated from API
let assignmentCounter = 0; // Still used for rendering logic

// --- Configuration ---
const assignmentDaysOfWeek = [0, 3, 6]; // Sun, Wed, Sat
const positions = ['Sound', 'Media', 'Live'];

// --- Helper Functions ---
function shuffleArray(array) { /* ... (Fisher-Yates shuffle) ... */
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
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

// --- API Interaction Functions ---
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
        unavailableEntries = await unavailRes.json(); // API now returns {id, member, date}

        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Unavailability:", unavailableEntries);

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alert("Failed to load data. Please check the console and try refreshing.");
    }
}

// --- UI Rendering Functions ---

function renderTeamList() {
    teamList.innerHTML = '';
    // Sort members alphabetically for display
    const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach((member) => { // No index needed for deletion via API
        const li = document.createElement('li');
        li.textContent = member;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Remove ${member}`;
        // Pass member name directly to remove function
        deleteBtn.onclick = () => removeMember(member);
        li.appendChild(deleteBtn);
        teamList.appendChild(li);
    });
    populateMemberDropdown();
}

function populateMemberDropdown() {
    const currentSelection = unavailabilityMemberSelect.value;
    unavailabilityMemberSelect.innerHTML = '<option value="">-- Select Member --</option>';
    const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member;
        option.textContent = member;
        if (member === currentSelection) {
            option.selected = true;
        }
        unavailabilityMemberSelect.appendChild(option);
    });
}

function renderUnavailableList() {
    unavailableList.innerHTML = '';
    // Sort for display consistency (already sorted by API, but good practice)
    unavailableEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));

    unavailableEntries.forEach((entry) => { // Use entry.id for deletion
        const li = document.createElement('li');
         // Display date in local format
        const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString(); // Add Z for UTC date
        li.textContent = `${displayDate} - ${entry.member}`;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'x';
        removeBtn.title = `Remove unavailability for ${entry.member} on ${displayDate}`;
        // Pass entry ID directly to remove function
        removeBtn.onclick = () => removeUnavailability(entry.id);
        li.appendChild(removeBtn);
        unavailableList.appendChild(li);
    });
}

// Calendar rendering depends on teamMembers and unavailableEntries having been fetched
function isMemberUnavailable(memberName, dateYYYYMMDD) {
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

function renderCalendar(year, month, membersToAssign = teamMembers) {
    // ... (renderCalendar logic remains mostly the same as before) ...
    // ... (it uses the global teamMembers and unavailableEntries arrays) ...
    // ... (ensure it correctly uses isMemberUnavailable function) ...

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


// --- Action Functions (Call APIs) ---

async function addMember() {
    const name = memberNameInput.value.trim();
    if (!name) return;

    try {
        const response = await fetch('/api/team-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            memberNameInput.value = '';
            await fetchData(); // Re-fetch all data
            renderTeamList();
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Re-render calendar
        } else if (response.status === 409) {
            alert('Team member already exists.');
        } else if (response.status === 401 || response.status === 403) {
             window.location.href = '/login.html?message=Session expired or insufficient privileges.';
        }
         else {
            throw new Error(`Failed to add member: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error adding member:", error);
        alert("Failed to add member. See console for details.");
    }
    memberNameInput.focus();
}

async function removeMember(nameToRemove) { // Takes name as argument
    if (!nameToRemove || !confirm(`Are you sure you want to remove ${nameToRemove}? This will also remove their unavailability entries.`)) {
        return;
    }

    try {
        // Use encodeURIComponent in case names have special characters
        const response = await fetch(`/api/team-members/${encodeURIComponent(nameToRemove)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await fetchData(); // Re-fetch all data
            renderTeamList();
            renderUnavailableList(); // Update unavailability list too
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Re-render calendar
        } else if (response.status === 401 || response.status === 403) {
             window.location.href = '/login.html?message=Session expired or insufficient privileges.';
        } else {
            throw new Error(`Failed to remove member: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error removing member:", error);
        alert("Failed to remove member. See console for details.");
    }
}

 async function addUnavailability() {
    const dateValue = unavailabilityDateInput.value;
    const memberName = unavailabilityMemberSelect.value;

    if (!dateValue || !memberName) {
        alert("Please select both a date and a team member.");
        return;
    }

    try {
         const response = await fetch('/api/unavailability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member: memberName, date: dateValue }) // Send 'member' and 'date'
        });

         if (response.ok) {
            // Clear inputs? Optional.
            await fetchData(); // Re-fetch all data
            renderUnavailableList();
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        } else if (response.status === 409) {
            alert(`${memberName} is already marked as unavailable on ${new Date(dateValue + 'T00:00:00Z').toLocaleDateString()}.`);
        } else if (response.status === 401 || response.status === 403) {
             window.location.href = '/login.html?message=Session expired or insufficient privileges.';
        } else {
            throw new Error(`Failed to add unavailability: ${response.statusText}`);
        }

    } catch(error) {
         console.error("Error adding unavailability:", error);
        alert("Failed to add unavailability. See console for details.");
    }
}

async function removeUnavailability(idToRemove) { // Takes ID as argument
     if (!idToRemove || !confirm(`Are you sure you want to remove this unavailability entry?`)) {
        return;
    }
     try {
        const response = await fetch(`/api/unavailability/${idToRemove}`, {
            method: 'DELETE'
        });
         if (response.ok) {
            await fetchData(); // Re-fetch all data
            renderUnavailableList();
            renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        } else if (response.status === 401 || response.status === 403) {
             window.location.href = '/login.html?message=Session expired or insufficient privileges.';
        } else {
            throw new Error(`Failed to remove unavailability: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error removing unavailability:", error);
        alert("Failed to remove unavailability. See console for details.");
    }
}

 async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login.html'; // Redirect to login on successful logout
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
randomizeBtn.addEventListener('click', () => {
    if (teamMembers.length > 0) {
        let shuffledMembers = [...teamMembers];
        shuffleArray(shuffledMembers);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth(), shuffledMembers);
    } else {
        alert("Add team members before randomizing assignments.");
    }
});
addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addMember(); }});
addUnavailabilityBtn.addEventListener('click', addUnavailability);
logoutBtn.addEventListener('click', logout); // Add logout listener


// --- Initial Load ---
async function initializeAdminView() {
    await fetchData(); // Fetch data first
    renderTeamList(); // Then render lists
    renderUnavailableList();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Finally render calendar
}

initializeAdminView(); // Start the process
