import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ── GET /api/sessions/group/:groupId ────────────────────────
// Lists all upcoming sessions for a given group
router.get('/group/:groupId', authenticate, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT * FROM study_sessions
       WHERE group_id = ?
       ORDER BY session_date ASC, session_time ASC`,
      [req.params.groupId],
    );
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/sessions/upcoming ───────────────────────────────
// Returns upcoming sessions for ALL groups the current user belongs to
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT ss.*, g.name AS group_name
       FROM study_sessions ss
       JOIN groups_ g ON ss.group_id = g.id
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?
         AND CONCAT(ss.session_date, ' ', ss.session_time) >= NOW()
       ORDER BY ss.session_date ASC, ss.session_time ASC
       LIMIT 10`,
      [req.user.id],
    );
    res.json(sessions);
  } catch (err) {
    console.error('Upcoming sessions error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/sessions ───────────────────────────────────────
// Creates a new study session; only the group leader is allowed
router.post('/', authenticate, async (req, res) => {
  const { group_id, title, session_date, session_time, location, description } =
    req.body;

  if (!group_id || !title || !session_date || !session_time) {
    return res
      .status(400)
      .json({ message: 'Group, title, date, and time are required.' });
  }

  try {
    // Check the requester is the group leader
    const [groups] = await pool.query(
      'SELECT leader_id FROM groups_ WHERE id = ?',
      [group_id],
    );
    if (groups.length === 0)
      return res.status(404).json({ message: 'Group not found.' });
    if (groups[0].leader_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'Only the group leader can schedule sessions.' });
    }

    const [result] = await pool.query(
      `INSERT INTO study_sessions (group_id, title, session_date, session_time, location, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [group_id, title, session_date, session_time, location, description],
    );

    res
      .status(201)
      .json({ message: 'Session created!', sessionId: result.insertId });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/sessions/:id ─────────────────────────────────
// Only the group leader can remove a session
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Join to get the group leader
    const [rows] = await pool.query(
      `SELECT g.leader_id FROM study_sessions ss
       JOIN groups_ g ON ss.group_id = g.id
       WHERE ss.id = ?`,
      [req.params.id],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'Session not found.' });
    if (rows[0].leader_id !== req.user.id && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Only the group leader can delete sessions.' });
    }

    await pool.query('DELETE FROM study_sessions WHERE id = ?', [
      req.params.id,
    ]);
    res.json({ message: 'Session deleted.' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;
