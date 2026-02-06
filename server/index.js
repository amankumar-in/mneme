import cors from 'cors';
import express from 'express';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.js';
import noteRoutes from './routes/notes.js';
import searchRoutes from './routes/search.js';
import shareRoutes from './routes/share.js';
import syncRoutes from './routes/sync.js';
import taskRoutes from './routes/tasks.js';
import threadRoutes from './routes/threads.js';
import verifyRoutes from './routes/verify.js';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure user-data directories exist (idempotent: only creates if missing; does not clear contents).
// Mount a persistent disk at server/user-data so avatars and exports survive deployments.
const USER_DATA_DIR = path.join(__dirname, 'user-data');
const AVATARS_DIR = path.join(USER_DATA_DIR, 'avatars');
const EXPORTS_DIR = path.join(USER_DATA_DIR, 'exports');
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/laterbox';

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
    message: 'LaterBox API is running',
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

// Legal pages
app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - LaterBox</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.7; color: #1a1a1a; background: #fff; }
    .brand { display: flex; align-items: center; gap: 12px; padding: 20px 0 32px; border-bottom: 1px solid #e5e5e5; margin-bottom: 32px; }
    .brand-icon { width: 44px; height: 44px; background: #83ADAB; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 20px; }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .brand-tagline { font-size: 13px; color: #888; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 20px; margin-top: 36px; color: #2a2a2a; }
    h3 { font-size: 16px; margin-top: 20px; color: #333; }
    .updated { color: #666; font-size: 14px; margin-bottom: 32px; }
    ul { padding-left: 24px; }
    li { margin-bottom: 6px; }
    .highlight { background: #f0f7f6; border-left: 3px solid #83ADAB; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e5e5; text-align: center; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="brand">
    <div class="brand-icon">L</div>
    <div class="brand-text">
      <span class="brand-name">LaterBox</span>
      <span class="brand-tagline">by XCore Apps</span>
    </div>
  </div>

  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: February 6, 2025</p>

  <p>LaterBox ("we", "our", "us") is a personal note-taking and task management app developed by XCore Apps. Your privacy is fundamental to how we build and operate LaterBox. This policy explains in detail what data we collect, why we collect it, how we use it, and the choices you have.</p>

  <div class="highlight">
    <strong>Our core principle:</strong> LaterBox is designed to work fully offline and locally on your device. You are never required to create an account, share personal data, or connect to our servers to use the app. All your notes, threads, and tasks are stored locally on your device by default. Personal data is only collected if you voluntarily opt into specific features like cloud sync or account creation.
  </div>

  <h2>1. Data We Collect</h2>

  <h3>1.1 Data stored locally on your device (no account required)</h3>
  <p>When you use LaterBox without an account, all data remains entirely on your device:</p>
  <ul>
    <li>Notes, threads, and tasks you create</li>
    <li>App preferences and settings (theme, font, minimal mode, etc.)</li>
    <li>Media attachments (photos, audio, documents) you add to notes</li>
    <li>Location data attached to notes (only when you explicitly choose to attach a location)</li>
  </ul>
  <p>This data never leaves your device unless you choose to enable sync. We have no access to it.</p>

  <h3>1.2 Data collected when you create an account (optional)</h3>
  <p>If you choose to create an account to enable cloud sync, we collect:</p>
  <ul>
    <li><strong>Email address or phone number:</strong> Used solely for account verification and sign-in. We send a one-time verification code; we do not send marketing emails or promotional messages.</li>
    <li><strong>Display name:</strong> A name you choose to identify your account. This can be any name you like and does not need to be your real name.</li>
    <li><strong>Username:</strong> An optional identifier you can set for your account.</li>
  </ul>

  <h3>1.3 Data synced to our servers (only with sync enabled)</h3>
  <p>If you create an account and enable sync, the following data is transmitted to and stored on our servers:</p>
  <ul>
    <li>Notes, threads, and tasks (content, timestamps, metadata)</li>
    <li>Thread settings (name, icon, wallpaper, pinned status)</li>
    <li>Task details (reminders, completion status)</li>
    <li>Note metadata (starred, locked, edited status)</li>
  </ul>
  <p>Sync is a feature you opt into. You can disable sync at any time from the app settings, and you can delete all remote data from within the app.</p>

  <h3>1.4 Data we do NOT collect</h3>
  <p>We want to be explicit about what we do not collect:</p>
  <ul>
    <li>We do not collect analytics or usage tracking data</li>
    <li>We do not collect device identifiers or advertising IDs</li>
    <li>We do not collect browsing history or app usage patterns</li>
    <li>We do not collect contacts (the contacts permission is only used locally if you choose to share a note, and contact data is never sent to our servers)</li>
    <li>We do not collect location data in the background (location is only accessed when you explicitly attach it to a note)</li>
    <li>We do not use cookies or tracking pixels</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <p>The data we collect is used strictly for the following purposes:</p>
  <ul>
    <li><strong>Account verification:</strong> Your email or phone number is used to send a one-time verification code when you sign in. No other communications are sent.</li>
    <li><strong>Cloud sync:</strong> If enabled, your notes and threads are synced to our servers so you can access them across devices.</li>
    <li><strong>App functionality:</strong> Your account information is used to associate your synced data with your account.</li>
    <li><strong>Support:</strong> If you contact us, we may use your account information to respond to your request.</li>
  </ul>
  <p>We do not use your data for advertising, profiling, recommendations, or any purpose other than providing the core app functionality you have opted into.</p>

  <h2>3. Data Storage and Security</h2>

  <h3>3.1 Local storage</h3>
  <p>Data stored locally on your device is kept in a SQLite database within the app's private storage area. This data is protected by your device's built-in security (screen lock, encryption). We do not have access to locally stored data.</p>

  <h3>3.2 Server storage</h3>
  <p>If you use cloud sync, your data is stored on secure servers with the following protections:</p>
  <ul>
    <li>All data in transit is encrypted using HTTPS/TLS</li>
    <li>Database access is restricted and authenticated</li>
    <li>Passwords are hashed using bcrypt and are never stored in plain text</li>
    <li>Authentication is handled via JSON Web Tokens (JWT) with expiration</li>
  </ul>

  <h3>3.3 Data retention</h3>
  <p>We retain your synced data for as long as you have an active account. When you delete your account, all associated data is permanently removed from our servers. There is no recovery period — deletion is immediate and irreversible.</p>

  <h2>4. Third-Party Services</h2>
  <p>To provide specific functionality, we use the following third-party services. Data is shared with these services only as necessary for their specific function:</p>
  <ul>
    <li><strong>MongoDB Atlas</strong> (MongoDB, Inc.) — Cloud database hosting. Stores your synced notes, threads, and account data. <a href="https://www.mongodb.com/legal/privacy-policy">Privacy Policy</a></li>
    <li><strong>Render</strong> (Render Services, Inc.) — Server hosting. Hosts our backend API. <a href="https://render.com/privacy">Privacy Policy</a></li>
    <li><strong>ZeptoMail</strong> (Zoho Corporation) — Email delivery. Used only to send verification codes to your email address when you sign in. <a href="https://www.zoho.com/privacy.html">Privacy Policy</a></li>
    <li><strong>Twilio</strong> (Twilio, Inc.) — SMS delivery. Used only to send verification codes to your phone number when you sign in. <a href="https://www.twilio.com/legal/privacy">Privacy Policy</a></li>
  </ul>
  <p>We do not use any analytics SDKs, crash reporting services, or advertising networks.</p>

  <h2>5. Data Sharing and Disclosure</h2>
  <p>We do not sell, rent, trade, or share your personal data with third parties for their own purposes. Your data may only be disclosed in the following limited circumstances:</p>
  <ul>
    <li><strong>Service providers:</strong> As listed in Section 4, strictly to operate the app's features.</li>
    <li><strong>Legal requirements:</strong> If required by law, subpoena, or court order.</li>
    <li><strong>Safety:</strong> To protect the rights, safety, or property of our users or the public, if required by law.</li>
  </ul>

  <h2>6. Your Rights and Choices</h2>
  <p>You have full control over your data:</p>
  <ul>
    <li><strong>Use without an account:</strong> You can use LaterBox entirely offline without sharing any data with us.</li>
    <li><strong>Disable sync:</strong> You can turn off cloud sync at any time in the app settings. Your data will remain local only.</li>
    <li><strong>Delete remote data:</strong> You can delete all data stored on our servers from within the app, without deleting your account.</li>
    <li><strong>Delete your account:</strong> You can permanently delete your account and all associated data from within the app at any time.</li>
    <li><strong>Access your data:</strong> You can export your notes and threads from within the app.</li>
  </ul>

  <h2>7. Permissions</h2>
  <p>LaterBox may request the following device permissions. Each is optional and only used when you initiate the related feature:</p>
  <ul>
    <li><strong>Camera / Photo Library:</strong> Only accessed when you choose to attach a photo or media to a note.</li>
    <li><strong>Microphone:</strong> Only accessed when you choose to record an audio note.</li>
    <li><strong>Location:</strong> Only accessed when you choose to attach your location to a note. Never accessed in the background.</li>
    <li><strong>Contacts:</strong> Only accessed locally when you choose to share a note. Contact data is never sent to our servers.</li>
    <li><strong>Notifications:</strong> Only used for task reminders you have set.</li>
  </ul>
  <p>Denying any permission will not affect the core functionality of the app. Only the specific feature requiring that permission will be unavailable.</p>

  <h2>8. Children's Privacy</h2>
  <p>LaterBox is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal data through the account creation process, please contact us and we will promptly delete it.</p>

  <h2>9. International Data Transfers</h2>
  <p>Our servers may be located in regions different from your own. By using the cloud sync feature, you consent to the transfer and storage of your data in these locations. All transfers are protected by HTTPS/TLS encryption.</p>

  <h2>10. Changes to This Policy</h2>
  <p>We may update this privacy policy from time to time. When we make changes, we will update the "Last updated" date at the top of this page. For significant changes, we may notify you through the app. We encourage you to review this policy periodically.</p>

  <h2>11. Contact Us</h2>
  <p>If you have any questions, concerns, or requests regarding this privacy policy or your data, please contact us at:</p>
  <p><strong>Email:</strong> <a href="mailto:laterbox@xcoreapps.com">laterbox@xcoreapps.com</a></p>
  <p><strong>Developer:</strong> XCore Apps</p>

  <div class="footer">
    <p>&copy; 2025 LaterBox by XCore Apps. All rights reserved.</p>
  </div>
</body>
</html>`);
});

app.get('/delete-account', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delete Account - LaterBox</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.7; color: #1a1a1a; background: #fff; }
    .brand { display: flex; align-items: center; gap: 12px; padding: 20px 0 32px; border-bottom: 1px solid #e5e5e5; margin-bottom: 32px; }
    .brand-icon { width: 44px; height: 44px; background: #83ADAB; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 20px; }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .brand-tagline { font-size: 13px; color: #888; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 20px; margin-top: 32px; color: #2a2a2a; }
    .updated { color: #666; font-size: 14px; margin-bottom: 32px; }
    ol { padding-left: 24px; }
    ul { padding-left: 24px; list-style: disc; }
    li { margin-bottom: 8px; }
    .step { background: #f8f8f8; border-radius: 8px; padding: 16px; margin: 8px 0; }
    .step-num { display: inline-block; width: 24px; height: 24px; background: #83ADAB; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 13px; font-weight: 700; margin-right: 8px; }
    .warning { background: #fff3f3; border-left: 3px solid #e74c3c; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e5e5; text-align: center; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="brand">
    <div class="brand-icon">L</div>
    <div class="brand-text">
      <span class="brand-name">LaterBox</span>
      <span class="brand-tagline">by XCore Apps</span>
    </div>
  </div>

  <h1>Data Deletion</h1>
  <p class="updated">LaterBox provides multiple options to manage and delete your data directly from within the app.</p>

  <h2>Option 1: Delete Remote Data Only</h2>
  <p>Remove all your synced data from our servers while keeping your local data and account intact.</p>

  <div class="step"><span class="step-num">1</span> Open LaterBox on your device</div>
  <div class="step"><span class="step-num">2</span> Go to <strong>Settings</strong> (gear icon)</div>
  <div class="step"><span class="step-num">3</span> Scroll down to the <strong>Data Control</strong> section</div>
  <div class="step"><span class="step-num">4</span> Tap <strong>Delete Remote Data</strong></div>
  <div class="step"><span class="step-num">5</span> Confirm the deletion when prompted</div>

  <p><strong>What gets deleted:</strong></p>
  <ul>
    <li>All notes, threads, and tasks stored on our servers</li>
  </ul>
  <p><strong>What is kept:</strong></p>
  <ul>
    <li>Your account (you remain signed in)</li>
    <li>All data stored locally on your device</li>
  </ul>

  <h2>Option 2: Delete Account Information</h2>
  <p>Remove your personal profile information from our servers while keeping your notes and threads.</p>

  <div class="step"><span class="step-num">1</span> Open LaterBox on your device</div>
  <div class="step"><span class="step-num">2</span> Go to <strong>Settings</strong> (gear icon)</div>
  <div class="step"><span class="step-num">3</span> Scroll down to the <strong>Data Control</strong> section</div>
  <div class="step"><span class="step-num">4</span> Tap <strong>Delete Account Info</strong></div>
  <div class="step"><span class="step-num">5</span> Confirm the deletion when prompted</div>

  <p><strong>What gets deleted:</strong></p>
  <ul>
    <li>Your name, email, phone number, username, avatar, and password</li>
  </ul>
  <p><strong>What is kept:</strong></p>
  <ul>
    <li>Your notes, threads, and tasks on the server</li>
    <li>All data stored locally on your device</li>
  </ul>

  <h2>Option 3: Delete Everything</h2>
  <p>Permanently delete your account and all associated data from our servers.</p>

  <div class="step"><span class="step-num">1</span> Open LaterBox on your device</div>
  <div class="step"><span class="step-num">2</span> Go to <strong>Settings</strong> (gear icon)</div>
  <div class="step"><span class="step-num">3</span> Scroll down to the <strong>Data Control</strong> section</div>
  <div class="step"><span class="step-num">4</span> Tap <strong>Delete Everything</strong></div>
  <div class="step"><span class="step-num">5</span> Confirm the deletion when prompted</div>

  <p><strong>What gets deleted:</strong></p>
  <ul>
    <li>Your account information (name, email, phone number, username)</li>
    <li>All your notes and their content</li>
    <li>All your threads</li>
    <li>All your tasks and reminders</li>
    <li>Your profile avatar</li>
    <li>Any shared thread records</li>
  </ul>

  <div class="warning">
    <strong>This action is irreversible.</strong> Once your account is deleted, your data cannot be recovered. There is no grace period or recovery window.
  </div>

  <h2>Data Retention</h2>
  <p>For all deletion options, the affected data is removed <strong>immediately and permanently</strong> from our servers. We do not keep backups of deleted data.</p>
  <p>Any data stored locally on your device (notes, settings) will remain on your device until you uninstall the app or choose to clear local data from within the app.</p>

  <h2>Need Help?</h2>
  <p>If you are unable to delete your data through the app or need assistance, contact us at <a href="mailto:help@xcoreapps.com">help@xcoreapps.com</a> and we will process your request.</p>

  <div class="footer">
    <p>&copy; 2025 LaterBox by XCore Apps. All rights reserved.</p>
  </div>
</body>
</html>`);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/threads', noteRoutes); // Notes are at /api/threads/:threadId/notes
app.use('/api/tasks', taskRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/share', shareRoutes);
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
