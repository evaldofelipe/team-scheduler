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
// <<< NEW: Special Assignments Selectors >>>
const specialAssignmentDateInput = document.getElementById('specialAssignmentDate');
const specialAssignmentPositionSelect = document.getElementById('specialAssignmentPosition');
const addSpecialAssignmentBtn = document.getElementById('addSpecialAssignmentBtn');
const specialAssignmentsList = document.getElementById('special-assignments-list');
// User Management
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
let unavailableEntries = []; // Stores ALL fetched entries
let overrideDays = []; // Stores ALL fetched override date strings YYYY-MM-DD
let specialAssignments = []; // <<< NEW: Stores ALL fetched special assignments
let assignmentCounter = 0;

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat

// --- Helper Functions ---
function shuffleArray(array) {
    for(let i = array.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
}
function formatDateYYYYMMDD(dateInput) {
     try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction Functions ---
async function fetchData() {
    console.log("Fetching data (including special assignments)...");
    try {
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes] = await Promise.all([ // <<< ADDED specialAssignRes
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments') // <<< FETCH NEW ENDPOINT
        ]);

        // Check for 401 Unauthorized on any request
        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes]; // <<< ADDED specialAssignRes
        if (responses.some(res => res.status === 401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false;
        }

        // Check for other non-OK statuses
        const errors = [];
        if (!membersRes.ok) errors.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
        if (!unavailRes.ok) errors.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
        if (!positionsRes.ok) errors.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`);
        if (!overridesRes.ok) errors.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
        if (!specialAssignRes.ok) errors.push(`Special Assignments: ${specialAssignRes.status} ${specialAssignRes.statusText}`); // <<< CHECK new response

        if (errors.length > 0) {
            throw new Error(`HTTP error fetching data! Statuses - ${errors.join(', ')}`);
         }

        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json(); // Expecting {id, name}
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json(); // <<< STORE new data (expecting {id, date, position_id, position_name})

        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Positions:", positions);
        console.log("Fetched Unavailability (All):", unavailableEntries);
        console.log("Fetched Override Days (All):", overrideDays);
        console.log("Fetched Special Assignments (All):", specialAssignments); // <<< LOG new data
        return true;

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        if (!document.body.dataset.fetchErrorShown) {
            alert("Failed to load critical data. Please check the console and try refreshing. If the problem persists, check server logs.");
            document.body.dataset.fetchErrorShown = "true";
        }
        return false;
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
    populateMemberDropdown(); // Update related dropdown
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
    populateSpecialAssignmentPositionDropdown(); // <<< Update related dropdown
}
function populateMemberDropdown() {
    const currentSelection = unavailabilityMemberSelect.value;
    unavailabilityMemberSelect.innerHTML = '<option value="">-- Select Member --</option>';
    const sortedMembers = [...teamMembers].sort();
    sortedMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member;
        option.textContent = member;
        if (member === currentSelection) { option.selected = true; }
        unavailabilityMemberSelect.appendChild(option);
    });
}
// <<< NEW Function to populate the positions dropdown for special assignments >>>
function populateSpecialAssignmentPositionDropdown() {
    const currentSelection = specialAssignmentPositionSelect.value;
    specialAssignmentPositionSelect.innerHTML = '<option value="">-- Select Position --</option>';
    // Sort positions by name for the dropdown
    const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
    sortedPositions.forEach(position => {
        const option = document.createElement('option');
        option.value = position.id; // Use position ID as the value
        option.textContent = position.name;
        // Re-select if previously selected and still exists
        if (position.id.toString() === currentSelection) {
            option.selected = true;
        }
        specialAssignmentPositionSelect.appendChild(option);
    });
}

function renderUnavailableList() {
    unavailableList.innerHTML = '';
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const filteredEntries = unavailableEntries.filter(entry => {
        const entryDate = new Date(entry.date + 'T00:00:00Z');
        return entryDate.getUTCFullYear() === currentYear && entryDate.getUTCMonth() === currentMonth;
    });
    filteredEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));

    if (filteredEntries.length === 0) {
        unavailableList.innerHTML = '<li>No unavailability entered for this month.</li>';
        const placeholderLi = unavailableList.querySelector('li');
        if(placeholderLi){ placeholderLi.style.cssText = 'justify-content: center; color: var(--text-secondary); font-style: italic;'; }
    } else {
        filteredEntries.forEach((entry) => {
            const li = document.createElement('li');
            const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString();
            li.textContent = `${displayDate} - ${entry.member}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove unavailability for ${entry.member} on ${displayDate}`;
            removeBtn.onclick = () => removeUnavailability(entry.id);
            li.appendChild(removeBtn);
            unavailableList.appendChild(li);
        });
    }
    if (unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';
}

function renderOverrideDaysList() {
    overrideDaysList.innerHTML = '';
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const filteredOverrideDays = overrideDays.filter(dateStr => {
        const overrideDate = new Date(dateStr + 'T00:00:00Z');
        return overrideDate.getUTCFullYear() === currentYear && overrideDate.getUTCMonth() === currentMonth;
    });
    filteredOverrideDays.sort();

     if (filteredOverrideDays.length === 0) {
        overrideDaysList.innerHTML = '<li>No override days set for this month.</li>';
        const placeholderLi = overrideDaysList.querySelector('li');
         if(placeholderLi){ placeholderLi.style.cssText = 'justify-content: center; color: var(--text-secondary); font-style: italic;'; }
    } else {
        filteredOverrideDays.forEach((dateStr) => {
            const li = document.createElement('li');
            const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString();
            const dateSpan = document.createElement('span');
            dateSpan.textContent = displayDate;
            li.appendChild(dateSpan);
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove Override for ${displayDate}`;
            removeBtn.onclick = () => removeOverrideDay(dateStr);
            li.appendChild(removeBtn);
            overrideDaysList.appendChild(li);
        });
    }
    if(overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
}

// <<< NEW Function to render the list of special assignments for the current month >>>
function renderSpecialAssignmentsList() {
    specialAssignmentsList.innerHTML = '';

    // Filter by current month/year
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const filteredSpecialAssignments = specialAssignments.filter(sa => {
        const assignmentDate = new Date(sa.date + 'T00:00:00Z'); // sa.date is already YYYY-MM-DD
        return assignmentDate.getUTCFullYear() === currentYear && assignmentDate.getUTCMonth() === currentMonth;
    });

    // Sort the filtered list by date then position name
    filteredSpecialAssignments.sort((a, b) => a.date.localeCompare(b.date) || a.position_name.localeCompare(b.position_name));

    if (filteredSpecialAssignments.length === 0) {
        specialAssignmentsList.innerHTML = '<li>No special assignment slots added for this month.</li>';
        const placeholderLi = specialAssignmentsList.querySelector('li');
        if(placeholderLi) { placeholderLi.style.cssText = 'justify-content: center; color: var(--text-secondary); font-style: italic;'; }
    } else {
        filteredSpecialAssignments.forEach((sa) => {
            const li = document.createElement('li');
            const displayDate = new Date(sa.date + 'T00:00:00Z').toLocaleDateString();
            // Display Date - Position Name
            li.textContent = `${displayDate} - ${sa.position_name}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove special slot for ${sa.position_name} on ${displayDate}`;
            removeBtn.onclick = () => removeSpecialAssignment(sa.id); // Use the special assignment ID
            li.appendChild(removeBtn);
            specialAssignmentsList.appendChild(li);
        });
    }
    if(specialAssignmentsList.lastChild) specialAssignmentsList.lastChild.style.borderBottom = 'none';
}


// Check unavailability against the FULL list
function isMemberUnavailable(memberName, dateYYYYMMDD) {
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

// Check if assignments should happen (default days OR override day) against FULL lists
function shouldAssignOnDate(dayOfWeek, dateStr) {
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// <<< MODIFIED renderCalendar function >>>
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
                        console.warn(`Could not find position details for special assignment ID ${sa.id} (position ID ${sa.position_id})`);
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


// --- Action Functions (Call APIs & Update UI) ---

// Generic helper for API calls
async function apiCall(url, options, successCallback) {
    try {
        const response = await fetch(url, options);

        if (response.status === 401 || response.status === 403) {
            console.warn(`Unauthorized/Forbidden (${response.status}) access to ${url}. Redirecting.`);
            window.location.href = '/login.html?message=Session expired or insufficient privileges.';
            return;
        }

        if (response.ok || (options.method === 'DELETE' && response.status === 404)) { // Allow 404 on DELETE
             if (await fetchData()) { // Re-fetch ALL data on success
                successCallback(); // Call specific render functions
             }
        } else {
             let errorText = `Operation failed (${response.status} ${response.statusText})`;
             try {
                 const errorJsonOrText = await response.text(); // Read as text first
                 try {
                     const errorJson = JSON.parse(errorJsonOrText); // Try parsing as JSON
                     errorText = errorJson.message || errorJson.error || errorText; // Use common error fields
                 } catch (parseError) {
                     // If not JSON, use the raw text if it's not empty HTML
                     if (errorJsonOrText && !errorJsonOrText.trim().startsWith('<')) {
                        errorText = errorJsonOrText;
                     }
                 }
             } catch(e) { /* Ignore read errors */ }
             console.error(`API Error for ${url}: ${errorText}`);
             alert(errorText);
        }
    } catch (error) {
        console.error(`Network or execution error for ${url}:`, error);
        alert("An error occurred. Please check the console.");
    }
}

// --- Member Actions ---
async function addMember() {
    const name = memberNameInput.value.trim(); if (!name) { alert('Please enter a member name.'); return; }
    memberNameInput.value = ''; memberNameInput.focus();
    await apiCall('/api/team-members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }, () => {
        renderTeamList(); // Updates list and dropdown
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Recalculate schedule
    });
}
async function removeMember(nameToRemove) {
    if (!nameToRemove || !confirm(`Remove ${nameToRemove}? This also removes their unavailability entries.`)) return;
    await apiCall(`/api/team-members/${encodeURIComponent(nameToRemove)}`, { method: 'DELETE' },
     () => {
        renderTeamList();
        renderUnavailableList(); // Their unavailability removed
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

// --- Position Actions ---
async function addPosition() {
    const name = positionNameInput.value.trim(); if (!name) { alert('Please enter a position name.'); return; }
    positionNameInput.value = ''; positionNameInput.focus();
    await apiCall('/api/positions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }, () => {
        renderPositionList(); // Updates list and dropdown
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}
async function removePosition(positionId) {
    const positionToRemove = positions.find(p => p.id === positionId);
    if (!positionToRemove || !confirm(`Remove Position: "${positionToRemove.name}"? This also removes any special assignment slots for this position.`)) return;
    await apiCall(`/api/positions/${positionId}`, { method: 'DELETE' },
    () => {
        renderPositionList();
        renderSpecialAssignmentsList(); // <<< Related special assignments are cascade-deleted
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

// --- Unavailability Actions ---
async function addUnavailability() {
    const dateValue = unavailabilityDateInput.value;
    const memberName = unavailabilityMemberSelect.value;
    if (!dateValue || !memberName) { alert("Please select both a date and a member."); return; }
    await apiCall('/api/unavailability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member: memberName, date: dateValue })
    }, () => {
        renderUnavailableList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}
async function removeUnavailability(idToRemove) {
     if (!idToRemove || !confirm(`Remove this unavailability entry?`)) return;
     await apiCall(`/api/unavailability/${idToRemove}`, { method: 'DELETE' },
     () => {
        renderUnavailableList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
     });
}

// --- Override Day Actions ---
async function addOverrideDay() {
    const dateValue = overrideDateInput.value; if (!dateValue) { alert("Please select a date."); return; }
    overrideDateInput.value = '';
    await apiCall('/api/overrides', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateValue })
    }, () => {
        renderOverrideDaysList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}
async function removeOverrideDay(dateStr) {
     const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString();
     if (!dateStr || !confirm(`Remove override for ${displayDate}?`)) return;
     await apiCall(`/api/overrides/${dateStr}`, { method: 'DELETE' },
      () => {
        renderOverrideDaysList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
     });
}

// <<< NEW: Special Assignment Actions >>>
async function addSpecialAssignment() {
    const dateValue = specialAssignmentDateInput.value; // YYYY-MM-DD
    const positionId = specialAssignmentPositionSelect.value;

    if (!dateValue || !positionId) {
        alert("Please select both a date and a position.");
        return;
    }

    // Clear inputs after getting values
    // specialAssignmentDateInput.value = ''; // Maybe don't clear date? User might add multiple for same date.
    // specialAssignmentPositionSelect.value = ''; // Reset dropdown

    await apiCall('/api/special-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateValue, position_id: positionId }) // Send position_id
    }, () => {
        // On success (after fetchData re-populates state):
        renderSpecialAssignmentsList(); // Update the list view
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Re-render calendar with the new slot
    });
}
async function removeSpecialAssignment(idToRemove) {
    // Find the assignment to show details in the confirmation
    const assignmentToRemove = specialAssignments.find(sa => sa.id === idToRemove);
    const confirmMessage = assignmentToRemove
        ? `Remove special assignment slot for "${assignmentToRemove.position_name}" on ${new Date(assignmentToRemove.date + 'T00:00:00Z').toLocaleDateString()}?`
        : `Remove this special assignment slot?`;

    if (!idToRemove || !confirm(confirmMessage)) return;

    await apiCall(`/api/special-assignments/${idToRemove}`, {
        method: 'DELETE'
    }, () => {
        // On success (after fetchData re-populates state):
        renderSpecialAssignmentsList(); // Update the list view
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Re-render calendar without the slot
    });
}


// --- User Management Actions ---
async function addUser() {
    const username = newUsernameInput.value.trim();
    const password = newPasswordInput.value;
    const role = newUserRoleSelect.value;
    userFeedbackMessage.textContent = ''; userFeedbackMessage.className = 'feedback-message';
    if (!username || !password || !role) { userFeedbackMessage.textContent = 'Please fill in all user fields.'; userFeedbackMessage.classList.add('error'); return; }
    if (password.length < 6) { userFeedbackMessage.textContent = 'Password must be at least 6 characters.'; userFeedbackMessage.classList.add('error'); return; }
    addUserBtn.disabled = true; addUserBtn.textContent = 'Adding...';
    try {
        const response = await fetch('/api/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            userFeedbackMessage.textContent = result.message || `User '${username}' added successfully!`;
            userFeedbackMessage.classList.add('success');
            newUsernameInput.value = ''; newPasswordInput.value = ''; newUserRoleSelect.value = 'user';
            setTimeout(() => { userFeedbackMessage.textContent = ''; userFeedbackMessage.className = 'feedback-message'; }, 5000);
        } else {
             userFeedbackMessage.textContent = result.message || `Failed to add user (${response.status})`; userFeedbackMessage.classList.add('error');
             console.error(`Failed to add user: ${response.status}`, result);
        }
    } catch (error) {
        console.error("Error during add user request:", error);
        userFeedbackMessage.textContent = 'A network error occurred.'; userFeedbackMessage.classList.add('error');
    } finally {
        addUserBtn.disabled = false; addUserBtn.textContent = 'Add User';
    }
}

// --- Logout ---
 async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) { window.location.href = '/login.html'; }
        else { const result = await response.json(); alert(`Logout failed: ${result.message || 'Unknown error'}`); }
    } catch (error) { console.error('Logout error:', error); alert('Logout request failed.'); }
}

// --- Event Listeners ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    renderUnavailableList();
    renderOverrideDaysList();
    renderSpecialAssignmentsList(); // <<< Re-render list on month change
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    renderUnavailableList();
    renderOverrideDaysList();
    renderSpecialAssignmentsList(); // <<< Re-render list on month change
});

randomizeBtn.addEventListener('click', () => {
    if (teamMembers.length > 0) {
        let shuffledMembers = [...teamMembers]; shuffleArray(shuffledMembers);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth(), shuffledMembers);
        alert("Assignments randomized for current view.");
    } else { alert("Add team members first."); }
});

logoutBtn.addEventListener('click', logout);
// Member listeners
addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); }});
// Position listeners
addPositionBtn.addEventListener('click', addPosition);
positionNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPosition(); }});
// Unavailability listener
addUnavailabilityBtn.addEventListener('click', addUnavailability);
// Override Day listeners
addOverrideDayBtn.addEventListener('click', addOverrideDay);
overrideDateInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addOverrideDay(); }});
// <<< NEW Special Assignment listener >>>
addSpecialAssignmentBtn.addEventListener('click', addSpecialAssignment);
// User listener
addUserBtn.addEventListener('click', addUser);
newPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUser(); }});

// --- Theme Toggle ---
function initializeTheme() { const theme = localStorage.getItem('theme') || 'light'; document.documentElement.setAttribute('data-theme', theme); }
function toggleTheme() { const currentTheme = document.documentElement.getAttribute('data-theme'); const newTheme = currentTheme === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', newTheme); localStorage.setItem('theme', newTheme); }
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) { themeToggleBtn.addEventListener('click', toggleTheme); } else { console.warn("Theme toggle button not found."); }

// --- Initial Load ---
async function initializeAdminView() {
    console.log("Initializing Admin View...");
    initializeTheme();
    if (await fetchData()) {
        console.log("Data fetch successful. Rendering components.");
        renderTeamList();           // Populates member list & dropdown
        renderPositionList();       // Populates position list & special assignment dropdown
        renderUnavailableList();    // Filtered list for current month
        renderOverrideDaysList();   // Filtered list for current month
        renderSpecialAssignmentsList(); // <<< Render new list (filtered)
        // populateSpecialAssignmentPositionDropdown(); // Called by renderPositionList now
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Render calendar last
    } else {
         console.error("Initialization failed due to data fetch error.");
         document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load application data. Please try refreshing. Check console.</p>';
    }
}

// Start the application
initializeAdminView();
