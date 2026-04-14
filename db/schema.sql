

CREATE DATABASE study_group_finder;
USE study_group_finder;

-- ── 1. USERS ────────────────────────────────────────────────
-- Stores every registered user: students and the admin.
CREATE TABLE  users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  program       VARCHAR(150)  NOT NULL,            -- e.g. "BSc Information Technology"
  year_of_study TINYINT       NOT NULL DEFAULT 1,  -- 1, 2, 3, 4
  role          ENUM('student','admin') NOT NULL DEFAULT 'student',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. STUDY GROUPS ─────────────────────────────────────────
-- Each group is tied to a specific course and owned by a leader.
CREATE TABLE  groups_ (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  course_name      VARCHAR(150) NOT NULL,
  course_code      VARCHAR(20)  NOT NULL,
  description      TEXT,
  meeting_location VARCHAR(255),   -- can be a physical place or an online link
  leader_id        INT NOT NULL,   -- the user who created the group
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── 3. GROUP MEMBERS ────────────────────────────────────────
-- Join table linking users to groups they have joined.
CREATE TABLE  group_members (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT NOT NULL,
  user_id    INT NOT NULL,
  joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_membership (group_id, user_id),  -- prevent duplicate joins
  FOREIGN KEY (group_id) REFERENCES groups_(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
);

-- ── 4. STUDY SESSIONS ───────────────────────────────────────
-- Scheduled study meetings created by the group leader.
CREATE TABLE  study_sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  group_id    INT  NOT NULL,
  title       VARCHAR(150) NOT NULL,
  session_date DATE         NOT NULL,
  session_time TIME         NOT NULL,
  location    VARCHAR(255),                         -- physical place or meeting link
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups_(id) ON DELETE CASCADE
);

-- ── 5. POSTS / ANNOUNCEMENTS ────────────────────────────────
-- Short posts inside a group for announcements and questions.
CREATE TABLE  posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT  NOT NULL,
  user_id    INT  NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups_(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
);

-- ── SEED: Default admin account ─────────────────────────────
-- Password: admin123  (generated with bcryptjs, 10 salt rounds)
-- Change this password immediately after first login in production!
INSERT IGNORE INTO users (name, email, password_hash, program, year_of_study, role)
VALUES (
  'System Admin',
  'admin@ucu.ac.ug',
  '$2a$10$rmL9JicVtONpXORv0iYMN.ePfHxIAW0R8eeNa2xJnIuk7B9tp750m',
  'Administration',
  1,
  'admin'
);

-- ── SEED: Sample student accounts for testing ────────────────
-- Password for all sample accounts: password
INSERT IGNORE INTO users (name, email, password_hash, program, year_of_study, role) VALUES
('Alice Nakato',    'alice@ucu.ac.ug',  '$2a$10$v1zY3Q1jethmxyli8qUBLuiTWTCKY8oNgOsMgiu8psQeMJZZrW37q', 'BSc Information Technology', 1, 'student'),
('Brian Ssemakula', 'brian@ucu.ac.ug',  '$2a$10$v1zY3Q1jethmxyli8qUBLuiTWTCKY8oNgOsMgiu8psQeMJZZrW37q', 'BSc Computer Science',        2, 'student'),
('Carol Atim',      'carol@ucu.ac.ug',  '$2a$10$v1zY3Q1jethmxyli8qUBLuiTWTCKY8oNgOsMgiu8psQeMJZZrW37q', 'BSc Software Engineering',   1, 'student');
