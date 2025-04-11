// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const logoutBtn = document.getElementById('logoutBtn');
// Team Members
const memberNameInput = document.getElementById('memberNameInput');
const memberPhoneInput = document.getElementById('memberPhoneInput');
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
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments'),
            fetch('/api/all-member-positions'),
            fetch('/api/held-assignments')
        ]);

        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes];
        if (responses.some(res => res.status === 401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false;
        }

        const errors = [];
        if (!membersRes.ok) errors.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
        if (!unavailRes.ok) errors.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
        if (!positionsRes.ok) errors.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`);
        if (!overridesRes.ok) errors.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
        if (!specialAssignRes.ok) errors.push(`Special Assignments: ${specialAssignRes.status} ${specialAssignRes.statusText}`);
        if (!allMemberPosRes.ok) errors.push(`All Member Positions: ${allMemberPosRes.status} ${allMemberPosRes.statusText}`);
        if (!heldAssignmentsRes.ok) errors.push(`Held Assignments: ${heldAssignmentsRes.status} ${heldAssignmentsRes.statusText}`);

        if (errors.length > 0) { throw new Error(`HTTP error fetching data! Statuses - ${errors.join(', ')}`); }

        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json();
        const allMemberPositionsData = await allMemberPosRes.json();
        const heldAssignmentsData = await heldAssignmentsRes.json();

        memberPositions.clear();
        for (const memberName in allMemberPositionsData) {
            memberPositions.set(memberName, allMemberPositionsData[memberName]);
        }

        heldDays.clear();
        heldAssignmentsData.forEach(assignment => {
            const dateStr = assignment.assignment_date;
            const dateAssignments = heldDays.get(dateStr) || [];
            dateAssignments.push({
                position_name: assignment.position_name,
                member_name: assignment.member_name
            });
            heldDays.set(dateStr, dateAssignments);
        });

        console.log("Fetched Team Members:", teamMembers);
        console.log("Fetched Positions (with config):", positions);
        console.log("Fetched Member Positions:", memberPositions);
        console.log("Fetched Held Assignments:", heldDays);
        return true;

    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        if (!document.body.dataset.fetchErrorShown) {
            alert("Failed to load critical data. Please check the console and try refreshing. If the problem persists, contact support.");
            document.body.dataset.fetchErrorShown = "true";
        }
        return false;
    }
}

// --- UI Rendering Functions ---

function renderTeamList() {
    teamList.innerHTML = '';
    const sortedMembers = [...teamMembers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    
    sortedMembers.forEach((member) => {
        const li = document.createElement('li');
        li.className = 'team-member-item';
        li.dataset.memberName = member.name;
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'member-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = member.name;
        infoDiv.appendChild(nameSpan);

        const phoneSpan = document.createElement('span');
        phoneSpan.className = 'member-phone';
        phoneSpan.textContent = member.phone_number || '(No phone)';
        infoDiv.appendChild(phoneSpan);

        li.appendChild(infoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'member-actions';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-member-btn';
        editBtn.title = `Edit ${member.name}`;
        editBtn.onclick = () => toggleEditMemberForm(member.name);
        actionsDiv.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'delete-member-btn';
        deleteBtn.title = `Remove ${member.name}`;
        deleteBtn.onclick = () => removeMember(member.name);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(actionsDiv);

        const positionsDiv = document.createElement('div');
        positionsDiv.className = 'member-positions';
        
        const memberCurrentPositions = memberPositions.get(member.name) || [];
        positions.forEach(position => {
            const label = document.createElement('label');
            label.className = 'position-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = position.id;
            checkbox.checked = memberCurrentPositions.some(p => p.id === position.id);
            checkbox.addEventListener('change', () => updateMemberPositions(member.name));
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${position.name}`));
            positionsDiv.appendChild(label);
        });
        
        li.appendChild(positionsDiv);

        const editFormDiv = document.createElement('div');
        editFormDiv.className = 'edit-member-form';
        editFormDiv.style.display = 'none';
        const editNameInput = document.createElement('input');
        editNameInput.type = 'text';
        editNameInput.className = 'edit-member-name-input';
        editNameInput.value = member.name;
        editNameInput.placeholder = 'Member Name';
        editNameInput.required = true;
        const editPhoneInput = document.createElement('input');
        editPhoneInput.type = 'tel';
        editPhoneInput.className = 'edit-member-phone-input';
        editPhoneInput.value = member.phone_number || '';
        editPhoneInput.placeholder = 'Phone Number (optional)';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-member-btn';
        saveBtn.onclick = () => updateMember(member.name);
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'cancel-edit-member-btn';
        cancelBtn.type = 'button';
        cancelBtn.onclick = () => toggleEditMemberForm(member.name, false);
        editFormDiv.appendChild(editNameInput);
        editFormDiv.appendChild(editPhoneInput);
        editFormDiv.appendChild(saveBtn);
        editFormDiv.appendChild(cancelBtn);
        li.appendChild(editFormDiv);

        teamList.appendChild(li);
    });

    if (teamList.lastChild) teamList.lastChild.style.borderBottom = 'none';
    populateMemberDropdown();
}

function toggleEditMemberForm(memberName, show = true) {
    const li = teamList.querySelector(`li[data-member-name="${memberName}"]`);
    if (!li) return;
    const infoDiv = li.querySelector('.member-info');
    const actionsDiv = li.querySelector('.member-actions');
    const positionsDiv = li.querySelector('.member-positions');
    const editFormDiv = li.querySelector('.edit-member-form');

    if (infoDiv && actionsDiv && positionsDiv && editFormDiv) {
        infoDiv.style.display = show ? 'none' : '';
        actionsDiv.style.display = show ? 'none' : '';
        positionsDiv.style.display = show ? 'none' : '';
        editFormDiv.style.display = show ? 'block' : 'none';
        if (show) {
            editFormDiv.querySelector('.edit-member-name-input')?.focus();
        } else {
             const member = teamMembers.find(m => m.name === memberName);
             if (member) {
                 editFormDiv.querySelector('.edit-member-name-input').value = member.name;
                 editFormDiv.querySelector('.edit-member-phone-input').value = member.phone_number || '';
             }
        }
    }
}

function populateMemberDropdown() {
    const currentSelection = unavailabilityMemberSelect.value;
    unavailabilityMemberSelect.innerHTML = '<option value="">-- Select Member --</option>';
    const sortedMembers = [...teamMembers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    sortedMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        option.textContent = member.name;
        if (member.name === currentSelection) {
            option.selected = true;
        }
        unavailabilityMemberSelect.appendChild(option);
    });
}

function renderPositionList() {
    positionList.innerHTML = '';
    positionFeedbackMessage.textContent = '';
    const sortedPositions = [...positions].sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

    sortedPositions.forEach(position => {
        const li = document.createElement('li');
        li.dataset.positionId = position.id;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'position-details';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'position-name';
        nameSpan.textContent = position.name;
        detailsDiv.appendChild(nameSpan);

        const configDiv = document.createElement('div');
        configDiv.className = 'position-config';

        const typeFieldset = document.createElement('fieldset');
        typeFieldset.className = 'assignment-type-group';
        const typeLegend = document.createElement('legend');
        typeLegend.textContent = 'Assignment Type:';
        typeFieldset.appendChild(typeLegend);

        ['regular', 'specific_days'].forEach(type => {
            const typeId = `pos-${position.id}-type-${type}`;
            const label = document.createElement('label');
            label.htmlFor = typeId;
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `pos-${position.id}-assignment-type`;
            radio.id = typeId;
            radio.value = type;
            radio.checked = (position.assignment_type === type);

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

        const daysFieldset = document.createElement('fieldset');
        daysFieldset.className = 'allowed-days-group';
        const daysLegend = document.createElement('legend');
        daysLegend.className = 'visually-hidden';
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
            checkbox.value = index.toString();
            checkbox.checked = currentAllowedDays.includes(index.toString());

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${dayName}`));
            daysFieldset.appendChild(label);
        });
        daysFieldset.disabled = (position.assignment_type !== 'specific_days');
        configDiv.appendChild(daysFieldset);

        detailsDiv.appendChild(configDiv);
        li.appendChild(detailsDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'position-actions';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-position-btn';
        saveBtn.title = `Save changes for ${position.name}`;
        saveBtn.onclick = () => updatePosition(position.id);
        actionsDiv.appendChild(saveBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'delete-position-btn';
        deleteBtn.title = `Remove Position: ${position.name}`;
        deleteBtn.onclick = () => removePosition(position.id);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(actionsDiv);

        positionList.appendChild(li);
    });

    populateSpecialAssignmentPositionDropdown();
}

function populateSpecialAssignmentPositionDropdown() {
    const currentSelection = specialAssignmentPositionSelect.value;
    specialAssignmentPositionSelect.innerHTML = '<option value="">-- Select Position --</option>';
    const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
    sortedPositions.forEach(position => {
        const option = document.createElement('option');
        option.value = position.id;
        option.textContent = position.name;
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
        unavailableList.innerHTML = '<li>No unavailability this month.</li>';
        const placeholderLi = unavailableList.querySelector('li');
        if(placeholderLi){ placeholderLi.style.cssText = '...'; }
    } else {
        filteredEntries.forEach((entry) => {
            const li = document.createElement('li');
            const displayDate = new Date(entry.date + 'T00:00:00Z').toLocaleDateString();
            li.textContent = `${displayDate} - ${entry.member}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove unavail ${entry.member} ${displayDate}`;
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
        overrideDaysList.innerHTML = '<li>No overrides this month.</li>';
        const placeholderLi = overrideDaysList.querySelector('li');
        if(placeholderLi){ placeholderLi.style.cssText = '...'; }
    } else {
        filteredOverrideDays.forEach((dateStr) => {
            const li = document.createElement('li');
            const displayDate = new Date(dateStr + 'T00:00:00Z').toLocaleDateString();
            const dateSpan = document.createElement('span');
            dateSpan.textContent = displayDate;
            li.appendChild(dateSpan);
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove Override ${displayDate}`;
            removeBtn.onclick = () => removeOverrideDay(dateStr);
            li.appendChild(removeBtn);
            overrideDaysList.appendChild(li);
        });
    }
    if(overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
}

function renderSpecialAssignmentsList() {
    specialAssignmentsList.innerHTML = '';
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const filteredSpecialAssignments = specialAssignments.filter(sa => {
        const assignmentDate = new Date(sa.date + 'T00:00:00Z');
        return assignmentDate.getUTCFullYear() === currentYear && assignmentDate.getUTCMonth() === currentMonth;
    });
    filteredSpecialAssignments.sort((a, b) => a.date.localeCompare(b.date) || a.position_name.localeCompare(b.position_name));
    if (filteredSpecialAssignments.length === 0) {
        specialAssignmentsList.innerHTML = '<li>No special slots this month.</li>';
        const placeholderLi = specialAssignmentsList.querySelector('li');
        if(placeholderLi) { placeholderLi.style.cssText = '...'; }
    } else {
        filteredSpecialAssignments.forEach((sa) => {
            const li = document.createElement('li');
            const displayDate = new Date(sa.date + 'T00:00:00Z').toLocaleDateString();
            li.textContent = `${displayDate} - ${sa.position_name}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Remove special slot ${sa.position_name} on ${displayDate}`;
            removeBtn.onclick = () => removeSpecialAssignment(sa.id);
            li.appendChild(removeBtn);
            specialAssignmentsList.appendChild(li);
        });
    }
    if(specialAssignmentsList.lastChild) specialAssignmentsList.lastChild.style.borderBottom = 'none';
}

function isMemberUnavailable(memberName, dateYYYYMMDD) {
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

function renderCalendar(year, month) {
    calendarBody.innerHTML = '';
    let mobileView = document.getElementById('calendar-body-mobile');
    
    if (!mobileView) {
        mobileView = document.createElement('ul');
        mobileView.id = 'calendar-body-mobile';
        mobileView.style.display = 'none';
        calendarBody.parentElement.after(mobileView);
    } else {
        mobileView.innerHTML = '';
    }

    monthYearHeader.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();
    assignmentCounter = 0;
    let date = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateYYYYMMDD(today);

    const membersForAssignment = teamMembers.map(m => m.name);
    const canAssign = membersForAssignment && membersForAssignment.length > 0;
    const memberCount = membersForAssignment.length;

    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            const dateNumberDiv = document.createElement('div');
            dateNumberDiv.className = 'date-number';

            if (week === 0 && dayOfWeek < startDayOfWeek) {
                cell.classList.add('other-month');
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                dateNumberDiv.textContent = prevMonthLastDay - startDayOfWeek + dayOfWeek + 1;
                cell.appendChild(dateNumberDiv);
            } else if (date > daysInMonth) {
                 cell.classList.add('other-month');
                 dateNumberDiv.textContent = date - daysInMonth;
                 cell.appendChild(dateNumberDiv);
                 date++;
            } else {
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);
                cell.dataset.date = currentCellDateStr;

                const cellDateOnly = new Date(currentCellDate.getUTCFullYear(), currentCellDate.getUTCMonth(), currentCellDate.getUTCDate());
                cellDateOnly.setHours(0,0,0,0);

                if (currentCellDateStr === todayStr) {
                    cell.classList.add('today');
                } else if (cellDateOnly < today) {
                    cell.classList.add('past-day');
                }

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

                const smallRandomizeBtn = document.createElement('button');
                smallRandomizeBtn.className = 'small-randomize-btn';
                smallRandomizeBtn.title = 'Randomize this day';
                smallRandomizeBtn.textContent = '🎲';
                smallRandomizeBtn.onclick = (e) => {
                    e.preventDefault();
                    
                    if (membersForAssignment.length > 0) {
                        let shuffledMemberNames = [...membersForAssignment];
                        shuffleArray(shuffledMemberNames);
                        let currentAssignmentCounter = 0;
                        
                        const targetCell = e.target.closest('td');
                        if (!targetCell || targetCell.querySelector('.hold-checkbox')?.checked) {
                            return;
                        }
                        const targetDateStr = targetCell.dataset.date;
                        if (!targetDateStr) return;

                        const assignmentDivs = targetCell.querySelectorAll('.assigned-position, .assignment-skipped');

                        assignmentDivs.forEach(div => {
                            const strongTag = div.querySelector('strong');
                            if (!strongTag) return;
                            const positionName = strongTag.textContent.replace(':', '').trim();
                            const positionInfo = positions.find(p => p.name === positionName);
                            if (!positionInfo) return;

                            let assigned = false;
                            let attempts = 0;
                            const maxAttempts = shuffledMemberNames.length;

                            while (!assigned && attempts < maxAttempts) {
                                const memberIndex = (currentAssignmentCounter + attempts) % maxAttempts;
                                const memberName = shuffledMemberNames[memberIndex];
                                
                                if (!isMemberUnavailable(memberName, targetDateStr) &&
                                    isMemberQualified(memberName, positionInfo.id))
                                {
                                    div.innerHTML = `<strong>${positionInfo.name}:</strong> ${memberName}`;
                                    div.className = 'assigned-position';
                                    assigned = true;
                                    currentAssignmentCounter = (currentAssignmentCounter + attempts + 1) % maxAttempts;
                                }
                                attempts++;
                            }

                            if (!assigned) {
                                div.innerHTML = `<strong>${positionInfo.name}:</strong> <span class="skipped-text">(Unavailable/Not Qualified)</span>`;
                                div.className = 'assignment-skipped';
                                currentAssignmentCounter = (currentAssignmentCounter + 1) % maxAttempts;
                            }
                        });
                    } else {
                        alert("Add team members first.");
                    }
                };

                holdContainer.appendChild(holdCheckbox);
                holdContainer.appendChild(holdLabel);
                holdContainer.appendChild(smallRandomizeBtn);
                cell.appendChild(holdContainer);

                dateNumberDiv.textContent = date;
                cell.appendChild(dateNumberDiv);

                if (dayOfWeek === 0 || dayOfWeek === 6) { cell.classList.add('weekend'); }

                let positionsForThisDay = [];
                const isOverrideDay = overrideDays.includes(currentCellDateStr);

                positions.forEach(position => {
                    let shouldAdd = false;
                    if (position.assignment_type === 'regular') {
                        shouldAdd = DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek) || isOverrideDay;
                    } else if (position.assignment_type === 'specific_days') {
                        const allowed = position.allowed_days ? position.allowed_days.split(',') : [];
                        shouldAdd = allowed.includes(dayOfWeek.toString());
                    }
                    if (shouldAdd) {
                        positionsForThisDay.push(position);
                    }
                });

                const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);
                todaysSpecialAssignments.forEach(sa => {
                    const positionInfo = positions.find(p => p.id === sa.position_id);
                    if (positionInfo) {
                        positionsForThisDay.push(positionInfo);
                    }
                });

                positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

                if (canAssign && positionsForThisDay.length > 0) {
                    cell.classList.add('assignment-day');
                    const todaysHeldAssignments = heldDays.get(currentCellDateStr) || [];

                    positionsForThisDay.forEach(position => {
                        const assignmentDiv = document.createElement('div');
                        let assignedMemberName = null;

                        const heldAssignment = todaysHeldAssignments.find(h => h.position_name === position.name);

                        if (heldAssignment) {
                            assignedMemberName = heldAssignment.member_name;
                            assignmentDiv.classList.add('assigned-position', 'held');
                            assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                        } else {
                            let attempts = 0;
                            while (assignedMemberName === null && attempts < memberCount) {
                                const potentialMemberIndex = (assignmentCounter + attempts) % memberCount;
                                const potentialMemberName = membersForAssignment[potentialMemberIndex];

                                if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) &&
                                    isMemberQualified(potentialMemberName, position.id))
                                {
                                    assignedMemberName = potentialMemberName;
                                    assignmentCounter = (assignmentCounter + attempts + 1);
                                }
                                attempts++;
                            }

                            if (assignedMemberName) {
                                assignmentDiv.classList.add('assigned-position');
                                assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                            } else {
                                assignmentDiv.classList.add('assignment-skipped');
                                assignmentDiv.innerHTML = `<strong>${position.name}:</strong> <span class="skipped-text">(Unavailable/Not Qualified)</span>`;
                                if (attempts === memberCount) {
                                    assignmentCounter++;
                                }
                            }
                        }
                        cell.appendChild(assignmentDiv);
                    });

                    if (memberCount > 0) { assignmentCounter %= memberCount; }
                    else { assignmentCounter = 0; }

                }

                date++;
            }
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
        if (date > daysInMonth && week > 0) break;
    }

    let mobileAssignmentCounter = 0;
    for (let d = 0; d < daysInMonth; d++) {
        const currentMobileDate = new Date(Date.UTC(year, month, d + 1));
        const currentCellDateStr = formatDateYYYYMMDD(currentMobileDate);
        const currentDayOfWeek = currentMobileDate.getUTCDay();

        const dayItem = document.createElement('li');
        dayItem.className = 'mobile-day-item';
        dayItem.dataset.date = currentCellDateStr;

        const cellDateOnly = new Date(currentMobileDate.getUTCFullYear(), currentMobileDate.getUTCMonth(), currentMobileDate.getUTCDate());
        cellDateOnly.setHours(0,0,0,0);

        if (currentCellDateStr === todayStr) {
            dayItem.classList.add('today');
        } else if (cellDateOnly < today) {
            dayItem.classList.add('past-day');
        }

        if (currentDayOfWeek === 0 || currentDayOfWeek === 6) {
            dayItem.classList.add('weekend');
        }

        const dayHeader = document.createElement('div');
        dayHeader.className = 'mobile-day-header';

        const dateDisplay = document.createElement('span');
        dateDisplay.className = 'mobile-date';
        if (typeof MONTH_NAMES_PT !== 'undefined') {
             dateDisplay.textContent = `${DAY_NAMES_PT[currentDayOfWeek]}, ${d + 1}`;
        } else {
             dateDisplay.textContent = `${currentMobileDate.toLocaleDateString('default', { weekday: 'short' })}, ${d + 1}`;
        }
        dayHeader.appendChild(dateDisplay);

        const dayContent = document.createElement('div');
        dayContent.className = 'mobile-day-content';

        let positionsForThisDay = [];
        const isOverrideDay = overrideDays.includes(currentCellDateStr);

        positions.forEach(position => {
            let shouldAdd = false;
            if (position.assignment_type === 'regular') {
                shouldAdd = DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverrideDay;
            } else if (position.assignment_type === 'specific_days') {
                const allowed = position.allowed_days ? position.allowed_days.split(',') : [];
                shouldAdd = allowed.includes(currentDayOfWeek.toString());
            }
            if (shouldAdd) {
                positionsForThisDay.push(position);
            }
        });

        const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);
        todaysSpecialAssignments.forEach(sa => {
            const positionInfo = positions.find(p => p.id === sa.position_id);
            if (positionInfo) {
                positionsForThisDay.push(positionInfo);
            }
        });

        positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

        if (canAssign && positionsForThisDay.length > 0) {
             dayItem.classList.add('assignment-day');
             const todaysHeldAssignments = heldDays.get(currentCellDateStr) || [];

            positionsForThisDay.forEach(position => {
                const assignmentDiv = document.createElement('div');
                let assignedMemberName = null;

                const heldAssignment = todaysHeldAssignments.find(h => h.position_name === position.name);

                if (heldAssignment) {
                    assignedMemberName = heldAssignment.member_name;
                    assignmentDiv.className = 'assigned-position held';
                    assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                } else {
                    let attempts = 0;
                    while (assignedMemberName === null && attempts < memberCount) {
                        const potentialMemberIndex = (mobileAssignmentCounter + attempts) % memberCount;
                        const potentialMemberName = membersForAssignment[potentialMemberIndex];

                        if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) &&
                            isMemberQualified(potentialMemberName, position.id))
                        {
                            assignedMemberName = potentialMemberName;
                            mobileAssignmentCounter = (mobileAssignmentCounter + attempts + 1);
                        } else { attempts++; }
                    }
                    if (assignedMemberName) {
                        assignmentDiv.className = 'assigned-position';
                        assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                    } else {
                        assignmentDiv.className = 'assignment-skipped';
                        assignmentDiv.innerHTML = `<strong>${position.name}:</strong> <span class="skipped-text">(Unavailable/Not Qualified)</span>`;
                        if (attempts === memberCount) mobileAssignmentCounter++;
                    }
                }
                dayContent.appendChild(assignmentDiv);
            });

            if (memberCount > 0) { mobileAssignmentCounter %= memberCount; }
             else { mobileAssignmentCounter = 0; }

        }

        dayItem.appendChild(dayHeader);
        dayItem.appendChild(dayContent);
        mobileView.appendChild(dayItem);
    }

    applyHeldVisuals();
}

function applyHeldVisuals() {
    document.querySelectorAll('.held').forEach(el => el.classList.remove('held'));
    document.querySelectorAll('.hold-checkbox').forEach(cb => {
        const dateStr = cb.id.replace('hold-', '');
        cb.checked = heldDays.has(dateStr);
    });

    heldDays.forEach((assignments, dateStr) => {
        const cell = document.querySelector(`#calendar-body td[data-date="${dateStr}"]`);
        const mobileItem = document.querySelector(`#calendar-body-mobile li[data-date="${dateStr}"]`);

        assignments.forEach(held => {
            if (cell) {
                const assignmentDivs = cell.querySelectorAll('.assigned-position');
                assignmentDivs.forEach(div => {
                    const strongTag = div.querySelector('strong');
                    if (strongTag && strongTag.textContent.includes(held.position_name) && div.textContent.includes(held.member_name)) {
                        div.classList.add('held');
                    }
                });
            }
            if (mobileItem) {
                 const assignmentDivs = mobileItem.querySelectorAll('.assigned-position');
                 assignmentDivs.forEach(div => {
                    const strongTag = div.querySelector('strong');
                    if (strongTag && strongTag.textContent.includes(held.position_name) && div.textContent.includes(held.member_name)) {
                        div.classList.add('held');
                    }
                });
            }
        });
    });
}

async function apiCall(url, options, successCallback, errorCallback) {
    console.log(`Making API call to ${url}`, options);
    try {
        const response = await fetch(url, options);
        console.log(`Response status: ${response.status}`);

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login.html?message=Session expired...';
            return false;
        }

        const isSuccess = response.ok || (options.method === 'DELETE' && response.status === 404);
        
        if (isSuccess) {
            console.log('API call successful, fetching updated data...');
            const dataRefreshed = await fetchData();
            
            if (dataRefreshed) {
                console.log('Data refresh successful, updating UI...');
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
            
            console.error(`API Error:`, errorText);
            if (errorCallback) {
                errorCallback(errorText);
            } else {
                alert(errorText);
            }
            return false;
        }
    } catch (error) {
        console.error(`Network error:`, error);
        if (errorCallback) {
            errorCallback("A network error occurred.");
        } else {
            alert("A network error occurred.");
        }
        return false;
    }
}

async function addMember() {
    const name = memberNameInput.value.trim();
    const phone_number = memberPhoneInput.value.trim() || null;
    if (!name) {
        alert('Please enter a member name.');
        memberNameInput.focus();
        return;
    }
    const success = await apiCall('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone_number })
    });
    if (success) {
        memberNameInput.value = '';
        memberPhoneInput.value = '';
        memberNameInput.focus();
    }
}

async function updateMember(originalName) {
    const li = teamList.querySelector(`li[data-member-name="${originalName}"]`);
    if (!li) return;
    const editForm = li.querySelector('.edit-member-form');
    const newNameInput = editForm.querySelector('.edit-member-name-input');
    const newPhoneInput = editForm.querySelector('.edit-member-phone-input');
    const newName = newNameInput.value.trim();
    const newPhoneNumber = newPhoneInput.value.trim() || null;
    if (!newName) {
        alert('Member name cannot be empty.');
        newNameInput.focus();
        return;
    }
    await apiCall(`/api/team-members/${encodeURIComponent(originalName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phone_number: newPhoneNumber })
    }, null, (errorText) => {
        alert(`Error updating member: ${errorText}`);
    });
}

async function removeMember(nameToRemove) {
    const member = teamMembers.find(m => m.name === nameToRemove);
    const confirmMessage = member
        ? `Remove team member: "${member.name}" ${member.phone_number ? '('+member.phone_number+')' : ''}?`
        : `Remove team member: "${nameToRemove}"?`;
    if (!confirm(confirmMessage)) return;
    await apiCall(`/api/team-members/${encodeURIComponent(nameToRemove)}`, {
        method: 'DELETE'
    });
}

async function addPosition() {
    console.log('Adding position...');
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

    positionNameInput.value = '';
    positionNameInput.focus();
}

async function updatePosition(positionId) {
    const listItem = positionList.querySelector(`li[data-position-id="${positionId}"]`);
    if (!listItem) { console.error("Could not find list item for position ID:", positionId); return; }
    positionFeedbackMessage.textContent = '';

    const nameSpan = listItem.querySelector('.position-name');
    const name = nameSpan ? nameSpan.textContent : 'Unknown';
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
             return;
        }
        allowedDays = selectedDays.sort().join(',');
    }

    const dataToUpdate = {
        name: name,
        assignment_type: assignmentType,
        allowed_days: allowedDays
    };

    console.log(`Updating position ${positionId} with:`, dataToUpdate);

    await apiCall(`/api/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToUpdate)
    }, () => {
        positionFeedbackMessage.textContent = `Position '${name}' updated successfully.`;
        positionFeedbackMessage.className = 'feedback-message success';
        setTimeout(() => { positionFeedbackMessage.textContent = ''; positionFeedbackMessage.className = 'feedback-message'; }, 4000);
    }, (errorText) => {
        positionFeedbackMessage.textContent = `Error updating position '${name}': ${errorText}`;
        positionFeedbackMessage.className = 'feedback-message error';
    });
}

async function removePosition(positionId) {
    const positionToRemove = positions.find(p => p.id === positionId);
    if (!positionToRemove || !confirm(`Remove Position: "${positionToRemove.name}"? Also removes special slots.`)) return;
    
    await apiCall(`/api/positions/${positionId}`, {
        method: 'DELETE'
    });
}

async function addUnavailability() {
    console.log('Adding unavailability...');
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

    unavailabilityDateInput.value = '';
    unavailabilityMemberSelect.value = '';
}

async function removeUnavailability(idToRemove) {
    if (!confirm('Remove this unavailability entry?')) return;
    
    await apiCall(`/api/unavailability/${idToRemove}`, {
        method: 'DELETE'
    });
}

async function addOverrideDay() {
    console.log('Add override day button clicked');
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

async function removeOverrideDay(dateStr) {
    if (!confirm(`Remove override day: ${new Date(dateStr).toLocaleDateString()}?`)) return;
    
    await apiCall(`/api/overrides/${dateStr}`, {
        method: 'DELETE'
    });
}

async function addSpecialAssignment() {
    console.log('Add special assignment button clicked');
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
    
    specialAssignmentDateInput.value = '';
    specialAssignmentPositionSelect.value = '';
}

async function removeSpecialAssignment(idToRemove) {
    if (!confirm('Remove this special assignment?')) return;
    
    await apiCall(`/api/special-assignments/${idToRemove}`, {
        method: 'DELETE'
    });
}

async function addUser() {
    console.log('Adding new user...');
    
    const username = newUsernameInput.value.trim();
    const password = newPasswordInput.value.trim();
    const role = newUserRoleSelect.value;

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
        userFeedbackMessage.textContent = `User '${username}' created successfully.`;
        userFeedbackMessage.className = 'feedback-message success';
        
        newUsernameInput.value = '';
        newPasswordInput.value = '';
        newUserRoleSelect.value = 'user';
        
        setTimeout(() => {
            userFeedbackMessage.textContent = '';
            userFeedbackMessage.className = 'feedback-message';
        }, 4000);
    }, (errorText) => {
        userFeedbackMessage.textContent = `Error creating user: ${errorText}`;
        userFeedbackMessage.className = 'feedback-message error';
    });
}

async function logout() {
    // ...
}

prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); });

randomizeBtn.addEventListener('click', () => {
    if (teamMembers.length > 0) {
        const currentHeldAssignments = new Map(heldDays);
        let maxAttempts = 10;
        let validRandomization = false;
        
        while (!validRandomization && maxAttempts > 0) {
            let shuffledMembers = [...teamMembers.map(m => m.name)];
            shuffleArray(shuffledMembers);
            assignmentCounter = 0;
            
            const cells = document.querySelectorAll('#calendar-body td:not(.other-month)');
            
            cells.forEach(cell => {
                if (!cell.querySelector('.hold-checkbox')?.checked) {
                    const dateNumber = cell.querySelector('.date-number');
                    const currentDate = dateNumber?.dataset.date;
                    
                    if (currentDate) {
                        const assignmentDivs = cell.querySelectorAll('.assigned-position');
                        assignmentDivs.forEach(div => {
                            const positionName = div.querySelector('strong').textContent.replace(':', '').trim();
                            const positionInfo = positions.find(p => p.name === positionName);
                            
                            if (!positionInfo) return;

                            let assigned = false;
                            let attempts = 0;
                            const maxAttempts = shuffledMembers.length;

                            while (!assigned && attempts < maxAttempts) {
                                const memberIndex = (assignmentCounter + attempts) % shuffledMembers.length;
                                const memberName = shuffledMembers[memberIndex];
                                
                                if (!isMemberUnavailable(memberName, currentDate) && 
                                    isMemberQualified(memberName, positionInfo.id))
                                {
                                    div.innerHTML = `<strong>${positionInfo.name}:</strong> ${memberName}`;
                                    assigned = true;
                                    assignmentCounter = (assignmentCounter + attempts + 1) % shuffledMembers.length;
                                }
                                attempts++;
                            }
                            
                            if (!assigned) {
                                div.innerHTML = `<strong>${positionInfo.name}:</strong> (No qualified member available)`;
                                assignmentCounter = (assignmentCounter + 1) % shuffledMembers.length;
                            }
                        });
                    }
                }
            });

            let hasIdenticalConsecutiveWeeks = false;
            for (let i = 0; i < cells.length - 14; i += 7) {
                const week1 = getWeekAssignments(cells, i);
                const week2 = getWeekAssignments(cells, i + 7);
                
                if (week1.length > 0 && areWeeksIdentical(week1, week2)) {
                    hasIdenticalConsecutiveWeeks = true;
                    break;
                }
            }

            validRandomization = !hasIdenticalConsecutiveWeeks;
            maxAttempts--;

            if (!validRandomization && maxAttempts > 0) {
                assignmentCounter = 0;
            }
        }

        currentHeldAssignments.forEach((assignments, dateStr) => {
            const cell = document.querySelector(`td .date-number[data-date="${dateStr}"]`)?.parentElement;
            if (cell) {
                assignments.forEach(({ position_name, member_name }) => {
                    const assignmentDivs = cell.querySelectorAll('.assigned-position');
                    for (const div of assignmentDivs) {
                        const strongTag = div.querySelector('strong');
                        if (strongTag && strongTag.textContent.includes(position_name) && div.textContent.includes(member_name)) {
                            div.classList.add('held');
                        }
                    }
                });

                const checkbox = cell.querySelector('.hold-checkbox');
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
        });

        if (maxAttempts === 0) {
            console.warn('Could not find a completely unique pattern after maximum attempts');
        }
    } else {
        alert("Add team members first.");
    }
});
logoutBtn.addEventListener('click', logout);

addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } });
memberPhoneInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } });

addPositionBtn.addEventListener('click', addPosition);
positionNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPosition(); } });

addUnavailabilityBtn.addEventListener('click', addUnavailability);

addOverrideDayBtn.addEventListener('click', addOverrideDay);
overrideDateInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addOverrideDay(); } });

addSpecialAssignmentBtn.addEventListener('click', addSpecialAssignment);

addUserBtn.addEventListener('click', addUser);
newPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUser(); } });

function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
}

const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
} else {
    console.warn("Theme toggle button not found in the DOM.");
}

async function initializeAdminView() {
    console.log("Initializing Admin View...");
    initializeTheme();
    if (await fetchData()) {
        console.log("Data fetch successful. Rendering components.");
        renderTeamList();
        renderPositionList();
        renderUnavailableList();
        renderOverrideDaysList();
        renderSpecialAssignmentsList();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        applyHeldVisuals();
    } else {
         console.error("Initialization failed due to data fetch error.");
         const schedulerDiv = document.getElementById('scheduler');
         if(schedulerDiv) {
            schedulerDiv.innerHTML = '<p style="color: red; padding: 20px;">Failed to load scheduler data. Please check the console for errors and try refreshing the page.</p>';
         }
    }
}

initializeAdminView();

async function updateMemberPositions(memberName) {
    const memberItem = teamList.querySelector(`.team-member-item[data-member-name="${memberName}"]`);
    
    if (!memberItem) {
        console.error(`Could not find list item for member: ${memberName}`);
        return;
    }

    const checkedPositions = Array.from(
        memberItem.querySelectorAll('.member-positions input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value));
    
    console.log(`Updating positions for ${memberName}:`, checkedPositions);

    await apiCall(`/api/member-positions/${encodeURIComponent(memberName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionIds: checkedPositions })
    });
}

function isMemberQualified(memberName, positionId) {
    const memberQuals = memberPositions.get(memberName) || [];
    return memberQuals.some(p => p.id === positionId);
}

async function saveCurrentAssignments() {
    const assignmentsToSave = [];
    const datesProcessed = new Set();

    const cells = document.querySelectorAll('#calendar-body td:not(.other-month)');

    cells.forEach(cell => {
        const dateStr = cell.dataset.date;
        if (!dateStr) return;

        datesProcessed.add(dateStr);

        const assignmentDivs = cell.querySelectorAll('.assigned-position');
        assignmentDivs.forEach(div => {
            const strongTag = div.querySelector('strong');
            if (!strongTag) return;

            const positionName = strongTag.textContent.replace(':', '').trim();
            const memberName = div.textContent.substring(div.textContent.indexOf(':') + 1).trim();

            if (positionName && memberName && !memberName.startsWith('(Unavailable') && !memberName.startsWith('(No qualified')) {
                 assignmentsToSave.push({
                    date: dateStr,
                    position_name: positionName,
                    member_name: memberName
                });
            }
        });
    });

    console.log("Assignments to save/hold:", assignmentsToSave);

    const success = await apiCall('/api/held-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assignmentsToSave })
    }, () => {
        alert('Current assignments saved and held.');
    }, (errorText) => {
        alert(`Failed to save held assignments: ${errorText}`);
    });
}

async function clearAllHolds() {
    if (!confirm("Are you sure you want to clear ALL held assignments for ALL dates?")) {
        return;
    }

    console.log("Clearing all held assignments...");

    const datesToClear = Array.from(heldDays.keys());
    if (datesToClear.length === 0) {
        alert("No assignments are currently held.");
        return;
    }

    let allSucceeded = true;
    const promises = [];

    heldDays.forEach((_, dateStr) => {
        promises.push(
            fetch(`/api/held-assignments/${dateStr}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) {
                    console.error(`Failed to clear holds for ${dateStr}: ${response.statusText}`);
                    allSucceeded = false;
                }
                return response.ok;
            })
            .catch(error => {
                 console.error(`Network error clearing holds for ${dateStr}:`, error);
                 allSucceeded = false;
                 return false;
            })
        );
    });

    await Promise.all(promises);

    if (allSucceeded) {
        heldDays.clear();
        document.querySelectorAll('.hold-checkbox').forEach(checkbox => checkbox.checked = false);
        document.querySelectorAll('.held').forEach(el => el.classList.remove('held'));
        alert('All holds cleared successfully.');
        await fetchData();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        applyHeldVisuals();
    } else {
        alert('Some errors occurred while clearing holds. Check the console. Refreshing data...');
        await fetchData();
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        applyHeldVisuals();
    }
}

const saveHoldsBtn = document.getElementById('saveHoldsBtn');
const clearHoldsBtn = document.getElementById('clearHoldsBtn');

if (saveHoldsBtn) saveHoldsBtn.addEventListener('click', saveCurrentAssignments);
else console.warn("Save Holds button not found");

if (clearHoldsBtn) clearHoldsBtn.addEventListener('click', clearAllHolds);
else console.warn("Clear Holds button not found");
