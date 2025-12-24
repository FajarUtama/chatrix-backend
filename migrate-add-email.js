const mongoose = require('mongoose');

// MongoDB connection details - hardcoded for migration
const MONGO_HOST = '34.169.119.250:27017';
const MONGO_USER = 'admin';
const MONGO_PASS = 'Pass1234!';
const MONGO_DB = 'chatrix';

// Build connection URI
const MONGO_URI = `mongodb://${MONGO_USER}:${encodeURIComponent(MONGO_PASS)}@${MONGO_HOST}/${MONGO_DB}?authSource=admin`;

async function addEmailToUsers() {
    try {
        console.log(`🔌 Connecting to MongoDB at ${MONGO_HOST}...`);
        console.log(`   Database: ${MONGO_DB}`);
        console.log(`   User: ${MONGO_USER}\n`);

        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Count total users
        const totalUsers = await usersCollection.countDocuments();
        console.log(`📊 Total users in database: ${totalUsers}`);

        // Find all users without email field or with null email
        const usersWithoutEmail = await usersCollection.find({
            $or: [
                { email: { $exists: false } },
                { email: null },
                { email: '' }
            ]
        }).toArray();

        console.log(`📧 Users without email: ${usersWithoutEmail.length}\n`);

        if (usersWithoutEmail.length === 0) {
            console.log('✅ All users already have email field');
            return;
        }

        console.log('Updating users:\n');

        // Update each user to add a default email based on username
        let updatedCount = 0;
        for (const user of usersWithoutEmail) {
            const defaultEmail = `${user.username}@chatrix.local`;

            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $set: {
                        email: defaultEmail,
                        email_verified: false
                    }
                }
            );

            updatedCount++;
            console.log(`  ✓ ${user.username.padEnd(20)} -> ${defaultEmail}`);
        }

        console.log(`\n✅ Successfully updated ${updatedCount} users`);
        console.log('\n⚠️  Note: Default emails use format: username@chatrix.local');
        console.log('   Users should update their email addresses through the profile update endpoint.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.error('\n💡 Connection timeout. Please check:');
            console.error('   1. MongoDB server is running');
            console.error('   2. Firewall allows connection to port 27017');
            console.error('   3. Network connectivity to the server');
        }
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the migration
console.log('=== Add Email Field to Users Migration ===\n');
addEmailToUsers()
    .then(() => {
        console.log('\n✅ Migration completed successfully\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed');
        process.exit(1);
    });
