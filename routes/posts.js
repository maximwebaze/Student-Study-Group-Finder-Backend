import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ── GET /api/posts/group/:groupId ────────────────────────────
// Retrieves all posts for a group (most recent first)
router.get('/group/:groupId', authenticate, async (req, res) => {
  try {
    const [posts] = await pool.query(
      `SELECT p.*, u.name AS author_name
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.group_id = ?
       ORDER BY p.created_at DESC`,
      [req.params.groupId],
    );
    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/posts ──────────────────────────────────────────
// Any group member can create a post
router.post('/', authenticate, async (req, res) => {
  const { group_id, content } = req.body;

  if (!group_id || !content?.trim()) {
    return res
      .status(400)
      .json({ message: 'Group ID and content are required.' });
  }

  try {
    // Ensure the user is actually a member of this group
    const [membership] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [group_id, req.user.id],
    );
    if (membership.length === 0) {
      return res
        .status(403)
        .json({ message: 'You must be a member to post in this group.' });
    }

    const [result] = await pool.query(
      'INSERT INTO posts (group_id, user_id, content) VALUES (?, ?, ?)',
      [group_id, req.user.id, content.trim()],
    );

    res.status(201).json({ message: 'Post created!', postId: result.insertId });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/posts/:id ────────────────────────────────────
// The post author, the group leader, or an admin can delete a post
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.user_id AS author_id, g.leader_id
       FROM posts p JOIN groups_ g ON p.group_id = g.id
       WHERE p.id = ?`,
      [req.params.id],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: 'Post not found.' });

    const { author_id, leader_id } = rows[0];
    const isAuthor = req.user.id === author_id;
    const isLeader = req.user.id === leader_id;
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isLeader && !isAdmin) {
      return res
        .status(403)
        .json({ message: 'You are not allowed to delete this post.' });
    }

    await pool.query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post deleted.' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;
