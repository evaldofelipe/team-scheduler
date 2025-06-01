// --- DOM Elements ---
const monthYearHeader = document.getElementById('monthYearHeader');
const calendarBody = document.getElementById('calendar-body');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
// const logoutBtn = document.getElementById('logoutBtn'); // REMOVED
// Theme Toggle (Button itself is selected below)

// --- State Variables ---
let currentDate = new Date();
let teamMembers = [];
let positions = []; // Now expects {id, name, display_order, assignment_type, allowed_days}
let unavailableEntries = [];
let overrideDays = [];
let specialAssignments = [];
let removedAssignments = []; // <<< ADDED: State for removed slots (user view)
let assignmentCounter = 0;
let memberPositions = new Map(); // { memberName => [{id, name}, ...] }
let heldDays = new Map(); // <<< ADDED: Store held assignments { dateStr => [{position_name, member_name}, ...] }

// --- Configuration ---
const DEFAULT_ASSIGNMENT_DAYS_OF_WEEK = [0, 3, 6]; // Sun, Wed, Sat (Still needed for 'regular' type)
// const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Not strictly needed for rendering here

// Add Portuguese Month Names
const MONTH_NAMES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
// Add Portuguese Day Names (for mobile view if needed, though HTML handles desktop)
const DAY_NAMES_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// --- Configuration ---
const REGULAR_TIMES = { // <<< ADDED: Map for regular day times
    0: '19:30', // Sun
    3: '19:30', // Wed
    6: '09:30'  // Sat
};

// --- Helper Functions ---
function formatDateYYYYMMDD(dateInput) { /* ... unchanged ... */
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// <<< ADDED: Helper to determine event time for a specific date >>>
function determineEventTimeForDate(dateStr, dayOfWeek, isOverrideDay, positionsForDay) {
    const overrideInfo = overrideDays.find(o => o.date === dateStr);
    if (overrideInfo && overrideInfo.time) {
        return overrideInfo.time; // Override time takes precedence
    }

    // Check regular times only if it wasn't an override OR if any position assigned today is 'regular' and today is a default assignment day
    const hasRegularDefaultAssignment = positionsForDay.some(p => {
        const positionDetails = positions.find(pos => pos.id === p.id); // Find full position details
        return positionDetails?.assignment_type === 'regular' && DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(dayOfWeek);
    });

    if ((isOverrideDay || hasRegularDefaultAssignment) && REGULAR_TIMES.hasOwnProperty(dayOfWeek)) {
        return REGULAR_TIMES[dayOfWeek];
    }

    return null; // No specific time determined
}
// <<< END ADDED >>>

// --- API Interaction ---
async function fetchData() {
    console.log("Buscando dados para a visualização do usuário...");
    try {
        // Fetch all data needed
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes, removedAssignRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments'),
            fetch('/api/all-member-positions'),
            fetch('/api/held-assignments'),
            fetch('/api/removed-assignments') // Fetch removed assignments
        ]);

        // Check for errors (excluding 401 redirect for public view)
        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes, removedAssignRes];
        const errors = [];
        responses.forEach((res, index) => {
            if (!res.ok) {
                const apiName = ['Membros', 'Indisponibilidade', 'Posições', 'Overrides', 'Tarefas Especiais', 'Qualificações', 'Tarefas Salvas', 'Tarefas Removidas'][index];
                // Don't redirect on 401/403 from public view, just log and report error
                if (res.status === 401 || res.status === 403) {
                     console.warn(`Erro de autorização (${res.status}) buscando ${apiName}. Este endpoint pode precisar ser público.`);
                     errors.push(`${apiName}: Erro Auth ${res.status}`);
                } else {
                    errors.push(`${apiName}: ${res.status} ${res.statusText}`);
                }
            }
        });

        if (errors.length > 0) {
            // Throw error to be caught below, preventing further processing
            throw new Error(`Erro HTTP buscando dados! Status - ${errors.join(', ')}`);
        }

        // Store all fetched data
        teamMembers = await membersRes.json();
        unavailableEntries = await unavailRes.json();
        positions = await positionsRes.json();
        overrideDays = await overridesRes.json();
        specialAssignments = await specialAssignRes.json();
        const allMemberPositionsData = await allMemberPosRes.json();
        const heldAssignmentsData = await heldAssignmentsRes.json();
        removedAssignments = await removedAssignRes.json(); // <<< ADDED: Store removed assignments

        // Convert member positions object into a Map
        memberPositions.clear();
        for (const memberName in allMemberPositionsData) {
            memberPositions.set(memberName, allMemberPositionsData[memberName]);
        }

        // <<< ADDED: Process and store held assignments into the heldDays Map >>>
        heldDays.clear();
        heldAssignmentsData.forEach(assignment => {
            const dateStr = assignment.assignment_date; // Already in YYYY-MM-DD string format from server
            const dateAssignments = heldDays.get(dateStr) || [];
            // Store using the names directly as fetched from the DB table
            dateAssignments.push({
                position_name: assignment.position_name,
                member_name: assignment.member_name
            });
            heldDays.set(dateStr, dateAssignments);
        });
        // <<< END ADDED >>>

        console.log("Posições buscadas (com config):", positions);
        console.log("Qualificações de Membros buscadas:", memberPositions);
        console.log("Tarefas Salvas buscadas:", heldDays);
        console.log("Override Days buscados:", overrideDays);
        console.log("Tarefas Removidas buscadas:", removedAssignments); // <<< ADDED: Log removed
        return true; // Indicate success

    } catch (error) {
        console.error("Falha ao buscar dados iniciais para visualização do usuário:", error);
        // Display error to the user without redirecting
        const schedulerDiv = document.getElementById('scheduler');
        if (schedulerDiv) {
            schedulerDiv.innerHTML = '<p style="color: red; padding: 20px;">Falha ao carregar os dados da agenda. Por favor, tente atualizar a página mais tarde.</p>';
        }
        // Prevent further rendering attempts
        return false;
    }
}

// --- UI Rendering ---

// Check unavailability against the FULL list
function isMemberUnavailable(memberName, dateYYYYMMDD) { /* ... unchanged ... */
    return unavailableEntries.some(entry => entry.date === dateYYYYMMDD && entry.member === memberName);
}

// <<< ADDED: Check if member is qualified for a position >>>
function isMemberQualified(memberName, positionId) {
    const memberQuals = memberPositions.get(memberName) || [];
    return memberQuals.some(p => p.id === positionId);
}

// Removed shouldAssignOnDate - logic is now within renderCalendar

// Modify the renderCalendar function in user.js
function renderCalendar(year, month) {
    // Clear both regular and mobile views
    calendarBody.innerHTML = '';
    let mobileView = document.getElementById('calendar-body-mobile');
    
    // Create mobile view if it doesn't exist
    if (!mobileView) {
        mobileView = document.createElement('ul');
        mobileView.id = 'calendar-body-mobile';
        mobileView.style.display = 'none'; // Hidden by default, shown via CSS media query
        calendarBody.parentElement.after(mobileView);
    } else {
        mobileView.innerHTML = '';
    }

    // --- ADDED: Get today's date for comparison ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight for accurate date comparison
    const todayStr = formatDateYYYYMMDD(today);
    // --- END ADDED ---

    // Use Portuguese month names
    monthYearHeader.textContent = `${MONTH_NAMES_PT[month]} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
    startDayOfWeek = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1; // Convert to Mon=0, Tue=1, ..., Sun=6
    assignmentCounter = 0;
    let date = 1;

    // <<< Use the global teamMembers state which is now array of objects >>>
    const membersForAssignment = teamMembers; // Array of {name, phone_number}
    const canAssign = membersForAssignment && membersForAssignment.length > 0;
    const memberCount = membersForAssignment.length;

    // Regular calendar rendering
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) { // 0 for Monday, 6 for Sunday
            const cell = document.createElement('td');
            const dateNumberDiv = document.createElement('div');
            dateNumberDiv.className = 'date-number';

            if (week === 0 && dayOfWeek < startDayOfWeek) {
                cell.classList.add('other-month');
                // Optionally display previous month's days faded
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                // Correct calculation for previous month's days when startDayOfWeek is Mon=0
                if (startDayOfWeek > dayOfWeek) { // Only true for days before the actual startDayOfWeek
                    dateNumberDiv.textContent = prevMonthLastDay - (startDayOfWeek - dayOfWeek - 1);
                } else { // Should not happen
                    dateNumberDiv.textContent = "?";
                }
                cell.appendChild(dateNumberDiv);
            } else if (date > daysInMonth) {
                cell.classList.add('other-month');
                // Optionally display next month's days faded
                dateNumberDiv.textContent = date - daysInMonth;
                cell.appendChild(dateNumberDiv);
                date++;
            } else {
                // Current month's day
                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);
                cell.dataset.date = currentCellDateStr;

                // --- ADDED: Apply 'today' and 'past-day' classes ---
                const cellDateOnly = new Date(currentCellDate.getUTCFullYear(), currentCellDate.getUTCMonth(), currentCellDate.getUTCDate());
                cellDateOnly.setHours(0,0,0,0); // Normalize cell date

                if (currentCellDateStr === todayStr) {
                    cell.classList.add('today');
                } else if (cellDateOnly < today) {
                    cell.classList.add('past-day');
                }
                // --- END ADDED ---

                dateNumberDiv.textContent = date;
                cell.appendChild(dateNumberDiv);

                const currentDayOfWeek = currentCellDate.getUTCDay(); // Actual day: Sun=0, Mon=1...

                // Highlight weekends based on actual day
                if (currentDayOfWeek === 0 || currentDayOfWeek === 6) { // Sunday or Saturday
                    cell.classList.add('weekend');
                }

                // Determine if assignments should happen today
                const isOverride = overrideDays.some(o => o.date === currentCellDateStr);
                const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);

                let positionsForThisDay = [];

                // --- CORRECTED LOGIC for adding positions based on rules ---
                positions.forEach(position => {
                    let shouldAdd = false;
                    const allowed = position.allowed_days ? position.allowed_days.split(',').map(d => d.trim()) : []; // Ensure trimmed strings

                    if (position.assignment_type === 'specific_days') {
                        // Specific Days: Assign ONLY if the current day is in its allowed list. Overrides DON'T apply here.
                        if (allowed.includes(currentDayOfWeek.toString())) { // Compare string day number
                            shouldAdd = true;
                        }
                    } else { // 'regular' type
                        // Regular: Assign if it's a default day OR if it's an override day.
                        if (DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverride) {
                            shouldAdd = true;
                        }
                    }
                    // Removed the separate override check here, it's integrated above for 'regular' type

                    if (shouldAdd) {
                        // Avoid duplicates if a position somehow matches multiple criteria (e.g., special + rule)
                        if (!positionsForThisDay.some(p => p.id === position.id)) {
                            positionsForThisDay.push(position);
                        }
                    }
                });
                // --- END CORRECTED LOGIC ---

                // Add special assignment slots (ensuring no duplicates if already added by rules)
                todaysSpecialAssignments.forEach(sa => {
                    const positionInfo = positions.find(p => p.id === sa.position_id);
                    // Check if position exists and isn't already added
                    if (positionInfo && !positionsForThisDay.some(p => p.id === positionInfo.id)) {
                        positionsForThisDay.push(positionInfo);
                    }
                });

                // <<< MODIFIED: Filter out REMOVED assignments (User View) >>>
                const todaysRemovedAssignments = removedAssignments.filter(ra => ra.date === currentCellDateStr);
                positionsForThisDay = positionsForThisDay.filter(p => {
                    return !todaysRemovedAssignments.some(ra => ra.position_id === p.id);
                });
                // <<< END MODIFIED >>>

                // Sort positions
                positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

                // Create assignments
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
                            // Don't advance counter for holds
                        } else {
                            let attempts = 0;
                            while (assignedMemberName === null && attempts < memberCount) {
                                const potentialMemberIndex = (assignmentCounter + attempts) % memberCount;
                                // <<< FIX: Get the member object, then extract the name >>>
                                const potentialMemberObject = membersForAssignment[potentialMemberIndex];
                                const potentialMemberName = potentialMemberObject.name; // Get name string

                                if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) &&
                                    isMemberQualified(potentialMemberName, position.id)) // Pass name string
                                {
                                    assignedMemberName = potentialMemberName; // Assign name string
                                    assignmentCounter = (assignmentCounter + attempts + 1);
                                } else {
                                    attempts++; // Increment attempts regardless
                                }
                            }

                            if (assignedMemberName) {
                                assignmentDiv.classList.add('assigned-position');
                                assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                            } else {
                                assignmentDiv.classList.add('assignment-skipped');
                                assignmentDiv.innerHTML = `<strong>${position.name}:</strong> <span class="skipped-text">(Indisponível/Não Qualificado)</span>`;
                                if (attempts === memberCount) assignmentCounter++;
                            }
                        }
                        cell.appendChild(assignmentDiv);
                    }); // End forEach position

                    if (memberCount > 0) { assignmentCounter %= memberCount; }
                    else { assignmentCounter = 0; }
                }

                // <<< ADDED: Determine and Display Event Time >>>
                let eventTime = null;
                if (positionsForThisDay.length > 0) {
                    const overrideInfo = overrideDays.find(o => o.date === currentCellDateStr);
                    if (overrideInfo && overrideInfo.time) {
                        eventTime = overrideInfo.time;
                    } else if (!overrideInfo && REGULAR_TIMES.hasOwnProperty(currentDayOfWeek)) {
                         const hasRegularAssignment = positionsForThisDay.some(p => {
                            const positionDetails = positions.find(pos => pos.id === p.id);
                            return positionDetails?.assignment_type === 'regular' && DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek);
                        });
                        if(hasRegularAssignment) {
                             eventTime = REGULAR_TIMES[currentDayOfWeek];
                        }
                    }
                    if (eventTime) {
                        const timeDiv = document.createElement('div');
                        timeDiv.className = 'event-time';
                        timeDiv.textContent = eventTime;
                        // Prepend timeDiv inside the cell
                        cell.insertBefore(timeDiv, cell.querySelector('.assigned-position, .assignment-skipped'));
                    }
                }
                // <<< END ADDED >>>

                date++;
            } // End current month day logic
            row.appendChild(cell);
        } // End dayOfWeek loop
        calendarBody.appendChild(row);

        // Stop adding rows if we've passed the last day of the month and the row is empty
        if (date > daysInMonth && row.querySelectorAll('td:not(.other-month)').length === 0) {
            break;
        }
    } // End week loop

    // Mobile view rendering
    // <<< IMPORTANT: Apply the same corrected logic to the mobile view >>>
    let mobileAssignmentCounter = 0; // Reset counter for mobile pass
    const mobileFirstDate = new Date(Date.UTC(year, month, 1));
    for (let d = 0; d < daysInMonth; d++) {
        const currentMobileDate = new Date(Date.UTC(year, month, d + 1));
        const currentCellDateStr = formatDateYYYYMMDD(currentMobileDate);
        const currentDayOfWeek = currentMobileDate.getUTCDay();

        const dayItem = document.createElement('li');
        dayItem.className = 'mobile-day-item';
        dayItem.dataset.date = currentCellDateStr;

        const dayHeader = document.createElement('div');
        dayHeader.className = 'mobile-day-header';
        // Use Portuguese day names for mobile header
        const dateDisplay = document.createElement('span');
        dateDisplay.className = 'mobile-date';
        const actualDayForMobile = currentMobileDate.getUTCDay(); // Sun=0, Mon=1...
        const dayNameIndex = (actualDayForMobile === 0) ? 6 : actualDayForMobile - 1; // Convert to Mon=0 ... Sun=6 for DAY_NAMES_PT
        dateDisplay.textContent = `${DAY_NAMES_PT[dayNameIndex]}, ${d + 1}`;
        dayHeader.appendChild(dateDisplay);
        dayItem.appendChild(dayHeader);

        // Add weekend class for mobile view based on actual day
        if (actualDayForMobile === 0 || actualDayForMobile === 6) { // Sunday or Saturday
            dayItem.classList.add('weekend');
        }

        const dayContent = document.createElement('div');
        dayContent.className = 'mobile-day-content';

        // Determine assignments for this day (same logic as desktop)
        const isOverride = overrideDays.some(o => o.date === currentCellDateStr);
        const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentCellDateStr);
        let positionsForThisDay = [];

        // --- CORRECTED LOGIC for adding positions based on rules (Mobile View) ---
        positions.forEach(position => {
            let shouldAdd = false;
            const allowed = position.allowed_days ? position.allowed_days.split(',').map(day => day.trim()) : []; // Ensure trimmed strings

            if (position.assignment_type === 'specific_days') {
                // Specific Days: Assign ONLY if the current day is in its allowed list.
                if (allowed.includes(currentDayOfWeek.toString())) { // Compare string day number
                    shouldAdd = true;
                }
            } else { // 'regular' type
                // Regular: Assign if it's a default day OR if it's an override day.
                if (DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverride) {
                    shouldAdd = true;
                }
            }

            if (shouldAdd) {
                 // Avoid duplicates
                if (!positionsForThisDay.some(p => p.id === position.id)) {
                    positionsForThisDay.push(position);
                }
            }
        });
        // --- END CORRECTED LOGIC (Mobile View) ---

        // Add special assignments (ensuring no duplicates)
        todaysSpecialAssignments.forEach(sa => {
            const positionInfo = positions.find(p => p.id === sa.position_id);
            if (positionInfo && !positionsForThisDay.some(p => p.id === positionInfo.id)) {
                positionsForThisDay.push(positionInfo);
            }
        });
        // Sort positions
        positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

        // <<< MODIFIED: Filter out REMOVED assignments (Mobile User View) >>>
        const todaysRemovedMobile = removedAssignments.filter(ra => ra.date === currentCellDateStr);
        positionsForThisDay = positionsForThisDay.filter(p => {
            return !todaysRemovedMobile.some(ra => ra.position_id === p.id);
        });
        // <<< END MODIFIED >>>

        // Create assignments for mobile
        if (canAssign && positionsForThisDay.length > 0) {
            dayItem.classList.add('assignment-day');
            const todaysHeldAssignments = heldDays.get(currentCellDateStr) || [];

            positionsForThisDay.forEach(position => {
                const assignmentDiv = document.createElement('div');
                let assignedMemberName = null;

                const heldAssignment = todaysHeldAssignments.find(h => h.position_name === position.name);

                if (heldAssignment) {
                    assignedMemberName = heldAssignment.member_name;
                    assignmentDiv.className = 'assigned-position held'; // Add base and held class
                    assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                    // Don't advance mobile counter for holds
                } else {
                    let attempts = 0;
                    while (assignedMemberName === null && attempts < memberCount) {
                        const potentialMemberIndex = (mobileAssignmentCounter + attempts) % memberCount;
                        // <<< FIX: Get the member object, then extract the name >>>
                        const potentialMemberObject = membersForAssignment[potentialMemberIndex];
                        const potentialMemberName = potentialMemberObject.name; // Get name string

                        if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) &&
                            isMemberQualified(potentialMemberName, position.id)) // Pass name string
                        {
                            assignedMemberName = potentialMemberName; // Assign name string
                            mobileAssignmentCounter = (mobileAssignmentCounter + attempts + 1);
                        } else {
                            attempts++;
                        }
                    }

                    if (assignedMemberName) {
                        assignmentDiv.className = 'assigned-position'; // Add base class
                        assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                    } else {
                        assignmentDiv.className = 'assignment-skipped'; // Add base and skipped class
                        assignmentDiv.innerHTML = `<strong>${position.name}:</strong> <span class="skipped-text">(Indisponível/Não Qualificado)</span>`;
                        if (attempts === memberCount) mobileAssignmentCounter++;
                    }
                }
                dayContent.appendChild(assignmentDiv);
            }); // End forEach position (Mobile)

            if (memberCount > 0) { mobileAssignmentCounter %= memberCount; }
             else { mobileAssignmentCounter = 0; }

        } // End if assignments needed (Mobile)

        // <<< ADDED: Determine and Display Event Time (Mobile) >>>
        let eventTime = null;
        if (positionsForThisDay.length > 0) {
            const overrideInfo = overrideDays.find(o => o.date === currentCellDateStr);
            if (overrideInfo && overrideInfo.time) {
                eventTime = overrideInfo.time;
            } else if (!overrideInfo && REGULAR_TIMES.hasOwnProperty(currentDayOfWeek)) {
                 const hasRegularAssignment = positionsForThisDay.some(p => {
                    const positionDetails = positions.find(pos => pos.id === p.id);
                    return positionDetails?.assignment_type === 'regular' && DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek);
                });
                if(hasRegularAssignment) {
                     eventTime = REGULAR_TIMES[currentDayOfWeek];
                }
            }
            if (eventTime) {
                const timeDiv = document.createElement('div');
                timeDiv.className = 'event-time';
                timeDiv.textContent = eventTime;
                // Add time to the mobile header
                dayHeader.appendChild(timeDiv);
            }
        }
        // <<< END ADDED >>>

        dayItem.appendChild(dayContent);
        mobileView.appendChild(dayItem);
    } // End mobile day loop
}

// <<< ADDED: Function to find and display the next upcoming event >>>
function displayNextEventInfo() {
    const displayElement = document.getElementById('next-event-display');
    if (!displayElement) return; // Element not found

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to start of UTC day

    const membersForAssignment = teamMembers; // Use fetched members
    const memberCount = membersForAssignment.length;

    let nextEventFound = false;
    let nextEventDetails = null;
    let searchDate = new Date(today); // Start searching from today

    // Simple assignment counter simulation for finding the *next* event
    // This doesn't need to be perfectly aligned with the main calendar counter state
    let simulationCounter = 0; 

    // Search ahead (e.g., 90 days)
    for (let i = 0; i < 90; i++) {
        const currentDate = new Date(Date.UTC(searchDate.getUTCFullYear(), searchDate.getUTCMonth(), searchDate.getUTCDate() + i));
        const currentDateStr = formatDateYYYYMMDD(currentDate);
        const currentDayOfWeek = currentDate.getUTCDay();

        // Determine if assignments should happen today (logic adapted from renderCalendar)
        const isOverride = overrideDays.some(o => o.date === currentDateStr);
        const todaysSpecialAssignments = specialAssignments.filter(sa => sa.date === currentDateStr);
        let positionsForThisDay = [];

        // Logic to determine positions for the day (same as renderCalendar)
        positions.forEach(position => {
            let shouldAdd = false;
            const allowed = position.allowed_days ? position.allowed_days.split(',').map(d => d.trim()) : [];
            if (position.assignment_type === 'specific_days') {
                if (allowed.includes(currentDayOfWeek.toString())) {
                    shouldAdd = true;
                }
            } else {
                if (DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverride) {
                    shouldAdd = true;
                }
            }
            if (shouldAdd && !positionsForThisDay.some(p => p.id === position.id)) {
                positionsForThisDay.push(position);
            }
        });
        todaysSpecialAssignments.forEach(sa => {
            const positionInfo = positions.find(p => p.id === sa.position_id);
            if (positionInfo && !positionsForThisDay.some(p => p.id === positionInfo.id)) {
                positionsForThisDay.push(positionInfo);
            }
        });
        const todaysRemovedAssignments = removedAssignments.filter(ra => ra.date === currentDateStr);
        positionsForThisDay = positionsForThisDay.filter(p => !todaysRemovedAssignments.some(ra => ra.position_id === p.id));
        positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));
        // End position determination logic

        if (positionsForThisDay.length > 0 && memberCount > 0) {
            const eventTime = determineEventTimeForDate(currentDateStr, currentDayOfWeek, isOverride, positionsForThisDay);

            if (eventTime) { // Only consider days with a determined time
                const todaysHeldAssignments = heldDays.get(currentDateStr) || [];
                const assignmentsForThisEvent = [];

                positionsForThisDay.forEach(position => {
                    let assignedMemberName = null;
                    const heldAssignment = todaysHeldAssignments.find(h => h.position_name === position.name);

                    if (heldAssignment) {
                        assignedMemberName = heldAssignment.member_name;
                        // Don't advance counter for holds
                    } else {
                        let attempts = 0;
                        while (assignedMemberName === null && attempts < memberCount) {
                            const potentialMemberIndex = (simulationCounter + attempts) % memberCount;
                            const potentialMemberObject = membersForAssignment[potentialMemberIndex];
                            const potentialMemberName = potentialMemberObject.name;

                            if (!isMemberUnavailable(potentialMemberName, currentDateStr) &&
                                isMemberQualified(potentialMemberName, position.id)) {
                                assignedMemberName = potentialMemberName;
                                simulationCounter = (simulationCounter + attempts + 1); // Advance counter
                            } else {
                                attempts++;
                            }
                        }
                        // If no one found after checking all, advance counter once for this slot
                        if (assignedMemberName === null && attempts === memberCount) {
                            simulationCounter++;
                        }
                    }

                    if (assignedMemberName) {
                        assignmentsForThisEvent.push({ positionName: position.name, memberName: assignedMemberName });
                    }
                }); // End forEach position

                 if (memberCount > 0) simulationCounter %= memberCount;

                if (assignmentsForThisEvent.length > 0) {
                    // Found the next event!
                    nextEventFound = true;
                    nextEventDetails = {
                        date: currentDate,
                        time: eventTime,
                        assignments: assignmentsForThisEvent
                    };
                    break; // Exit the loop
                }
            }
        }
    } // End date loop

    // Display the result
    if (nextEventFound && nextEventDetails) {
        const formattedDate = nextEventDetails.date.toLocaleDateString('pt-BR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
        let assignmentsHtml = '<ul>';
        nextEventDetails.assignments.forEach(a => {
            assignmentsHtml += `<li><strong>${a.positionName}:</strong> ${a.memberName}</li>`;
        });
        assignmentsHtml += '</ul>';

        displayElement.innerHTML = `
            <h3>Próxima Escala:</h3>
            <p class="next-event-date">🗓️ ${formattedDate}</p>
            <p class="next-event-time">⏰ ${nextEventDetails.time}</p>
            <div class="next-event-assignments">
                <h4>Participantes:</h4>
                ${assignmentsHtml}
            </div>
        `;
    } else {
        displayElement.innerHTML = '<p>Nenhuma próxima escala encontrada nos próximos 90 dias.</p>';
    }
}
// <<< END ADDED >>>

// --- Event Listeners ---
 prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
 });
 nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
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
async function initializeUserView() {
    console.log("Inicializando Visualização do Usuário...");
    initializeTheme();

    // Set initial button text
    prevMonthBtn.textContent = '< Ant';
    nextMonthBtn.textContent = 'Próx >';

    if(await fetchData()){
        console.log("Busca de dados bem-sucedida. Renderizando calendário e próxima escala.");
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        displayNextEventInfo(); // <<< CALL THE NEW FUNCTION HERE
    } else {
        console.error("Inicialização falhou devido a erro na busca de dados. Mensagem de erro deve ser exibida na página.");
        // No need to modify #scheduler here, fetchData does it on error
    }
}

// Start the application
initializeUserView();
