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

-- Create the positions table
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT DEFAULT 0, -- For controlling display order later
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the unavailability table
CREATE TABLE IF NOT EXISTS unavailability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_name VARCHAR(100) NOT NULL, -- Matches name in team_members
    unavailable_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_unavailability (member_name, unavailable_date) -- Prevent duplicates
);

-- Create the override_assignment_days table
CREATE TABLE IF NOT EXISTS override_assignment_days (
    override_date DATE NOT NULL PRIMARY KEY, -- The specific date that acts as an override
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- <<< NEW TABLE for Special Assignments >>>
-- Create the special_day_assignments table
CREATE TABLE IF NOT EXISTS special_day_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    special_date DATE NOT NULL,
    position_name VARCHAR(100) NOT NULL,
    assigned_member_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_special_assignment (special_date, position_name) -- Prevent same position on same date
);
-- <<< END NEW TABLE >>>

-- Create the users table for login
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- STORE HASHED PASSWORDS IN PRODUCTION!
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- Sample Data (IMPORTANT: Use secure passwords and hashing in real apps!) ---
-- Insert sample users ONLY IF they don't exist and you've HASHED the passwords first.
-- Example (replace hash):
-- INSERT IGNORE INTO users (username, password, role) VALUES
-- ('admin_user', '$2b$10$YourGeneratedHashForAdminPass', 'admin'),
-- ('regular_user', '$2b$10$YourGeneratedHashForUserPass', 'user');
