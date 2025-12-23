import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from '../modules/chat/schemas/conversation.schema';

async function cleanupConversations() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const conversationModel = app.get<Model<Conversation>>(getModelToken(Conversation.name));

    console.log('Starting conversation cleanup...');

    // Find all direct conversations
    const conversations = await conversationModel.find({ type: 'direct' }).exec();

    console.log(`Found ${conversations.length} direct conversations`);

    let fixedCount = 0;
    let deletedCount = 0;

    for (const conv of conversations) {
        // Check if participant_ids is not an array or has issues
        if (!Array.isArray(conv.participant_ids)) {
            console.log(`Found corrupted conversation ${conv._id}: participant_ids is not an array`);
            console.log(`  participant_ids:`, conv.participant_ids);

            // Delete this corrupted entry
            await conversationModel.deleteOne({ _id: conv._id });
            deletedCount++;
            console.log(`  Deleted corrupted conversation ${conv._id}`);
        } else if (conv.participant_ids.length !== 2) {
            console.log(`Found invalid conversation ${conv._id}: participant_ids length is ${conv.participant_ids.length}`);
            console.log(`  participant_ids:`, conv.participant_ids);

            if (conv.participant_ids.length === 1) {
                // This is a self-conversation, delete it
                await conversationModel.deleteOne({ _id: conv._id });
                deletedCount++;
                console.log(`  Deleted self-conversation ${conv._id}`);
            }
        } else if (conv.participant_ids[0] === conv.participant_ids[1]) {
            console.log(`Found self-conversation ${conv._id}`);
            await conversationModel.deleteOne({ _id: conv._id });
            deletedCount++;
            console.log(`  Deleted self-conversation ${conv._id}`);
        } else {
            // Check if participant_ids are sorted
            const sorted = [...conv.participant_ids].sort();
            if (conv.participant_ids[0] !== sorted[0] || conv.participant_ids[1] !== sorted[1]) {
                console.log(`Found unsorted conversation ${conv._id}`);
                console.log(`  Current: [${conv.participant_ids.join(', ')}]`);
                console.log(`  Sorted:  [${sorted.join(', ')}]`);

                // Update to sorted version
                await conversationModel.updateOne(
                    { _id: conv._id },
                    { $set: { participant_ids: sorted } }
                );
                fixedCount++;
                console.log(`  Fixed conversation ${conv._id}`);
            }
        }
    }

    console.log('\nCleanup complete!');
    console.log(`  Fixed: ${fixedCount}`);
    console.log(`  Deleted: ${deletedCount}`);

    await app.close();
}

cleanupConversations()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
