// --- Dependencies ---
const express = require('express');
const mysql = require('mysql2/promise'); // Using promise version for async/await
const session = require('express-session');
const path = require('path');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-very-secret-key'; // Change in production!

// Database connection details (use environment variables in production)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'your_db_user', // Replace with your DB user
    password: process.env.DB_PASSWORD || 'your_db_password', // Replace with your DB password
    database: process.env.DB_NAME || 'team_scheduler_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// --- Express App Setup ---
const app = express();
const pool = mysql.createPool(dbConfig); // Create a connection pool

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// Session middleware
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Don't save session if unmodified
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // Example: cookie valid for 1 day
    }
}));

// Middleware to check if user is logged in and has the required role
const requireLogin = (requiredRole = 'user') => {
    return (req, res, next) => {
        if (!req.session.user) {
            // For API requests, send 401, otherwise redirect
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(401).json({ message: 'Unauthorized: Please log in.' });
            } else {
                 return res.status(401).redirect('/login.html?message=Please log in');
            }
        }
        // Check role if specific role is required
        // Admins can access everything
        if (req.session.user.role === 'admin') {
             return next();
        }
        // Users can only access 'user' level routes
        if (requiredRole === 'admin' && req.session.user.role !== 'admin') {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                 return res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
            } else {
                return res.status(403).send('Forbidden: Insufficient privileges.');
            }
        }
        // If role is 'user' or not specified, and user is logged in (any role), allow access
        next();
    };
};

// --- Static Files ---
// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Login Endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const user = rows[0];

        // !! IMPORTANT: Plain text password comparison - ONLY FOR DEMO !!
        // !! In Production: Use bcrypt.compare(password, user.password) !!
        if (password === user.password) {
            // Passwords match - Store user info in session (excluding password)
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role
            };
            console.log(`User logged in: ${user.username}, Role: ${user.role}`);
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// Logout Endpoint
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.json({ success: true });
    });
});

// --- TEAM MEMBERS API ---

// Get Team Members Endpoint (accessible by admin and user)
app.get('/api/team-members', requireLogin(), async (req, res) => {
    try {
        const [members] = await pool.query('SELECT name FROM team_members ORDER BY name');
        res.json(members.map(m => m.name)); // Send only names
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).send('Error fetching team members');
    }
});

// Add Team Member Endpoint (admin only)
app.post('/api/team-members', requireLogin('admin'), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).send('Member name is required');
    }
    try {
        await pool.query('INSERT INTO team_members (name) VALUES (?)', [name]);
        res.status(201).json({ success: true, name: name });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('Team member already exists');
        }
        console.error('Error adding team member:', error);
        res.status(500).send('Error adding team member');
    }
});

// Delete Team Member Endpoint (admin only)
app.delete('/api/team-members/:name', requireLogin('admin'), async (req, res) => {
    // Decode name from URL parameter
    const name = decodeURIComponent(req.params.name);
    if (!name) {
        return res.status(400).send('Member name is required');
    }
    const connection = await pool.getConnection(); // Use transaction
    try {
        await connection.beginTransaction();
        // Delete unavailability first (using name as per schema choice)
        await connection.query('DELETE FROM unavailability WHERE member_name = ?', [name]);
        // Then delete the member
        const [result] = await connection.query('DELETE FROM team_members WHERE name = ?', [name]);

        await connection.commit(); // Commit transaction

        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).send('Team member not found');
        }
    } catch (error) {
        await connection.rollback(); // Rollback on error
        console.error('Error deleting team member:', error);
        res.status(500).send('Error deleting team member');
    } finally {
        connection.release(); // Release connection back to pool
    }
});

// --- POSITIONS API ---

// Get Positions Endpoint (accessible by admin and user)
app.get('/api/positions', requireLogin(), async (req, res) => {
    try {
        // Order by display_order then name for consistent results
        const [positions] = await pool.query('SELECT id, name FROM positions ORDER BY display_order, name');
        res.json(positions); // Send array of {id, name} objects
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).send('Error fetching positions');
    }
});

// Add Position Endpoint (admin only)
app.post('/api/positions', requireLogin('admin'), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).send('Position name is required');
    }
    try {
        // Add display_order logic later if needed, default is 0
        const [result] = await pool.query('INSERT INTO positions (name) VALUES (?)', [name]);
        res.status(201).json({ success: true, id: result.insertId, name: name });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('Position name already exists');
        }
        console.error('Error adding position:', error);
        res.status(500).send('Error adding position');
    }
});

// Delete Position Endpoint (admin only)
app.delete('/api/positions/:id', requireLogin('admin'), async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).send('Valid Position ID is required');
    }
    try {
        const [result] = await pool.query('DELETE FROM positions WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).send('Position not found');
        }
    } catch (error) {
        console.error('Error deleting position:', error);
        res.status(500).send('Error deleting position');
    }
});

// --- UNAVAILABILITY API ---

// Get Unavailability Endpoint (accessible by admin and user)
app.get('/api/unavailability', requireLogin(), async (req, res) => {
    try {
        const [entries] = await pool.query('SELECT id, member_name, unavailable_date FROM unavailability ORDER BY unavailable_date, member_name');
        // Format date correctly for consistency before sending
        const formattedEntries = entries.map(entry => ({
            id: entry.id,
            member: entry.member_name,
            date: entry.unavailable_date.toISOString().split('T')[0] // Ensure YYYY-MM-DD
        }));
        res.json(formattedEntries);
    } catch (error) {
        console.error('Error fetching unavailability:', error);
        res.status(500).send('Error fetching unavailability');
    }
});

// Add Unavailability Endpoint (admin only)
app.post('/api/unavailability', requireLogin('admin'), async (req, res) => {
    const { member, date } = req.body; // Expecting 'member' and 'date' (YYYY-MM-DD)
    if (!member || !date) {
        return res.status(400).send('Member name and date are required');
    }
    // Basic date validation (more robust validation recommended)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).send('Invalid date format. Use YYYY-MM-DD');
    }

    try {
        const [result] = await pool.query('INSERT INTO unavailability (member_name, unavailable_date) VALUES (?, ?)', [member, date]);
        res.status(201).json({ success: true, id: result.insertId, member, date });
    } catch (error) {
         if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('This member is already marked unavailable on this date');
        }
        console.error('Error adding unavailability:', error);
        res.status(500).send('Error adding unavailability');
    }
});

// Delete Unavailability Endpoint (admin only)
app.delete('/api/unavailability/:id', requireLogin('admin'), async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) { // Basic check if ID is a number
        return res.status(400).send('Valid ID is required');
    }
    try {
        const [result] = await pool.query('DELETE FROM unavailability WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.status(404).send('Unavailability entry not found');
        }
    } catch (error) {
        console.error('Error deleting unavailability:', error);
        res.status(500).send('Error deleting unavailability');
    }
});


// --- HTML Serving Routes ---

// Redirect root to login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Serve Admin page (protected)
app.get('/admin', requireLogin('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve User page (protected)
// Use requireLogin() which defaults to 'user' level access (allows admin too)
app.get('/user', requireLogin(), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
});

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Ensure database is set up and user credentials in dbConfig are correct.');
    console.warn('Authentication uses plain text passwords - FOR DEMO ONLY!');
});
