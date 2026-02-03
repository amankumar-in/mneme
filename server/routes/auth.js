import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = path.join(__dirname, '..', 'user-data', 'avatars');

const PASSWORD_SALT_ROUNDS = 12;

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: AVATARS_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      if (!/^\.(jpe?g|png|gif|webp)$/.test(ext)) return cb(new Error('Invalid image type'), null);
      cb(null, req.user._id.toString() + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('avatar');

const router = express.Router();

/**
 * POST /api/auth/signup
 * Create a new account with username + password
 * Returns JWT token
 */
router.post('/signup', asyncHandler(async (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required',
    });
  }

  // Validate username format
  const usernameRegex = /^[a-z0-9_]{3,30}$/;
  if (!usernameRegex.test(username.toLowerCase())) {
    return res.status(400).json({
      error: 'Username must be 3-30 characters, lowercase letters, numbers, and underscores only',
    });
  }

  // Validate password (8+ chars)
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Check if username is taken
  const existingUser = await User.findOne({ username: username.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  const user = await User.create({
    username: username.toLowerCase(),
    passwordHash,
    name: name || 'Me',
  });

  // Generate token
  const token = generateToken(user._id);

  res.status(201).json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      settings: user.settings,
      createdAt: user.createdAt,
    },
  });
}));

/**
 * POST /api/auth/login
 * Login with username + password
 * Returns JWT token
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required',
    });
  }

  // Find user with password
  const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!user.passwordHash) {
    return res.status(401).json({
      error: 'This account requires email or phone verification',
      hasPassword: false,
    });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate token
  const token = generateToken(user._id);

  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      settings: user.settings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}));

/**
 * GET /api/auth/me
 * Get current user profile (requires auth token)
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      email: req.user.email,
      phone: req.user.phone,
      avatar: req.user.avatar,
      settings: req.user.settings,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
}));

/**
 * POST /api/auth/avatar
 * Upload user avatar; stored in user-data/avatars, User.avatar set to /api/avatar/:filename
 */
router.post('/avatar', authenticate, (req, res, next) => {
  uploadAvatar(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const avatarUrl = `/api/avatar/${req.file.filename}`;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarUrl },
    { new: true, runValidators: true }
  );
  res.json({
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      settings: user.settings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}));

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { name, username, email, phone, avatar, settings } = req.body;

  // Build update object
  const update = {};
  if (name !== undefined) update.name = name;
  if (username !== undefined) {
    // Validate username if setting
    if (username) {
      const usernameRegex = /^[a-z0-9_]{3,30}$/;
      if (!usernameRegex.test(username.toLowerCase())) {
        return res.status(400).json({
          error: 'Username must be 3-30 characters, lowercase letters, numbers, and underscores only',
        });
      }
      // Check uniqueness
      const existingUser = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        return res.status(409).json({ error: 'Username is already taken' });
      }
      update.username = username.toLowerCase();
    } else {
      update.username = null;
    }
  }
  if (email !== undefined) update.email = email || null;
  if (phone !== undefined) update.phone = phone || null;
  if (avatar !== undefined) update.avatar = avatar;
  if (settings !== undefined) {
    // Merge settings
    update.settings = {
      ...req.user.settings,
      ...settings,
      notifications: {
        ...req.user.settings.notifications,
        ...(settings.notifications || {}),
      },
      privacy: {
        ...req.user.settings.privacy,
        ...(settings.privacy || {}),
      },
    };
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    update,
    { new: true, runValidators: true }
  );

  res.json({
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      settings: user.settings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}));

/**
 * DELETE /api/auth/account-info
 * Clear profile information but keep data (chats, messages)
 */
router.delete('/account-info', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: {
      name: 1,
      username: 1,
      email: 1,
      phone: 1,
      avatar: 1,
      passwordHash: 1,
    },
  });

  res.json({
    success: true,
    message: 'Account information deleted. Your threads and messages are preserved.',
  });
}));

/**
 * DELETE /api/auth/me
 * Delete current user account and all data
 */
router.delete('/me', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Import models
  const Chat = (await import('../models/Chat.js')).default;
  const Message = (await import('../models/Message.js')).default;
  const SharedChat = (await import('../models/SharedChat.js')).default;

  // Delete all user's chats
  const userChats = await Chat.find({ ownerId: userId });
  const chatIds = userChats.map((c) => c._id);

  // Delete all messages in user's chats
  await Message.deleteMany({ chatId: { $in: chatIds } });

  // Delete all chats
  await Chat.deleteMany({ ownerId: userId });

  // Delete all shared chat records
  await SharedChat.deleteMany({
    $or: [
      { sharedBy: userId },
      { sharedWith: userId },
    ],
  });

  // Remove user from any chats they're a participant in
  await Chat.updateMany(
    { participants: userId },
    { $pull: { participants: userId } }
  );

  // Delete the user
  await User.findByIdAndDelete(userId);

  res.json({
    success: true,
    message: 'Account and all data deleted successfully',
  });
}));

/**
 * POST /api/auth/check-username
 * Check if username is available (no auth required)
 */
router.post('/check-username', asyncHandler(async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      error: 'Username required',
      available: false,
    });
  }

  const existing = await User.findOne({
    username: username.toLowerCase(),
  });

  res.json({
    username,
    available: !existing,
  });
}));

export default router;
