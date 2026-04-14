import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();

// Apply both middleware to every route in this file
router.use(authenticate, adminOnly);

// ── GET /api/admin/stats ─────────────────────────────────────
// Returns high-level platform statistics for the dashboard
router.get('/stats', async (req, res) => {
  try {
    // Run multiple count queries in parallel for efficiency
    const [[users], [groups], [sessions], [posts]] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'student'"),
      pool.query('SELECT COUNT(*) AS total FROM groups_'),
      pool.query('SELECT COUNT(*) AS total FROM study_sessions'),
      pool.query('SELECT COUNT(*) AS total FROM posts'),
    ]);

    // Find the most active courses (by number of groups)
    const [activeCourses] = await pool.query(
      `SELECT course_name, course_code, COUNT(*) AS group_count
       FROM groups_
       GROUP BY course_name, course_code
       ORDER BY group_count DESC
       LIMIT 5`,
    );

    res.json({
      totalStudents: users[0].total,
      totalGroups: groups[0].total,
      totalSessions: sessions[0].total,
      totalPosts: posts[0].total,
      activeCourses,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/admin/users ─────────────────────────────────────
// Returns all registered users
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, name, email, program, year_of_study, role, created_at
       FROM users ORDER BY created_at DESC`,
    );
    res.json(users);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/admin/groups ────────────────────────────────────
// Returns all groups with leader name and member count
router.get('/groups', async (req, res) => {
  try {
    const [groups] = await pool.query(
      `SELECT g.*, u.name AS leader_name,
              COUNT(DISTINCT gm.user_id) AS member_count
       FROM groups_ g
       JOIN users u ON g.leader_id = u.id
       LEFT JOIN group_members gm ON g.id = gm.group_id
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
    );
    res.json(groups);
  } catch (err) {
    console.error('Admin groups error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/admin/users/:id ──────────────────────────────
// Admin can remove any user (cascades to memberships, posts etc.)
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent deleting other admins
    const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found.' });
    if (rows[0].role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin accounts.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;
