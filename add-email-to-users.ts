import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatrix';

async function addEmailToUsers() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();
        const usersCollection = db.collection('users');

        // Find all users without email field
        const usersWithoutEmail = await usersCollection.find({
            email: { $exists: false }
        }).toArray();

        console.log(`Found ${usersWithoutEmail.length} users without email field`);

        if (usersWithoutEmail.length === 0) {
            console.log('All users already have email field');
            return;
        }

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
            console.log(`Updated user ${user.username} with email: ${defaultEmail}`);
        }

        console.log(`\n✅ Successfully updated ${updatedCount} users`);
        console.log('\n⚠️  Note: Default emails use format: username@chatrix.local');
        console.log('Users should update their email addresses through the profile update endpoint.');

    } catch (error) {
        console.error('Error updating users:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the migration
addEmailToUsers()
    .then(() => {
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
