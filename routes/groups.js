import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ── GET /api/groups  ─────────────────────────────────────────
// Returns all groups; supports search by course_name, course_code, or name
router.get('/', authenticate, async (req, res) => {
  const { search } = req.query;

  try {
    let query = `
      SELECT g.*, u.name AS leader_name,
             COUNT(DISTINCT gm.user_id) AS member_count
      FROM groups_ g
      JOIN users u ON g.leader_id = u.id
      LEFT JOIN group_members gm ON g.id = gm.group_id
    `;
    const params = [];

    // Append WHERE clause if a search term is provided
    if (search) {
      query += ` WHERE g.name LIKE ? OR g.course_name LIKE ? OR g.course_code LIKE ?`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` GROUP BY g.id ORDER BY g.created_at DESC`;

    const [groups] = await pool.query(query, params);
    res.json(groups);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/groups/:id ──────────────────────────────────────
// Returns a single group with its full member list
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Fetch the group details
    const [groups] = await pool.query(
      `SELECT g.*, u.name AS leader_name
       FROM groups_ g JOIN users u ON g.leader_id = u.id
       WHERE g.id = ?`,
      [req.params.id],
    );

    if (groups.length === 0) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // Fetch the member list for this group
    const [members] = await pool.query(
      `SELECT u.id, u.name, u.email, u.program, u.year_of_study, gm.joined_at
       FROM group_members gm JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`,
      [req.params.id],
    );

    res.json({ ...groups[0], members });
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/groups ─────────────────────────────────────────
// Creates a new group; the creator automatically becomes the leader AND a member
router.post('/', authenticate, async (req, res) => {
  const { name, course_name, course_code, description, meeting_location } =
    req.body;

  if (!name || !course_name || !course_code) {
    return res
      .status(400)
      .json({ message: 'Name, course name, and course code are required.' });
  }

  try {
    // Insert the new group
    const [result] = await pool.query(
      `INSERT INTO groups_ (name, course_name, course_code, description, meeting_location, leader_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        course_name,
        course_code,
        description,
        meeting_location,
        req.user.id,
      ],
    );

    const groupId = result.insertId;

    // Auto-join the creator as a member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
      [groupId, req.user.id],
    );

    res.status(201).json({ message: 'Group created!', groupId });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PUT /api/groups/:id ──────────────────────────────────────
// Allows only the group leader to update group information
router.put('/:id', authenticate, async (req, res) => {
  const { name, course_name, course_code, description, meeting_location } =
    req.body;

  try {
    // Verify the requester is the leader
    const [rows] = await pool.query(
      'SELECT leader_id FROM groups_ WHERE id = ?',
      [req.params.id],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'Group not found.' });
    if (rows[0].leader_id !== req.user.id && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Only the group leader can edit this group.' });
    }

    await pool.query(
      `UPDATE groups_ SET name=?, course_name=?, course_code=?, description=?, meeting_location=?
       WHERE id = ?`,
      [
        name,
        course_name,
        course_code,
        description,
        meeting_location,
        req.params.id,
      ],
    );

    res.json({ message: 'Group updated successfully.' });
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/groups/:id ───────────────────────────────────
// Only the leader or admin can delete a group
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT leader_id FROM groups_ WHERE id = ?',
      [req.params.id],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'Group not found.' });
    if (rows[0].leader_id !== req.user.id && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Only the group leader can delete this group.' });
    }

    await pool.query('DELETE FROM groups_ WHERE id = ?', [req.params.id]);
    res.json({ message: 'Group deleted.' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/groups/:id/join ────────────────────────────────
// Any authenticated student can join a group
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    // Check the group exists
    const [groups] = await pool.query('SELECT id FROM groups_ WHERE id = ?', [
      req.params.id,
    ]);
    if (groups.length === 0)
      return res.status(404).json({ message: 'Group not found.' });

    // Prevent duplicate membership
    const [existing] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: 'You are already a member of this group.' });
    }

    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
      [req.params.id, req.user.id],
    );

    res.json({ message: 'Successfully joined the group!' });
  } catch (err) {
    console.error('Join group error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/groups/:id/leave ─────────────────────────────
// A member can leave a group (leaders cannot leave their own group)
router.delete('/:id/leave', authenticate, async (req, res) => {
  try {
    // Prevent the leader from accidentally leaving (they should delete or transfer)
    const [groups] = await pool.query(
      'SELECT leader_id FROM groups_ WHERE id = ?',
      [req.params.id],
    );
    if (groups.length === 0)
      return res.status(404).json({ message: 'Group not found.' });
    if (groups[0].leader_id === req.user.id) {
      return res
        .status(400)
        .json({
          message:
            'Leaders cannot leave their own group. Delete the group instead.',
        });
    }

    await pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );

    res.json({ message: 'You have left the group.' });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/groups/:id/members/:userId ───────────────────
// Group leader (or admin) removes a specific member from the group
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    // Confirm requester is leader or admin
    const [rows] = await pool.query(
      'SELECT leader_id FROM groups_ WHERE id = ?',
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Group not found.' });
    if (rows[0].leader_id !== req.user.id && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({
          message: 'Only the group leader or admin can remove members.',
        });
    }

    // Leaders cannot be removed from their own group this way
    if (parseInt(req.params.userId) === rows[0].leader_id) {
      return res
        .status(400)
        .json({ message: 'Cannot remove the group leader.' });
    }

    await pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.params.userId],
    );

    res.json({ message: 'Member removed from group.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/groups/my/groups ────────────────────────────────
// Returns all groups the current user is a member of
router.get('/my/groups', authenticate, async (req, res) => {
  try {
    const [groups] = await pool.query(
      `SELECT g.*, u.name AS leader_name,
              COUNT(DISTINCT gm2.user_id) AS member_count
       FROM group_members gm
       JOIN groups_ g ON gm.group_id = g.id
       JOIN users u ON g.leader_id = u.id
       LEFT JOIN group_members gm2 ON g.id = gm2.group_id
       WHERE gm.user_id = ?
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.user.id],
    );
    res.json(groups);
  } catch (err) {
    console.error('My groups error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;
