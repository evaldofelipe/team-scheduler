// --- Dependencies ---
require('dotenv').config(); // <<< LOAD .env variables FIRST
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');

// --- Configuration ---
// Now variables from .env will override defaults if present
const PORT = process.env.PORT || 3000;
// Use a strong, unique secret from .env or generate one if missing (but log a warning)
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-insecure-secret-change-me';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10'); // Get salt rounds from env or default to 10

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'your_db_user', // Default user if not in .env
    password: process.env.DB_PASSWORD || 'your_db_password', // Default password if not in .env
    database: process.env.DB_NAME || 'team_scheduler_db', // Default db name if not in .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Add a check for the session secret
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
    secret: SESSION_SECRET, // Use the variable loaded from .env or default
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// ... (rest of server.js remains the same: requireLogin, static files, API routes, HTML serving, error handling, server start) ...

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
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
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
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});


// --- TEAM MEMBERS API ---
app.get('/api/team-members', requireLogin(), async (req, res) => {
    try {
        const [members] = await pool.query('SELECT name FROM team_members ORDER BY name');
        res.json(members.map(m => m.name));
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
        await connection.query('DELETE FROM unavailability WHERE member_name = ?', [name]);
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
        console.error('Error deleting position:', error);
        res.status(500).send('Server error deleting position.');
    }
});


// --- UNAVAILABILITY API ---
app.get('/api/unavailability', requireLogin(), async (req, res) => {
     try {
        const [entries] = await pool.query('SELECT id, member_name, unavailable_date FROM unavailability ORDER BY unavailable_date, member_name');
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format. Use YYYY-MM-DD.'); }
    try {
        const [result] = await pool.query('INSERT INTO unavailability (member_name, unavailable_date) VALUES (?, ?)', [member, date]);
        res.status(201).json({ success: true, id: result.insertId, member, date });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('This member is already marked unavailable on this date.'); }
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
        const overrideDates = overrides.map(o => o.override_date.toISOString().split('T')[0]);
        res.json(overrideDates);
    } catch (error) {
        console.error('Error fetching override days:', error);
        res.status(500).send('Error fetching override days');
    }
});

app.post('/api/overrides', requireLogin('admin'), async (req, res) => {
    const { date } = req.body;
    if (!date) { return res.status(400).send('Date is required for override.'); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format. Use YYYY-MM-DD'); }
    try {
        await pool.query('INSERT INTO override_assignment_days (override_date) VALUES (?)', [date]);
        res.status(201).json({ success: true, date: date });
    } catch (error) {
         if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('This date is already set as an override day.'); }
        console.error('Error adding override day:', error);
        res.status(500).send('Server error adding override day.');
    }
});

app.delete('/api/overrides/:date', requireLogin('admin'), async (req, res) => {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format in URL. Use YYYY-MM-DD'); }
    try {
        const [result] = await pool.query('DELETE FROM override_assignment_days WHERE override_date = ?', [date]);
        if (result.affectedRows > 0) { res.json({ success: true }); }
        else { res.status(404).send('Override day not found.'); }
    } catch (error) {
        console.error('Error deleting override day:', error);
        res.status(500).send('Error deleting override day.');
    }
});


// --- USER MANAGEMENT API (Admin Only) ---
app.post('/api/users', requireLogin('admin'), async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) { return res.status(400).json({ success: false, message: 'Username, password, and role are required.' }); }
    if (role !== 'admin' && role !== 'user') { return res.status(400).json({ success: false, message: 'Invalid role specified. Must be "admin" or "user".' }); }
    if (password.length < 6) { return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' }); }

    try {
        console.log(`Hashing password for user: ${username}`);
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); // Use SALT_ROUNDS from config
        console.log(`Password hashed successfully for user: ${username}`);

        await pool.query( 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role] );

        console.log(`Admin ${req.session.user.username} created new user: ${username} with role: ${role}`);
        res.status(201).json({ success: true, message: `User '${username}' created successfully.` });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.warn(`Failed to create user '${username}'. Username already exists.`);
            return res.status(409).json({ success: false, message: `Username '${username}' already exists.` });
        }
        console.error(`Error creating user '${username}':`, error);
        res.status(500).json({ success: false, message: 'Server error while creating user.' });
    }
});


// --- HTML Serving Routes ---
app.get('/', (req, res) => { res.redirect('/login.html'); });
app.get('/admin', requireLogin('admin'), (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/user', requireLogin('user'), (req, res) => { res.sendFile(path.join(__dirname, 'public', 'user.html')); });
app.get('/login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke on the server!');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    pool.query('SELECT 1')
        .then(() => console.log('Database connection successful.'))
        .catch(err => console.error('Database connection failed:', err));
});
