// --- Dependencies ---
require('dotenv').config(); // <<< LOAD .env variables FIRST
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-insecure-secret-change-me';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'your_db_user',
    password: process.env.DB_PASSWORD || 'your_db_password',
    database: process.env.DB_NAME || 'team_scheduler_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // <<< ADDED: Ensure DATE columns are returned as strings to avoid timezone issues >>>
    dateStrings: true
};

// --- Sanity Checks ---
if (SESSION_SECRET === 'default-insecure-secret-change-me') {
    console.warn('************************************************************************');
    console.warn('WARNING: Using default session secret. Please set SESSION_SECRET in your .env file!');
    console.warn('************************************************************************');
}
if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
    console.warn('************************************************************************');
    console.warn('WARNING: DB_USER or DB_PASSWORD not found in .env. Using potentially insecure defaults.');
    console.warn('************************************************************************');
}

// --- Express App Setup ---
const app = express();
const pool = mysql.createPool(dbConfig);

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// --- Authorization Middleware ---
const requireLogin = (requiredRole = 'user') => {
    return (req, res, next) => {
        if (!req.session.user) {
            // If API request fails auth, send JSON error
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
            }
            // Otherwise, redirect browser requests to login
            // Keep the original message for clarity if redirected from elsewhere
            const message = req.query.message || 'Please log in';
            return res.status(401).redirect(`/login.html?message=${encodeURIComponent(message)}`);
        }
        // Allow admin access to everything
        if (req.session.user.role === 'admin') {
            return next();
        }
        // If admin role is specifically required, but user is not admin
        if (requiredRole === 'admin' && req.session.user.role !== 'admin') {
             if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges.' });
            } else {
                // Redirect non-admin users trying to access admin pages/actions
                return res.status(403).redirect('/user?message=Access Denied'); // Redirect to user page
            }
        }
        // If we reach here, the user is logged in and meets the minimum role requirement ('user')
        next();
    };
};

// --- Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper Functions ---
// Validate the allowed_days string (comma-separated 0-6)
function validateAllowedDays(daysString) {
    if (!daysString) return true; // Empty is valid (means no specific days)
    const days = daysString.split(',');
    const validDayPattern = /^[0-6]$/;
    const daySet = new Set(); // Check for duplicates
    for (const day of days) {
        const trimmedDay = day.trim();
        if (!validDayPattern.test(trimmedDay)) return false; // Invalid format
        if (daySet.has(trimmedDay)) return false; // Duplicate day
        daySet.add(trimmedDay);
    }
    return true;
}
// Normalize the allowed_days string (remove spaces, sort)
function normalizeAllowedDays(daysString) {
    if (!daysString) return null;
    const days = daysString.split(',')
                           .map(d => d.trim())
                           .filter(d => /^[0-6]$/.test(d)) // Keep only valid days
                           .sort(); // Sort for consistency
    return [...new Set(days)].join(','); // Remove duplicates and join
}


// --- API Routes ---

// Login/Logout
app.post('/login', async (req, res) => { /* ... unchanged ... */
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ success: false, message: 'Username and password required.' }); }
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) { return res.status(401).json({ success: false, message: 'Invalid credentials.' }); }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            console.log(`User login successful: ${user.username} (${user.role})`);
            res.json({ success: true, role: user.role });
        } else {
            console.warn(`Failed login attempt for user: ${username}`);
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (error) { console.error('Login error:', error); res.status(500).json({ success: false, message: 'Server error during login.' }); }
});
app.post('/logout', (req, res) => { /* ... unchanged ... */
    const username = req.session.user ? req.session.user.username : 'Unknown user';
    req.session.destroy(err => {
        if (err) { console.error(`Logout error for ${username}:`, err); return res.status(500).json({ success: false, message: 'Could not log out.' }); }
        console.log(`User logout successful: ${username}`);
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// --- TEAM MEMBERS API ---
app.get('/api/team-members', async (req, res) => {
    try {
        // <<< MODIFIED: Select name and phone_number >>>
        const [members] = await pool.query('SELECT name, phone_number FROM team_members ORDER BY name');
        // <<< MODIFIED: Return array of objects >>>
        res.json(members);
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).send('Server error fetching team members.');
    }
});

app.post('/api/team-members', requireLogin('admin'), async (req, res) => {
    // <<< MODIFIED: Destructure name and phone_number >>>
    const { name, phone_number } = req.body;
    if (!name) {
        return res.status(400).send('Member name is required.');
    }
    const cleanPhoneNumber = phone_number ? phone_number.trim() : null;

    try {
        // <<< MODIFIED: Insert name and phone_number >>>
        const [result] = await pool.query(
            'INSERT INTO team_members (name, phone_number) VALUES (?, ?)',
            [name, cleanPhoneNumber]
        );
        // <<< MODIFIED: Return the created member object >>>
        res.status(201).json({ success: true, name, phone_number: cleanPhoneNumber });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('Team member with this name already exists.');
        }
        console.error('Error adding team member:', error);
        res.status(500).send('Server error adding team member.');
    }
});

// <<< ADDED: PUT endpoint to update member details >>>
app.put('/api/team-members/:name', requireLogin('admin'), async (req, res) => {
    const originalName = decodeURIComponent(req.params.name);
    const { name: newName, phone_number } = req.body;

    if (!newName) {
        return res.status(400).json({ message: 'Member name is required.' });
    }
    const cleanPhoneNumber = phone_number ? phone_number.trim() : null;

    try {
        // Check if the member exists first
        const [existing] = await pool.query('SELECT name FROM team_members WHERE name = ?', [originalName]);
        if (existing.length === 0) {
            return res.status(404).json({ message: `Member '${originalName}' not found.` });
        }

        // Update the member
        const [result] = await pool.query(
            'UPDATE team_members SET name = ?, phone_number = ? WHERE name = ?',
            [newName, cleanPhoneNumber, originalName]
        );

        if (result.affectedRows > 0) {
            // If name changed, related tables might need updating.
            // For now, rely on frontend refresh. Consider transactions for robustness.
            console.log(`Member updated: ${originalName} -> ${newName}`);
            res.json({ success: true, name: newName, phone_number: cleanPhoneNumber });
        } else {
            // This case might occur if the name didn't actually change but the request was sent
            // Or if the WHERE clause somehow failed despite the initial check.
             res.status(304).json({ message: `Member '${originalName}' not modified (or not found during update).` }); // 304 Not Modified might be appropriate
        }

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes("'name'")) {
             return res.status(409).json({ message: `Another member with the name '${newName}' already exists.` });
        }
        console.error(`Error updating member ${originalName}:`, error);
        res.status(500).json({ message: 'Server error updating member.' });
    }
});

app.delete('/api/team-members/:name', requireLogin('admin'), async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    if (!name) { return res.status(400).send('Member name is required in URL.'); }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // <<< MODIFIED: Explicitly delete related records before deleting the member >>>
        console.log(`Attempting to delete records related to member: ${name}`);
        await connection.query('DELETE FROM unavailability WHERE member_name = ?', [name]);
        console.log(`Deleted unavailability for ${name}`);
        await connection.query('DELETE FROM member_positions WHERE member_name = ?', [name]);
        console.log(`Deleted member_positions for ${name}`);
        await connection.query('DELETE FROM held_assignments WHERE member_name = ?', [name]);
        console.log(`Deleted held_assignments for ${name}`);

        // Then delete the member
        const [result] = await connection.query('DELETE FROM team_members WHERE name = ?', [name]);
        console.log(`Deleted team_member ${name}, affected rows: ${result.affectedRows}`);
        await connection.commit();

        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            // This case means the member didn't exist, even though related records might have been deleted (if any existed)
            res.status(404).send('Team member not found.');
        }
    } catch (error) {
        await connection.rollback();
        console.error(`Error deleting team member ${name}:`, error);
        // Keep the foreign key check, as it might still occur if deletion order is wrong or constraints exist elsewhere
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
             res.status(409).send('Cannot delete member due to existing references (this should not happen if related records were deleted first).');
        } else {
            res.status(500).send('Server error deleting team member.');
        }
    } finally {
        connection.release();
    }
});


// --- POSITIONS API ---
app.get('/api/positions', async (req, res) => { /* ... logic unchanged ... */
    try {
        const [positions] = await pool.query(
            'SELECT id, name, display_order, assignment_type, allowed_days FROM positions ORDER BY display_order, name'
        );
        res.json(positions);
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).send('Server error fetching positions.');
    }
});

app.post('/api/positions', requireLogin('admin'), async (req, res) => {
    // <<< MODIFIED: Accept and validate new fields >>>
    const { name, assignment_type = 'regular', allowed_days } = req.body;

    if (!name) { return res.status(400).json({ message: 'Position name is required.' }); }
    if (assignment_type !== 'regular' && assignment_type !== 'specific_days') {
        return res.status(400).json({ message: 'Invalid assignment type. Must be "regular" or "specific_days".' });
    }
    // Ensure allowed_days is null if type is regular
    let finalAllowedDays = null;
    if (assignment_type === 'specific_days') {
        if (!validateAllowedDays(allowed_days)) {
            return res.status(400).json({ message: 'Invalid allowed_days format. Must be comma-separated numbers from 0 to 6 (e.g., "1,3,5").' });
        }
        finalAllowedDays = normalizeAllowedDays(allowed_days); // Clean up the string
        if (!finalAllowedDays) { // If after normalization it's empty, treat as regular
             return res.status(400).json({ message: 'Allowed days cannot be empty when type is specific_days.' });
        }
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO positions (name, assignment_type, allowed_days) VALUES (?, ?, ?)',
            [name, assignment_type, finalAllowedDays]
        );
        res.status(201).json({
            success: true,
            id: result.insertId,
            name: name,
            assignment_type: assignment_type,
            allowed_days: finalAllowedDays
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Position with this name already exists.' });
        }
        console.error('Error adding position:', error);
        res.status(500).json({ message: 'Server error adding position.' });
    }
});

// <<< NEW: PUT endpoint for updating positions >>>
app.put('/api/positions/:id', requireLogin('admin'), async (req, res) => {
    const { id } = req.params;
    const { name, assignment_type, allowed_days, display_order } = req.body; // Also allow updating display_order

    if (!id || isNaN(parseInt(id))) { return res.status(400).json({ message: 'Valid numeric position ID is required in URL.' }); }
    const positionId = parseInt(id);

    // --- Validation ---
    if (!name) { return res.status(400).json({ message: 'Position name is required.' }); }
    if (!assignment_type || (assignment_type !== 'regular' && assignment_type !== 'specific_days')) {
        return res.status(400).json({ message: 'Invalid assignment type. Must be "regular" or "specific_days".' });
    }
    let finalAllowedDays = null;
    if (assignment_type === 'specific_days') {
        if (!validateAllowedDays(allowed_days)) {
            return res.status(400).json({ message: 'Invalid allowed_days format. Must be comma-separated numbers from 0 to 6 (e.g., "1,3,5").' });
        }
        finalAllowedDays = normalizeAllowedDays(allowed_days);
         if (!finalAllowedDays) {
             return res.status(400).json({ message: 'Allowed days cannot be empty when type is specific_days.' });
        }
    }
    const finalDisplayOrder = display_order !== undefined && !isNaN(parseInt(display_order)) ? parseInt(display_order) : null; // Keep existing if not provided/invalid

    // --- Update Logic ---
    try {
        let updateQuery = 'UPDATE positions SET name = ?, assignment_type = ?, allowed_days = ?';
        const queryParams = [name, assignment_type, finalAllowedDays];

        if (finalDisplayOrder !== null) {
            updateQuery += ', display_order = ?';
            queryParams.push(finalDisplayOrder);
        }

        updateQuery += ' WHERE id = ?';
        queryParams.push(positionId);

        const [result] = await pool.query(updateQuery, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Position not found.' });
        }

        // Return the likely updated state (doesn't re-fetch, relies on input)
        res.json({
            success: true,
            id: positionId,
            name: name,
            assignment_type: assignment_type,
            allowed_days: finalAllowedDays,
            // Note: display_order might not be accurately reflected here if it wasn't updated
            // Frontend should re-fetch all positions on success anyway
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            // Check if it's the name causing the duplication
            if (error.message.includes("'name'")) {
                 return res.status(409).json({ message: `Another position with the name '${name}' already exists.` });
            }
        }
        console.error(`Error updating position ID ${positionId}:`, error);
        res.status(500).json({ message: 'Server error updating position.' });
    }
});

app.delete('/api/positions/:id', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid numeric position ID is required.'); }
    const positionId = parseInt(id);
    const connection = await pool.getConnection();
    try { await connection.beginTransaction(); const [result] = await connection.query('DELETE FROM positions WHERE id = ?', [positionId]); await connection.commit(); if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Position not found.'); } } catch (error) { await connection.rollback(); console.error('Error deleting position:', error); if (error.code === 'ER_ROW_IS_REFERENCED_2') { res.status(409).send('Cannot delete position as it might be referenced.'); } else { res.status(500).send('Server error deleting position.'); } } finally { connection.release(); }
});


// --- UNAVAILABILITY API ---
app.get('/api/unavailability', async (req, res) => { /* ... logic unchanged ... */
     try { const [entries] = await pool.query('SELECT id, member_name, unavailable_date FROM unavailability ORDER BY unavailable_date, member_name'); res.json(entries.map(entry => ({ id: entry.id, member: entry.member_name, date: entry.unavailable_date }))); } catch (error) { console.error('Error fetching unavailability:', error); res.status(500).send('Server error fetching unavailability.'); }
});
app.post('/api/unavailability', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { member, date } = req.body; if (!member || !date) { return res.status(400).send('Member name and date are required.'); } if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format. Use YYYY-MM-DD.'); }
    try { const [memberExists] = await pool.query('SELECT 1 FROM team_members WHERE name = ?', [member]); if (memberExists.length === 0) { return res.status(404).send(`Team member '${member}' not found.`); } const [result] = await pool.query('INSERT INTO unavailability (member_name, unavailable_date) VALUES (?, ?)', [member, date]); res.status(201).json({ success: true, id: result.insertId, member, date }); } catch (error) { if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('This member is already marked unavailable on this date.'); } console.error('Error adding unavailability:', error); res.status(500).send('Server error adding unavailability.'); }
});
app.delete('/api/unavailability/:id', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid numeric unavailability ID is required.'); }
    try { const [result] = await pool.query('DELETE FROM unavailability WHERE id = ?', [id]); if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Unavailability entry not found.'); } } catch (error) { console.error('Error deleting unavailability:', error); res.status(500).send('Server error deleting unavailability.'); }
});


// --- OVERRIDE ASSIGNMENT DAYS API ---
app.get('/api/overrides', async (req, res) => { /* ... logic unchanged ... */
    try { const [overrides] = await pool.query('SELECT override_date FROM override_assignment_days ORDER BY override_date'); res.json(overrides.map(o => o.override_date)); } catch (error) { console.error('Error fetching override days:', error); res.status(500).send('Error fetching override days'); }
});
app.post('/api/overrides', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { date } = req.body; if (!date) { return res.status(400).send('Date is required for override.'); } if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format. Use YYYY-MM-DD'); }
    try { await pool.query('INSERT INTO override_assignment_days (override_date) VALUES (?)', [date]); res.status(201).json({ success: true, date: date }); } catch (error) { if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('This date is already set as an override day.'); } console.error('Error adding override day:', error); res.status(500).send('Server error adding override day.'); }
});
app.delete('/api/overrides/:date', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const date = req.params.date; if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format in URL. Use YYYY-MM-DD'); }
    try { const [result] = await pool.query('DELETE FROM override_assignment_days WHERE override_date = ?', [date]); if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Override day not found.'); } } catch (error) { console.error('Error deleting override day:', error); res.status(500).send('Error deleting override day.'); }
});


// --- SPECIAL ASSIGNMENTS API ---
app.get('/api/special-assignments', async (req, res) => { /* ... logic unchanged ... */
    try { const [assignments] = await pool.query(` SELECT sa.id, sa.assignment_date, sa.position_id, p.name AS position_name FROM special_assignments sa JOIN positions p ON sa.position_id = p.id ORDER BY sa.assignment_date, p.name `); res.json(assignments.map(sa => ({ ...sa, date: sa.assignment_date }))); } catch (error) { console.error('Error fetching special assignments:', error); res.status(500).send('Server error fetching special assignments.'); }
});
app.post('/api/special-assignments', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { date, position_id } = req.body; if (!date || !position_id) { return res.status(400).send('Date and Position ID are required.'); } if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format. Use YYYY-MM-DD.'); } if (isNaN(parseInt(position_id))) { return res.status(400).send('Invalid Position ID. Must be a number.'); }
    const numericPositionId = parseInt(position_id);
    try { const [positionExists] = await pool.query('SELECT name FROM positions WHERE id = ?', [numericPositionId]); if (positionExists.length === 0) { return res.status(404).send(`Position with ID ${numericPositionId} not found.`); } const positionName = positionExists[0].name; const [result] = await pool.query( 'INSERT INTO special_assignments (assignment_date, position_id) VALUES (?, ?)', [date, numericPositionId] ); res.status(201).json({ success: true, id: result.insertId, date: date, position_id: numericPositionId, position_name: positionName }); } catch (error) { if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('This position is already added as a special assignment on this date.'); } if (error.code === 'ER_NO_REFERENCED_ROW_2') { return res.status(404).send(`Position with ID ${numericPositionId} not found.`); } console.error('Error adding special assignment:', error); res.status(500).send('Server error adding special assignment.'); }
});
app.delete('/api/special-assignments/:id', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid numeric special assignment ID is required.'); } const numericId = parseInt(id);
    try { const [result] = await pool.query('DELETE FROM special_assignments WHERE id = ?', [numericId]); if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Special assignment entry not found.'); } } catch (error) { console.error('Error deleting special assignment:', error); res.status(500).send('Error deleting special assignment.'); }
});


// --- USER MANAGEMENT API (Admin Only) ---
app.post('/api/users', requireLogin('admin'), async (req, res) => { /* ... unchanged ... */
    const { username, password, role } = req.body; if (!username || !password || !role) { return res.status(400).json({ success: false, message: 'Username, password, and role are required.' }); } if (role !== 'admin' && role !== 'user') { return res.status(400).json({ success: false, message: 'Invalid role specified. Must be "admin" or "user".' }); } if (password.length < 6) { return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' }); }
    try { console.log(`Hashing password for user: ${username}`); const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); console.log(`Password hashed successfully for user: ${username}`); await pool.query( 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role] ); console.log(`Admin ${req.session.user.username} created new user: ${username} with role: ${role}`); res.status(201).json({ success: true, message: `User '${username}' created successfully.` }); } catch (error) { if (error.code === 'ER_DUP_ENTRY') { console.warn(`Failed to create user '${username}'. Username already exists.`); return res.status(409).json({ success: false, message: `Username '${username}' already exists.` }); } console.error(`Error creating user '${username}':`, error); res.status(500).json({ success: false, message: 'Server error while creating user.' }); }
});


// --- HTML Serving Routes ---
app.get('/', (req, res) => {
    // Redirect to /user instead of login
    res.redirect('/user');
});
app.get('/admin', requireLogin('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- Error Handling ---
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).send('Something broke on the server!'); });

// --- MEMBER POSITIONS API ---
app.get('/api/member-positions/:memberName', async (req, res) => {
    const memberName = decodeURIComponent(req.params.memberName);
    try {
        const [memberExists] = await pool.query('SELECT 1 FROM team_members WHERE name = ?', [memberName]);
        if (memberExists.length === 0) {
             return res.json([]); // Return empty array if member doesn't exist
        }
        const [positions] = await pool.query(
            `SELECT p.id, p.name
             FROM positions p
             INNER JOIN member_positions mp ON p.id = mp.position_id
             WHERE mp.member_name = ?
             ORDER BY p.display_order, p.name`,
            [memberName]
        );
        res.json(positions);
    } catch (error) {
        console.error(`Error fetching member positions for ${memberName}:`, error);
        res.status(500).send('Server error fetching member positions.');
    }
});

app.post('/api/member-positions/:memberName', requireLogin('admin'), async (req, res) => {
    const memberName = decodeURIComponent(req.params.memberName);
    const { positionIds } = req.body;

    if (!Array.isArray(positionIds)) {
        return res.status(400).send('Position IDs must be provided as an array.');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // Check member existence
        const [memberExists] = await connection.query('SELECT 1 FROM team_members WHERE name = ?', [memberName]);
        if (memberExists.length === 0) {
             await connection.rollback();
             return res.status(404).send(`Team member '${memberName}' not found.`);
        }
        // Delete existing positions for this member
        await connection.query('DELETE FROM member_positions WHERE member_name = ?', [memberName]);

        // Insert new positions
        if (positionIds.length > 0) {
            const values = positionIds.map(id => [memberName, id]);
            await connection.query(
                'INSERT INTO member_positions (member_name, position_id) VALUES ?',
                [values]
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error(`Error updating member positions for ${memberName}:`, error);
         // <<< REVERTED: Simplified error handling, check for specific FK errors >>>
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             // This likely means a position ID doesn't exist, as member existence was checked
             return res.status(404).send(`One or more position IDs provided do not exist.`);
        }
        res.status(500).send('Server error updating member positions.');
    } finally {
        connection.release();
    }
});

// GET (all members) - This endpoint might still be useful for the user view qualification check
// Keep it, but ensure it works correctly.
app.get('/api/all-member-positions', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT mp.member_name, p.id as position_id, p.name as position_name
             FROM member_positions mp
             JOIN positions p ON mp.position_id = p.id
             ORDER BY mp.member_name, p.display_order, p.name`
        );
        const allMemberPositions = rows.reduce((acc, row) => {
            if (!acc[row.member_name]) {
                acc[row.member_name] = [];
            }
            acc[row.member_name].push({ id: row.position_id, name: row.position_name });
            return acc;
        }, {});
        res.json(allMemberPositions);
    } catch (error) {
        console.error('Error fetching all member positions:', error);
        res.status(500).json({ message: 'Server error fetching all member positions.' });
    }
});

// --- HELD ASSIGNMENTS API ---
app.get('/api/held-assignments', async (req, res) => {
    try {
        const [assignments] = await pool.query(
            'SELECT id, assignment_date, position_name, member_name FROM held_assignments ORDER BY assignment_date'
        );
        res.json(assignments);
    } catch (error) {
        console.error('Error fetching held assignments:', error);
        res.status(500).send('Server error fetching held assignments.');
    }
});

app.post('/api/held-assignments', requireLogin('admin'), async (req, res) => {
    const { assignments } = req.body; // Array of {date, position_name, member_name}

    if (!Array.isArray(assignments)) {
        return res.status(400).send('Assignments must be provided as an array.');
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Clear existing held assignments for the dates we're updating
        const dates = [...new Set(assignments.map(a => a.date))];
        if (dates.length > 0) {
            await connection.query(
                'DELETE FROM held_assignments WHERE assignment_date IN (?)',
                [dates]
            );
        }

        // Insert new held assignments
        if (assignments.length > 0) {
            const values = assignments.map(a => [a.date, a.position_name, a.member_name]);
            await connection.query(
                'INSERT INTO held_assignments (assignment_date, position_name, member_name) VALUES ?',
                [values]
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Error saving held assignments:', error);
        res.status(500).send('Server error saving held assignments.');
    } finally {
        connection.release();
    }
});

app.delete('/api/held-assignments/:date', requireLogin('admin'), async (req, res) => {
    const { date } = req.params;
     if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).send('Invalid date format. Use YYYY-MM-DD.');
    }
    try {
        const [result] = await pool.query('DELETE FROM held_assignments WHERE assignment_date = ?', [date]);
        res.json({ success: true, deletedCount: result.affectedRows });
    } catch (error) {
        console.error('Error deleting held assignments:', error);
        res.status(500).send('Server error deleting held assignments.');
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    pool.query('SELECT 1').then(() => console.log('Database connection successful.')).catch(err => console.error('Database connection failed:', err));
});
