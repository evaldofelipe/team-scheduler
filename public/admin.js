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
const positionList = document.getElementById('position-list'); // Container UL
const positionFeedbackMessage = document.getElementById('position-feedback-message'); // Feedback div
// Unavailability
const unavailabilityDateInput = document.getElementById('unavailabilityDate');
const unavailabilityMemberSelect = document.getElementById('unavailabilityMember');
const addUnavailabilityBtn = document.getElementById('addUnavailabilityBtn');
const unavailableList = document.getElementById('unavailable-list');
// Override Days
const overrideDateInput = document.getElementById('overrideDateInput');
const addOverrideDayBtn = document.getElementById('addOverrideDayBtn');
const overrideDaysList = document.getElementById('override-days-list');
// Special Assignments
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
let positions = []; // Now expects {id, name, assignment_type, allowed_days}
let unavailableEntries = [];
let overrideDays = [];
let specialAssignments = [];
let assignmentCounter = 0;
let memberPositions = new Map(); // Store member position assignments
let heldDays = new Map(); // Still use Map for temporary storage

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // For labels

// --- Helper Functions ---
function shuffleArray(array) { /* ... unchanged ... */
    for(let i = array.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
}
function formatDateYYYYMMDD(dateInput) { /* ... unchanged ... */
     try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction Functions ---
async function fetchData() {
    console.log("Fetching data...");
    try {
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments')
        ]);

        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes];
        if (responses.some(res => res.status === 401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false;
        }

        const errors = [];
        if (!membersRes.ok) errors.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
        if (!unavailRes.ok) errors.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
        if (!positionsRes.ok) errors.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`); // Check positions response
        if (!overridesRes.ok) errors.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
        if (!specialAssignRes.ok) errors.push(`Special Assignments: ${specialAssignRes.status} ${specialAssignRes.statusText}`);

        if (errors.length > 0) { throw new Error(`HTTP error fetching data! Statuses - ${errors.join(', ')}`); }

        teamMembers = await membersRes.json();
        
        // Fetch positions for each member
        memberPositions.clear();
        await Promise.all(teamMembers.map(async (member) => {
            const response = await fetch(`/api/member-positions/${encodeURIComponent(member)}`);
            if (response.ok) {
                const positions = await response.json();
                memberPositions.set(member, positions);
            }
        }));

        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json(); // <<< Store positions with new fields
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json();

        console.log("Fetched Positions (with config):", positions); // Log updated positions
        // ... other logs ...
        return true;

    } catch (error) { /* ... error handling unchanged ... */
        console.error("Failed to fetch initial data:", error); if (!document.body.dataset.fetchErrorShown) { alert("Failed to load critical data..."); document.body.dataset.fetchErrorShown = "true"; } return false;
    }
}

// --- UI Rendering Functions ---

function renderTeamList() {
    teamList.innerHTML = '';
    const sortedMembers = [...teamMembers].sort();
    
    sortedMembers.forEach((member) => {
        const li = document.createElement('li');
        li.className = 'team-member-item';
        li.dataset.memberName = member; // Add data attribute
        
        // Member name and delete button container
        const headerDiv = document.createElement('div');
        headerDiv.className = 'member-header';
        headerDiv.textContent = member;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Remove ${member}`;
        deleteBtn.onclick = () => removeMember(member);
        headerDiv.appendChild(deleteBtn);
        
        li.appendChild(headerDiv);
        
        // Position selection
        const positionsDiv = document.createElement('div');
        positionsDiv.className = 'member-positions';
        
        const memberCurrentPositions = memberPositions.get(member) || [];
        positions.forEach(position => {
            const label = document.createElement('label');
            label.className = 'position-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = position.id;
            checkbox.checked = memberCurrentPositions.some(p => p.id === position.id);
            checkbox.addEventListener('change', () => updateMemberPositions(member));
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${position.name}`));
            positionsDiv.appendChild(label);
        });
        
        li.appendChild(positionsDiv);
        teamList.appendChild(li);
    });
    if (teamList.lastChild) teamList.lastChild.style.borderBottom = 'none';
    populateMemberDropdown();
}

// <<< MAJOR REWRITE: renderPositionList >>>
function renderPositionList() {
    positionList.innerHTML = ''; // Clear the container
    positionFeedbackMessage.textContent = ''; // Clear previous feedback
    const sortedPositions = [...positions].sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

    sortedPositions.forEach(position => {
        const li = document.createElement('li');
        li.dataset.positionId = position.id; // Store ID for reference

        // --- Position Details Wrapper ---
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'position-details';

        // Position Name (Could be made editable later)
        const nameSpan = document.createElement('span');
        nameSpan.className = 'position-name';
        nameSpan.textContent = position.name;
        detailsDiv.appendChild(nameSpan);

        // --- Configuration Section ---
        const configDiv = document.createElement('div');
        configDiv.className = 'position-config';

        // Assignment Type Radio Buttons
        const typeFieldset = document.createElement('fieldset');
        typeFieldset.className = 'assignment-type-group';
        const typeLegend = document.createElement('legend'); // Good for accessibility
        typeLegend.textContent = 'Assignment Type:';
        typeFieldset.appendChild(typeLegend);

        ['regular', 'specific_days'].forEach(type => {
            const typeId = `pos-${position.id}-type-${type}`;
            const label = document.createElement('label');
            label.htmlFor = typeId;
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `pos-${position.id}-assignment-type`; // Group radios per position
            radio.id = typeId;
            radio.value = type;
            radio.checked = (position.assignment_type === type);

            // Add event listener to toggle day checkboxes
            radio.addEventListener('change', (e) => {
                const dayCheckboxesFieldset = li.querySelector('.allowed-days-group');
                if (dayCheckboxesFieldset) {
                    dayCheckboxesFieldset.disabled = (e.target.value !== 'specific_days');
                }
            });

            label.appendChild(radio);
            label.appendChild(document.createTextNode(type === 'regular' ? ' Regular (Sun/Wed/Sat + Overrides)' : ' Specific Days Only'));
            typeFieldset.appendChild(label);
        });
        configDiv.appendChild(typeFieldset);

        // Allowed Days Checkboxes
        const daysFieldset = document.createElement('fieldset');
        daysFieldset.className = 'allowed-days-group';
        const daysLegend = document.createElement('legend');
        daysLegend.className = 'visually-hidden'; // Hide legend visually
        daysLegend.textContent = 'Allowed Specific Days';
        daysFieldset.appendChild(daysLegend);

        const currentAllowedDays = position.allowed_days ? position.allowed_days.split(',') : [];
        DAY_NAMES.forEach((dayName, index) => {
            const dayId = `pos-${position.id}-day-${index}`;
            const label = document.createElement('label');
            label.htmlFor = dayId;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = dayId;
            checkbox.value = index.toString(); // Use 0-6 as value
            checkbox.checked = currentAllowedDays.includes(index.toString());

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${dayName}`));
            daysFieldset.appendChild(label);
        });
        // Initial disabled state based on type
        daysFieldset.disabled = (position.assignment_type !== 'specific_days');
        configDiv.appendChild(daysFieldset);

        detailsDiv.appendChild(configDiv);
        li.appendChild(detailsDiv);

        // --- Action Buttons ---
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'position-actions';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-position-btn';
        saveBtn.title = `Save changes for ${position.name}`;
        saveBtn.onclick = () => updatePosition(position.id); // Pass ID to handler
        actionsDiv.appendChild(saveBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'delete-position-btn'; // Maybe use a specific class
        deleteBtn.title = `Remove Position: ${position.name}`;
        deleteBtn.onclick = () => removePosition(position.id);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(actionsDiv);

        positionList.appendChild(li); // Add the fully constructed item to the list
    });

    // Update other dropdowns that depend on positions
    populateSpecialAssignmentPositionDropdown();
}

function populateMemberDropdown() { /* ... unchanged ... */
    const currentSelection = unavailabilityMemberSelect.value; unavailabilityMemberSelect.innerHTML = '<option value="">-- Select Member --</option>'; const sortedMembers = [...teamMembers].sort(); sortedMembers.forEach(member => { const option = document.createElement('option'); option.value = member; option.textContent = member; if (member === currentSelection) { option.selected = true; } unavailabilityMemberSelect.appendChild(option); });
}
function populateSpecialAssignmentPositionDropdown() { /* ... unchanged ... */
    const currentSelection = specialAssignmentPositionSelect.value; specialAssignmentPositionSelect.innerHTML = '<option value="">-- Select Position --</option>'; const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name)); sortedPositions.forEach(position => { const option = document.createElement('option'); option.value = position.id; option.textContent = position.name; if (position.id.toString() === currentSelection) { option.selected = true; } specialAssignmentPositionSelect.appendChild(option); });
}
function renderUnavailableList() { /* ... unchanged ... */
    unavailableList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth(); const filteredEntries = unavailableEntries.filter(entry => { const entryDate = new Date(entry.date + 'T00:00:00Z'); return entryDate.getUTCFullYear() === currentYear && entryDate.getUTCMonth() === currentMonth; }); filteredEntries.sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member)); if (filteredEntries.length === 0) { unavailableList.innerHTML = '<li>No unavailability this month.</li>'; const placeholderLi = unavailableList.querySelector('li'); if(placeholderLi){ placeholderLi.style.cssText = '...'; } } else { filteredEntries.forEach((entry) => { const li = document.createElement('li'); const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString(); li.textContent = `${displayDate} - ${entry.member}`; const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove unavail ${entry.member} ${displayDate}`; removeBtn.onclick = () => removeUnavailability(entry.id); li.appendChild(removeBtn); unavailableList.appendChild(li); }); } if (unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';
}
function renderOverrideDaysList() { /* ... unchanged ... */
    overrideDaysList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth(); const filteredOverrideDays = overrideDays.filter(dateStr => { const overrideDate = new Date(dateStr + 'T00:00:00Z'); return overrideDate.getUTCFullYear() === currentYear && overrideDate.getUTCMonth() === currentMonth; }); filteredOverrideDays.sort(); if (filteredOverrideDays.length === 0) { overrideDaysList.innerHTML = '<li>No overrides this month.</li>'; const placeholderLi = overrideDaysList.querySelector('li'); if(placeholderLi){ placeholderLi.style.cssText = '...'; } } else { filteredOverrideDays.forEach((dateStr) => { const li = document.createElement('li'); const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString(); const dateSpan = document.createElement('span'); dateSpan.textContent = displayDate; li.appendChild(dateSpan); const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove Override ${displayDate}`; removeBtn.onclick = () => removeOverrideDay(dateStr); li.appendChild(removeBtn); overrideDaysList.appendChild(li); }); } if(overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
}
function renderSpecialAssignmentsList() { /* ... unchanged ... */
    specialAssignmentsList.innerHTML = ''; const currentYear = currentDate.getFullYear(); const currentMonth = currentDate.getMonth(); const filteredSpecialAssignments = specialAssignments.filter(sa => { const assignmentDate = new Date(sa.date + 'T00:00:00Z'); return assignmentDate.getUTCFullYear() === currentYear && assignmentDate.getUTCMonth() === currentMonth; }); filteredSpecialAssignments.sort((a, b) => a.date.localeCompare(b.date) || a.position_name.localeCompare(b.position_name)); if (filteredSpecialAssignments.length === 0) { specialAssignmentsList.innerHTML = '<li>No special slots this month.</li>'; const placeholderLi = specialAssignmentsList.querySelector('li'); if(placeholderLi) { placeholderLi.style.cssText = '...'; } } else { filteredSpecialAssignments.forEach((sa) => { const li = document.createElement('li'); const displayDate = new Date(sa.date + 'T00:00:00Z').toLocaleDateString(); li.textContent = `${displayDate} - ${sa.position_name}`; const removeBtn = document.createElement('button'); removeBtn.textContent = 'x'; removeBtn.title = `Remove special slot ${sa.position_name} on ${displayDate}`; removeBtn.onclick = () => removeSpecialAssignment(sa.id); li.appendChild(removeBtn); specialAssignmentsList.appendChild(li); }); } if(specialAssignmentsList.lastChild) specialAssignmentsList.lastChild.style.borderBottom = 'none';
}

function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... unchanged ... */
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}
// No longer need shouldAssignOnDate - logic is per-position now
// function shouldAssignOnDate(dayOfWeek, dateStr) { /* ... REMOVED ... */ }


// <<< MODIFIED renderCalendar function >>>
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
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);

                // Add hold checkbox container
                const holdContainer = document.createElement('div');
                holdContainer.className = 'hold-container';
                
                const holdCheckbox = document.createElement('input');
                holdCheckbox.type = 'checkbox';
                holdCheckbox.className = 'hold-checkbox';
                holdCheckbox.id = `hold-${currentCellDateStr}`;
                holdCheckbox.addEventListener('change', async (e) => {
                    if (e.target.checked) {
                        const assignments = Array.from(cell.querySelectorAll('.assigned-position')).map(div => {
                            const positionName = div.querySelector('strong').textContent;
                            const memberName = div.textContent.split(':')[1].trim();
                            return {
                                date: currentCellDateStr,
                                position_name: positionName,
                                member_name: memberName
                            };
                        });
                        
                        try {
                            const response = await fetch('/api/held-assignments', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ assignments })
                            });
                            
                            if (response.ok) {
                                heldDays.set(currentCellDateStr, assignments);
                            } else {
                                e.target.checked = false;
                                alert('Failed to save held assignments');
                            }
                        } catch (error) {
                            console.error('Error saving held assignments:', error);
                            e.target.checked = false;
                            alert('Error saving held assignments');
                        }
                    } else {
                        try {
                            const response = await fetch(`/api/held-assignments/${currentCellDateStr}`, {
                                method: 'DELETE'
                            });
                            
                            if (response.ok) {
                                heldDays.delete(currentCellDateStr);
                            } else {
                                e.target.checked = true;
                                alert('Failed to remove held assignments');
                            }
                        } catch (error) {
                            console.error('Error removing held assignments:', error);
                            e.target.checked = true;
                            alert('Error removing held assignments');
                        }
                    }
                });

                const holdLabel = document.createElement('label');
                holdLabel.htmlFor = `hold-${currentCellDateStr}`;
                holdLabel.textContent = 'Hold';
                holdLabel.className = 'hold-label';

                // Add small randomize button
                const smallRandomizeBtn = document.createElement('button');
                smallRandomizeBtn.className = 'small-randomize-btn';
                smallRandomizeBtn.title = 'Randomize this day';
                smallRandomizeBtn.textContent = '🎲';
                smallRandomizeBtn.onclick = (e) => {
                    e.preventDefault(); // Prevent form submission if inside a form
                    
                    if (teamMembers.length > 0) {
                        let shuffledMembers = [...teamMembers];
                        shuffleArray(shuffledMembers);
                        
                        // Only re-render assignments for this specific day
                        const assignmentDivs = cell.querySelectorAll('.assigned-position');
                        assignmentDivs.forEach(div => {
                            if (!holdCheckbox.checked) { // Only randomize if not held
                                const position = div.querySelector('strong').textContent;
                                let assigned = false;
                                let attempts = 0;
                                
                                while (!assigned && attempts < shuffledMembers.length) {
                                    const memberIndex = (assignmentCounter + attempts) % shuffledMembers.length;
                                    const memberName = shuffledMembers[memberIndex];
                                    
                                    if (!isMemberUnavailable(memberName, currentCellDateStr)) {
                                        div.innerHTML = `<strong>${position}</strong>: ${memberName}`;
                                        assigned = true;
                                        assignmentCounter = (assignmentCounter + attempts + 1) % shuffledMembers.length;
                                    }
                                    attempts++;
                                }
                                
                                if (!assigned) {
                                    div.innerHTML = `<strong>${position}</strong>: (Unavailable)`;
                                    assignmentCounter = (assignmentCounter + 1) % shuffledMembers.length;
                                }
                            }
                        });
                    }
                };

                holdContainer.appendChild(holdCheckbox);
                holdContainer.appendChild(holdLabel);
                holdContainer.appendChild(smallRandomizeBtn);
                cell.appendChild(holdContainer);

                const dateNumber = document.createElement('span');
                dateNumber.classList.add('date-number');
                dateNumber.textContent = date;
                dateNumber.dataset.date = currentCellDateStr;
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
                    } else { console.warn(`Could not find position details for special assignment ID ${sa.id}`); }
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
                            if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) && 
                                isMemberQualified(potentialMemberName, position.id)) {
                                assignedMemberName = potentialMemberName;
                                assignmentCounter = (assignmentCounter + attempts + 1);
                            }
                            attempts++;
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


// --- Action Functions (Call APIs & Update UI) ---

// Generic helper - Modified to add more logging
async function apiCall(url, options, successCallback, errorCallback) {
    console.log(`Making API call to ${url}`, options); // Debug logging
    try {
        const response = await fetch(url, options);
        console.log(`Response status: ${response.status}`); // Debug logging

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login.html?message=Session expired...';
            return false;
        }

        const isSuccess = response.ok || (options.method === 'DELETE' && response.status === 404);
        
        if (isSuccess) {
            console.log('API call successful, fetching updated data...'); // Debug logging
            // First refresh the data
            const dataRefreshed = await fetchData();
            
            if (dataRefreshed) {
                console.log('Data refresh successful, updating UI...'); // Debug logging
                // Update all relevant UI components
                renderTeamList();
                renderPositionList();
                renderUnavailableList();
                renderOverrideDaysList();
                renderSpecialAssignmentsList();
                renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
                
                if (successCallback) successCallback();
                return true;
            }
        } else {
            let errorText = `Operation failed (${response.status})`;
            try {
                const errorData = await response.json();
                errorText = errorData.message || errorData.error || errorText;
            } catch (e) {
                try {
                    const text = await response.text();
                    if (text && !text.trim().startsWith('<')) errorText = text;
                } catch(e2) {}
            }
            
            console.error(`API Error:`, errorText); // Debug logging
            if (errorCallback) {
                errorCallback(errorText);
            } else {
                alert(errorText);
            }
            return false;
        }
    } catch (error) {
        console.error(`Network error:`, error); // Debug logging
        if (errorCallback) {
            errorCallback("A network error occurred.");
        } else {
            alert("A network error occurred.");
        }
        return false;
    }
}

// --- Member Actions ---
async function addMember() {
    console.log('Adding member...'); // Debug logging
    const name = memberNameInput.value.trim();
    if (!name) {
        alert('Please enter a member name.');
        return;
    }

    await apiCall('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });

    // Clear input only after successful addition
    memberNameInput.value = '';
    memberNameInput.focus();
}

// --- Position Actions ---
async function addPosition() {
    console.log('Adding position...'); // Debug logging
    const name = positionNameInput.value.trim();
    if (!name) {
        alert('Please enter a position name.');
        return;
    }

    await apiCall('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });

    // Clear input only after successful addition
    positionNameInput.value = '';
    positionNameInput.focus();
}

// --- Unavailability Actions ---
async function addUnavailability() {
    console.log('Adding unavailability...'); // Debug logging
    const date = unavailabilityDateInput.value;
    const member = unavailabilityMemberSelect.value;
    
    if (!date || !member) {
        alert('Please select both a date and a member.');
        return;
    }

    await apiCall('/api/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, member })
    });

    // Clear inputs only after successful addition
    unavailabilityDateInput.value = '';
    unavailabilityMemberSelect.value = '';
}

// --- Override Day Actions ---
async function addOverrideDay() {
    console.log('Add override day button clicked'); // Add logging
    const date = overrideDateInput.value;
    if (!date) {
        alert('Please select a date.');
        return;
    }
    
    await apiCall('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
    });
    
    overrideDateInput.value = '';
}

// --- Special Assignment Actions ---
async function addSpecialAssignment() {
    console.log('Add special assignment button clicked'); // Add logging
    const date = specialAssignmentDateInput.value;
    const position_id = specialAssignmentPositionSelect.value;
    
    if (!date || !position_id) {
        alert('Please select both a date and a position.');
        return;
    }
    
    await apiCall('/api/special-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, position_id })
    });
    
    // Clear inputs after successful addition
    specialAssignmentDateInput.value = '';
    specialAssignmentPositionSelect.value = '';
}

// --- Member Actions ---
async function removeMember(nameToRemove) {
    if (!confirm(`Remove team member: "${nameToRemove}"?`)) return;
    
    await apiCall(`/api/team-members/${encodeURIComponent(nameToRemove)}`, {
        method: 'DELETE'
    });
}

// --- Position Actions ---
async function updatePosition(positionId) {
    const listItem = positionList.querySelector(`li[data-position-id="${positionId}"]`);
    if (!listItem) { console.error("Could not find list item for position ID:", positionId); return; }
    positionFeedbackMessage.textContent = ''; // Clear previous feedback

    // Find elements within this specific list item
    const nameSpan = listItem.querySelector('.position-name'); // If made editable later, change selector
    const name = nameSpan ? nameSpan.textContent : 'Unknown'; // Get current name for messages
    const typeRadio = listItem.querySelector('input[type="radio"][name^="pos-"]:checked');
    const dayCheckboxes = listItem.querySelectorAll('.allowed-days-group input[type="checkbox"]:checked');

    if (!typeRadio) { alert(`Could not determine assignment type for ${name}.`); return; }

    const assignmentType = typeRadio.value;
    let allowedDays = null;

    if (assignmentType === 'specific_days') {
        const selectedDays = Array.from(dayCheckboxes).map(cb => cb.value);
        if (selectedDays.length === 0) {
             positionFeedbackMessage.textContent = `Error for '${name}': Specific days type requires at least one day to be selected.`;
             positionFeedbackMessage.className = 'feedback-message error';
             return; // Prevent saving invalid state
        }
        allowedDays = selectedDays.sort().join(','); // Create sorted comma-separated string
    }

    const dataToUpdate = {
        name: name, // Currently not editing name, but send it back
        assignment_type: assignmentType,
        allowed_days: allowedDays // Will be null if type is 'regular'
        // Could add display_order update here later if needed
    };

    console.log(`Updating position ${positionId} with:`, dataToUpdate);

    // Use apiCall - it will re-fetch data and trigger re-renders on success
    await apiCall(`/api/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToUpdate)
    }, () => {
        // Success message (re-fetch/re-render handled by apiCall)
        positionFeedbackMessage.textContent = `Position '${name}' updated successfully.`;
        positionFeedbackMessage.className = 'feedback-message success';
        setTimeout(() => { positionFeedbackMessage.textContent = ''; positionFeedbackMessage.className = 'feedback-message'; }, 4000);
        // Note: renderCalendar will be called automatically due to fetchData in apiCall
    }, (errorText) => {
        // Error message
        positionFeedbackMessage.textContent = `Error updating position '${name}': ${errorText}`;
        positionFeedbackMessage.className = 'feedback-message error';
        // Optionally revert UI changes here, but re-fetch on success should handle most cases
    });
}


async function removePosition(positionId) {
    const positionToRemove = positions.find(p => p.id === positionId);
    if (!positionToRemove || !confirm(`Remove Position: "${positionToRemove.name}"? Also removes special slots.`)) return;
    
    await apiCall(`/api/positions/${positionId}`, {
        method: 'DELETE'
    });
}

// --- Unavailability Actions ---
async function removeUnavailability(idToRemove) {
    if (!confirm('Remove this unavailability entry?')) return;
    
    await apiCall(`/api/unavailability/${idToRemove}`, {
        method: 'DELETE'
    });
}

// --- Override Day Actions ---
async function removeOverrideDay(dateStr) {
    if (!confirm(`Remove override day: ${new Date(dateStr).toLocaleDateString()}?`)) return;
    
    await apiCall(`/api/overrides/${dateStr}`, {
        method: 'DELETE'
    });
}

// --- Special Assignment Actions ---
async function removeSpecialAssignment(idToRemove) {
    if (!confirm('Remove this special assignment?')) return;
    
    await apiCall(`/api/special-assignments/${idToRemove}`, {
        method: 'DELETE'
    });
}

// --- User Management Actions ---
async function addUser() {
    console.log('Adding new user...'); // Debug logging
    
    const username = newUsernameInput.value.trim();
    const password = newPasswordInput.value.trim();
    const role = newUserRoleSelect.value;

    // Validation
    if (!username || !password) {
        userFeedbackMessage.textContent = 'Username and password are required.';
        userFeedbackMessage.className = 'feedback-message error';
        return;
    }

    if (password.length < 6) {
        userFeedbackMessage.textContent = 'Password must be at least 6 characters long.';
        userFeedbackMessage.className = 'feedback-message error';
        return;
    }

    await apiCall('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    }, () => {
        // Success callback
        userFeedbackMessage.textContent = `User '${username}' created successfully.`;
        userFeedbackMessage.className = 'feedback-message success';
        
        // Clear inputs
        newUsernameInput.value = '';
        newPasswordInput.value = '';
        newUserRoleSelect.value = 'user'; // Reset to default role
        
        // Clear success message after a delay
        setTimeout(() => {
            userFeedbackMessage.textContent = '';
            userFeedbackMessage.className = 'feedback-message';
        }, 4000);
    }, (errorText) => {
        // Error callback
        userFeedbackMessage.textContent = `Error creating user: ${errorText}`;
        userFeedbackMessage.className = 'feedback-message error';
    });
}

// --- Logout --- (Unchanged)
async function logout() { /* ... */ }

// --- Event Listeners ---
prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); });
randomizeBtn.addEventListener('click', () => {
    if (teamMembers.length > 0) {
        // Store current held assignments before rendering
        const currentHeldAssignments = new Map(heldDays);
        
        let shuffledMembers = [...teamMembers];
        shuffleArray(shuffledMembers);
        
        // Render calendar with new random assignments
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth(), shuffledMembers);

        // Restore held assignments
        currentHeldAssignments.forEach((assignments, dateStr) => {
            const cell = document.querySelector(`td .date-number[data-date="${dateStr}"]`)?.parentElement;
            if (cell) {
                // Restore assignments
                assignments.forEach(({ position_name, member_name }) => {
                    const assignmentDivs = cell.querySelectorAll('.assigned-position');
                    for (const div of assignmentDivs) {
                        if (div.querySelector('strong').textContent === position_name) {
                            div.innerHTML = `<strong>${position_name}</strong>: ${member_name}`;
                            break;
                        }
                    }
                });

                // Make sure to update the checkbox
                const checkbox = cell.querySelector('.hold-checkbox');
                if (checkbox) {
                    checkbox.checked = true;
                }

                // Keep the assignments in the heldDays Map
                heldDays.set(dateStr, assignments);
            }
        });
    } else {
        alert("Add team members first.");
    }
});
logoutBtn.addEventListener('click', logout);
// Member listeners (Unchanged)
addMemberBtn.addEventListener('click', addMember); memberNameInput.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); addMember();} });
// Position listeners
addPositionBtn.addEventListener('click', addPosition); positionNameInput.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); addPosition();} });
// Unavailability listener (Unchanged)
addUnavailabilityBtn.addEventListener('click', addUnavailability);
// Override Day listeners (Unchanged)
addOverrideDayBtn.addEventListener('click', addOverrideDay); overrideDateInput.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); addOverrideDay();} });
// Special Assignment listener (Unchanged)
addSpecialAssignmentBtn.addEventListener('click', addSpecialAssignment);
// User listener (Unchanged)
addUserBtn.addEventListener('click', addUser); newPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addUser();
    }
});

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
async function initializeAdminView() {
    console.log("Initializing Admin View...");
    initializeTheme();
    if (await fetchData()) {
        console.log("Data fetch successful. Rendering components.");
        await loadHeldAssignments(); // Load held assignments
        renderTeamList();
        renderPositionList();
        renderUnavailableList();
        renderOverrideDaysList();
        renderSpecialAssignmentsList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    } else {
         console.error("Initialization failed..."); document.getElementById('scheduler').innerHTML = '<p>Failed to load...</p>';
    }
}

// Start the application
initializeAdminView();

// Update function to use a more compatible selector approach
async function updateMemberPositions(memberName) {
    // Find the member's list item using a data attribute
    const memberItems = Array.from(teamList.querySelectorAll('.team-member-item'));
    const memberItem = memberItems.find(item => 
        item.querySelector('.member-header').textContent.trim().includes(memberName)
    );
    
    if (!memberItem) {
        console.error(`Could not find list item for member: ${memberName}`);
        return;
    }
    
    const checkedPositions = Array.from(
        memberItem.querySelectorAll('.member-positions input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value));
    
    await apiCall(`/api/member-positions/${encodeURIComponent(memberName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionIds: checkedPositions })
    });
}

// Update the assignment logic in renderCalendar
function isMemberQualified(memberName, positionId) {
    const memberPositionsList = memberPositions.get(memberName) || [];
    return memberPositionsList.some(p => p.id === positionId);
}

// Add this function to save current assignments
function saveCurrentAssignments() {
    heldDays.clear(); // Clear previous holds
    
    // Get all calendar cells that have assignments
    const cells = document.querySelectorAll('#calendar-body td:not(.other-month)');
    
    cells.forEach(cell => {
        const assignments = Array.from(cell.querySelectorAll('.assigned-position')).map(div => {
            const positionName = div.querySelector('strong').textContent;
            const memberName = div.textContent.split(':')[1].trim();
            return { position: positionName, member: memberName };
        });
        
        if (assignments.length > 0) {
            // Find the date for this cell
            const dateStr = formatDateYYYYMMDD(new Date(currentDate.getFullYear(), currentDate.getMonth(), parseInt(cell.querySelector('.date-number').textContent)));
            heldDays.set(dateStr, assignments);
            
            // Update checkbox
            const checkbox = cell.querySelector('.hold-checkbox');
            if (checkbox) {
                checkbox.checked = true;
            }
        }
    });
    
    alert('Current assignments saved and held');
}

// Add this function to clear all holds
function clearAllHolds() {
    heldDays.clear();
    document.querySelectorAll('.hold-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    alert('All holds cleared');
}

// Add these event listeners with your other listeners
const saveHoldsBtn = document.getElementById('saveHoldsBtn');
const clearHoldsBtn = document.getElementById('clearHoldsBtn');

saveHoldsBtn.addEventListener('click', saveCurrentAssignments);
clearHoldsBtn.addEventListener('click', clearAllHolds);

// Add function to load held assignments from database
async function loadHeldAssignments() {
    try {
        const response = await fetch('/api/held-assignments');
        if (response.ok) {
            const assignments = await response.json();
            heldDays.clear();
            
            // Group assignments by date
            assignments.forEach(assignment => {
                const dateAssignments = heldDays.get(assignment.assignment_date) || [];
                dateAssignments.push({
                    position_name: assignment.position_name,
                    member_name: assignment.member_name
                });
                heldDays.set(assignment.assignment_date, dateAssignments);
            });
            
            // Update checkboxes
            document.querySelectorAll('.hold-checkbox').forEach(checkbox => {
                const dateStr = checkbox.id.replace('hold-', '');
                checkbox.checked = heldDays.has(dateStr);
            });
        }
    } catch (error) {
        console.error('Error loading held assignments:', error);
    }
}
