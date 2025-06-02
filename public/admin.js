// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const calendarBodyMobile = document.getElementById('calendar-body-mobile');
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
const unavailabilityDateFromInput = document.getElementById('unavailabilityDateFrom'); // <<< MODIFIED
const unavailabilityDateToInput = document.getElementById('unavailabilityDateTo');   // <<< MODIFIED
const unavailabilityMemberSelect = document.getElementById('unavailabilityMember');
const addUnavailabilityBtn = document.getElementById('addUnavailabilityBtn');
const unavailableList = document.getElementById('unavailable-list');
// Override Days
const overrideDateInput = document.getElementById('overrideDateInput');
const overrideTimeInput = document.getElementById('overrideTimeInput');
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
const notifyDayDateInput = document.getElementById('notifyDayDateInput');
const notifyDayBtn = document.getElementById('notifyDayBtn');
// <<< ADDED: Removed Assignments Elements >>>
const removedAssignmentDateInput = document.getElementById('removedAssignmentDate');
const removedAssignmentPositionSelect = document.getElementById('removedAssignmentPosition');
const addRemovedAssignmentBtn = document.getElementById('addRemovedAssignmentBtn');
const removedAssignmentsList = document.getElementById('removed-assignments-list');
// <<< END ADDED >>>
// <<< ADDED: Upcoming Notifications Selectors >>>
const upcomingNotificationsList = document.getElementById('upcoming-notifications-list');
// <<< ADDED: Statistics Elements >>>
const memberStatsList = document.getElementById('memberStatsList');
const memberStatsChartCanvas = document.getElementById('memberStatsChart');
const statsNoDataMessage = document.getElementById('stats-member-no-data'); // <<< FIX: Changed ID to match HTML
// <<< ADDED: Position Stats Elements >>>
const positionStatsList = document.getElementById('positionStatsList');
const positionStatsChartCanvas = document.getElementById('positionStatsChart');
const statsPositionNoDataMessage = document.getElementById('stats-position-no-data');
// <<< ADDED: Unavailability Stats Elements >>>
const memberUnavailabilityStatsList = document.getElementById('memberUnavailabilityStatsList');
const statsUnavailabilityNoDataMessage = document.getElementById('stats-unavailability-no-data');
// <<< ADDED: Days Not Scheduled Stats Elements >>>
const memberDaysNotScheduledStatsList = document.getElementById('memberDaysNotScheduledStatsList');
const statsNotScheduledNoDataMessage = document.getElementById('stats-not-scheduled-no-data');

// --- State Variables ---
let currentDate = new Date();
let teamMembers = [];
let positions = []; // Now expects {id, name, assignment_type, allowed_days}
let unavailableEntries = [];
let overrideDays = [];
let specialAssignments = [];
let removedAssignments = []; // <<< ADDED: State for removed slots
let assignmentCounter = 0;
let memberPositions = new Map(); // Store member position assignments
let memberAvailabilityDays = new Map(); // Store member availability days
let heldDays = new Map(); // Still use Map for temporary storage
let memberAssignmentCounts = new Map(); // <<< ADDED: Store counts for statistics
let memberStatsChart = null; // <<< ADDED: Store chart instance
let positionAssignmentCounts = new Map(); // <<< ADDED: Position counts
let positionStatsChart = null; // <<< ADDED: Position chart instance
let memberUnavailabilityCounts = new Map(); // <<< ADDED: Unavailability counts
let memberDaysNotScheduledCounts = new Map(); // <<< ADDED: Days Not Scheduled counts

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // For labels
const REGULAR_TIMES = { // Map for regular day times
    0: '19:30', // Sun
    3: '19:30', // Wed
    6: '09:30'  // Sat
};

// --- Helper Functions ---
function shuffleArray(array) { /* ... unchanged ... */
    for(let i = array.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
}
function formatDateYYYYMMDD(dateInput) { /* ... unchanged ... */
     try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}
const delay = ms => new Promise(res => setTimeout(res, ms));

// --- API Interaction Functions ---
async function fetchData() {
    console.log("Fetching data...");
    try {
        // <<< MODIFIED: Add removed assignments fetch >>>
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes, removedAssignRes, allMemberAvailabilityRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments'),
            fetch('/api/all-member-positions'),
            fetch('/api/held-assignments'),
            fetch('/api/removed-assignments'), // Fetch removed assignments
            fetch('/api/all-member-availability') // New fetch
        ]);

        // <<< MODIFIED: Include new response in checks >>>
        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes, removedAssignRes, allMemberAvailabilityRes];
        if (responses.some(res => res.status === 401)) {
            console.warn("Session expired or unauthorized. Redirecting to login.");
            window.location.href = '/login.html?message=Session expired. Please log in.';
            return false;
        }

        const errors = [];
        // Standard error checks for critical endpoints
        if (!membersRes.ok) errors.push(`Members: ${membersRes.status} ${membersRes.statusText}`);
        if (!unavailRes.ok) errors.push(`Unavailability: ${unavailRes.status} ${unavailRes.statusText}`);
        if (!positionsRes.ok) errors.push(`Positions: ${positionsRes.status} ${positionsRes.statusText}`);
        if (!overridesRes.ok) errors.push(`Overrides: ${overridesRes.status} ${overridesRes.statusText}`);
        if (!specialAssignRes.ok) errors.push(`Special Assignments: ${specialAssignRes.status} ${specialAssignRes.statusText}`);
        if (!allMemberPosRes.ok) errors.push(`All Member Positions: ${allMemberPosRes.status} ${allMemberPosRes.statusText}`);
        if (!heldAssignmentsRes.ok) errors.push(`Held Assignments: ${heldAssignmentsRes.status} ${heldAssignmentsRes.statusText}`);
        if (!removedAssignRes.ok) errors.push(`Removed Assignments: ${removedAssignRes.status} ${removedAssignRes.statusText}`);

        // Specific handling for allMemberAvailabilityRes
        let allMemberAvailabilityData = {}; // Default to empty object
        if (allMemberAvailabilityRes.status === 404) {
            console.warn("'/api/all-member-availability' endpoint not found (404). Defaulting to empty availability data. This is a temporary workaround.");
            // memberAvailabilityDays.clear() will be called later anyway
        } else if (!allMemberAvailabilityRes.ok) {
            // Handle other non-404 errors for this endpoint normally
            errors.push(`All Member Availability: ${allMemberAvailabilityRes.status} ${allMemberAvailabilityRes.statusText}`);
        } else {
            // If OK and not 404, parse the JSON
            allMemberAvailabilityData = await allMemberAvailabilityRes.json();
        }

        if (errors.length > 0) { throw new Error(`HTTP error fetching data! Statuses - ${errors.join(', ')}`); }

        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json();
        const allMemberPositionsData = await allMemberPosRes.json();
        const heldAssignmentsData = await heldAssignmentsRes.json();
        removedAssignments = await removedAssignRes.json();
        // allMemberAvailabilityData is already defined and potentially populated above

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
        console.log("Fetched Override Days:", overrideDays);
        console.log("Fetched Removed Assignments:", removedAssignments);

        memberAvailabilityDays.clear(); // Clear previous data, then populate
        // This loop is safe even if allMemberAvailabilityData is an empty object (from 404)
        for (const memberName in allMemberAvailabilityData) {
            memberAvailabilityDays.set(memberName, allMemberAvailabilityData[memberName]);
        }
        console.log("Fetched Member Availability Days (may be defaulted due to 404):", memberAvailabilityDays);
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

        if (member.phone_number) {
            const smsBtn = document.createElement('button');
            smsBtn.textContent = '✉️';
            smsBtn.className = 'sms-member-btn';
            smsBtn.title = `Send SMS notification to ${member.name}`;
            smsBtn.onclick = (event) => sendSmsNotification(member.name, event.target);
            actionsDiv.appendChild(smsBtn);
        }

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

        // START of new code for availability days
        const availabilityDaysDiv = document.createElement('div');
        availabilityDaysDiv.className = 'member-availability-days';

        const memberCurrentAvailability = memberAvailabilityDays.get(member.name) || []; // Get current member's saved days

        DAY_NAMES.forEach((dayName, dayIndex) => {
            const label = document.createElement('label');
            label.className = 'availability-day-checkbox'; // For potential styling

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = dayIndex.toString(); // Store day index (0-6)
            checkbox.checked = memberCurrentAvailability.includes(dayIndex.toString()) || memberCurrentAvailability.includes(dayIndex); // Check if string or number index

            // Add event listener for when the checkbox state changes
            checkbox.addEventListener('change', () => updateMemberAvailabilityDays(member.name));

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${dayName}`));
            availabilityDaysDiv.appendChild(label);
        });
        li.appendChild(availabilityDaysDiv); // Append new div

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
    const availabilityDiv = li.querySelector('.member-availability-days');
    const editFormDiv = li.querySelector('.edit-member-form');

    if (infoDiv && actionsDiv && positionsDiv && availabilityDiv && editFormDiv) { // Added availabilityDiv
        infoDiv.style.display = show ? 'none' : '';
        actionsDiv.style.display = show ? 'none' : '';
        positionsDiv.style.display = show ? 'none' : '';
        availabilityDiv.style.display = show ? 'none' : ''; // Added this line
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

    // <<< ADDED: Also populate the new dropdown for removed assignments >>>
    populateRemovedAssignmentPositionDropdown();
}

// <<< ADDED: Function to populate the position dropdown for removed assignments >>>
function populateRemovedAssignmentPositionDropdown() {
    const currentSelection = removedAssignmentPositionSelect.value;
    removedAssignmentPositionSelect.innerHTML = '<option value="">-- Select Position --</option>';
    // Use the same sorted positions list
    const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
    sortedPositions.forEach(position => {
        const option = document.createElement('option');
        option.value = position.id;
        option.textContent = position.name;
        if (position.id.toString() === currentSelection) {
            option.selected = true;
        }
        removedAssignmentPositionSelect.appendChild(option);
    });
}
// <<< END ADDED >>>

function renderUnavailableList() {
    unavailableList.innerHTML = '';
    memberUnavailabilityCounts.clear(); // <<< ADDED: Clear unavailability counts

    // <<< MODIFIED: Get UTC year/month from the current viewing date for consistent comparison >>>
    const currentViewYear = currentDate.getUTCFullYear();
    const currentViewMonth = currentDate.getUTCMonth();

    const filteredEntries = unavailableEntries.filter(entry => {
        const entryDate = new Date(entry.date + 'T00:00:00Z');
        // Compare UTC date from entry with UTC date of the current view
        return entryDate.getUTCFullYear() === currentViewYear && entryDate.getUTCMonth() === currentViewMonth;
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

            // <<< ADDED: Increment unavailability count for stats >>>
            memberUnavailabilityCounts.set(entry.member, (memberUnavailabilityCounts.get(entry.member) || 0) + 1);
        });
    }
    if (unavailableList.lastChild) unavailableList.lastChild.style.borderBottom = 'none';

    // <<< ADDED: Render the unavailability statistics >>>
    renderUnavailabilityStatistics(memberUnavailabilityCounts);
}

function renderOverrideDaysList() {
    overrideDaysList.innerHTML = '';
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const relevantOverrides = overrideDays
        .filter(override => {
            try {
                const overrideDate = new Date(override.date + 'T00:00:00Z');
                return overrideDate.getUTCFullYear() === currentYear && overrideDate.getUTCMonth() === currentMonth;
            } catch (e) {
                console.warn(`Invalid date found in overrideDays: ${override.date}`);
                return false;
            }
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    relevantOverrides.forEach(override => {
        const li = document.createElement('li');
        li.textContent = `${override.date} (${override.time || 'No Time Set'})`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Remove override for ${override.date}`;
        deleteBtn.onclick = () => removeOverrideDay(override.date);
        li.appendChild(deleteBtn);
        overrideDaysList.appendChild(li);
    });
    if (overrideDaysList.lastChild) overrideDaysList.lastChild.style.borderBottom = 'none';
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

function renderRemovedAssignmentsList() {
    removedAssignmentsList.innerHTML = '';
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const filteredRemoved = removedAssignments.filter(ra => {
        const assignmentDate = new Date(ra.date + 'T00:00:00Z');
        return assignmentDate.getUTCFullYear() === currentYear && assignmentDate.getUTCMonth() === currentMonth;
    });

    filteredRemoved.sort((a, b) => a.date.localeCompare(b.date) || a.position_name.localeCompare(b.position_name));

    if (filteredRemoved.length === 0) {
        removedAssignmentsList.innerHTML = '<li>No slots removed this month.</li>';
        const placeholderLi = removedAssignmentsList.querySelector('li');
        if (placeholderLi) { placeholderLi.style.cssText = 'color: var(--text-secondary); font-style: italic;'; }
    } else {
        filteredRemoved.forEach((ra) => {
            const li = document.createElement('li');
            const displayDate = new Date(ra.date + 'T00:00:00Z').toLocaleDateString();
            li.textContent = `${displayDate} - ${ra.position_name}`;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'x';
            removeBtn.title = `Restore slot ${ra.position_name} on ${displayDate}`;
            removeBtn.onclick = () => removeRemovedAssignment(ra.id);
            li.appendChild(removeBtn);
            removedAssignmentsList.appendChild(li);
        });
    }
    if (removedAssignmentsList.lastChild) removedAssignmentsList.lastChild.style.borderBottom = 'none';
}

function isMemberUnavailable(memberName, dateYYYYMMDD) {
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

/**
 * Checks if a member is available on a specific date, considering both
 * specific date unavailability and general day-of-week preferences.
 * @param {string} memberName - The name of the member.
 * @param {string} dateStr - The date string in YYYY-MM-DD format.
 * @param {number} dayOfWeek - The day of the week (0 for Sunday, 1 for Monday, etc.).
 * @returns {boolean} - True if the member is considered available, false otherwise.
 */
function isMemberAvailableOnDay(memberName, dateStr, dayOfWeek) {
    // 1. Check for specific date unavailability first (e.g., vacation)
    if (isMemberUnavailable(memberName, dateStr)) {
        return false; // Member has a specific unavailability entry for this date
    }

    // 2. Check general day-of-week availability preferences
    const memberSpecificWeekAvailability = memberAvailabilityDays.get(memberName);

    // If the member has defined specific days of the week they are available
    if (memberSpecificWeekAvailability && memberSpecificWeekAvailability.length > 0) {
        // They must be available on this specific dayOfWeek
        // Ensure comparison works if stored as string or number
        return memberSpecificWeekAvailability.some(d => d == dayOfWeek.toString());
    }

    // If no specific day-of-week preferences are set for this member,
    // they are considered available on any day of the week (as far as this check is concerned).
    return true;
}

function removeAssignmentSelect() {
    const existingSelect = document.getElementById('temp-assignment-select');
    if (existingSelect) {
        existingSelect.remove();
    }
}

async function handleAssignmentClick(event) {
    const assignmentDiv = event.target.closest('.assigned-position, .assignment-skipped');
    if (!assignmentDiv) return; // Click wasn't on an assignment

    const cell = assignmentDiv.closest('td');
    if (!cell) return;
    const dateStr = cell.dataset.date;
    if (!dateStr) return;

    // Don't allow editing on past days
    if (cell.classList.contains('past-day')) {
        console.log("Cannot manually assign on past days.");
        return;
    }

    // Remove any existing dropdown
    removeAssignmentSelect();

    const strongTag = assignmentDiv.querySelector('strong');
    if (!strongTag) return; // Should always exist

    const positionName = strongTag.textContent.replace(':', '').trim();
    const positionInfo = positions.find(p => p.name === positionName);
    if (!positionInfo) {
        console.error(`Position info not found for "${positionName}"`);
        return;
    }

    // Find qualified & available members for this position on this date
    const clickedDate = new Date(dateStr + 'T00:00:00Z'); // Interpret dateStr in UTC context
    const dayOfWeek = clickedDate.getUTCDay();

    // Find qualified & available members for this position on this date, respecting day-of-week availability
    const availableQualifiedMembers = teamMembers.filter(member => {
        return isMemberQualified(member.name, positionInfo.id) &&
               isMemberAvailableOnDay(member.name, dateStr, dayOfWeek);
    }).sort((a, b) => a.name.localeCompare(b.name)); // Sort members alphabetically

    const currentMemberName = assignmentDiv.classList.contains('assigned-position')
        ? assignmentDiv.textContent.split(':')[1]?.trim()
        : null; // Null if skipped

    // Create the select element
    const select = document.createElement('select');
    select.id = 'temp-assignment-select'; // ID for easy removal
    select.style.position = 'absolute'; // Position near the click
    select.style.left = `${event.offsetX}px`;
    select.style.top = `${event.offsetY}px`; // Adjust as needed
    select.style.zIndex = '10'; // Ensure it's above other cell content
    select.style.minWidth = '100px';

    // Option to revert to automatic
    const autoOption = document.createElement('option');
    autoOption.value = ''; // Empty value signifies automatic/clear hold
    autoOption.textContent = '-- Automatic --';
    select.appendChild(autoOption);

    // Populate with available members
    availableQualifiedMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        option.textContent = member.name;
        if (member.name === currentMemberName) {
            option.selected = true; // Select the currently assigned member
        }
        select.appendChild(option);
    });

    // Add event listener to handle selection change
    select.addEventListener('change', async () => {
        const selectedMemberName = select.value || null; // null if '-- Automatic --' is chosen
        await updateManualAssignment(dateStr, positionName, selectedMemberName, assignmentDiv, cell);
        removeAssignmentSelect(); // Remove dropdown after selection
    });

    // Add listener to remove dropdown if user clicks outside
    select.addEventListener('blur', () => {
        // Delay removal slightly to allow change event to fire first
        setTimeout(removeAssignmentSelect, 150);
    });

    // Append select to the cell (or assignmentDiv) and focus it
    cell.appendChild(select);
    select.focus();
}

async function updateManualAssignment(dateStr, positionName, selectedMemberName, assignmentDiv, cell) {
    console.log(`Updating manual assignment: ${dateStr} - ${positionName} -> ${selectedMemberName || 'Automatic'}`);

    try {
        const response = await fetch('/api/assignment/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, position_name: positionName, member_name: selectedMemberName })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(errorData.message || `Failed to set assignment (status ${response.status})`);
        }

        console.log('Manual assignment update successful.');

        // Update local heldDays state
        let dateHolds = heldDays.get(dateStr) || [];
        // Remove existing entry for this position
        dateHolds = dateHolds.filter(h => h.position_name !== positionName);
        if (selectedMemberName) {
            // Add the new manual assignment
            dateHolds.push({ position_name: positionName, member_name: selectedMemberName });
        }
        if (dateHolds.length > 0) {
            heldDays.set(dateStr, dateHolds);
        } else {
            heldDays.delete(dateStr); // Remove entry if no holds left for this date
        }

        // Update the UI immediately
        if (selectedMemberName) {
            assignmentDiv.innerHTML = `<strong>${positionName}:</strong> ${selectedMemberName}`;
            assignmentDiv.className = 'assigned-position held'; // Mark as manually assigned (held)
        } else {
            // Need to re-run assignment logic for just this slot or re-render the day?
            // Simplest immediate UI update: revert to a placeholder or the original state *before* the click
            // For a true 'automatic', we'd need to recalculate. Re-rendering the whole calendar might be easiest.
            // Let's just re-render the calendar for simplicity after clearing a manual hold.
            console.log("Cleared manual hold, re-rendering calendar...");
            // assignmentDiv.innerHTML = `<strong>${positionName}:</strong> <span class="skipped-text">(Automatic)</span>`; // Placeholder text
            // assignmentDiv.className = 'assignment-skipped'; // Or assigned-position if calc needed
             renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Re-render to apply auto logic
        }

         // Update the main hold checkbox state for the day
         const holdCheckbox = cell.querySelector('.hold-checkbox');
         if (holdCheckbox) {
             holdCheckbox.checked = heldDays.has(dateStr);
         }

    } catch (error) {
        console.error('Error updating manual assignment:', error);
        alert(`Error setting assignment: ${error.message}`);
        // Optionally revert UI or keep the select open on error
    }
    // <<< ADDED: Re-render calendar to update stats after manual change >>>
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

// <<< ADDED: Function to randomize assignments for a single day >>>
async function randomizeSingleDay(dateStr, cellElement) {
    console.log(`Randomizing single day: ${dateStr}`);

    // 1. Recalculate positions for the day (logic copied & adapted from renderCalendar pre-calc)
    const currentDayDate = new Date(dateStr + 'T00:00:00Z'); // Use Z for UTC interpretation
    const currentDayOfWeek = currentDayDate.getUTCDay();
    let positionsForThisDay = [];
    const isOverrideDay = overrideDays.some(o => o.date === dateStr);

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
    const todaysSpecial = specialAssignments.filter(sa => sa.date === dateStr);
    todaysSpecial.forEach(sa => {
        const positionInfo = positions.find(p => p.id === sa.position_id);
        if (positionInfo && !positionsForThisDay.some(p => p.id === positionInfo.id)) {
            positionsForThisDay.push(positionInfo);
        }
    });
    const todaysRemoved = removedAssignments.filter(ra => ra.date === dateStr);
    positionsForThisDay = positionsForThisDay.filter(p => !todaysRemoved.some(ra => ra.position_id === p.id));
    positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

    if (positionsForThisDay.length === 0) {
        console.log("No positions scheduled for this day to randomize.");
        return; // Nothing to do
    }

    // 2. Get qualified & available members for *any* position today
    // The currentDayOfWeek is already available from:
    // const currentDayDate = new Date(dateStr + 'T00:00:00Z');
    // const currentDayOfWeek = currentDayDate.getUTCDay();

    const availableMembersToday = teamMembers.filter(member => {
        // isMemberAvailableOnDay checks both specific date unavailability and day-of-week preference.
        const isGenerallyAvailable = isMemberAvailableOnDay(member.name, dateStr, currentDayOfWeek);
        const isQualifiedForAny = positionsForThisDay.some(pos => isMemberQualified(member.name, pos.id));
        return isGenerallyAvailable && isQualifiedForAny;
    }).map(m => m.name); // Just get names

    // Prepare message for skipped slots
    const skippedMessage = availableMembersToday.length === 0 ? "(No one available)" : "(Skipped/Unavailable)";

    if (availableMembersToday.length === 0) {
        console.log("No qualified and available members for this day's positions.");
    }

    // 3. Shuffle the available members
    shuffleArray(availableMembersToday);

    // 4. Assign shuffled members to positions
    const assignmentsMade = new Map(); // { positionName: memberName | null }
    const membersAssignedThisDay = new Set(); // Track members assigned today
    let memberPool = [...availableMembersToday]; // Create a pool to draw from

    positionsForThisDay.forEach(position => {
        let assigned = false;
        for (let i = 0; i < memberPool.length; i++) {
            const potentialMember = memberPool[i];
            // Check qualification AND if not already assigned today
            if (isMemberQualified(potentialMember, position.id) && !membersAssignedThisDay.has(potentialMember)) {
                assignmentsMade.set(position.name, potentialMember);
                membersAssignedThisDay.add(potentialMember);
                memberPool.splice(i, 1); // Remove member from pool for this day
                assigned = true;
                break; // Move to next position
            }
        }
        if (!assigned) {
            assignmentsMade.set(position.name, null); // Mark as skipped
        }
    });

    // 5. Update UI for the cell
    // Remove existing assignment divs first
    cellElement.querySelectorAll('.assigned-position, .assignment-skipped').forEach(div => div.remove());

    // Add new/updated divs
    assignmentsMade.forEach((memberName, positionName) => {
        const assignmentDiv = document.createElement('div');
        if (memberName) {
            assignmentDiv.className = 'assigned-position'; // Not held, just randomized
            assignmentDiv.innerHTML = `<strong>${positionName}:</strong> ${memberName}`;
        } else {
            assignmentDiv.className = 'assignment-skipped'; // Use a specific class
            assignmentDiv.innerHTML = `<strong>${positionName}:</strong> <span class="skipped-text">${skippedMessage}</span>`;
        }
        // Add click handler for manual assignment (copied from renderCalendar)
        // Applies to both assigned and skipped slots after randomization
        if (!cellElement.classList.contains('past-day')) {
            assignmentDiv.addEventListener('click', handleAssignmentClick);
            assignmentDiv.style.cursor = 'pointer';
            assignmentDiv.title = 'Click to manually assign';
        }
        cellElement.appendChild(assignmentDiv);
    });

    console.log(`Single day ${dateStr} randomized. Assignments:`, assignmentsMade);
    // NOTE: This randomization is purely visual/temporary. It is NOT saved/held automatically.
    // The 'Hold Day' checkbox state remains unchanged. If the user wants to keep this, they must check 'Hold Day'.
}
// <<< END ADDED >>>

function renderCalendar(year, month) {
    calendarBody.innerHTML = '';
    let mobileView = document.getElementById('calendar-body-mobile');

    memberAssignmentCounts.clear();
    positionAssignmentCounts.clear();

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
    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
    startDayOfWeek = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1; // Convert to Mon=0, Tue=1, ..., Sun=6
    assignmentCounter = 0; // Reset global counter for auto-assignment

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateYYYYMMDD(today);

    const membersForAssignment = teamMembers.map(m => m.name);
    const canAssign = membersForAssignment && membersForAssignment.length > 0;
    const memberCount = membersForAssignment.length;

    // --- Pre-calculate Assignments and Counts --- START ---
    const calculatedMonthlyAssignments = new Map(); // { dateStr: [{ positionName, memberName, isHeld, eventTime }, ...] }

    for (let d = 1; d <= daysInMonth; d++) {
        const currentDateObj = new Date(Date.UTC(year, month, d));
        const currentDateStr = formatDateYYYYMMDD(currentDateObj);
        const currentDayOfWeek = currentDateObj.getUTCDay();

        let positionsForThisDay = [];
        const isOverrideDay = overrideDays.some(o => o.date === currentDateStr);

        // Determine active positions (logic copied from original loop)
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
        const todaysSpecial = specialAssignments.filter(sa => sa.date === currentDateStr);
        todaysSpecial.forEach(sa => {
            const positionInfo = positions.find(p => p.id === sa.position_id);
            if (positionInfo && !positionsForThisDay.some(p => p.id === positionInfo.id)) {
                positionsForThisDay.push(positionInfo);
            }
        });
        const todaysRemoved = removedAssignments.filter(ra => ra.date === currentDateStr);
        positionsForThisDay = positionsForThisDay.filter(p => !todaysRemoved.some(ra => ra.position_id === p.id));
        positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

        let dailyEventTime = null;
        if (positionsForThisDay.length > 0) {
             const overrideInfo = overrideDays.find(o => o.date === currentDateStr);
             if (overrideInfo && overrideInfo.time) {
                 dailyEventTime = overrideInfo.time;
             } else if (!overrideInfo && REGULAR_TIMES.hasOwnProperty(currentDayOfWeek)) {
                 const hasRegularAssignment = positionsForThisDay.some(p => {
                     const positionDetails = positions.find(pos => pos.id === p.id);
                     return positionDetails?.assignment_type === 'regular' && DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek);
                 });
                 if(hasRegularAssignment) {
                      dailyEventTime = REGULAR_TIMES[currentDayOfWeek];
                 }
             }
        }

        const dailyAssignments = [];
        if (canAssign && positionsForThisDay.length > 0) {
            const todaysHeld = heldDays.get(currentDateStr) || [];
            positionsForThisDay.forEach(position => {
                let assignedMemberName = null;
                let isHeld = false;

                const heldAssignment = todaysHeld.find(h => h.position_name === position.name);

                if (heldAssignment) {
                    assignedMemberName = heldAssignment.member_name;
                    isHeld = true;
                } else {
                    // <<< MODIFIED: Add check for previous week's assignment >>>
                    let previousAssignee = null;
                    const isRegularDefaultDay = position.assignment_type === 'regular' && DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek);

                    if (isRegularDefaultDay) {
                        const prevDate = new Date(currentDateObj);
                        prevDate.setUTCDate(currentDateObj.getUTCDate() - 7);
                        const prevDateStr = formatDateYYYYMMDD(prevDate);

                        // Check assignments calculated *so far* for the previous date
                        const prevDayAssignments = calculatedMonthlyAssignments.get(prevDateStr);
                        if (prevDayAssignments) {
                            const prevAssignmentForPos = prevDayAssignments.find(a => a.positionName === position.name);
                            if (prevAssignmentForPos) {
                                previousAssignee = prevAssignmentForPos.memberName;
                            }
                        }
                    }

                    let attempts = 0;
                    let potentialMemberName = null;
                    let skippedPreviousAssignee = false; // Flag to ensure we only skip once if needed

                    // Find all available and qualified members *for this specific position* on this day
                    // Ensure currentDayOfWeek is defined in this scope. It is: const currentDayOfWeek = currentDateObj.getUTCDay();
                    const candidatesForSlot = membersForAssignment.filter(memberName =>
                        isMemberAvailableOnDay(memberName, currentDateStr, currentDayOfWeek) &&
                        isMemberQualified(memberName, position.id)
                    );

                    while (assignedMemberName === null && attempts < memberCount) { // Outer loop still needed to cycle globally
                        const potentialMemberIndex = (assignmentCounter + attempts) % memberCount;
                        const globallyPotentialMember = membersForAssignment[potentialMemberIndex];

                        // Check if this globally potential member is actually a candidate for *this* slot
                        if (candidatesForSlot.includes(globallyPotentialMember)) {
                            potentialMemberName = globallyPotentialMember;

                            // Check for repetition only on regular days and if a previous assignee exists
                            if (isRegularDefaultDay && previousAssignee && potentialMemberName === previousAssignee && candidatesForSlot.length > 1 && !skippedPreviousAssignee) {
                                console.log(`[Anti-Repetition] Skipping ${potentialMemberName} for ${position.name} on ${currentDateStr} because they did it last week (${previousAssignee}). Candidates: ${candidatesForSlot.length}`);
                                potentialMemberName = null; // Don't assign this member, try next attempt
                                skippedPreviousAssignee = true; // Mark as skipped to avoid infinite loop if only the previous assignee is left in the cycle
                            } else {
                                // Assign if: Not a repeat, or is a repeat but only candidate, or not a regular day
                                assignedMemberName = potentialMemberName;
                                assignmentCounter = (assignmentCounter + attempts + 1); // Advance counter based on successful find
                            }
                        } else {
                            potentialMemberName = null; // This member isn't qualified/available for this slot
                        }

                        attempts++; // Move to the next potential member in the global rotation

                        // If we've tried everyone in the global list for this slot, break to avoid infinite loops
                        if (attempts >= memberCount && assignedMemberName === null) {
                            console.warn(`Could not find suitable assignment for ${position.name} on ${currentDateStr} after checking all members.`);
                            // If we skipped the previous assignee and ended up here, assign them anyway if they are the only candidate left
                            if (skippedPreviousAssignee && candidatesForSlot.length === 1 && candidatesForSlot[0] === previousAssignee) {
                                console.log(`[Anti-Repetition] Assigning ${previousAssignee} anyway as they are the only candidate left.`);
                                assignedMemberName = previousAssignee;
                                // Find where the assignmentCounter should be for this member - tricky, maybe just advance by 1?
                                // Let's stick with advancing based on the loop attempt count for now.
                                // assignmentCounter = (assignmentCounter + attempts); // Advance counter based on attempt count
                            } else if (candidatesForSlot.length === 1 && assignedMemberName === null) {
                                // If only one candidate overall and they weren't picked (maybe due to counter starting elsewhere), assign them
                                console.log(`Assigning the only candidate ${candidatesForSlot[0]} for ${position.name} on ${currentDateStr}`);
                                assignedMemberName = candidatesForSlot[0];
                                // Find the attempt count for this specific member? Or just advance?
                                // assignmentCounter = (assignmentCounter + attempts); // Advance based on attempt count
                            }
                            // If still null here, the slot remains unassigned
                        }
                    }
                    // <<< END MODIFICATION >>>
                }

                if (assignedMemberName) {
                    dailyAssignments.push({
                        positionName: position.name,
                        memberName: assignedMemberName,
                        isHeld: isHeld,
                        eventTime: dailyEventTime
                    });
                    // *** INCREMENT COUNTS HERE (ONCE) ***
                    memberAssignmentCounts.set(assignedMemberName, (memberAssignmentCounts.get(assignedMemberName) || 0) + 1);
                    positionAssignmentCounts.set(position.name, (positionAssignmentCounts.get(position.name) || 0) + 1);
                } else {
                     // Store skipped slots if needed for other logic, or just ignore
                     // For this refactor, we mainly care about actual assignments
                }
            });
            if (memberCount > 0) assignmentCounter %= memberCount;
            else assignmentCounter = 0;
        }

        if (dailyAssignments.length > 0) {
            calculatedMonthlyAssignments.set(currentDateStr, dailyAssignments);
        }
    }
    // --- Pre-calculate Assignments and Counts --- END ---

    // --- Render Calendar Grid --- START ---
    let date = 1;
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) { // 0 for Monday, 6 for Sunday
            const cell = document.createElement('td');
            const dateNumberDiv = document.createElement('div');
            dateNumberDiv.className = 'date-number';

            if (week === 0 && dayOfWeek < startDayOfWeek) {
                // Other month - before
                cell.classList.add('other-month');
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                // Correct calculation for previous month's days when startDayOfWeek is Mon=0
                if (startDayOfWeek > dayOfWeek) { // Only true for days before the actual startDayOfWeek
                    dateNumberDiv.textContent = prevMonthLastDay - (startDayOfWeek - dayOfWeek - 1);
                } else { // Should not happen if logic is correct, but as a fallback
                    dateNumberDiv.textContent = "?";
                }
                cell.appendChild(dateNumberDiv);
            } else if (date > daysInMonth) {
                // Other month - after
                 cell.classList.add('other-month');
                 dateNumberDiv.textContent = date - daysInMonth;
                 cell.appendChild(dateNumberDiv);
                 date++;
            } else {
                // Current month day
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);
                cell.dataset.date = currentCellDateStr;

                const cellDateOnly = new Date(currentCellDate.getUTCFullYear(), currentCellDate.getUTCMonth(), currentCellDate.getUTCDate());
                cellDateOnly.setHours(0,0,0,0);

                if (currentCellDateStr === todayStr) cell.classList.add('today');
                else if (cellDateOnly < today) cell.classList.add('past-day');

                // Highlight weekends based on actual day (Sun=0, Sat=6 from getUTCDay())
                const actualDayOfWeek = currentCellDate.getUTCDay();
                if (actualDayOfWeek === 0 || actualDayOfWeek === 6) { // Sunday or Saturday
                    cell.classList.add('weekend');
                }

                // Add Hold container (logic unchanged)
                const holdContainer = document.createElement('div');
                holdContainer.className = 'hold-container';
                // ... (hold checkbox, label, small randomize button creation/event listener) ...
                const holdCheckbox = document.createElement('input');
                holdCheckbox.type = 'checkbox';
                holdCheckbox.className = 'hold-checkbox';
                holdCheckbox.id = `hold-${currentCellDateStr}`;
                holdCheckbox.addEventListener('change', async (e) => {
                    const assignmentsToHold = [];
                    const currentAssignments = calculatedMonthlyAssignments.get(currentCellDateStr) || [];
                    currentAssignments.forEach(a => {
                         assignmentsToHold.push({ date: currentCellDateStr, position_name: a.positionName, member_name: a.memberName });
                    });

                    if (e.target.checked) {
                        try {
                            const response = await fetch('/api/held-assignments', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ assignments: assignmentsToHold })
                            });
                            if (response.ok) {
                                heldDays.set(currentCellDateStr, assignmentsToHold); // Update local state
                                // Visually update divs (add .held class)
                                cell.querySelectorAll('.assigned-position').forEach(div => div.classList.add('held'));
                            } else { throw new Error('Failed to save'); }
                        } catch (error) {
                            console.error('Error saving holds:', error);
                            e.target.checked = false; // Revert checkbox
                            alert('Failed to save holds for this day.');
                        }
                    } else {
                        try {
                            const response = await fetch(`/api/held-assignments/${currentCellDateStr}`, { method: 'DELETE' });
                            if (response.ok) {
                                heldDays.delete(currentCellDateStr); // Update local state
                                // Visually update divs (remove .held class)
                                cell.querySelectorAll('.assigned-position.held').forEach(div => div.classList.remove('held'));
                            } else { throw new Error('Failed to delete'); }
                        } catch (error) {
                            console.error('Error clearing holds:', error);
                            e.target.checked = true; // Revert checkbox
                            alert('Failed to clear holds for this day.');
                        }
                    }
                });
                const holdLabel = document.createElement('label');
                holdLabel.htmlFor = `hold-${currentCellDateStr}`;
                holdLabel.textContent = 'Hold Day';
                holdLabel.className = 'hold-label';
                const smallRandomizeBtn = document.createElement('button');
                smallRandomizeBtn.className = 'small-randomize-btn';
                smallRandomizeBtn.title = 'Randomize this day (if not held)';
                smallRandomizeBtn.textContent = '🎲';
                // <<< MODIFIED: onClick handler for small randomize button >>>
                smallRandomizeBtn.onclick = (e) => {
                    const targetCell = e.target.closest('td');
                    if (!targetCell) return; // Should not happen

                    const holdCheckbox = targetCell.querySelector('.hold-checkbox');
                    if (holdCheckbox?.checked) {
                        console.log('Cannot randomize a held day.');
                        // Provide visual feedback that it's held
                        const originalTitle = e.target.title;
                        e.target.title = 'Day is held!';
                        e.target.style.opacity = '0.5';
                        setTimeout(() => {
                            // Check if the button still exists before resetting
                            if (e.target) {
                                e.target.title = originalTitle;
                                e.target.style.opacity = '1';
                            }
                        }, 1500);
                        return;
                    }

                    const dateStr = targetCell.dataset.date;
                    if (!dateStr) {
                        console.error("Could not get date from cell for randomization.");
                        return;
                    }

                    console.log(`Randomizing single day via button click: ${dateStr}`);
                    // Call the new function instead of re-rendering the whole calendar
                    randomizeSingleDay(dateStr, targetCell);
                    // Do NOT call renderCalendar here.
                };
                // <<< END MODIFICATION >>>
                holdContainer.appendChild(holdCheckbox);
                holdContainer.appendChild(holdLabel);
                holdContainer.appendChild(smallRandomizeBtn); // <<< UNCOMMENTED THIS LINE
                cell.appendChild(holdContainer);

                // Add Date Number
                dateNumberDiv.textContent = date;
                cell.appendChild(dateNumberDiv);

                // --- Render assignments from pre-calculated data --- 
                const todaysAssignments = calculatedMonthlyAssignments.get(currentCellDateStr) || [];

                // Add Event Time Div (only once if assignments exist)
                if (todaysAssignments.length > 0 && todaysAssignments[0].eventTime) {
                     const timeDiv = document.createElement('div');
                     timeDiv.className = 'event-time';
                     timeDiv.textContent = todaysAssignments[0].eventTime;
                     cell.appendChild(timeDiv); // Append time before assignments
                }

                todaysAssignments.forEach(assignment => {
                    const assignmentDiv = document.createElement('div');
                    assignmentDiv.classList.add('assigned-position');
                    if (assignment.isHeld) {
                        assignmentDiv.classList.add('held');
                    }
                    assignmentDiv.innerHTML = `<strong>${assignment.positionName}:</strong> ${assignment.memberName}`;

                    // Add click handler for manual assignment (only if not past day)
                    if (!cell.classList.contains('past-day')) {
                        assignmentDiv.addEventListener('click', handleAssignmentClick);
                        assignmentDiv.style.cursor = 'pointer';
                        assignmentDiv.title = 'Click to manually assign';
                    }
                    cell.appendChild(assignmentDiv);
                });

                // --- Handle skipped slots (if needed) --- 
                // We might need to recalculate which positions *should* be here vs which *are*
                // and display skipped text for those missing. This adds complexity back.
                // Simpler: Just display assigned slots from pre-calculation.

                date++;
            }
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
        if (date > daysInMonth && week > 0) break; // Exit loop early if month ends
    }
     // --- Render Calendar Grid --- END ---

    // --- Mobile View Rendering (Read from calculated data) --- START ---
    for (let d = 1; d <= daysInMonth; d++) {
        const currentMobileDate = new Date(Date.UTC(year, month, d));
        const currentCellDateStr = formatDateYYYYMMDD(currentMobileDate);
        const currentDayOfWeek = currentMobileDate.getUTCDay();
        const dayItem = document.createElement('li');
        dayItem.className = 'mobile-day-item';
        dayItem.dataset.date = currentCellDateStr;

        const cellDateOnly = new Date(currentMobileDate.getUTCFullYear(), currentMobileDate.getUTCMonth(), currentMobileDate.getUTCDate());
        cellDateOnly.setHours(0,0,0,0);

        if (currentCellDateStr === todayStr) dayItem.classList.add('today');
        else if (cellDateOnly < today) dayItem.classList.add('past-day');
        if (currentDayOfWeek === 0 || currentDayOfWeek === 6) dayItem.classList.add('weekend');

        const dayHeader = document.createElement('div');
        dayHeader.className = 'mobile-day-header';
        const dateDisplay = document.createElement('span');
        dateDisplay.className = 'mobile-date';
        dateDisplay.textContent = `${currentMobileDate.toLocaleDateString('default', { weekday: 'short' })}, ${d}`;
        dayHeader.appendChild(dateDisplay);

        const todaysAssignments = calculatedMonthlyAssignments.get(currentCellDateStr) || [];

        // Add Event Time
        if (todaysAssignments.length > 0 && todaysAssignments[0].eventTime) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'event-time';
            timeDiv.textContent = todaysAssignments[0].eventTime;
            dayHeader.appendChild(timeDiv);
        }

        const dayContent = document.createElement('div');
        dayContent.className = 'mobile-day-content';

        if (todaysAssignments.length > 0) {
             dayItem.classList.add('assignment-day');
             todaysAssignments.forEach(assignment => {
                const assignmentDiv = document.createElement('div');
                assignmentDiv.classList.add('assigned-position');
                if (assignment.isHeld) {
                    assignmentDiv.classList.add('held');
                }
                assignmentDiv.innerHTML = `<strong>${assignment.positionName}:</strong> ${assignment.memberName}`;

                if (!dayItem.classList.contains('past-day')) {
                    assignmentDiv.addEventListener('click', handleAssignmentClick);
                    assignmentDiv.style.cursor = 'pointer';
                    assignmentDiv.title = 'Click to manually assign';
                }
                dayContent.appendChild(assignmentDiv);
            });
        } // else: No assignments for this day, content remains empty

        dayItem.appendChild(dayHeader);
        dayItem.appendChild(dayContent);
        mobileView.appendChild(dayItem);
    }
     // --- Mobile View Rendering --- END ---

    applyHeldVisuals(); // Should still work if it reads classes

    // --- Render Statistics (based on counts from pre-calc loop) ---
    renderStatistics(memberAssignmentCounts);
    renderPositionStatistics(positionAssignmentCounts);

    // --- Calculate Days Not Scheduled (using pre-calculated data) --- START ---
    console.log("[Days Not Scheduled] Starting calculation...");
    memberDaysNotScheduledCounts.clear(); // Clear previous counts
    teamMembers.forEach(member => memberDaysNotScheduledCounts.set(member.name, 0)); // Initialize

    for (let d = 1; d <= daysInMonth; d++) {
        const currentIterationDate = new Date(Date.UTC(year, month, d));
        const currentCellDateStr = formatDateYYYYMMDD(currentIterationDate);
        const currentDayOfWeek = currentIterationDate.getUTCDay();

        // 1. Determine positions active (same logic as pre-calc)
        let positionsScheduledOnThisDay = [];
        const isOverride = overrideDays.some(o => o.date === currentCellDateStr);
        positions.forEach(position => {
            let shouldAdd = false;
            if (position.assignment_type === 'regular') {
                shouldAdd = DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverride;
            } else if (position.assignment_type === 'specific_days') {
                const allowed = position.allowed_days ? position.allowed_days.split(',') : [];
                shouldAdd = allowed.includes(currentDayOfWeek.toString());
            }
            if (shouldAdd) {
                positionsScheduledOnThisDay.push(position);
            }
        });
        const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);
        todaysSpecialAssignments.forEach(sa => {
            const positionInfo = positions.find(p => p.id === sa.position_id);
            if (positionInfo && !positionsScheduledOnThisDay.some(p => p.id === positionInfo.id)) {
                positionsScheduledOnThisDay.push(positionInfo);
            }
        });
        const todaysRemovedAssignments = removedAssignments.filter(ra => ra.date === currentCellDateStr);
        positionsScheduledOnThisDay = positionsScheduledOnThisDay.filter(p => !todaysRemovedAssignments.some(ra => ra.position_id === p.id));

        if (positionsScheduledOnThisDay.length === 0) continue;

        // 2. Check each member
        teamMembers.forEach(member => {
            const memberName = member.name;

            // 3. Check if qualified for any active position
            const isQualifiedForAnySlot = positionsScheduledOnThisDay.some(pos => isMemberQualified(memberName, pos.id));
            if (!isQualifiedForAnySlot) return;

            // 4. Check if unavailable
            if (isMemberUnavailable(memberName, currentCellDateStr)) return;

            // 5. Check if member was *actually* assigned using pre-calculated data
            const assignmentsForDay = calculatedMonthlyAssignments.get(currentCellDateStr) || [];
            const wasAssigned = assignmentsForDay.some(a => a.memberName === memberName);

            // 6. Increment count if qualified, available, but not assigned
            if (!wasAssigned) {
                memberDaysNotScheduledCounts.set(memberName, (memberDaysNotScheduledCounts.get(memberName) || 0) + 1);
            }
        });
    }
    console.log("[Days Not Scheduled] Calculation complete:", memberDaysNotScheduledCounts);
    // --- Calculate Days Not Scheduled --- END ---

    renderDaysNotScheduledStats(memberDaysNotScheduledCounts);
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

// Generic API call helper
async function apiCall(url, options = {}, successCallback, errorCallback) {
    console.log(`Making API call to ${url}`, options);
    try {
        const response = await fetch(url, options);
        console.log(`Response status: ${response.status}`);

        // Handle 304 Not Modified specifically - browser uses cache, no body to parse
        if (response.status === 304) {
            console.log(`API Call to ${url}: Status 304 - Not Modified (Using Cache)`);
            // If it's a GET request, this is fine, the browser has the data.
            // If it's a POST/PUT/DELETE, a 304 is unexpected but we shouldn't crash.
            // We won't call successCallback as there's no new data.
            return true; // Indicate the call itself didn't fail network-wise.
        }

        if (response.status === 401 || response.status === 403) {
            // Redirect to login if unauthorized or forbidden
            window.location.href = '/login.html?message=Session expired or insufficient privileges. Please log in again.';
            return false;
        }

        // Check if the response was successful (status code 2xx)
        if (response.ok) {
            let data = {};
            try {
                data = await response.json();
            } catch (e) {
                try {
                    const text = await response.text();
                    if (text && !text.trim().startsWith('<')) data = text;
                } catch(e2) {}
            }
            if (successCallback) successCallback(data);
            return true;
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
    console.log('Adding unavailability period...');
    const dateFrom = unavailabilityDateFromInput.value;
    const dateTo = unavailabilityDateToInput.value;
    const member = unavailabilityMemberSelect.value;
    
    if (!dateFrom || !dateTo || !member) {
        alert('Please select a member and both From and To dates.');
        if (!member) unavailabilityMemberSelect.focus();
        else if (!dateFrom) unavailabilityDateFromInput.focus();
        else unavailabilityDateToInput.focus();
        return;
    }

    // Chronological validation
    if (new Date(dateFrom) > new Date(dateTo)) {
        alert("'From Date' cannot be after 'To Date'.");
        unavailabilityDateFromInput.focus();
        return;
    }

    await apiCall('/api/unavailability/period', { // <<< MODIFIED endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member, dateFrom, dateTo }) // <<< MODIFIED body
    });

    // Clear inputs on success (apiCall handles refresh via fetchData)
    unavailabilityDateFromInput.value = ''; // <<< MODIFIED
    unavailabilityDateToInput.value = '';   // <<< MODIFIED
    unavailabilityMemberSelect.value = '';
}

async function removeUnavailability(idToRemove) {
    if (!confirm('Remove this unavailability entry?')) return;
    
    await apiCall(`/api/unavailability/${idToRemove}`, {
        method: 'DELETE'
    });
}

async function addOverrideDay() {
    const date = overrideDateInput.value;
    const time = overrideTimeInput.value;

    if (!date) {
        alert('Please select a date for the override.');
        overrideDateInput.focus();
        return;
    }
    if (!time) {
        alert('Please select a time for the override.');
        overrideTimeInput.focus();
        return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
        alert('Invalid time format. Please use HH:MM.');
        overrideTimeInput.focus();
        return;
    }

    console.log(`Adding override day: ${date} at ${time}`);

    const success = await apiCall('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time })
    });

    if (success) {
        overrideDateInput.value = '';
        overrideTimeInput.value = '';
    }
}

async function removeOverrideDay(dateToRemove) {
    if (!confirm(`Remove override day for ${dateToRemove}?`)) return;
    await apiCall(`/api/overrides/${dateToRemove}`, { method: 'DELETE' });
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

prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); renderRemovedAssignmentsList(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); renderUnavailableList(); renderOverrideDaysList(); renderSpecialAssignmentsList(); renderRemovedAssignmentsList(); });

// <<< MODIFIED: Randomize Button Logic (Day-by-Day) >>>
randomizeBtn.addEventListener('click', async () => { // Make async for potential future delays
    if (teamMembers.length === 0) {
        alert("Add team members first before randomizing.");
        return;
    }

    if (!confirm("Randomize assignments day-by-day for the current month? This will generate a new schedule for all days that aren't explicitly held. This change is temporary until you hold specific days.")) {
        return;
    }

    console.log("Randomizing assignments day-by-day for the entire month...");

    // 1. Store the currently held days
    const originalHeldDays = new Map(heldDays);

    // 2. Get all cells for the current month
    const cells = document.querySelectorAll('#calendar-body td:not(.other-month)');

    // 3. Iterate and randomize non-held days visually
    // Use Promise.all if we add delays later, for now sequential is fine
    for (const cell of cells) {
        const dateStr = cell.dataset.date;
        if (!dateStr) continue; // Skip if cell has no date

        // Check if this day was originally held
        if (!originalHeldDays.has(dateStr)) {
            console.log(`Applying single-day randomization to ${dateStr}`);
            await randomizeSingleDay(dateStr, cell);
            // Optional: Add a small delay here if you want to see it happen
            // await delay(10); // Example: 10ms delay
        }
    }

    console.log("Visual day-by-day randomization complete. Recalculating calendar for stats...");

    // 4. Re-render the calendar to update underlying data and stats correctly
    // based on standard logic applied to non-held days.
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());

    // 5. Restore the original held days map *locally* immediately after re-render
    heldDays = originalHeldDays;

    // 6. Re-apply the visual held status based on the restored map
    applyHeldVisuals();

    console.log("Month randomization complete. Held days restored visually.");
    alert("Assignments randomized day-by-day for the month. Check 'Hold Day' on days you wish to keep.");

});
// <<< END MODIFICATION >>>

logoutBtn.addEventListener('click', logout);

addMemberBtn.addEventListener('click', addMember);
memberNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } });
memberPhoneInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } });

addPositionBtn.addEventListener('click', addPosition);
positionNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPosition(); } });

addUnavailabilityBtn.addEventListener('click', addUnavailability);

addOverrideDayBtn.addEventListener('click', addOverrideDay);
overrideDateInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); overrideTimeInput.focus(); } });
overrideTimeInput.addEventListener('keypress', (e => { if (e.key === 'Enter') { e.preventDefault(); addOverrideDay(); } }));

addSpecialAssignmentBtn.addEventListener('click', addSpecialAssignment);

addUserBtn.addEventListener('click', addUser);
newPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUser(); } });
// <<< ADDED: Event listener for the new button >>>
addRemovedAssignmentBtn.addEventListener('click', addRemovedAssignment);
// <<< END ADDED >>>

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

    // Set initial button text
    prevMonthBtn.textContent = '< Prev';
    nextMonthBtn.textContent = 'Next >';

    // Add tooltips if needed (make sure titles are set in HTML)
    // setupTooltips();

    // showLoadingIndicator(true); // Show loading indicator -- REMOVED
    const dataFetched = await fetchData();
    // showLoadingIndicator(false); // Hide loading indicator -- REMOVED

    if (dataFetched) {
        console.log("Initial data fetched successfully. Rendering components.");
        // Populate dropdowns FIRST
        populateMemberDropdown();
        populateSpecialAssignmentPositionDropdown();
        populateRemovedAssignmentPositionDropdown();
        // Render lists
        renderTeamList();
        renderPositionList();
        renderUnavailableList();
        renderOverrideDaysList();
        renderSpecialAssignmentsList();
        renderRemovedAssignmentsList();
        // <<< ADDED: Fetch and render upcoming notifications >>>
        await fetchUpcomingNotifications();
        // Render calendar last (relies on other data being processed)
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        // Apply visual cues for held assignments after calendar is rendered
        applyHeldVisuals();
    } else {
        console.error("Initialization failed due to data fetch error. Check console.");
        // Optionally display a persistent error message to the user
        const mainView = document.getElementById('calendar-view');
        if(mainView) {
            mainView.innerHTML = '<p style="color: var(--button-danger-bg); padding: 20px;">Failed to load critical scheduler data. Please try refreshing the page or contact support.</p>';
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

async function updateMemberAvailabilityDays(memberName) {
    const memberItem = teamList.querySelector(`.team-member-item[data-member-name="${memberName}"]`);

    if (!memberItem) {
        console.error(`Could not find list item for member: ${memberName} when updating availability.`);
        alert(`Error: Could not find UI elements for ${memberName} to update availability.`);
        return;
    }

    const availabilityDaysDiv = memberItem.querySelector('.member-availability-days');
    if (!availabilityDaysDiv) {
        console.error(`Could not find availability days div for member: ${memberName}`);
        alert(`Error: Could not find availability checkboxes for ${memberName}.`);
        return;
    }

    const selectedDayCheckboxes = availabilityDaysDiv.querySelectorAll('input[type="checkbox"]:checked');
    const selectedDays = Array.from(selectedDayCheckboxes).map(cb => cb.value); // Values are '0' through '6'

    console.log(`Updating availability days for ${memberName}:`, selectedDays);

    // Assuming the API endpoint is /api/member-availability
    // and it expects a JSON body like { memberName: "name", availableDays: ["0", "2", "4"] }
    const success = await apiCall(`/api/member-availability`, { // URL Changed
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberName: memberName, availableDays: selectedDays }) // Payload Changed
    },
    (data) => { // Success callback for apiCall
        // Update the local state on successful API call
        memberAvailabilityDays.set(memberName, selectedDays.map(day => parseInt(day, 10))); // Store as numbers
        console.log(`Successfully updated availability for ${memberName}. New local state:`, memberAvailabilityDays.get(memberName));
        // Optionally, provide user feedback e.g., a temporary message or log
        // No specific UI feedback needed here unless requirements change.
        // Re-render calendar if these changes should immediately affect it.
        // For now, just updating the map as per plan.
        // renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // Consider if this is needed
    },
    (errorText) => { // Error callback for apiCall
        alert(`Failed to update availability for ${memberName}: ${errorText}`);
        // Optionally, revert checkbox changes on error, though this can be complex.
        // For now, the UI will remain as is, but the backend sync failed.
        // Re-fetch data to ensure UI consistency with backend might be an option after an error.
        // initializeAdminView(); // This would revert all changes, perhaps too drastic.
    });

    if (success) {
        // If apiCall itself indicates success and successCallback was called.
        // Additional actions after successful update can go here if not in successCallback.
    } else {
        // If apiCall indicates failure (e.g. network error before reaching server, or server error not caught by errorCallback)
        // This block might be redundant if apiCall's errorCallback handles all user-facing error messages.
        // However, if you want to ensure some action (like trying to revert UI) happens even for network errors,
        // you might add logic here. For now, rely on apiCall's error handling.
        console.error(`API call to update availability for ${memberName} reported failure or network issue.`);
    }
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

async function handleNotifyDay() {
    const selectedDate = notifyDayDateInput.value;
    if (!selectedDate) {
        alert('Please select a date first.');
        return;
    }

    console.log(`[Notify Day] Finding members assigned on ${selectedDate}`);
    const membersToNotify = new Set(); // Use Set to store unique member names

    // --- Helper function to extract name ---
    const extractMemberName = (assignmentDiv) => {
        if (!assignmentDiv || !assignmentDiv.textContent) return null;

        // Check if it's a skipped assignment first
        if (assignmentDiv.classList.contains('assignment-skipped')) {
            console.log(`[Notify Day] Skipping element with text: ${assignmentDiv.textContent} (skipped class)`);
            return null;
        }
        /* <<< REMOVED/COMMENTED OUT: Check for held assignments >>>
        // Check if it's a held assignment (we usually don't notify held ones automatically)
        if (assignmentDiv.classList.contains('held')) {
             console.log(`[Notify Day] Skipping element with text: ${assignmentDiv.textContent} (held class)`);
             return null; // Now we WANT to include held members
        }
        */ // <<< END REMOVED/COMMENTED OUT >>>


        // Try splitting by ':' - robust check
        const textParts = assignmentDiv.textContent.split(':');
        if (textParts.length > 1) {
            const potentialName = textParts[1].trim();
            // Ensure it's not an empty string or a placeholder like "(Unavailable...)"
            if (potentialName && !potentialName.startsWith('(')) {
                // Log whether it was held or not for clarity
                const isHeld = assignmentDiv.classList.contains('held');
                console.log(`[Notify Day] Extracted name: "${potentialName}" from text: "${assignmentDiv.textContent}" (Held: ${isHeld})`);
                return potentialName;
            } else {
                 console.log(`[Notify Day] Skipping element with text: ${assignmentDiv.textContent} (placeholder or empty after split)`);
                 return null;
            }
        } else {
            console.log(`[Notify Day] Skipping element with text: ${assignmentDiv.textContent} (could not split by ':')`);
            return null; // Format doesn't match "Position: Name"
        }
    };
    // --- End helper function ---


    // --- Find members in Desktop View ---
    const desktopCell = calendarBody.querySelector(`td[data-date="${selectedDate}"]`);
    if (desktopCell) {
        console.log(`[Notify Day] Checking desktop cell for ${selectedDate}`);
        const desktopAssignments = desktopCell.querySelectorAll('.assigned-position'); // Only target assigned positions
        console.log(`[Notify Day] Found ${desktopAssignments.length} potential desktop assignments.`);
        desktopAssignments.forEach(div => {
            const memberName = extractMemberName(div);
            if (memberName) {
                membersToNotify.add(memberName);
            }
        });
    } else {
         console.log(`[Notify Day] No desktop cell found for ${selectedDate}`);
    }

    // --- Find members in Mobile View ---
    if (calendarBodyMobile) {
        const mobileDayItem = calendarBodyMobile.querySelector(`li[data-date="${selectedDate}"]`);
        if (mobileDayItem) {
            console.log(`[Notify Day] Checking mobile list item for ${selectedDate}`);
            const mobileAssignments = mobileDayItem.querySelectorAll('.assigned-position'); // Only target assigned positions
            console.log(`[Notify Day] Found ${mobileAssignments.length} potential mobile assignments.`);
            mobileAssignments.forEach(div => {
                const memberName = extractMemberName(div);
                if (memberName) {
                    membersToNotify.add(memberName);
                }
            });
        } else {
             console.log(`[Notify Day] No mobile list item found for ${selectedDate}`);
        }
    } else {
         console.log("[Notify Day] Mobile calendar body not found.");
    }

    const uniqueMemberNames = Array.from(membersToNotify);
    console.log(`[Notify Day] Final unique members found for ${selectedDate}:`, uniqueMemberNames); // Log the final list

    if (uniqueMemberNames.length === 0) {
        alert(`No members found assigned (and not held/skipped) on ${selectedDate} to notify.`); // More specific message
        return;
    }

    // --- Create the data structure for the bulk endpoint ---
    const notificationsPayload = uniqueMemberNames.map(name => ({
        memberName: name,
        date: selectedDate
    }));

    // Show the names in the confirmation dialog
    if (!confirm(`Send dynamic SMS notification to ${uniqueMemberNames.length} member(s) for date ${selectedDate}?\n\nMembers:\n- ${uniqueMemberNames.join('\n- ')}`)) {
        console.log("[Notify Day] User cancelled notification.");
        return;
    }

    // Call the bulk sending function with the new payload
    await sendBulkSmsNotifications(notificationsPayload, notifyDayBtn);
}

async function sendBulkSmsNotifications(notificationsPayload, buttonElement) {
    const originalText = buttonElement.textContent;
    const totalNotifications = notificationsPayload.length;
    const delayMs = 1100;

    buttonElement.disabled = true;
    buttonElement.textContent = `Sending 0/${totalNotifications}...`;
    buttonElement.title = `Sending notifications...`;

    console.log(`Starting bulk dynamic SMS request for ${totalNotifications} notifications.`);

    let finalSuccessCount = 0;
    let finalFailureCount = 0;

    try {
        const response = await fetch(`/api/notify-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ notifications: notificationsPayload })
        });

        const result = await response.json();

        if (response.ok) {
            finalSuccessCount = result.successCount || 0;
            finalFailureCount = result.failureCount || 0;
            console.log(`Bulk SMS request finished. Server reported: Success=${finalSuccessCount}, Failed=${finalFailureCount}`);
            if (result.results) {
                 console.log("Detailed results:", result.results);
            }
        } else {
            console.error(`Bulk SMS request failed (${response.status}): ${result.message || 'Unknown server error'}`);
            finalFailureCount = totalNotifications;
            alert(`Failed to process bulk SMS request: ${result.message || 'Server error'}`);
        }

    } catch (error) {
        console.error('Network error during bulk SMS request:', error);
        finalFailureCount = totalNotifications;
        alert('Network error occurred while sending bulk notifications. Please check the console.');
    }

    if (finalFailureCount === 0 && finalSuccessCount === totalNotifications) {
        buttonElement.textContent = `Sent ${finalSuccessCount}/${totalNotifications} ✅`;
        buttonElement.title = `All ${finalSuccessCount} notifications sent successfully.`;
    } else {
         buttonElement.textContent = `Sent ${finalSuccessCount}/${totalNotifications} (${finalFailureCount} failed) ❌`;
         buttonElement.title = `${finalSuccessCount} sent, ${finalFailureCount} failed. Check server logs/console for details.`;
    }

    setTimeout(() => {
        buttonElement.disabled = false;
        buttonElement.textContent = originalText;
        buttonElement.title = `Send SMS to all members assigned on selected date`;
    }, 5000);
}

async function sendSmsNotification(memberName, buttonElement) {
    if (!memberName) {
        console.error("No member name provided for SMS notification.");
        alert("Could not identify the member to notify.");
        return;
    }

    const originalText = buttonElement.textContent;
    buttonElement.textContent = '⏳';
    buttonElement.disabled = true;
    buttonElement.title = `Sending generic SMS to ${memberName}...`;

    console.log(`Sending generic SMS notification to: ${memberName}`);

    try {
        const response = await fetch(`/api/notify-member/${encodeURIComponent(memberName)}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log(`Generic SMS Success: ${result.message}`);
            buttonElement.title = `Generic SMS sent to ${memberName}!`;
            buttonElement.textContent = '✅';
            setTimeout(() => {
                 buttonElement.textContent = originalText;
                 buttonElement.title = `Send generic SMS notification to ${memberName}`;
                 buttonElement.disabled = false;
            }, 3000);
        } else {
            console.error(`Generic SMS Error (${response.status}): ${result.message}`);
            alert(`Failed to send generic SMS to ${memberName}: ${result.message || 'Unknown error'}`);
            buttonElement.textContent = '❌';
            buttonElement.title = `Failed to send generic SMS: ${result.message || 'Unknown error'}`;
            setTimeout(() => {
                 buttonElement.textContent = originalText;
                 buttonElement.title = `Send generic SMS notification to ${memberName}`;
                 buttonElement.disabled = false;
            }, 5000);
        }
    } catch (error) {
        console.error('Network error sending generic SMS notification:', error);
        alert(`Network error trying to send generic SMS to ${memberName}. Please check the console.`);
        buttonElement.textContent = '❌';
        buttonElement.title = `Network error sending generic SMS`;
        setTimeout(() => {
             buttonElement.textContent = originalText;
             buttonElement.title = `Send generic SMS notification to ${memberName}`;
             buttonElement.disabled = false;
        }, 5000);
    }
}

if (notifyDayBtn) {
    notifyDayBtn.addEventListener('click', handleNotifyDay);
} else {
    console.warn("Notify Day button not found.");
}

// <<< ADDED: Functions to handle adding/removing removed assignments >>>
async function addRemovedAssignment() {
    const date = removedAssignmentDateInput.value;
    const position_id = removedAssignmentPositionSelect.value;

    if (!date || !position_id) {
        alert('Please select both a date and a position to remove.');
        return;
    }

    const success = await apiCall('/api/removed-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, position_id })
    }, null, (errorText) => {
        alert(`Error removing slot: ${errorText}`); // Show specific error
    });

    if (success) {
        // Clear inputs only on success
        removedAssignmentDateInput.value = '';
        removedAssignmentPositionSelect.value = '';
        // No need to call renderRemovedAssignmentsList here, apiCall handles refresh
    }
}

async function removeRemovedAssignment(idToRemove) {
    if (!confirm('Restore this assignment slot for the selected date?')) return;

    await apiCall(`/api/removed-assignments/${idToRemove}`, {
        method: 'DELETE'
    });
    // No need to call renderRemovedAssignmentsList here, apiCall handles refresh
    // <<< ADDED: Refresh calendar/stats after restoring a slot >>>
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}
// <<< END ADDED >>>

// <<< ADDED: Render Upcoming Automated Notifications >>>
function renderUpcomingNotifications(upcoming = []) {
    if (!upcomingNotificationsList) return;
    upcomingNotificationsList.innerHTML = ''; // Clear previous list

    if (upcoming.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No upcoming automated notifications scheduled.';
        li.style.fontStyle = 'italic';
        li.style.color = 'var(--text-secondary)';
        upcomingNotificationsList.appendChild(li);
        return;
    }

    // Optional: Format date/time nicely
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };

    upcoming.forEach(notif => {
        const li = document.createElement('li');
        const notificationDate = new Date(notif.notificationTime);
        let formattedTime = 'Invalid Date';
        try {
            formattedTime = notificationDate.toLocaleString(undefined, options);
        } catch (e) {
            console.warn("Could not format notification date:", notif.notificationTime, e);
        }

        li.innerHTML = `
            <span class="upcoming-time">[${formattedTime}]</span>
            <span class="upcoming-details">${notif.memberName} (${notif.positionName} on ${notif.assignmentDate})</span>
        `;
        upcomingNotificationsList.appendChild(li);
    });
}
// <<< END ADDED >>>

// <<< ADDED: Fetch Upcoming Notifications function >>>
async function fetchUpcomingNotifications() {
    console.log("Fetching upcoming notifications...");
    await apiCall('/api/upcoming-notifications', { method: 'GET' },
        (data) => {
            console.log("Upcoming notifications data:", data);
            if (data.success) {
                renderUpcomingNotifications(data.upcoming);
            } else {
                 console.error("Failed to fetch upcoming notifications:", data.message);
                 renderUpcomingNotifications([]); // Render empty list on error
            }
        },
        (errorStatus, errorText) => {
            console.error(`Error fetching upcoming notifications: ${errorStatus} ${errorText}`);
            renderUpcomingNotifications([]); // Render empty list on error
            // Display error in the list itself
            if (upcomingNotificationsList) {
                upcomingNotificationsList.innerHTML = '<li><span style="color: var(--button-danger-bg);">Error loading upcoming notifications.</span></li>';
            }
        }
    );
}
// <<< END ADDED >>>

// <<< ADDED: Function to render statistics list and chart >>>
function renderStatistics(countsMap) {
    if (!memberStatsList || !memberStatsChartCanvas || !statsNoDataMessage) {
        console.warn('Statistics elements not found in the DOM.');
        return;
    }

    memberStatsList.innerHTML = ''; // Clear previous list
    statsNoDataMessage.style.display = 'none'; // Hide no-data message initially

    // Destroy previous chart instance if it exists
    if (memberStatsChart) {
        memberStatsChart.destroy();
        memberStatsChart = null;
    }

    const sortedEntries = Array.from(countsMap.entries()).sort(([, countA], [, countB]) => countB - countA); // Sort by count descending
    let totalAssignments = 0;
    sortedEntries.forEach(([name, count]) => {
        totalAssignments += count;
        const li = document.createElement('li');
        li.textContent = `${name}: ${count} assignment(s)`;
        li.style.padding = '3px 0'; // Add some spacing
        memberStatsList.appendChild(li);
    });

    if (totalAssignments === 0) {
        memberStatsList.innerHTML = '<li>No assignments found for this month.</li>';
        statsNoDataMessage.style.display = 'block'; // Show no-data message
        memberStatsChartCanvas.style.display = 'none'; // Hide canvas
        return; // Don't render chart if no data
    }

    memberStatsChartCanvas.style.display = 'block'; // Show canvas

    const labels = sortedEntries.map(([name]) => name);
    const data = sortedEntries.map(([, count]) => count);

    // Generate colors - simple approach
    const backgroundColors = labels.map((_, i) => `hsl(${i * (360 / labels.length)}, 70%, 60%)`);

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Assignments', // Used in tooltip header
            data: data,
            backgroundColor: backgroundColors,
            hoverOffset: 4
        }]
    };

    const config = {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                         boxWidth: 12,
                         font: {
                             size: 10 // Smaller font for legend
                         }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                const percentage = ((context.parsed / totalAssignments) * 100).toFixed(1);
                                label += `${context.formattedValue} (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                },
                title: {
                    display: false, // We have a separate H4 title
                }
            }
        }
    };

    // Create the chart
    memberStatsChart = new Chart(memberStatsChartCanvas, config);
}
// <<< END ADDED >>>

// <<< ADDED: Function to render POSITION statistics list and chart >>>
function renderPositionStatistics(countsMap) {
    if (!positionStatsList || !positionStatsChartCanvas || !statsPositionNoDataMessage) {
        console.warn('Position Statistics elements not found in the DOM.');
        return;
    }

    positionStatsList.innerHTML = ''; // Clear previous list
    statsPositionNoDataMessage.style.display = 'none'; // Hide no-data message initially

    // Destroy previous chart instance if it exists
    if (positionStatsChart) {
        positionStatsChart.destroy();
        positionStatsChart = null;
    }

    // Sort positions by name (alphabetical) for consistency
    const sortedEntries = Array.from(countsMap.entries()).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
    let totalAssignments = 0;
    sortedEntries.forEach(([name, count]) => {
        totalAssignments += count;
        const li = document.createElement('li');
        li.textContent = `${name}: ${count} assignment(s)`;
        li.style.padding = '3px 0'; // Add some spacing
        positionStatsList.appendChild(li);
    });

    if (totalAssignments === 0) {
        positionStatsList.innerHTML = '<li>No assignments found for this month.</li>';
        statsPositionNoDataMessage.style.display = 'block'; // Show no-data message
        positionStatsChartCanvas.style.display = 'none'; // Hide canvas
        return; // Don't render chart if no data
    }

    positionStatsChartCanvas.style.display = 'block'; // Show canvas

    const labels = sortedEntries.map(([name]) => name);
    const data = sortedEntries.map(([, count]) => count);

    // Generate colors based on position order
    const backgroundColors = labels.map((_, i) => `hsl(${(i * (360 / labels.length) + 180) % 360}, 60%, 70%)`); // Offset colors from member chart

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Assignments', // Used in tooltip header
            data: data,
            backgroundColor: backgroundColors,
            hoverOffset: 4
        }]
    };

    const config = {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                         boxWidth: 12,
                         font: {
                             size: 10 // Smaller font for legend
                         }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                const percentage = ((context.parsed / totalAssignments) * 100).toFixed(1);
                                label += `${context.formattedValue} (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                },
                title: {
                    display: false, // We have a separate H4 title
                }
            }
        }
    };

    // Create the chart
    positionStatsChart = new Chart(positionStatsChartCanvas, config);
}
// <<< END ADDED >>>

// <<< ADDED: Function to render UNAVAILABILITY statistics list >>>
function renderUnavailabilityStatistics(countsMap) {
    if (!memberUnavailabilityStatsList || !statsUnavailabilityNoDataMessage) {
        console.warn('Unavailability Statistics elements not found in the DOM.');
        return;
    }

    memberUnavailabilityStatsList.innerHTML = ''; // Clear previous list
    statsUnavailabilityNoDataMessage.style.display = 'none'; // Hide no-data message

    // Sort members alphabetically
    const sortedEntries = Array.from(countsMap.entries()).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

    if (sortedEntries.length === 0) {
        statsUnavailabilityNoDataMessage.style.display = 'block'; // Show no-data message
    } else {
        sortedEntries.forEach(([name, count]) => {
            const li = document.createElement('li');
            li.textContent = `${name}: ${count} day(s)`;
            li.style.padding = '3px 0';
            li.style.borderBottom = '1px dashed var(--list-item-border)';
            memberUnavailabilityStatsList.appendChild(li);
        });
        // Remove border from last item
        if (memberUnavailabilityStatsList.lastChild) {
            memberUnavailabilityStatsList.lastChild.style.borderBottom = 'none';
        }
    }
}
// <<< END ADDED >>>

// <<< ADDED: Function to render DAYS NOT SCHEDULED statistics list >>>
function renderDaysNotScheduledStats(countsMap) {
    if (!memberDaysNotScheduledStatsList || !statsNotScheduledNoDataMessage) {
        console.warn('Days Not Scheduled Statistics elements not found in the DOM.');
        return;
    }

    memberDaysNotScheduledStatsList.innerHTML = ''; // Clear previous list
    statsNotScheduledNoDataMessage.style.display = 'none'; // Hide no-data message

    // Sort members alphabetically
    const sortedEntries = Array.from(countsMap.entries())
                           .filter(([, count]) => count > 0) // Only show members with > 0 days not scheduled
                           .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

    if (sortedEntries.length === 0) {
        statsNotScheduledNoDataMessage.style.display = 'block'; // Show the "all good" message
    } else {
        sortedEntries.forEach(([name, count]) => {
            const li = document.createElement('li');
            li.textContent = `${name}: ${count} day(s)`;
            li.style.padding = '3px 0';
            li.style.borderBottom = '1px dashed var(--list-item-border)';
            memberDaysNotScheduledStatsList.appendChild(li);
        });
        // Remove border from last item
        if (memberDaysNotScheduledStatsList.lastChild) {
            memberDaysNotScheduledStatsList.lastChild.style.borderBottom = 'none';
        }
    }
}
// <<< END ADDED >>>
