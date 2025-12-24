const mongoose = require('mongoose');

// MongoDB connection details
const MONGO_HOST = '34.169.119.250:27017';
const MONGO_USER = 'admin';
const MONGO_PASS = 'Pass1234!';
const MONGO_DB = 'chatrix';

// Build connection URI
const MONGO_URI = `mongodb://${MONGO_USER}:${encodeURIComponent(MONGO_PASS)}@${MONGO_HOST}/${MONGO_DB}?authSource=admin`;

async function checkUsers() {
    try {
        console.log('🔌 Connecting to MongoDB...\n');

        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Count total users
        const totalUsers = await usersCollection.countDocuments();
        console.log(`📊 Total users: ${totalUsers}`);

        // Count users with email
        const usersWithEmail = await usersCollection.countDocuments({
            email: { $exists: true, $ne: null, $ne: '' }
        });
        console.log(`✅ Users with email: ${usersWithEmail}`);

        // Count users without email
        const usersWithoutEmail = await usersCollection.countDocuments({
            $or: [
                { email: { $exists: false } },
                { email: null },
                { email: '' }
            ]
        });
        console.log(`❌ Users without email: ${usersWithoutEmail}\n`);

        // Show sample of users with their emails
        console.log('📋 Sample users:\n');
        const sampleUsers = await usersCollection.find({}).limit(10).toArray();

        sampleUsers.forEach(user => {
            const emailStatus = user.email ? '✓' : '✗';
            const email = user.email || 'NO EMAIL';
            console.log(`  ${emailStatus} ${user.username.padEnd(20)} -> ${email}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the check
console.log('=== Check User Emails ===\n');
checkUsers()
    .then(() => {
        console.log('\n✅ Check completed\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Check failed');
        process.exit(1);
    });
