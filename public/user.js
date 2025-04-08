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
const DAY_NAMES_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// --- Helper Functions ---
function formatDateYYYYMMDD(dateInput) { /* ... unchanged ... */
    try { const date = new Date(dateInput); const year = date.getUTCFullYear(); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const day = String(date.getUTCDate()).padStart(2, '0'); return `${year}-${month}-${day}`; } catch (e) { return ""; }
}

// --- API Interaction ---
 async function fetchData() {
    console.log("Buscando dados para a visualização do usuário...");
    try {
        // Fetch all data needed
        const [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes] = await Promise.all([
            fetch('/api/team-members'),
            fetch('/api/unavailability'),
            fetch('/api/positions'),
            fetch('/api/overrides'),
            fetch('/api/special-assignments'),
            fetch('/api/all-member-positions'),
            fetch('/api/held-assignments')
        ]);

        // Check for errors (excluding 401 redirect for public view)
        const responses = [membersRes, unavailRes, positionsRes, overridesRes, specialAssignRes, allMemberPosRes, heldAssignmentsRes];
        const errors = [];
        responses.forEach((res, index) => {
            if (!res.ok) {
                const apiName = ['Membros', 'Indisponibilidade', 'Posições', 'Overrides', 'Tarefas Especiais', 'Qualificações', 'Tarefas Salvas'][index];
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
function renderCalendar(year, month, membersToAssign = teamMembers) {
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

    // Use Portuguese month names
    monthYearHeader.textContent = `${MONTH_NAMES_PT[month]} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();
    assignmentCounter = 0;
    let date = 1;
    const canAssign = membersToAssign && membersToAssign.length > 0;

    // Regular calendar rendering
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            const dateNumberDiv = document.createElement('div');
            dateNumberDiv.className = 'date-number';

            if (week === 0 && dayOfWeek < startDayOfWeek) {
                cell.classList.add('other-month');
                // Optionally display previous month's days faded
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                dateNumberDiv.textContent = prevMonthLastDay - startDayOfWeek + dayOfWeek + 1;
                cell.appendChild(dateNumberDiv);
            } else if (date > daysInMonth) {
                cell.classList.add('other-month');
                // Optionally display next month's days faded
                dateNumberDiv.textContent = date - daysInMonth;
                cell.appendChild(dateNumberDiv);
                date++;
            } else {
                // Current month's day
                cell.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                dateNumberDiv.textContent = date;
                cell.appendChild(dateNumberDiv);

                const currentCellDate = new Date(Date.UTC(year, month, date));
                const currentCellDateStr = formatDateYYYYMMDD(currentCellDate);
                const currentDayOfWeek = currentCellDate.getUTCDay();

                // Determine if assignments should happen today
                const isOverrideDay = overrideDays.includes(currentCellDateStr);
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
                        if (DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverrideDay) {
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

                // Sort positions
                positionsForThisDay.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));

                // Create assignments
                if (canAssign && positionsForThisDay.length > 0) {
                    cell.classList.add('assignment-day');
                    const memberCount = membersToAssign.length;
                    const todaysHeldAssignments = heldDays.get(currentCellDateStr) || [];

                    positionsForThisDay.forEach(position => {
                        const assignmentDiv = document.createElement('div');
                        assignmentDiv.className = 'assigned-position';
                        let assignedMemberName = null;

                        const heldAssignment = todaysHeldAssignments.find(h => h.position_name === position.name);

                        if (heldAssignment) {
                            assignedMemberName = heldAssignment.member_name;
                            assignmentDiv.classList.add('held');
                            assignmentDiv.innerHTML = `<a href="#" class="position-link" title="Posição: ${position.name}">${position.name}</a>: ${assignedMemberName}`;
                            // Don't advance counter for holds
                        } else {
                            let attempts = 0;
                            while (assignedMemberName === null && attempts < memberCount) {
                                const potentialMemberIndex = (assignmentCounter + attempts) % memberCount;
                                const potentialMemberName = membersToAssign[potentialMemberIndex];

                                if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) &&
                                    isMemberQualified(potentialMemberName, position.id))
                                {
                                    assignedMemberName = potentialMemberName;
                                    assignmentCounter = (assignmentCounter + attempts + 1); // Advance counter only for non-held
                                } else {
                                    attempts++;
                                }
                            }

                            if (assignedMemberName) {
                                assignmentDiv.innerHTML = `<a href="#" class="position-link" title="Posição: ${position.name}">${position.name}</a>: ${assignedMemberName}`;
                            } else {
                                assignmentDiv.classList.add('assignment-skipped');
                                // Changed text for skipped assignment
                                assignmentDiv.innerHTML = `<a href="#" class="position-link" title="Posição: ${position.name}">${position.name}</a>: <span class="skipped-text">(Indisponível/Não Qualificado)</span>`;
                                if (attempts === memberCount) {
                                    assignmentCounter++; // Advance counter if skipped for non-held
                                }
                            }
                        }
                        cell.appendChild(assignmentDiv);
                    }); // End forEach position

                    if (memberCount > 0) { assignmentCounter %= memberCount; }
                    else { assignmentCounter = 0; }
                }
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
        dayHeader.textContent = `${DAY_NAMES_PT[currentDayOfWeek]}, ${d + 1}`;
        dayItem.appendChild(dayHeader);

        const dayContent = document.createElement('div');
        dayContent.className = 'mobile-day-content';

        // Determine assignments for this day (same logic as desktop)
        const isOverrideDay = overrideDays.includes(currentCellDateStr);
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
                if (DEFAULT_ASSIGNMENT_DAYS_OF_WEEK.includes(currentDayOfWeek) || isOverrideDay) {
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

        // Create assignments for mobile
        if (canAssign && positionsForThisDay.length > 0) {
            dayItem.classList.add('assignment-day'); // Add class to the list item
            const memberCount = membersToAssign.length;
            const todaysHeldAssignments = heldDays.get(currentCellDateStr) || [];

            positionsForThisDay.forEach(position => {
                const assignmentDiv = document.createElement('div');
                assignmentDiv.className = 'assigned-position'; // Base class
                let assignedMemberName = null;

                const heldAssignment = todaysHeldAssignments.find(h => h.position_name === position.name);

                if (heldAssignment) {
                    assignedMemberName = heldAssignment.member_name;
                    assignmentDiv.classList.add('held');
                    assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                    // Don't advance mobile counter for holds
                } else {
                    let attempts = 0;
                    while (assignedMemberName === null && attempts < memberCount) {
                        const potentialMemberIndex = (mobileAssignmentCounter + attempts) % memberCount;
                        const potentialMemberName = membersToAssign[potentialMemberIndex];

                        if (!isMemberUnavailable(potentialMemberName, currentCellDateStr) &&
                            isMemberQualified(potentialMemberName, position.id))
                        {
                            assignedMemberName = potentialMemberName;
                            mobileAssignmentCounter = (mobileAssignmentCounter + attempts + 1); // Advance mobile counter ONLY for non-held
                        } else {
                            attempts++;
                        }
                    }

                    if (assignedMemberName) {
                        assignmentDiv.innerHTML = `<strong>${position.name}:</strong> ${assignedMemberName}`;
                    } else {
                        assignmentDiv.classList.add('assignment-skipped');
                        // Changed text for skipped assignment
                        assignmentDiv.innerHTML = `<strong>${position.name}:</strong> <span class="skipped-text">(Indisponível/Não Qualificado)</span>`;
                        if (attempts === memberCount) {
                            mobileAssignmentCounter++; // Advance mobile counter if skipped for non-held
                        }
                    }
                }
                dayContent.appendChild(assignmentDiv);
            }); // End forEach position

            if (memberCount > 0) { mobileAssignmentCounter %= memberCount; }
             else { mobileAssignmentCounter = 0; }

        } // End if assignments needed

        dayItem.appendChild(dayContent);
        mobileView.appendChild(dayItem);
    } // End mobile day loop
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
        console.log("Busca de dados bem-sucedida. Renderizando calendário.");
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    } else {
        console.error("Inicialização falhou devido a erro na busca de dados. Mensagem de erro deve ser exibida na página.");
        // No need to modify #scheduler here, fetchData does it on error
    }
}

// Start the application
initializeUserView();
