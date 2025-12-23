import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminConversationController } from './admin-conversation.controller';
import { Conversation, ConversationSchema } from '../chat/schemas/conversation.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
        ]),
    ],
    controllers: [AdminConversationController],
})
export class AdminModule { }
