// --- Dependencies ---
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const path = require('path');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-very-secret-key-override'; // Use a strong secret

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
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

const requireLogin = (requiredRole = 'user') => {
    return (req, res, next) => {
        if (!req.session.user) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(401).json({ message: 'Unauthorized: Please log in.' });
            } else {
                 return res.status(401).redirect('/login.html?message=Please log in');
            }
        }
        if (req.session.user.role === 'admin') return next(); // Admin bypasses role check below
        if (requiredRole === 'admin' && req.session.user.role !== 'admin') {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
            } else {
                return res.status(403).send('Forbidden: Insufficient privileges.');
            }
        }
        next();
    };
};

// --- Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Login/Logout (Keep as is)
app.post('/login', async (req, res) => { /* ... */
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ success: false, message: 'Username and password required.' }); }
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) { return res.status(401).json({ success: false, message: 'Invalid credentials.' }); }
        const user = rows[0];
        // !! Use bcrypt in production !!
        if (password === user.password) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (error) { console.error('Login error:', error); res.status(500).json({ success: false, message: 'Server error.' }); }
});
app.post('/logout', (req, res) => { /* ... */
    req.session.destroy(err => {
        if (err) { console.error('Logout error:', err); return res.status(500).json({ success: false, message: 'Could not log out.' }); }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});


// --- TEAM MEMBERS API (Keep as is) ---
app.get('/api/team-members', requireLogin(), async (req, res) => { /* ... */
    try {
        const [members] = await pool.query('SELECT name FROM team_members ORDER BY name');
        res.json(members.map(m => m.name));
    } catch (error) { console.error('Error fetching team members:', error); res.status(500).send('Server error.'); }
});
app.post('/api/team-members', requireLogin('admin'), async (req, res) => { /* ... */
    const { name } = req.body; if (!name) { return res.status(400).send('Name required.'); }
    try { await pool.query('INSERT INTO team_members (name) VALUES (?)', [name]); res.status(201).json({ success: true, name }); }
    catch (error) { if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('Member exists.'); } console.error(error); res.status(500).send('Server error.'); }
});
app.delete('/api/team-members/:name', requireLogin('admin'), async (req, res) => { /* ... */
    const name = decodeURIComponent(req.params.name); if (!name) { return res.status(400).send('Name required.'); }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM unavailability WHERE member_name = ?', [name]);
        const [result] = await connection.query('DELETE FROM team_members WHERE name = ?', [name]);
        await connection.commit();
        if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Not found.'); }
    } catch (error) { await connection.rollback(); console.error(error); res.status(500).send('Server error.'); }
    finally { connection.release(); }
});


// --- POSITIONS API (Keep as is) ---
app.get('/api/positions', requireLogin(), async (req, res) => { /* ... */
    try {
        const [positions] = await pool.query('SELECT id, name FROM positions ORDER BY display_order, name');
        res.json(positions);
    } catch (error) { console.error('Error fetching positions:', error); res.status(500).send('Server error.'); }
});
app.post('/api/positions', requireLogin('admin'), async (req, res) => { /* ... */
    const { name } = req.body; if (!name) { return res.status(400).send('Name required.'); }
    try { const [result] = await pool.query('INSERT INTO positions (name) VALUES (?)', [name]); res.status(201).json({ success: true, id: result.insertId, name }); }
    catch (error) { if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('Position exists.'); } console.error(error); res.status(500).send('Server error.'); }
});
app.delete('/api/positions/:id', requireLogin('admin'), async (req, res) => { /* ... */
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid ID required.'); }
    try { const [result] = await pool.query('DELETE FROM positions WHERE id = ?', [id]); if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Not found.'); } }
    catch (error) { console.error(error); res.status(500).send('Server error.'); }
});


// --- UNAVAILABILITY API (Keep as is) ---
app.get('/api/unavailability', requireLogin(), async (req, res) => { /* ... */
     try {
        const [entries] = await pool.query('SELECT id, member_name, unavailable_date FROM unavailability ORDER BY unavailable_date, member_name');
        const formattedEntries = entries.map(entry => ({ id: entry.id, member: entry.member_name, date: entry.unavailable_date.toISOString().split('T')[0] }));
        res.json(formattedEntries);
    } catch (error) { console.error(error); res.status(500).send('Server error.'); }
});
app.post('/api/unavailability', requireLogin('admin'), async (req, res) => { /* ... */
    const { member, date } = req.body; if (!member || !date) { return res.status(400).send('Member and date required.'); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { return res.status(400).send('Invalid date format.'); }
    try { const [result] = await pool.query('INSERT INTO unavailability (member_name, unavailable_date) VALUES (?, ?)', [member, date]); res.status(201).json({ success: true, id: result.insertId, member, date }); }
    catch (error) { if (error.code === 'ER_DUP_ENTRY') { return res.status(409).send('Entry exists.'); } console.error(error); res.status(500).send('Server error.'); }
});
app.delete('/api/unavailability/:id', requireLogin('admin'), async (req, res) => { /* ... */
    const { id } = req.params; if (!id || isNaN(parseInt(id))) { return res.status(400).send('Valid ID required.'); }
    try { const [result] = await pool.query('DELETE FROM unavailability WHERE id = ?', [id]); if (result.affectedRows > 0) { res.json({ success: true }); } else { res.status(404).send('Not found.'); } }
    catch (error) { console.error(error); res.status(500).send('Server error.'); }
});


// --- <<< NEW: OVERRIDE ASSIGNMENT DAYS API >>> ---
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
        return res.status(400).send('Date is required');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).send('Invalid date format. Use YYYY-MM-DD');
    }
    try {
        await pool.query('INSERT INTO override_assignment_days (override_date) VALUES (?)', [date]);
        res.status(201).json({ success: true, date: date });
    } catch (error) {
         if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('This date is already an override day');
        }
        console.error('Error adding override day:', error);
        res.status(500).send('Error adding override day');
    }
});

app.delete('/api/overrides/:date', requireLogin('admin'), async (req, res) => {
    // Date comes directly from URL param (needs to be YYYY-MM-DD)
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
         return res.status(400).send('Invalid date format in URL. Use YYYY-MM-DD');
    }
    try {
        const [result] = await pool.query('DELETE FROM override_assignment_days WHERE override_date = ?', [date]);
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            // It's okay if it wasn't found, maybe deleted already
            res.status(404).send('Override day not found');
        }
    } catch (error) {
        console.error('Error deleting override day:', error);
        res.status(500).send('Error deleting override day');
    }
});
// --- <<< END OVERRIDE API >>> ---


// --- HTML Serving Routes (Keep as is) ---
app.get('/', (req, res) => { res.redirect('/login.html'); });
app.get('/admin', requireLogin('admin'), (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/user', requireLogin(), (req, res) => { res.sendFile(path.join(__dirname, 'public', 'user.html')); });

// --- Error Handling (Keep as is) ---
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).send('Something broke!'); });

// --- Start Server (Keep as is) ---
app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`); /* ... */ });
