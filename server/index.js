import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure user-data directories exist (idempotent: only creates if missing; does not clear contents).
// Mount a persistent disk at server/user-data so avatars and exports survive deployments.
const USER_DATA_DIR = path.join(__dirname, 'user-data');
const AVATARS_DIR = path.join(USER_DATA_DIR, 'avatars');
const EXPORTS_DIR = path.join(USER_DATA_DIR, 'exports');
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

// Routes
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import taskRoutes from './routes/tasks.js';
import searchRoutes from './routes/search.js';
import syncRoutes from './routes/sync.js';
import verifyRoutes from './routes/verify.js';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mneme';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mneme API is running',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Serve user avatars from user-data/avatars (no auth; filename is userId.ext)
app.get('/api/avatar/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename');
  }
  const filePath = path.join(AVATARS_DIR, filename);
  if (!filePath.startsWith(AVATARS_DIR)) {
    return res.status(400).send('Invalid filename');
  }
  res.sendFile(filePath, (err) => {
    if (err) res.status(err.status === 404 ? 404 : 500).send(err.code === 'ENOENT' ? 'Not found' : 'Error');
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/chats', messageRoutes); // Messages are at /api/chats/:chatId/messages
app.use('/api/tasks', taskRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/verify', verifyRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});
