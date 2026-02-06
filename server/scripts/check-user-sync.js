/**
 * One-off script: check user(s) and report threads (chats) and notes (messages) synced.
 * Usage: node scripts/check-user-sync.js [email]   — single user
 *        node scripts/check-user-sync.js all       — all users
 */

import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mneme';
const arg = (process.argv[2] || '').toLowerCase().trim();
const listAll = arg === 'all' || arg === '--all';

async function reportOne(user) {
  const userId = user._id;
  const chats = await Chat.find({
    ownerId: userId,
    deletedAt: null,
  }).lean();
  const allChatsIncludingDeleted = await Chat.find({ ownerId: userId }).lean();
  const withName = chats.filter((c) => c.name && String(c.name).trim().length > 0);
  const chatIds = chats.map((c) => c._id);
  const messageCount = await Message.countDocuments({
    chatId: { $in: chatIds },
    isDeleted: false,
  });
  const totalMessages = await Message.countDocuments({ chatId: { $in: chatIds } });
  const identifier = user.email || user.username || user.phone || user._id.toString();
  console.log('---');
  console.log('User:', identifier);
  console.log('  id:', userId.toString());
  console.log('  threads (chats, non-deleted):', chats.length);
  console.log('  threads with name:', withName.length);
  if (withName.length > 0) {
    withName.forEach((c, i) => console.log(`    [${i + 1}] name: "${c.name}"`));
  }
  if (allChatsIncludingDeleted.length > chats.length) {
    const deleted = allChatsIncludingDeleted.filter((c) => c.deletedAt);
    console.log('  threads (including deleted):', allChatsIncludingDeleted.length);
    deleted.forEach((c, i) => console.log(`    deleted [${i + 1}] name: "${c.name}" deletedAt: ${c.deletedAt}`));
  }
  console.log('  notes (messages, non-deleted):', messageCount);
  console.log('  total messages:', totalMessages);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  if (listAll) {
    const users = await User.find({}).lean();
    console.log('Total users:', users.length);
    for (const user of users) {
      await reportOne(user);
    }
    if (users.length === 0) console.log('(none)');
  } else {
    const email = arg || 'eyeclik@gmail.com';
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.log('User not found:', email);
      await mongoose.disconnect();
      process.exit(0);
    }
    await reportOne(user);
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
