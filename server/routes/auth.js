import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendEmailVerification, sendSmsVerification } from '../services/verification.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATARS_DIR = path.join(__dirname, '..', 'user-data', 'avatars');

const PASSWORD_SALT_ROUNDS = 12;
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

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
 * Clear profile information but keep data (threads, notes)
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
    message: 'Account information deleted. Your threads and notes are preserved.',
  });
}));

/**
 * DELETE /api/auth/me
 * Delete current user account and all data
 */
router.delete('/me', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Import models
  const Thread = (await import('../models/Thread.js')).default;
  const Note = (await import('../models/Note.js')).default;
  const SharedThread = (await import('../models/SharedThread.js')).default;

  // Delete all user's threads
  const userThreads = await Thread.find({ ownerId: userId });
  const threadIds = userThreads.map((t) => t._id);

  // Delete all notes in user's threads
  await Note.deleteMany({ threadId: { $in: threadIds } });

  // Delete all threads
  await Thread.deleteMany({ ownerId: userId });

  // Delete all shared thread records
  await SharedThread.deleteMany({
    $or: [
      { sharedBy: userId },
      { sharedWith: userId },
    ],
  });

  // Remove user from any threads they're a participant in
  await Thread.updateMany(
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

// ============================================
// Unauthenticated phone/email auth routes
// Equal-rank: phone, email, username all work
// ============================================

const userResponseFields = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  settings: user.settings,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * POST /api/auth/phone/send
 * Send verification code to phone (NO auth required)
 */
router.post('/phone/send', asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone format. Include country code (e.g., +1234567890)' });
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  // Check if phone belongs to existing user
  const existingUser = await User.findOne({ phone: normalizedPhone });

  // Rate limit
  const recent = await Verification.findOne({
    type: 'phone',
    target: normalizedPhone,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
  });
  if (recent) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recent.createdAt.getTime())) / 1000);
    return res.status(429).json({ error: 'Please wait before requesting another code', waitSeconds });
  }

  const code = Verification.generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Clean up old verifications for this phone
  await Verification.deleteMany({ type: 'phone', target: normalizedPhone });

  await Verification.create({
    type: 'phone',
    target: normalizedPhone,
    code,
    expiresAt,
    metadata: existingUser ? { targetUserId: existingUser._id } : undefined,
  });

  try {
    await sendSmsVerification(normalizedPhone, code);
    res.json({ success: true, isExisting: !!existingUser });
  } catch (error) {
    console.error('Failed to send SMS:', error.message);
    res.status(500).json({ error: 'Failed to send verification SMS' });
  }
}));

/**
 * POST /api/auth/phone/verify
 * Verify phone code and return JWT (NO auth required)
 * If phone exists: logs in, returns full profile
 * If phone doesn't exist: creates account, returns profile
 */
router.post('/phone/verify', asyncHandler(async (req, res) => {
  const { phone, code, name } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  const verification = await Verification.findOne({
    type: 'phone',
    target: normalizedPhone,
    verified: false,
  });

  if (!verification) {
    return res.status(400).json({ error: 'No pending verification found' });
  }

  if (verification.expiresAt < new Date()) {
    await Verification.deleteOne({ _id: verification._id });
    return res.status(400).json({ error: 'Verification code has expired' });
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    await Verification.deleteOne({ _id: verification._id });
    return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
  }

  if (verification.code !== code) {
    verification.attempts += 1;
    await verification.save();
    return res.status(400).json({
      error: 'Invalid verification code',
      attemptsRemaining: MAX_ATTEMPTS - verification.attempts,
    });
  }

  // Code correct
  verification.verified = true;
  await verification.save();

  let user;

  if (verification.metadata?.targetUserId) {
    // Existing user - log them in
    user = await User.findById(verification.metadata.targetUserId);
    if (!user) {
      return res.status(400).json({ error: 'Account no longer exists' });
    }
  } else {
    // New user - create account with phone
    user = await User.create({
      phone: normalizedPhone,
      name: name || 'Me',
    });
  }

  const token = generateToken(user._id);

  res.json({
    token,
    user: userResponseFields(user),
    isNew: !verification.metadata?.targetUserId,
  });
}));

/**
 * POST /api/auth/email/send
 * Send verification code to email (NO auth required)
 */
router.post('/email/send', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const normalizedEmail = email.toLowerCase();

  // Check if email belongs to existing user
  const existingUser = await User.findOne({ email: normalizedEmail });

  // Rate limit
  const recent = await Verification.findOne({
    type: 'email',
    target: normalizedEmail,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
  });
  if (recent) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recent.createdAt.getTime())) / 1000);
    return res.status(429).json({ error: 'Please wait before requesting another code', waitSeconds });
  }

  const code = Verification.generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Clean up old verifications for this email
  await Verification.deleteMany({ type: 'email', target: normalizedEmail });

  await Verification.create({
    type: 'email',
    target: normalizedEmail,
    code,
    expiresAt,
    metadata: existingUser ? { targetUserId: existingUser._id } : undefined,
  });

  try {
    await sendEmailVerification(normalizedEmail, code);
    res.json({ success: true, isExisting: !!existingUser });
  } catch (error) {
    console.error('Failed to send email:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
}));

/**
 * POST /api/auth/email/verify
 * Verify email code and return JWT (NO auth required)
 * If email exists: logs in, returns full profile
 * If email doesn't exist: creates account, returns profile
 */
router.post('/email/verify', asyncHandler(async (req, res) => {
  const { email, code, name } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const normalizedEmail = email.toLowerCase();

  const verification = await Verification.findOne({
    type: 'email',
    target: normalizedEmail,
    verified: false,
  });

  if (!verification) {
    return res.status(400).json({ error: 'No pending verification found' });
  }

  if (verification.expiresAt < new Date()) {
    await Verification.deleteOne({ _id: verification._id });
    return res.status(400).json({ error: 'Verification code has expired' });
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    await Verification.deleteOne({ _id: verification._id });
    return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
  }

  if (verification.code !== code) {
    verification.attempts += 1;
    await verification.save();
    return res.status(400).json({
      error: 'Invalid verification code',
      attemptsRemaining: MAX_ATTEMPTS - verification.attempts,
    });
  }

  // Code correct
  verification.verified = true;
  await verification.save();

  let user;

  if (verification.metadata?.targetUserId) {
    // Existing user - log them in
    user = await User.findById(verification.metadata.targetUserId);
    if (!user) {
      return res.status(400).json({ error: 'Account no longer exists' });
    }
  } else {
    // New user - create account with email
    user = await User.create({
      email: normalizedEmail,
      name: name || 'Me',
    });
  }

  const token = generateToken(user._id);

  res.json({
    token,
    user: userResponseFields(user),
    isNew: !verification.metadata?.targetUserId,
  });
}));

export default router;
