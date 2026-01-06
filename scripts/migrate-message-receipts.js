/**
 * Migration Script: Add message_id and server_ts to Messages
 * Run this script before deploying the new receipt system
 * 
 * Usage: node scripts/migrate-message-receipts.js
 * 
 * Or using MongoDB shell:
 * mongo your_database_name scripts/migrate-message-receipts.js
 */

// Connect to database (adjust connection string as needed)
// const db = db.getSiblingDB('chatrix');

print('Starting migration: Add message_id and server_ts to Messages');

// Step 1: Add message_id and server_ts to existing messages
print('Step 1: Adding message_id and server_ts to existing messages...');

const result = db.messages.updateMany(
  { message_id: { $exists: false } },
  [
    {
      $set: {
        // Generate message_id from _id (or use ULID if available)
        message_id: { $toString: "$_id" },
        // Use created_at as server_ts if available, otherwise use current date
        server_ts: {
          $cond: {
            if: { $ne: ["$created_at", null] },
            then: "$created_at",
            else: new Date()
          }
        }
      }
    }
  ]
);

print(`Updated ${result.modifiedCount} messages`);

// Step 2: Create indexes
print('Step 2: Creating indexes...');

try {
  // Unique index on message_id
  db.messages.createIndex({ message_id: 1 }, { unique: true });
  print('✓ Created unique index on message_id');
} catch (e) {
  print('Index on message_id already exists or error: ' + e.message);
}

try {
  // Index for querying messages in conversation (ordered by server_ts)
  db.messages.createIndex({ conversation_id: 1, server_ts: -1 });
  print('✓ Created index on conversation_id + server_ts');
} catch (e) {
  print('Index on conversation_id + server_ts already exists or error: ' + e.message);
}

try {
  // Index for querying messages by conversation and message_id (for ULID ordering)
  db.messages.createIndex({ conversation_id: 1, message_id: 1 });
  print('✓ Created index on conversation_id + message_id');
} catch (e) {
  print('Index on conversation_id + message_id already exists or error: ' + e.message);
}

// Step 3: Verify
print('Step 3: Verifying migration...');

const messagesWithoutId = db.messages.countDocuments({ message_id: { $exists: false } });
if (messagesWithoutId > 0) {
  print(`⚠ WARNING: ${messagesWithoutId} messages still missing message_id`);
} else {
  print('✓ All messages have message_id');
}

const messagesWithoutServerTs = db.messages.countDocuments({ server_ts: { $exists: false } });
if (messagesWithoutServerTs > 0) {
  print(`⚠ WARNING: ${messagesWithoutServerTs} messages still missing server_ts`);
} else {
  print('✓ All messages have server_ts');
}

// Step 4: Create conversation_receipts collection indexes
// (Collection will be created automatically by Mongoose, but we can create indexes manually)
print('Step 4: Ensuring conversation_receipts indexes...');

try {
  // Unique index: one receipt per user per conversation
  db.conversation_receipts.createIndex(
    { conversation_id: 1, user_id: 1 },
    { unique: true }
  );
  print('✓ Created unique index on conversation_receipts (conversation_id + user_id)');
} catch (e) {
  print('Index on conversation_receipts already exists or error: ' + e.message);
}

try {
  // Index for querying all receipts for a conversation
  db.conversation_receipts.createIndex({ conversation_id: 1 });
  print('✓ Created index on conversation_receipts.conversation_id');
} catch (e) {
  print('Index on conversation_receipts.conversation_id already exists or error: ' + e.message);
}

try {
  // Index for querying receipts by user
  db.conversation_receipts.createIndex({ user_id: 1, updated_at: -1 });
  print('✓ Created index on conversation_receipts (user_id + updated_at)');
} catch (e) {
  print('Index on conversation_receipts (user_id + updated_at) already exists or error: ' + e.message);
}

print('');
print('Migration completed!');
print('');
print('Next steps:');
print('1. Deploy updated backend code');
print('2. Restart MQTT broker with new ACL configuration');
print('3. Update clients to use new MQTT topics (chat/v1/users/{userId}/messages)');
print('4. Monitor logs for any errors');



