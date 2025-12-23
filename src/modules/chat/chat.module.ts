import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { MqttModule } from '../../infrastructure/mqtt/mqtt.module';
import { PostModule } from '../post/post.module';
import { UserModule } from '../user/user.module';
import { BlockModule } from '../block/block.module';
import { ContactModule } from '../contact/contact.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    MqttModule,
    UserModule,
    BlockModule,
    ContactModule,
    forwardRef(() => PostModule),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule { }
