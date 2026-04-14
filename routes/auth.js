import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';

const router = Router();

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, program, year_of_study } = req.body;

  // Basic input validation
  if (!name || !email || !password || !program || !year_of_study) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if email is already taken
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email],
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Hash the password (salt rounds = 10 is the standard balance of speed vs security)
    const password_hash = await bcrypt.hash(password, 10);

    // Insert the new student into the database
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, program, year_of_study)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, password_hash, program, year_of_study],
    );

    res.status(201).json({
      message: 'Registration successful!',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: 'Email and password are required.' });
  }

  try {
    // Fetch user by email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];

    // Compare submitted password against the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Sign a JWT containing lightweight user info (avoid storing sensitive data in token)
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    // Return token and safe user object (no password hash)
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        program: user.program,
        year_of_study: user.year_of_study,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────
// Returns the current logged-in user's profile (used on app load)
import { authenticate } from '../middleware/auth.js';

router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, program, year_of_study, role, created_at FROM users WHERE id = ?',
      [req.user.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;
