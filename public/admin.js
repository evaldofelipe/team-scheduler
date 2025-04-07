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
// <<< NEW User Management Selectors >>>
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
    console.log("Fetching data...");
    try {
        const [membersRes, unavailRes, positionsRes, overridesRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides')
        ]);

        // Check for 401 Unauthorized on any request (session likely expired)
        if ([membersRes.status, unavailRes.status, positionsRes.status, overridesRes.status].includes(401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false; // Indicate failure, stop further processing
        }

        // Check for other non-OK statuses
         if (!membersRes.ok || !unavailRes.ok || !positionsRes.ok || !overridesRes.ok) {
            let errorStatuses = [];
            if (!membersRes.ok) errorStatuses.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
            if (!unavailRes.ok) errorStatuses.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
            if (!positionsRes.ok) errorStatuses.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`);
            if (!overridesRes.ok) errorStatuses.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
            throw new Error(`HTTP error fetching data! Statuses - ${errorStatuses.join(', ')}`);
         }

        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json(); // Store ALL entries
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json(); // Store ALL override dates

        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Positions:", positions);
        console.log("Fetched Unavailability (All):", unavailableEntries);
        console.log("Fetched Override Days (All):", overrideDays);
        return true; // Indicate success

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        // Avoid alert loops if fetch fails constantly
        if (!document.body.dataset.fetchErrorShown) {
            alert("Failed to load critical data. Please check the console and try refreshing. If the problem persists, check server logs.");
            document.body.dataset.fetchErrorShown = "true"; // Mark that error was shown
        }
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
    populateMemberDropdown(); // Update dropdown whenever team list changes
}
function renderPositionList() {
    positionList.innerHTML = '';
    // Assuming positions have {id, name}, sort by name
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
        // Re-select previously selected member if they still exist
        if (member === currentSelection) {
            option.selected = true;
        }
        unavailabilityMemberSelect.appendChild(option);
    });
}

// UPDATE: Render Unavailability List with Filtering by Current Month
function renderUnavailableList() {
    unavailableList.innerHTML = '';

    // --- Filtering Logic ---
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed (0=Jan, 11=Dec)

    const filteredEntries = unavailableEntries.filter(entry => {
        // Parse the entry date string (YYYY-MM-DD) into a Date object.
        // Use UTC methods to avoid timezone issues when comparing year/month.
        const entryDate = new Date(entry.date + 'T00:00:00Z');
        return entryDate.getUTCFullYear() === currentYear && entryDate.getUTCMonth() === currentMonth;
    });
    // --- End Filtering ---

    // Sort the *filtered* entries
    filteredEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));

    if (filteredEntries.length === 0) {
        unavailableList.innerHTML = '<li>No unavailability entered for this month.</li>';
        // Style the placeholder message
        const placeholderLi = unavailableList.querySelector('li');
        if(placeholderLi){
             placeholderLi.style.justifyContent = 'center';
             placeholderLi.style.color = 'var(--text-secondary)';
             placeholderLi.style.fontStyle = 'italic';
        }
    } else {
        filteredEntries.forEach((entry) => {
            const li = document.createElement('li');
            // Display date using local format, but the date itself is correct UTC midnight
            const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString();
            li.textContent = `${displayDate} - ${entry.member}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove unavailability for ${entry.member} on ${displayDate}`;
            removeBtn.onclick = () => removeUnavailability(entry.id); // Keep using original ID
            li.appendChild(removeBtn);
            unavailableList.appendChild(li);
        });
    }
    // Remove border from the actual last item, even if it's the placeholder
    if (unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';
}

// UPDATE: Render Override Days List with Filtering by Current Month
function renderOverrideDaysList() {
    overrideDaysList.innerHTML = '';

    // --- Filtering Logic ---
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed

    const filteredOverrideDays = overrideDays.filter(dateStr => {
        // Parse the date string (YYYY-MM-DD) into a Date object. Use UTC.
        const overrideDate = new Date(dateStr + 'T00:00:00Z');
        return overrideDate.getUTCFullYear() === currentYear && overrideDate.getUTCMonth() === currentMonth;
    });
    // --- End Filtering ---

    // Sort the *filtered* dates
    filteredOverrideDays.sort();

     if (filteredOverrideDays.length === 0) {
        overrideDaysList.innerHTML = '<li>No override days set for this month.</li>';
        // Style the placeholder message
        const placeholderLi = overrideDaysList.querySelector('li');
         if(placeholderLi){
            placeholderLi.style.justifyContent = 'center';
            placeholderLi.style.color = 'var(--text-secondary)';
            placeholderLi.style.fontStyle = 'italic';
        }
    } else {
        filteredOverrideDays.forEach((dateStr) => {
            const li = document.createElement('li');
            // Display date using local format
            const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString();

            const dateSpan = document.createElement('span');
            dateSpan.textContent = displayDate;
            li.appendChild(dateSpan);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove Override for ${displayDate}`;
            removeBtn.onclick = () => removeOverrideDay(dateStr); // Keep using original YYYY-MM-DD string
            li.appendChild(removeBtn);
            overrideDaysList.appendChild(li);
        });
    }
    if(overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
}


function isMemberUnavailable(memberName, dateYYYYMMDD) {
    // Check against the full list of unavailable entries
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

// Helper to check if assignments should happen on a given date
function shouldAssignOnDate(dayOfWeek, dateStr) {
    // Check if it's one of the default assignment days OR if it's in the full override list
    return DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || overrideDays.includes(dateStr);
}

// renderCalendar uses shouldAssignOnDate (which checks against ALL override days)
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
                // Cell before the 1st of the month
                cell.classList.add('other-month');
            } else if (date > daysInMonth) {
                // Cell after the last day of the month
                cell.classList.add('other-month');
            } else {
                // Valid day cell
                const currentCellDate = new Date(Date.UTC(year, month, date)); // Use UTC for consistency
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate); // YYYY-MM-DD format

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                cell.appendChild(dateNumber);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                // Check if assignments should happen on this day
                if (canAssign && hasPositions && shouldAssignOnDate(dayOfWeek, currentCellDateStr)) {
                    cell.classList.add('assignment-day');

                    positions.forEach(position => {
                        let assignedMemberName = null;
                        let attempts = 0;
                        // Try to find an available member using round-robin
                        while (assignedMemberName === null && attempts < membersToAssign.length) {
                            const potentialMemberIndex = (assignmentCounter + attempts) % membersToAssign.length;
                            const potentialMemberName = membersToAssign[potentialMemberIndex];

                            if (!isMemberUnavailable(potentialMemberName, currentCellDateStr)) {
                                assignedMemberName = potentialMemberName;
                                // IMPORTANT: Increment counter only AFTER successful assignment or exhausting attempts
                                assignmentCounter = (assignmentCounter + attempts + 1);
                            } else {
                                // Member is unavailable, try the next one in the list
                                attempts++;
                            }
                        } // End while loop

                        const assignmentDiv = document.createElement('div');
                        if (assignedMemberName) {
                            assignmentDiv.classList.add('assigned-position');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                            // console.log(`Assigned ${assignedMemberName} to ${position.name} on ${currentCellDateStr}`);
                        } else {
                            // No available member found after checking everyone
                            assignmentDiv.classList.add('assignment-skipped');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> (Unavailable)`;
                            // console.log(`Skipped ${position.name} on ${currentCellDateStr} - no available members.`);
                            // Ensure counter advances even if skipped to avoid getting stuck
                            if (attempts === membersToAssign.length) {
                                assignmentCounter++; // Move past this slot
                            }
                        }
                        cell.appendChild(assignmentDiv);
                    }); // End positions.forEach

                    // Ensure counter wraps around correctly after processing all positions for the day
                     if (membersToAssign.length > 0) {
                         assignmentCounter %= membersToAssign.length;
                     } else {
                         assignmentCounter = 0;
                     }

                } // End if shouldAssignOnDate

                date++; // Move to the next date
            } // End else (valid day cell)
            row.appendChild(cell);
        } // End dayOfWeek loop
        calendarBody.appendChild(row);
        // Stop adding rows if we've gone past the end of the month
         if (date > daysInMonth && week > 0) break; // Optimization
    } // End week loop
}


// --- Action Functions (Call APIs & Update UI) ---

// Generic helper for API calls to reduce repetition (kept for existing actions)
async function apiCall(url, options, successCallback) {
    try {
        const response = await fetch(url, options);

        if (response.status === 401 || response.status === 403) {
            console.warn(`Unauthorized/Forbidden (${response.status}) access to ${url}. Redirecting.`);
            window.location.href = '/login.html?message=Session expired or insufficient privileges.';
            return; // Stop processing
        }

        if (response.ok || (options.method === 'DELETE' && response.status === 404)) { // Allow 404 on DELETE
             if (await fetchData()) { // Re-fetch ALL data on success
                successCallback(); // Call specific render functions
             }
        } else {
             // Try to get error message from server response body
             let errorText = `Operation failed (${response.status} ${response.statusText})`;
             try {
                 const errorJson = await response.json();
                 errorText = errorJson.message || errorText;
             } catch(e) {
                 // If response is not JSON, try reading as text
                 try { errorText = await response.text() || errorText; } catch (e2) {}
             }
             console.error(`API Error for ${url}: ${errorText}`);
             alert(errorText); // Show specific error from server if possible
        }
    } catch (error) {
        console.error(`Network or execution error for ${url}:`, error);
        alert("An error occurred. Please check the console.");
    }
}

async function addMember() {
    const name = memberNameInput.value.trim(); if (!name) { alert('Please enter a member name.'); return; }
    memberNameInput.value = ''; // Clear input immediately
    memberNameInput.focus();
    await apiCall('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }, () => {
        renderTeamList(); // Only need to re-render team list & dropdown
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Re-render calendar with potentially new members
    });
}

async function removeMember(nameToRemove) {
    if (!nameToRemove || !confirm(`Remove ${nameToRemove}? This also removes their unavailability entries.`)) return;
    await apiCall(`/api/team-members/${encodeURIComponent(nameToRemove)}`, {
        method: 'DELETE'
    }, () => {
        renderTeamList();       // Member list changed
        renderUnavailableList(); // Their unavailability was removed
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Recalculate schedule
    });
}

async function addPosition() {
    const name = positionNameInput.value.trim(); if (!name) { alert('Please enter a position name.'); return; }
    positionNameInput.value = '';
    positionNameInput.focus();
    await apiCall('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }, () => {
        renderPositionList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function removePosition(positionId) {
    const positionToRemove = positions.find(p => p.id === positionId);
    if (!positionToRemove || !confirm(`Remove Position: "${positionToRemove.name}"?`)) return;
    await apiCall(`/api/positions/${positionId}`, {
        method: 'DELETE'
    }, () => {
        renderPositionList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    });
}

async function addUnavailability() {
    const dateValue = unavailabilityDateInput.value; // YYYY-MM-DD format from input type="date"
    const memberName = unavailabilityMemberSelect.value;
    if (!dateValue || !memberName) { alert("Please select both a date and a member."); return; }

    await apiCall('/api/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: memberName, date: dateValue })
    }, () => {
        renderUnavailableList(); // Re-render the filtered list
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Recalculate schedule
    });
}

async function removeUnavailability(idToRemove) {
     if (!idToRemove || !confirm(`Remove this unavailability entry?`)) return;
     await apiCall(`/api/unavailability/${idToRemove}`, {
        method: 'DELETE'
     }, () => {
        renderUnavailableList(); // Re-render filtered list
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Recalculate schedule
     });
}

async function addOverrideDay() {
    const dateValue = overrideDateInput.value; // YYYY-MM-DD
    if (!dateValue) { alert("Please select a date to set as an override."); return; }

    overrideDateInput.value = ''; // Clear input

    await apiCall('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateValue })
    }, () => {
        renderOverrideDaysList(); // Re-render filtered list
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Recalculate schedule
    });
}

async function removeOverrideDay(dateStr) { // Takes YYYY-MM-DD string
     const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString();
     if (!dateStr || !confirm(`Remove override for ${displayDate}? Assignments will revert to default logic for this day.`)) return;
     await apiCall(`/api/overrides/${dateStr}`, { // Date is part of URL
        method: 'DELETE'
     }, () => {
        renderOverrideDaysList(); // Re-render filtered list
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Recalculate schedule
     });
}

async function logout() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login.html'; // Redirect to login on successful logout
        } else {
            const result = await response.json();
            alert(`Logout failed: ${result.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout request failed. Check console.');
    }
}

// <<< NEW: Add User Function >>>
async function addUser() {
    const username = newUsernameInput.value.trim();
    const password = newPasswordInput.value; // Get password as is (don't trim)
    const role = newUserRoleSelect.value;

    // Clear previous feedback
    userFeedbackMessage.textContent = '';
    userFeedbackMessage.className = 'feedback-message'; // Reset class

    // Basic client-side validation
    if (!username || !password || !role) {
        userFeedbackMessage.textContent = 'Please fill in all user fields.';
        userFeedbackMessage.classList.add('error');
        return;
    }
     if (password.length < 6) { // Match server validation if possible
        userFeedbackMessage.textContent = 'Password must be at least 6 characters.';
        userFeedbackMessage.classList.add('error');
        return;
    }

    console.log(`Attempting to add user: ${username}, Role: ${role}`); // Don't log password

    // Disable button during request
    addUserBtn.disabled = true;
    addUserBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role }) // Send plain password to server
        });

        const result = await response.json(); // Expect JSON response

        if (response.ok && result.success) {
            userFeedbackMessage.textContent = result.message || `User '${username}' added successfully!`;
            userFeedbackMessage.classList.add('success');
            // Clear the form on success
            newUsernameInput.value = '';
            newPasswordInput.value = '';
            newUserRoleSelect.value = 'user'; // Reset role to default
            console.log(`Successfully added user: ${username}`);
            // Optional: Clear message after a few seconds
            setTimeout(() => {
                userFeedbackMessage.textContent = '';
                userFeedbackMessage.className = 'feedback-message';
            }, 5000); // Clear after 5 seconds
        } else {
             // Display error message from server
             userFeedbackMessage.textContent = result.message || `Failed to add user (${response.status})`;
             userFeedbackMessage.classList.add('error');
             console.error(`Failed to add user: ${response.status}`, result);
        }
    } catch (error) {
        console.error("Error during add user request:", error);
        userFeedbackMessage.textContent = 'A network error occurred. Please try again.';
        userFeedbackMessage.classList.add('error');
    } finally {
        // Re-enable button
        addUserBtn.disabled = false;
        addUserBtn.textContent = 'Add User';
    }
}


// --- Event Listeners ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    renderUnavailableList(); // UPDATE: Re-render list on month change
    renderOverrideDaysList(); // UPDATE: Re-render list on month change
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    renderUnavailableList(); // UPDATE: Re-render list on month change
    renderOverrideDaysList(); // UPDATE: Re-render list on month change
});

randomizeBtn.addEventListener('click', () => {
    if (teamMembers.length > 0) {
        // Create a shuffled copy for this rendering only, doesn't change master list
        let shuffledMembers = [...teamMembers];
        shuffleArray(shuffledMembers);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth(), shuffledMembers);
        alert("Assignments randomized for current view. Add/remove members or navigate months to reset to default order.");
    } else {
        alert("Add team members before randomizing.");
    }
});

logoutBtn.addEventListener('click', logout);

// Member listeners
addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addMember(); }});

// Position listeners
addPositionBtn.addEventListener('click', addPosition);
positionNameInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addPosition(); }});

// Unavailability listener
addUnavailabilityBtn.addEventListener('click', addUnavailability);

// Override Day listeners
addOverrideDayBtn.addEventListener('click', addOverrideDay);
overrideDateInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') { event.preventDefault(); addOverrideDay(); }});

// <<< NEW User Listener >>>
addUserBtn.addEventListener('click', addUser);
// Optional: Add user on Enter press in password field
newPasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        addUser();
    }
});


// --- Theme Toggle ---
function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light'; // Default to light
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Add event listener for theme toggle (assuming button exists in HTML)
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
     themeToggleBtn.addEventListener('click', toggleTheme);
} else {
    console.warn("Theme toggle button not found in the DOM.");
}


// --- Initial Load ---
async function initializeAdminView() {
    console.log("Initializing Admin View...");
    initializeTheme(); // Set theme early
    if (await fetchData()) { // Fetch data first
        console.log("Data fetch successful. Rendering components.");
        renderTeamList();
        renderPositionList();
        renderUnavailableList(); // Render filtered list for initial month
        renderOverrideDaysList(); // Render filtered list for initial month
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Finally render calendar
    } else {
         console.error("Initialization failed due to data fetch error.");
         // Maybe display an error message in the UI body
         document.getElementById('scheduler').innerHTML = '<p style="color: red; padding: 20px;">Failed to load application data. Please try refreshing the page. Check console for details.</p>';
    }
}

// Start the application
initializeAdminView();
