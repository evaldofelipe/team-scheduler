// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const memberNameInput = document.getElementById('memberNameInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const teamList = document.getElementById('team-list');
const positionNameInput = document.getElementById('positionNameInput'); // New
const addPositionBtn = document.getElementById('addPositionBtn');     // New
const positionList = document.getElementById('position-list');         // New
const unavailabilityDateInput = document.getElementById('unavailabilityDate');
const unavailabilityMemberSelect = document.getElementById('unavailabilityMember');
const addUnavailabilityBtn = document.getElementById('addUnavailabilityBtn');
const unavailableList = document.getElementById('unavailable-list');
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
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function formatDateYYYYMMDD(dateInput) {
     try {
        const date = new Date(dateInput);
        // Use UTC methods to avoid timezone issues when creating the string
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return ""; }
}

// --- API Interaction Functions ---
async function fetchData() {
    try {
        const [membersRes, unavailRes, positionsRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions')
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
        positions = await positionsRes.json();

        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Unavailability:", unavailableEntries);
        console.log("Fetched Positions:", positions);
        return true; // Indicate success

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alert("Failed to load data. Please check the console and try refreshing.");
        return false; // Indicate failure
    }
}

// --- UI Rendering Functions ---

function renderTeamList() {
    teamList.innerHTML = '';
    const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach((member) => {
        const li = document.createElement('li');
        li.textContent = member;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Remove ${member}`;
        deleteBtn.onclick = () => removeMember(member);
        li.appendChild(deleteBtn);
        teamList.appendChild(li);
    });
    if (teamList.lastChild) teamList.lastChild.style.borderBottom = 'none';
    populateMemberDropdown();
}

function renderPositionList() {
    positionList.innerHTML = '';
    const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
    sortedPositions.forEach(position => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = position.name;
        li.appendChild(nameSpan);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Remove Position: ${position.name}`;
        deleteBtn.onclick = () => removePosition(position.id);
        li.appendChild(deleteBtn);
        positionList.appendChild(li);
    });
     if(positionList.lastChild) positionList.lastChild.style.borderBottom = 'none';
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
    unavailableEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));
    unavailableEntries.forEach((entry) => {
        const li = document.createElement('li');
        const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString(); // Treat date as UTC
        li.textContent = `${displayDate} - ${entry.member}`;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'x';
        removeBtn.title = `Remove unavailability for ${entry.member} on ${displayDate}`;
        removeBtn.onclick = () => removeUnavailability(entry.id);
        li.appendChild(removeBtn);
        unavailableList.appendChild(li);
    });
     if(unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';
}

function isMemberUnavailable(memberName, dateYYYYMMDD) {
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

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
                // Use UTC to create date object to avoid potential timezone shifts
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);
                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                if (canAssign && hasPositions && assignmentDaysOfWeek.includes(dayOfWeek)) {
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
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                        } else {
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`;
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
            if(await fetchData()){ // Re-fetch and check success
                renderTeamList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            }
        } else if (response.status === 409) { alert('Team member already exists.'); }
          else if (response.status === 401 || response.status === 403) { window.location.href = '/login.html?message=Session expired or insufficient privileges.'; }
          else { throw new Error(`Failed to add member: ${response.statusText}`); }
    } catch (error) { console.error("Error adding member:", error); alert("Failed to add member."); }
    memberNameInput.focus();
}

async function removeMember(nameToRemove) {
    if (!nameToRemove || !confirm(`Remove ${nameToRemove}? This also removes their unavailability.`)) return;
    try {
        const response = await fetch(`/api/team-members/${encodeURIComponent(nameToRemove)}`, { method: 'DELETE' });
        if (response.ok) {
            if(await fetchData()){
                renderTeamList();
                renderUnavailableList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            }
        } else if (response.status === 401 || response.status === 403) { window.location.href = '/login.html?message=Session expired or insufficient privileges.'; }
          else { throw new Error(`Failed to remove member: ${response.statusText}`); }
    } catch (error) { console.error("Error removing member:", error); alert("Failed to remove member."); }
}

async function addPosition() {
    const name = positionNameInput.value.trim();
    if (!name) return;
    try {
        const response = await fetch('/api/positions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            positionNameInput.value = '';
            if(await fetchData()){
                renderPositionList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            }
        } else if (response.status === 409) { alert('Position name already exists.'); }
          else if (response.status === 401 || response.status === 403) { window.location.href = '/login.html?message=Session expired or insufficient privileges.'; }
          else { throw new Error(`Failed to add position: ${response.statusText}`); }
    } catch (error) { console.error("Error adding position:", error); alert("Failed to add position."); }
    positionNameInput.focus();
}

async function removePosition(positionId) {
    const positionToRemove = positions.find(p => p.id === positionId);
    if (!positionToRemove || !confirm(`Remove Position: "${positionToRemove.name}"?`)) return;
    try {
        const response = await fetch(`/api/positions/${positionId}`, { method: 'DELETE' });
        if (response.ok) {
             if(await fetchData()){
                renderPositionList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
             }
        } else if (response.status === 401 || response.status === 403) { window.location.href = '/login.html?message=Session expired or insufficient privileges.'; }
          else { throw new Error(`Failed to remove position: ${response.statusText}`); }
    } catch (error) { console.error("Error removing position:", error); alert("Failed to remove position."); }
}

async function addUnavailability() {
    const dateValue = unavailabilityDateInput.value;
    const memberName = unavailabilityMemberSelect.value;
    if (!dateValue || !memberName) { alert("Please select both a date and a team member."); return; }
    try {
         const response = await fetch('/api/unavailability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member: memberName, date: dateValue })
        });
         if (response.ok) {
            // unavailabilityDateInput.value = ''; // Optionally clear date
            if(await fetchData()){
                renderUnavailableList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
            }
        } else if (response.status === 409) { alert(`${memberName} is already marked unavailable on this date.`); }
          else if (response.status === 401 || response.status === 403) { window.location.href = '/login.html?message=Session expired or insufficient privileges.'; }
          else { throw new Error(`Failed to add unavailability: ${response.statusText}`); }
    } catch(error) { console.error("Error adding unavailability:", error); alert("Failed to add unavailability."); }
}

async function removeUnavailability(idToRemove) {
     if (!idToRemove || !confirm(`Remove this unavailability entry?`)) return;
     try {
        const response = await fetch(`/api/unavailability/${idToRemove}`, { method: 'DELETE' });
         if (response.ok) {
             if(await fetchData()){
                renderUnavailableList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
             }
        } else if (response.status === 401 || response.status === 403) { window.location.href = '/login.html?message=Session expired or insufficient privileges.'; }
          else { throw new Error(`Failed to remove unavailability: ${response.statusText}`); }
    } catch (error) { console.error("Error removing unavailability:", error); alert("Failed to remove unavailability."); }
}

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
randomizeBtn.addEventListener('click', () => {
    if (teamMembers.length > 0) {
        let shuffledMembers = [...teamMembers];
        shuffleArray(shuffledMembers);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth(), shuffledMembers);
    } else {
        alert("Add team members first.");
    }
});
addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addMember(); }});
addPositionBtn.addEventListener('click', addPosition); // New
positionNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addPosition(); }}); // New
addUnavailabilityBtn.addEventListener('click', addUnavailability);
logoutBtn.addEventListener('click', logout);


// --- Initial Load ---
async function initializeAdminView() {
    if(await fetchData()){ // Fetch data first and check success
        renderTeamList();       // Then render lists
        renderPositionList();
        renderUnavailableList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Finally render calendar
    }
}

initializeAdminView(); // Start the process
