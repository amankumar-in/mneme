import express from 'express';
import bcrypt from 'bcrypt';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import { sendEmailVerification, sendSmsVerification } from '../services/verification.js';

const router = express.Router();

const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const PASSWORD_SALT_ROUNDS = 12;
const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_MINUTES = 15;

// In-memory rate limiting for password attempts (in production, use Redis)
const passwordAttempts = new Map(); // usernameAttempt -> { attempts: number, lockedUntil: Date | null }

/**
 * POST /api/verify/email/send
 * Send verification code to email
 * If email is taken by another user, still sends code and returns isExisting: true
 */
router.post('/email/send', authenticate, asyncHandler(async (req, res) => {
  const { email } = req.body;
  const userId = req.user._id;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check if email is already taken by another user
  const existingUser = await User.findOne({
    email: email.toLowerCase(),
    _id: { $ne: userId }
  });
  const isExisting = !!existingUser;

  // Check for recent verification request (rate limiting)
  const recentVerification = await Verification.findOne({
    userId,
    type: 'email',
    target: email.toLowerCase(),
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
  });
  if (recentVerification) {
    const waitSeconds = Math.ceil(
      (RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recentVerification.createdAt.getTime())) / 1000
    );
    return res.status(429).json({
      error: 'Please wait before requesting another code',
      waitSeconds,
    });
  }

  // Generate code and save
  const code = Verification.generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Remove any existing verification for this email
  await Verification.deleteMany({ userId, type: 'email', target: email.toLowerCase() });

  // Store target user ID if this is an existing email (for linking)
  await Verification.create({
    userId,
    type: 'email',
    target: email.toLowerCase(),
    code,
    expiresAt,
    metadata: isExisting ? { targetUserId: existingUser._id } : undefined,
  });

  // Send email
  try {
    await sendEmailVerification(email, code);
    res.json({ success: true, message: 'Verification code sent', isExisting });
  } catch (error) {
    console.error('Failed to send email:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
}));

/**
 * POST /api/verify/email/verify
 * Verify email with code
 * If linking to existing account, returns linked: true and full user profile
 */
router.post('/email/verify', authenticate, asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const userId = req.user._id;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const verification = await Verification.findOne({
    userId,
    type: 'email',
    target: email.toLowerCase(),
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

  // Check if this is linking to an existing account
  if (verification.metadata?.targetUserId) {
    const targetUser = await User.findById(verification.metadata.targetUserId);
    if (targetUser) {
      // Mark as verified and clean up
      verification.verified = true;
      await verification.save();

      // Return target user info for linking
      return res.json({
        success: true,
        linked: true,
        targetUserId: targetUser._id,
        user: {
          name: targetUser.name,
          username: targetUser.username,
          email: targetUser.email,
          phone: targetUser.phone,
          avatar: targetUser.avatar,
        },
      });
    }
  }

  // Code is correct - update user's email (normal verification flow)
  await User.findByIdAndUpdate(userId, { email: email.toLowerCase() });

  // Mark as verified and clean up
  verification.verified = true;
  await verification.save();

  res.json({ success: true, message: 'Email verified successfully' });
}));

/**
 * POST /api/verify/phone/send
 * Send verification code to phone
 * If phone is taken by another user, still sends code and returns isExisting: true
 */
router.post('/phone/send', authenticate, asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const userId = req.user._id;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Validate phone format (should include country code)
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone format. Include country code (e.g., +1234567890)' });
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  // Check if phone is already taken by another user
  const existingUser = await User.findOne({
    phone: normalizedPhone,
    _id: { $ne: userId }
  });
  const isExisting = !!existingUser;

  // Check for recent verification request (rate limiting)
  const recentVerification = await Verification.findOne({
    userId,
    type: 'phone',
    target: normalizedPhone,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
  });
  if (recentVerification) {
    const waitSeconds = Math.ceil(
      (RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recentVerification.createdAt.getTime())) / 1000
    );
    return res.status(429).json({
      error: 'Please wait before requesting another code',
      waitSeconds,
    });
  }

  // Generate code and save
  const code = Verification.generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  // Remove any existing verification for this phone
  await Verification.deleteMany({ userId, type: 'phone', target: normalizedPhone });

  // Store target user ID if this is an existing phone (for linking)
  await Verification.create({
    userId,
    type: 'phone',
    target: normalizedPhone,
    code,
    expiresAt,
    metadata: isExisting ? { targetUserId: existingUser._id } : undefined,
  });

  // Send SMS
  try {
    await sendSmsVerification(normalizedPhone, code);
    res.json({ success: true, message: 'Verification code sent', isExisting });
  } catch (error) {
    console.error('Failed to send SMS:', error.message);
    res.status(500).json({ error: 'Failed to send verification SMS' });
  }
}));

/**
 * POST /api/verify/phone/verify
 * Verify phone with code
 * If linking to existing account, returns linked: true and full user profile
 */
router.post('/phone/verify', authenticate, asyncHandler(async (req, res) => {
  const { phone, code } = req.body;
  const userId = req.user._id;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  const verification = await Verification.findOne({
    userId,
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

  // Check if this is linking to an existing account
  if (verification.metadata?.targetUserId) {
    const targetUser = await User.findById(verification.metadata.targetUserId);
    if (targetUser) {
      // Mark as verified and clean up
      verification.verified = true;
      await verification.save();

      // Return target user info for linking
      return res.json({
        success: true,
        linked: true,
        targetUserId: targetUser._id,
        user: {
          name: targetUser.name,
          username: targetUser.username,
          email: targetUser.email,
          phone: targetUser.phone,
          avatar: targetUser.avatar,
        },
      });
    }
  }

  // Code is correct - update user's phone (normal verification flow)
  await User.findByIdAndUpdate(userId, { phone: normalizedPhone });

  // Mark as verified and clean up
  verification.verified = true;
  await verification.save();

  res.json({ success: true, message: 'Phone verified successfully' });
}));

/**
 * GET /api/verify/check-username/:username
 * Check if username is available and whether it has a password
 */
router.get('/check-username/:username', authenticate, asyncHandler(async (req, res) => {
  const { username } = req.params;
  const userId = req.user._id;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Validate username format
  const usernameRegex = /^[a-z0-9_]{3,30}$/;
  if (!usernameRegex.test(username.toLowerCase())) {
    return res.status(400).json({
      error: 'Username must be 3-30 characters, lowercase letters, numbers, and underscores only',
      available: false,
    });
  }

  const existingUser = await User.findOne({
    username: username.toLowerCase(),
    _id: { $ne: userId },
  }).select('+passwordHash');

  if (!existingUser) {
    return res.json({
      available: true,
      username: username.toLowerCase(),
    });
  }

  res.json({
    available: false,
    username: username.toLowerCase(),
    hasPassword: !!existingUser.passwordHash,
  });
}));

/**
 * POST /api/verify/username-with-password
 * Claim an available username with a password
 */
router.post('/username-with-password', authenticate, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const userId = req.user._id;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
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
  const existingUser = await User.findOne({
    username: username.toLowerCase(),
    _id: { $ne: userId },
  });
  if (existingUser) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  // Update user with username and password
  await User.findByIdAndUpdate(userId, {
    username: username.toLowerCase(),
    passwordHash,
  });

  res.json({ success: true, message: 'Username claimed successfully' });
}));

/**
 * POST /api/verify/username-login
 * Verify password for a taken username and link account
 */
router.post('/username-login', authenticate, asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check rate limiting (use username as key since we don't have device ID anymore)
  const attemptKey = `login:${username.toLowerCase()}`;
  const attemptData = passwordAttempts.get(attemptKey) || { attempts: 0, lockedUntil: null };

  if (attemptData.lockedUntil && attemptData.lockedUntil > new Date()) {
    const waitMinutes = Math.ceil((attemptData.lockedUntil - new Date()) / 60000);
    return res.status(429).json({
      error: `Too many attempts. Try again in ${waitMinutes} minutes.`,
      lockedUntil: attemptData.lockedUntil,
    });
  }

  // Find user with that username (include passwordHash)
  const targetUser = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');

  if (!targetUser) {
    return res.status(400).json({ error: 'Username not found' });
  }

  if (!targetUser.passwordHash) {
    return res.status(400).json({
      error: 'This username requires email or phone verification',
      hasPassword: false,
    });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, targetUser.passwordHash);

  if (!isValid) {
    // Increment attempts
    attemptData.attempts += 1;
    if (attemptData.attempts >= PASSWORD_MAX_ATTEMPTS) {
      attemptData.lockedUntil = new Date(Date.now() + PASSWORD_LOCKOUT_MINUTES * 60 * 1000);
      attemptData.attempts = 0;
    }
    passwordAttempts.set(attemptKey, attemptData);

    return res.status(400).json({
      error: 'Invalid password',
      attemptsRemaining: PASSWORD_MAX_ATTEMPTS - attemptData.attempts,
    });
  }

  // Clear rate limit on success
  passwordAttempts.delete(attemptKey);

  // Return target user info for linking (the actual linking will be done via link-device endpoint)
  res.json({
    success: true,
    verified: true,
    targetUserId: targetUser._id,
    user: {
      name: targetUser.name,
      username: targetUser.username,
      email: targetUser.email,
      phone: targetUser.phone,
      avatar: targetUser.avatar,
    },
  });
}));

/**
 * GET /api/verify/password-status
 * Check if current user has a password set
 */
router.get('/password-status', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  res.json({
    hasPassword: !!user.passwordHash,
    hasUsername: !!user.username,
  });
}));

/**
 * POST /api/verify/set-password
 * Set password for users who have a username but no password yet
 */
router.post('/set-password', authenticate, asyncHandler(async (req, res) => {
  const { password } = req.body;
  const userId = req.user._id;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const user = await User.findById(userId).select('+passwordHash');

  if (!user.username) {
    return res.status(400).json({ error: 'Set a username first before setting a password' });
  }

  if (user.passwordHash) {
    return res.status(400).json({ error: 'Password already set. Use change-password instead.' });
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  await User.findByIdAndUpdate(userId, { passwordHash });

  res.json({ success: true, message: 'Password set successfully' });
}));

/**
 * POST /api/verify/change-password
 * Change password for users who already have one
 */
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  // Check rate limiting (use user ID as key)
  const attemptKey = `changepw:${userId}`;
  const attemptData = passwordAttempts.get(attemptKey) || { attempts: 0, lockedUntil: null };

  if (attemptData.lockedUntil && attemptData.lockedUntil > new Date()) {
    const waitMinutes = Math.ceil((attemptData.lockedUntil - new Date()) / 60000);
    return res.status(429).json({
      error: `Too many attempts. Try again in ${waitMinutes} minutes.`,
      lockedUntil: attemptData.lockedUntil,
    });
  }

  const user = await User.findById(userId).select('+passwordHash');

  if (!user.passwordHash) {
    return res.status(400).json({ error: 'No password set. Use set-password instead.' });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValid) {
    attemptData.attempts += 1;
    if (attemptData.attempts >= PASSWORD_MAX_ATTEMPTS) {
      attemptData.lockedUntil = new Date(Date.now() + PASSWORD_LOCKOUT_MINUTES * 60 * 1000);
      attemptData.attempts = 0;
    }
    passwordAttempts.set(attemptKey, attemptData);

    return res.status(400).json({
      error: 'Current password is incorrect',
      attemptsRemaining: PASSWORD_MAX_ATTEMPTS - attemptData.attempts,
    });
  }

  // Clear rate limit on success
  passwordAttempts.delete(attemptKey);

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  await User.findByIdAndUpdate(userId, { passwordHash });

  res.json({ success: true, message: 'Password changed successfully' });
}));

/**
 * POST /api/verify/username
 * Update username (no verification needed, just uniqueness check)
 */
router.post('/username', authenticate, asyncHandler(async (req, res) => {
  const { username } = req.body;
  const userId = req.user._id;

  if (!username) {
    // Clearing username
    await User.findByIdAndUpdate(userId, { $unset: { username: 1 } });
    return res.json({ success: true, message: 'Username removed' });
  }

  // Validate username format
  const usernameRegex = /^[a-z0-9_]{3,30}$/;
  if (!usernameRegex.test(username.toLowerCase())) {
    return res.status(400).json({
      error: 'Username must be 3-30 characters, lowercase letters, numbers, and underscores only',
    });
  }

  // Check availability
  const existingUser = await User.findOne({
    username: username.toLowerCase(),
    _id: { $ne: userId },
  });
  if (existingUser) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  await User.findByIdAndUpdate(userId, { username: username.toLowerCase() });
  res.json({ success: true, message: 'Username updated' });
}));

export default router;
