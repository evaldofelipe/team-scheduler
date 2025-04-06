-- Create a database (if it doesn't exist)
CREATE DATABASE IF NOT EXISTS team_scheduler_db;

-- Use the database
USE team_scheduler_db;

-- Create the team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the unavailability table
CREATE TABLE IF NOT EXISTS unavailability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_name VARCHAR(100) NOT NULL, -- Matches name in team_members
    unavailable_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_unavailability (member_name, unavailable_date) -- Prevent duplicates
    -- Optional: Add FOREIGN KEY constraint if you prefer using member IDs
    -- member_id INT,
    -- FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

-- Create the users table for login
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- STORE HASHED PASSWORDS IN PRODUCTION!
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Sample Data (IMPORTANT: Use secure passwords and hashing in real apps!) ---

-- Delete existing sample users first to avoid errors on re-run
DELETE FROM users WHERE username IN ('admin_user', 'regular_user');

-- Insert sample admin user (Password: adminpass)
-- In production, hash 'adminpass' using bcrypt before inserting
INSERT INTO users (username, password, role) VALUES
('admin_user', 'adminpass', 'admin'); -- !! Use a HASHED password in production !!

-- Insert sample regular user (Password: userpass)
-- In production, hash 'userpass' using bcrypt before inserting
INSERT INTO users (username, password, role) VALUES
('regular_user', 'userpass', 'user'); -- !! Use a HASHED password in production !!

-- Optional: Add some initial team members
-- INSERT INTO team_members (name) VALUES ('Alice'), ('Bob'), ('Charlie')
-- ON DUPLICATE KEY UPDATE name=name; -- Avoid error if they exist

-- Optional: Add some initial unavailability
-- INSERT INTO unavailability (member_name, unavailable_date) VALUES ('Bob', '2024-03-20')
-- ON DUPLICATE KEY UPDATE member_name=member_name;
