-- Create a database (if it doesn't exist)
CREATE DATABASE IF NOT EXISTS team_scheduler_db;

-- Use the database
USE team_scheduler_db;

-- Create the team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NULL DEFAULT NULL, -- <<< ADDED: Optional phone number
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the positions table
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT DEFAULT 0,
    -- NEW COLUMNS for assignment rules --
    assignment_type ENUM('regular', 'specific_days') NOT NULL DEFAULT 'regular',
    allowed_days VARCHAR(15) NULL DEFAULT NULL, -- Comma-separated days (0-6), only used if type is 'specific_days'
    -- END NEW COLUMNS --
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

-- Create the override_assignment_days table  -- <<< ADDED THIS TABLE >>>
CREATE TABLE IF NOT EXISTS override_assignment_days (
    override_date DATE NOT NULL PRIMARY KEY, -- The specific date that acts as an override
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the users table for login
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- STORE HASHED PASSWORDS IN PRODUCTION!
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create the special_assignments table for adding temporary slots
CREATE TABLE IF NOT EXISTS special_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_date DATE NOT NULL,
    position_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE, -- Ensure position exists, cascade delete if position is removed
    UNIQUE KEY unique_special_assignment (assignment_date, position_id) -- Prevent adding the same position slot twice on the same date
);

-- Add new table for member position capabilities
CREATE TABLE IF NOT EXISTS member_positions (
    member_name VARCHAR(100) NOT NULL,
    position_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_name, position_id),
    FOREIGN KEY (member_name) REFERENCES team_members(name) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

-- Add new table for held assignments
CREATE TABLE IF NOT EXISTS held_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_date DATE NOT NULL,
    position_name VARCHAR(100) NOT NULL,
    member_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_held_assignment (assignment_date, position_name)
);

-- --- Sample Data (IMPORTANT: Use secure passwords and hashing in real apps!) ---

-- Delete existing sample users first to avoid errors on re-run
DELETE FROM users WHERE username IN ('admin_user', 'regular_user');

-- Insert sample admin user (Password: adminpass)
-- !! IMPORTANT !! In production, hash 'adminpass' using bcrypt *before* inserting!
-- Example: const hashedPassword = await bcrypt.hash('adminpass', 10);
-- Then insert the hashedPassword variable below instead of 'adminpass'.
INSERT INTO users (username, password, role) VALUES
('admin_user', 'adminpass', 'admin'); -- !! REPLACE 'adminpass' WITH HASHED PASSWORD !!

-- Insert sample regular user (Password: userpass)
-- !! IMPORTANT !! In production, hash 'userpass' using bcrypt *before* inserting!
-- Example: const hashedPassword = await bcrypt.hash('userpass', 10);
-- Then insert the hashedPassword variable below instead of 'userpass'.
INSERT INTO users (username, password, role) VALUES
('regular_user', 'userpass', 'user'); -- !! REPLACE 'userpass' WITH HASHED PASSWORD !!

-- Optional: Add some initial team members (Uncomment if needed)
-- INSERT INTO team_members (name) VALUES ('Alice'), ('Bob'), ('Charlie')
-- ON DUPLICATE KEY UPDATE name=name; -- Avoid error if they exist

-- Optional: Add some initial positions (Uncomment if needed)
-- INSERT INTO positions (name) VALUES ('Sound'), ('Media'), ('Live')
-- ON DUPLICATE KEY UPDATE name=name; -- Avoid error if they exist

-- Optional: Add some initial unavailability (Uncomment if needed)
-- INSERT INTO unavailability (member_name, unavailable_date) VALUES ('Bob', '2024-03-20')
-- ON DUPLICATE KEY UPDATE member_name=member_name;

-- Check and add columns if they don't exist
SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE positions ADD COLUMN assignment_type ENUM("regular", "specific_days") NOT NULL DEFAULT "regular"',
    'SELECT "Column assignment_type already exists"'
) INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'positions' 
AND COLUMN_NAME = 'assignment_type';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE positions ADD COLUMN allowed_days VARCHAR(15) NULL DEFAULT NULL',
    'SELECT "Column allowed_days already exists"'
) INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'positions' 
AND COLUMN_NAME = 'allowed_days';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- <<< ADDED: Check and add phone_number column to team_members if it doesn't exist >>>
SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE team_members ADD COLUMN phone_number VARCHAR(20) NULL DEFAULT NULL AFTER name',
    'SELECT "Column phone_number already exists in team_members"'
) INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'team_members'
AND COLUMN_NAME = 'phone_number';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
