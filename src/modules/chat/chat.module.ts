import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ReceiptService } from './receipt.service';
import { ReceiptSubscriberService } from './receipt-subscriber.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { ConversationReceipt, ConversationReceiptSchema } from './schemas/conversation-receipt.schema';
import { MqttModule } from '../../infrastructure/mqtt/mqtt.module';
import { PostModule } from '../post/post.module';
import { UserModule } from '../user/user.module';
import { BlockModule } from '../block/block.module';
import { ContactModule } from '../contact/contact.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ConversationReceipt.name, schema: ConversationReceiptSchema },
    ]),
    MqttModule,
    UserModule,
    BlockModule,
    ContactModule,
    StorageModule,
    NotificationModule,
    forwardRef(() => PostModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ReceiptService, ReceiptSubscriberService],
  exports: [ChatService, ReceiptService],
})
export class ChatModule { }
