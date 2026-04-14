import express from 'express';
import cors from 'cors';

// Route modules
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import sessionRoutes from './routes/sessions.js';
import postRoutes from './routes/posts.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Global Middleware ─────────────────────────────────────────
app.use(
  cors({
    origin: 'http://localhost:5173', // Vite dev server default port
    credentials: true,
  }),
);

app.use(express.json()); // parse incoming JSON bodies
app.use(express.urlencoded({ extended: true })); // parse URL-encoded form data

// ── API Routes ────────────────────────────────────────────────
// Each route file handles a specific domain of the application
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler – catches any undefined routes ─────────────────
app.use((req, res) => {
  res
    .status(404)
    .json({ message: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'An unexpected server error occurred.' });
});

// ── Start the server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
