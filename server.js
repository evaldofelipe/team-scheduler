// --- Dependencies ---
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt'); // <<< REQUIRE BCRYPT

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-very-secret-key-override'; // Use a strong secret
const SALT_ROUNDS = 10; // <<< DEFINE SALT ROUNDS for bcrypt

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'your_db_user', // Replace
    password: process.env.DB_PASSWORD || 'your_db_password', // Replace
    database: process.env.DB_NAME || 'team_scheduler_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

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

const requireLogin = (requiredRole = 'user') => {
    return (req, res, next) => {
        if (!req.session.user) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(401).json({ success: false, message: 'Unauthorized: Please log in.' });
            } else {
                 return res.status(401).redirect('/login.html?message=Please log in');
            }
        }
        // Admins can access anything
        if (req.session.user.role === 'admin') return next();
        // If admin role is specifically required, but user is not admin
        if (requiredRole === 'admin' && req.session.user.role !== 'admin') {
             if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges.' });
            } else {
                // Redirect or send forbidden page for HTML requests
                return res.status(403).send('Forbidden: Insufficient privileges.');
            }
        }
        // If user role is sufficient (covers 'user' requirement when role is 'user')
        next();
    };
};

// --- Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Login/Logout
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required.' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            // Avoid specific "user not found" messages for security
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        const user = rows[0];

        // --- !!! CRITICAL SECURITY POINT !!! ---
        // !! Replace the IF below with bcrypt.compare !!
        const match = await bcrypt.compare(password, user.password); // user.password MUST be the HASH from the DB
        if (match) {
            // Passwords match - proceed with session creation
            req.session.user = { id: user.id, username: user.username, role: user.role };
            console.log(`User login successful: ${user.username} (${user.role})`);
            res.json({ success: true, role: user.role });
        } else {
            // Passwords don't match
            console.warn(`Failed login attempt for user: ${username}`);
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        // --- !!! END SECURITY POINT !!! ---

        // <<< REMOVE THIS OLD PLAIN TEXT CHECK >>>
        // if (password === user.password) {
        //     req.session.user = { id: user.id, username: user.username, role: user.role };
        //     res.json({ success: true, role: user.role });
        // } else {
        //     res.status(401).json({ success: false, message: 'Invalid credentials.' });
        // }
        // <<< --- >>>

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

app.post('/logout', (req, res) => {
    const username = req.session.user ? req.session.user.username : 'Unknown user';
    req.session.destroy(err => {
        if (err) {
            console.error(`Logout error for ${username}:`, err);
            return res.status(500).json({ success: false, message: 'Could not log out.' });
        }
        console.log(`User logout successful: ${username}`);
        res.clearCookie('connect.sid'); // Use the default session cookie name
        res.json({ success: true });
    });
});


// --- TEAM MEMBERS API ---
app.get('/api/team-members', requireLogin(), async (req, res) => {
    try {
        const [members] = await pool.query('SELECT name FROM team_members ORDER BY name');
        res.json(members.map(m => m.name)); // Send only names
    } catch (error) { console.error('Error fetching team members:', error); res.status(500).send('Server error fetching team members.'); }
});

app.post('/api/team-members', requireLogin('admin'), async (req, res) => {
    const { name } = req.body; if (!name) { return res.status(400).send('Member name is required.'); }
    try {
        await pool.query('INSERT INTO team_members (name) VALUES (?)', [name]);
        res.status(201).json({ success: true, name });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('Team member with this name already exists.'); }
        console.error('Error adding team member:', error); res.status(500).send('Server error adding team member.');
    }
});

app.delete('/api/team-members/:name', requireLogin('admin'), async (req, res) => {
    const name = decodeURIComponent(req.params.name); if (!name) { return res.status(400).send('Member name is required in URL.'); }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // Delete related unavailability first
        await connection.query('DELETE FROM unavailability WHERE member_name = ?', [name]);
        // Then delete the member
        const [result] = await connection.query('DELETE FROM team_members WHERE name = ?', [name]);
        await connection.commit();
        if (result.affectedRows > 0) { res.json({ success: true }); }
        else { res.status(404).send('Team member not found.'); }
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting team member:', error);
        res.status(500).send('Server error deleting team member.');
    } finally {
        connection.release();
    }
});


// --- POSITIONS API ---
app.get('/api/positions', requireLogin(), async (req, res) => {
    try {
        // Order by display_order, then name for consistent ordering
        const [positions] = await pool.query('SELECT id, name FROM positions ORDER BY display_order, name');
        res.json(positions);
    } catch (error) { console.error('Error fetching positions:', error); res.status(500).send('Server error fetching positions.'); }
});

app.post('/api/positions', requireLogin('admin'), async (req, res) => {
    const { name } = req.body; if (!name) { return res.status(400).send('Position name is required.'); }
    try {
        const [result] = await pool.query('INSERT INTO positions (name) VALUES (?)', [name]);
        res.status(201).json({ success: true, id: result.insertId, name });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('Position with this name already exists.'); }
        console.error('Error adding position:', error); res.status(500).send('Server error adding position.');
    }
});

app.delete('/api/positions/:id', requireLogin('admin'), async (req, res) => {
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid numeric position ID is required.'); }
    try {
        const [result] = await pool.query('DELETE FROM positions WHERE id = ?', [id]);
        if (result.affectedRows > 0) { res.json({ success: true }); }
        else { res.status(404).send('Position not found.'); }
    } catch (error) {
        // Handle potential foreign key constraints if assignments link to positions later
        console.error('Error deleting position:', error);
        res.status(500).send('Server error deleting position.');
    }
});


// --- UNAVAILABILITY API ---
app.get('/api/unavailability', requireLogin(), async (req, res) => {
     try {
        const [entries] = await pool.query('SELECT id, member_name, unavailable_date FROM unavailability ORDER BY unavailable_date, member_name');
        // Format date to YYYY-MM-DD string before sending
        const formattedEntries = entries.map(entry => ({
            id: entry.id,
            member: entry.member_name,
            date: entry.unavailable_date.toISOString().split('T')[0]
        }));
        res.json(formattedEntries);
    } catch (error) { console.error('Error fetching unavailability:', error); res.status(500).send('Server error fetching unavailability.'); }
});

app.post('/api/unavailability', requireLogin('admin'), async (req, res) => {
    const { member, date } = req.body;
    if (!member || !date) { return res.status(400).send('Member name and date are required.'); }
    // Basic validation for YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format. Use YYYY-MM-DD.'); }
    try {
        const [result] = await pool.query('INSERT INTO unavailability (member_name, unavailable_date) VALUES (?, ?)', [member, date]);
        res.status(201).json({ success: true, id: result.insertId, member, date });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('This member is already marked unavailable on this date.'); }
        // Check if member actually exists? Could add a check here.
        console.error('Error adding unavailability:', error); res.status(500).send('Server error adding unavailability.');
    }
});

app.delete('/api/unavailability/:id', requireLogin('admin'), async (req, res) => {
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid numeric unavailability ID is required.'); }
    try {
        const [result] = await pool.query('DELETE FROM unavailability WHERE id = ?', [id]);
        if (result.affectedRows > 0) { res.json({ success: true }); }
        else { res.status(404).send('Unavailability entry not found.'); }
    } catch (error) { console.error('Error deleting unavailability:', error); res.status(500).send('Server error deleting unavailability.'); }
});


// --- OVERRIDE ASSIGNMENT DAYS API ---
app.get('/api/overrides', requireLogin(), async (req, res) => {
    try {
        const [overrides] = await pool.query('SELECT override_date FROM override_assignment_days ORDER BY override_date');
        // Send just an array of date strings (YYYY-MM-DD)
        const overrideDates = overrides.map(o => o.override_date.toISOString().split('T')[0]);
        res.json(overrideDates);
    } catch (error) {
        console.error('Error fetching override days:', error);
        res.status(500).send('Error fetching override days');
    }
});

app.post('/api/overrides', requireLogin('admin'), async (req, res) => {
    const { date } = req.body; // Expecting 'date' (YYYY-MM-DD)
    if (!date) {
        return res.status(400).send('Date is required for override.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).send('Invalid date format. Use YYYY-MM-DD');
    }
    try {
        await pool.query('INSERT INTO override_assignment_days (override_date) VALUES (?)', [date]);
        res.status(201).json({ success: true, date: date }); // Return the added date
    } catch (error) {
         if (error.code === 'ER_DUP_ENTRY') {
            // Don't treat duplicate as a server error, just inform client
            return res.status(409).send('This date is already set as an override day.');
        }
        console.error('Error adding override day:', error);
        res.status(500).send('Server error adding override day.');
    }
});

app.delete('/api/overrides/:date', requireLogin('admin'), async (req, res) => {
    // Date comes directly from URL param (needs to be YYYY-MM-DD)
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
         // Check format from URL parameter
         return res.status(400).send('Invalid date format in URL. Use YYYY-MM-DD');
    }
    try {
        const [result] = await pool.query('DELETE FROM override_assignment_days WHERE override_date = ?', [date]);
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            // If not found, it might have been deleted already or never existed.
            // Consider 404 an acceptable outcome here from client perspective.
            res.status(404).send('Override day not found.');
        }
    } catch (error) {
        console.error('Error deleting override day:', error);
        res.status(500).send('Server error deleting override day.');
    }
});


// <<< NEW: USER MANAGEMENT API (Admin Only) >>>
app.post('/api/users', requireLogin('admin'), async (req, res) => {
    const { username, password, role } = req.body;

    // Basic Validation
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Username, password, and role are required.' });
    }
    if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ success: false, message: 'Invalid role specified. Must be "admin" or "user".' });
    }
    if (password.length < 6) { // Example minimum password length check
         return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    try {
        // --- Hash the password ---
        console.log(`Hashing password for user: ${username}`);
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        console.log(`Password hashed successfully for user: ${username}`);
        // -------------------------

        // Insert the new user with the HASHED password
        await pool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        console.log(`Admin ${req.session.user.username} created new user: ${username} with role: ${role}`);
        res.status(201).json({ success: true, message: `User '${username}' created successfully.` });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            // Handle unique constraint violation for username
            console.warn(`Failed to create user '${username}'. Username already exists.`);
            return res.status(409).json({ success: false, message: `Username '${username}' already exists.` });
        }
        // Handle other potential errors
        console.error(`Error creating user '${username}':`, error);
        res.status(500).json({ success: false, message: 'Server error while creating user.' });
    }
});
// <<< END USER MANAGEMENT API >>>


// --- HTML Serving Routes ---
// Redirect root to login page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Serve admin page only to logged-in admins
app.get('/admin', requireLogin('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve user page to any logged-in user (admin or user)
app.get('/user', requireLogin('user'), (req, res) => { // 'user' role is sufficient
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// Let login page be accessible without login
app.get('/login.html', (req, res) => {
     res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- Error Handling ---
// Basic catch-all error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke on the server!');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Check DB connection on startup (optional but good practice)
    pool.query('SELECT 1')
        .then(() => console.log('Database connection successful.'))
        .catch(err => console.error('Database connection failed:', err));
});
