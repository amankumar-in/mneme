/**
 * One-off script: fetch user by email and list notes in a thread by name.
 * Usage (from server directory):
 *   node scripts/fetch-user-notes.js
 *   MONGODB_URI=mongodb://... node scripts/fetch-user-notes.js
 *
 * Edit EMAIL and THREAD_NAME below or pass as env: FETCH_USER_EMAIL, FETCH_THREAD_NAME
 */
import mongoose from 'mongoose';
import { Note, Thread, User } from '../models/index.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/laterbox';
const EMAIL = process.env.FETCH_USER_EMAIL || 'eyeclik@gmail.com';
const THREAD_NAME = process.env.FETCH_THREAD_NAME || 'Plot';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const user = await User.findOne({ email: EMAIL.toLowerCase() });
  if (!user) {
    console.log(`User not found: ${EMAIL}`);
    await mongoose.connection.close();
    process.exit(1);
  }
  console.log('User:', { _id: user._id, name: user.name, email: user.email, username: user.username });

  const thread = await Thread.findOne({
    name: THREAD_NAME,
    $or: [{ ownerId: user._id }, { participants: user._id }],
    deletedAt: null,
  });
  if (!thread) {
    console.log(`Thread "${THREAD_NAME}" not found for this user.`);
    await mongoose.connection.close();
    process.exit(1);
  }
  console.log('Thread:', { _id: thread._id, name: thread.name });

  const { notes } = await Note.getThreadNotes(thread._id, { limit: 500 });
  console.log(`\nNotes (${notes.length}):`);
  notes.forEach((n, i) => {
    const preview = (n.content || `[${n.type}]`).slice(0, 60);
    console.log(`  ${i + 1}. ${n.createdAt?.toISOString?.() || n.createdAt} | ${n.type} | ${preview}${(n.content && n.content.length > 60) ? '...' : ''}`);
  });

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
