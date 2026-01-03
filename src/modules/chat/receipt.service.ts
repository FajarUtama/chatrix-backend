import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConversationReceipt, ConversationReceiptDocument } from './schemas/conversation-receipt.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';

/**
 * Service for handling message receipts (delivered/read watermarks)
 * Implements watermark-based receipt tracking for efficiency
 */
@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @InjectModel(ConversationReceipt.name)
    private receiptModel: Model<ConversationReceiptDocument>,
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    private mqttService: MqttService,
  ) {}

  /**
   * Process delivered_up_to receipt from client
   * Updates watermark if message_id is newer than existing
   * Idempotent: duplicate receipts are ignored
   */
  async processDeliveredUpTo(
    conversationId: string,
    userId: string,
    lastDeliveredMessageId: string,
    clientTs?: Date,
  ): Promise<void> {
    this.logger.debug(
      `Processing delivered_up_to: conversation=${conversationId}, user=${userId}, message_id=${lastDeliveredMessageId}`,
    );

    // Validate conversation and membership
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation || !conversation.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or user is not a member');
    }

    // Validate message exists
    const message = await this.messageModel.findOne({ message_id: lastDeliveredMessageId }).exec();
    if (!message) {
      this.logger.warn(`Message not found: ${lastDeliveredMessageId}`);
      return;
    }

    if (message.conversation_id !== conversationId) {
      throw new Error('Message does not belong to conversation');
    }

    // Get or create receipt record
    let receipt = await this.receiptModel
      .findOne({ conversation_id: conversationId, user_id: userId })
      .exec();

    const now = new Date();

    if (!receipt) {
      // Create new receipt record
      receipt = await this.receiptModel.create({
        conversation_id: conversationId,
        user_id: userId,
        last_delivered_message_id: lastDeliveredMessageId,
        last_delivered_at: now,
      });
      this.logger.debug(`Created new receipt record for conversation=${conversationId}, user=${userId}`);
    } else {
      // Update watermark if new message_id is "greater" than existing
      // For ULID: lexicographic comparison works (time-ordered)
      // For UUID: need to compare server_ts
      const shouldUpdate = await this.shouldAdvanceWatermark(
        receipt.last_delivered_message_id,
        lastDeliveredMessageId,
      );

      if (shouldUpdate) {
        receipt.last_delivered_message_id = lastDeliveredMessageId;
        receipt.last_delivered_at = now;
        await receipt.save();
        this.logger.debug(`Updated delivered watermark for conversation=${conversationId}, user=${userId}`);
      } else {
        this.logger.debug(`Ignored out-of-order delivered receipt: existing=${receipt.last_delivered_message_id}, incoming=${lastDeliveredMessageId}`);
        return; // Idempotent: ignore out-of-order receipt
      }
    }

    // Publish receipt update to relevant users (sender and other members)
    await this.publishReceiptUpdate(conversationId, userId, 'delivered_up_to', lastDeliveredMessageId, now);
  }

  /**
   * Process read_up_to receipt from client
   * Updates watermark if message_id is newer than existing
   * Idempotent: duplicate receipts are ignored
   */
  async processReadUpTo(
    conversationId: string,
    userId: string,
    lastReadMessageId: string,
    clientTs?: Date,
  ): Promise<void> {
    this.logger.debug(
      `Processing read_up_to: conversation=${conversationId}, user=${userId}, message_id=${lastReadMessageId}`,
    );

    // Validate conversation and membership
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation || !conversation.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or user is not a member');
    }

    // Validate message exists
    const message = await this.messageModel.findOne({ message_id: lastReadMessageId }).exec();
    if (!message) {
      this.logger.warn(`Message not found: ${lastReadMessageId}`);
      return;
    }

    if (message.conversation_id !== conversationId) {
      throw new Error('Message does not belong to conversation');
    }

    // Get or create receipt record
    let receipt = await this.receiptModel
      .findOne({ conversation_id: conversationId, user_id: userId })
      .exec();

    const now = new Date();

    if (!receipt) {
      // Create new receipt record
      receipt = await this.receiptModel.create({
        conversation_id: conversationId,
        user_id: userId,
        last_read_message_id: lastReadMessageId,
        last_read_at: now,
      });
      this.logger.debug(`Created new receipt record for conversation=${conversationId}, user=${userId}`);
    } else {
      // Update watermark if new message_id is "greater" than existing
      const shouldUpdate = await this.shouldAdvanceWatermark(receipt.last_read_message_id, lastReadMessageId);

      if (shouldUpdate) {
        receipt.last_read_message_id = lastReadMessageId;
        receipt.last_read_at = now;
        await receipt.save();
        this.logger.debug(`Updated read watermark for conversation=${conversationId}, user=${userId}`);
      } else {
        this.logger.debug(`Ignored out-of-order read receipt: existing=${receipt.last_read_message_id}, incoming=${lastReadMessageId}`);
        return; // Idempotent: ignore out-of-order receipt
      }
    }

    // Publish receipt update to relevant users (senders of messages that are now read)
    await this.publishReceiptUpdate(conversationId, userId, 'read_up_to', lastReadMessageId, now);
  }

  /**
   * Check if new watermark should advance existing watermark
   * Compares message IDs to ensure monotonicity
   * For ULID: lexicographic comparison (time-ordered)
   * For UUID: compare server_ts from message
   */
  private async shouldAdvanceWatermark(
    existingMessageId: string | null | undefined,
    newMessageId: string,
  ): Promise<boolean> {
    if (!existingMessageId) {
      return true; // No existing watermark, accept new one
    }

    // If same message_id, ignore (idempotent)
    if (existingMessageId === newMessageId) {
      return false;
    }

    // For ULID: lexicographic comparison works (they're time-ordered)
    // For UUID: we need to compare server_ts
    // Try ULID comparison first (most common case)
    if (this.isUlid(existingMessageId) && this.isUlid(newMessageId)) {
      return newMessageId > existingMessageId;
    }

    // Fallback: compare server_ts from messages
    const existingMsg = await this.messageModel.findOne({ message_id: existingMessageId }).exec();
    const newMsg = await this.messageModel.findOne({ message_id: newMessageId }).exec();

    if (!existingMsg || !newMsg) {
      // If messages not found, accept new watermark (safer to advance)
      return true;
    }

    // Compare server_ts
    return newMsg.server_ts.getTime() > existingMsg.server_ts.getTime();
  }

  /**
   * Simple check if string looks like ULID (26 chars, base32)
   */
  private isUlid(str: string): boolean {
    return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(str);
  }

  /**
   * Publish receipt update to relevant users via MQTT
   * For 1-1: publish to sender only
   * For group: publish to all members (they can compute which of their messages are affected)
   * Also publishes conversation update with correct unread_count
   */
  private async publishReceiptUpdate(
    conversationId: string,
    actorUserId: string,
    receiptType: 'delivered_up_to' | 'read_up_to',
    messageId: string,
    ts: Date,
  ): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation) {
      return;
    }

    const payload = {
      type: receiptType,
      conversation_id: conversationId,
      actor_user_id: actorUserId,
      [`last_${receiptType === 'delivered_up_to' ? 'delivered' : 'read'}_message_id`]: messageId,
      ts: ts.toISOString(),
    };

    // For 1-1 chat: publish to the other participant only
    // For group chat: publish to all members (each can compute status for their messages)
    const recipients =
      conversation.type === 'direct'
        ? conversation.participant_ids.filter((id) => id !== actorUserId)
        : conversation.participant_ids.filter((id) => id !== actorUserId);

    // Publish to each recipient's receipts topic
    for (const recipientId of recipients) {
      const topic = `chat/v1/users/${recipientId}/receipts`;
      this.mqttService.publishAsync(topic, payload).catch((error) => {
        this.logger.error(`Failed to publish receipt update to ${topic}:`, error);
      });
    }

    // If read receipt, also publish conversation update with unread_count = 0 for the reader
    if (receiptType === 'read_up_to') {
      // Calculate unread count for the actor (should be 0 if they just read the latest message)
      const actorReceipt = await this.getReceiptForUser(conversationId, actorUserId);
      const unreadCount = await this.calculateUnreadCount(conversationId, actorUserId, actorReceipt);
      
      // Publish conversation update to actor (reader) with unread_count = 0
      const conversationUpdatePayload = {
        conversation_id: conversationId,
        action: 'messages_read',
        read_by: actorUserId,
        read_at: ts.toISOString(),
        unread_count: unreadCount,
      };

      this.mqttService.publishAsync(
        `chat/v1/users/${actorUserId}/conversations`,
        conversationUpdatePayload,
      ).catch((error) => {
        this.logger.error(`Failed to publish conversation update to ${actorUserId}:`, error);
      });
    }

    this.logger.debug(`Published ${receiptType} receipt update for conversation=${conversationId} to ${recipients.length} recipients`);
  }

  /**
   * Calculate unread count for a user in a conversation based on watermark receipts
   */
  private async calculateUnreadCount(
    conversationId: string,
    userId: string,
    userReceipt: ConversationReceiptDocument | null,
  ): Promise<number> {
    if (!userReceipt || !userReceipt.last_read_message_id) {
      // No receipt yet, count all messages from others as unread
      return this.messageModel.countDocuments({
        conversation_id: conversationId,
        sender_id: { $ne: userId },
      }).exec();
    }

    // If user has read some messages, count messages after last_read_message_id
    const lastReadMessage = await this.messageModel
      .findOne({ message_id: userReceipt.last_read_message_id })
      .exec();

    if (!lastReadMessage) {
      // If last_read_message_id not found, count all unread (fallback)
      return this.messageModel.countDocuments({
        conversation_id: conversationId,
        sender_id: { $ne: userId },
      }).exec();
    }

    // Count messages sent by others after the last read message
    return this.messageModel.countDocuments({
      conversation_id: conversationId,
      sender_id: { $ne: userId },
      server_ts: { $gt: lastReadMessage.server_ts },
    }).exec();
  }

  /**
   * Get receipt watermarks for a conversation
   * Used for computing message status
   */
  async getReceiptsForConversation(conversationId: string): Promise<ConversationReceiptDocument[]> {
    return this.receiptModel.find({ conversation_id: conversationId }).exec();
  }

  /**
   * Get receipt for a specific user in a conversation
   */
  async getReceiptForUser(conversationId: string, userId: string): Promise<ConversationReceiptDocument | null> {
    return this.receiptModel.findOne({ conversation_id: conversationId, user_id: userId }).exec();
  }

  /**
   * Compute message status for a message sent by senderId
   * Returns status: 'sent' | 'delivered' | 'read'
   * For group: returns summary with counts
   */
  async computeMessageStatus(
    conversationId: string,
    messageId: string,
    senderId: string,
    conversationType: 'direct' | 'group',
  ): Promise<
    | { status: 'sent' | 'delivered' | 'read' }
    | {
        status: 'sent' | 'delivered' | 'read';
        delivered_count: number;
        read_count: number;
        member_count_excluding_sender: number;
        is_fully_delivered: boolean;
        is_fully_read: boolean;
      }
  > {
    // Get all receipts for this conversation
    const receipts = await this.getReceiptsForConversation(conversationId);

    // Get message to get its server_ts for comparison
    const message = await this.messageModel.findOne({ message_id: messageId }).exec();
    if (!message) {
      return { status: 'sent' };
    }

    if (conversationType === 'direct') {
      // Find the other participant (recipient)
      const conversation = await this.conversationModel.findById(conversationId).exec();
      if (!conversation) {
        return { status: 'sent' };
      }

      const recipientId = conversation.participant_ids.find((id) => id !== senderId);
      if (!recipientId) {
        return { status: 'sent' };
      }

      const recipientReceipt = receipts.find((r) => r.user_id === recipientId);
      if (!recipientReceipt) {
        return { status: 'sent' };
      }

      // Check read first (read implies delivered)
      if (recipientReceipt.last_read_message_id) {
        const readMsg = await this.messageModel.findOne({ message_id: recipientReceipt.last_read_message_id }).exec();
        if (readMsg && readMsg.server_ts >= message.server_ts) {
          return { status: 'read' };
        }
      }

      // Check delivered
      if (recipientReceipt.last_delivered_message_id) {
        const deliveredMsg = await this.messageModel
          .findOne({ message_id: recipientReceipt.last_delivered_message_id })
          .exec();
        if (deliveredMsg && deliveredMsg.server_ts >= message.server_ts) {
          return { status: 'delivered' };
        }
      }

      return { status: 'sent' };
    } else {
      // Group chat: compute counts
      const conversation = await this.conversationModel.findById(conversationId).exec();
      if (!conversation) {
        return { status: 'sent' };
      }

      const membersExcludingSender = conversation.participant_ids.filter((id) => id !== senderId);
      let deliveredCount = 0;
      let readCount = 0;

      for (const memberId of membersExcludingSender) {
        const memberReceipt = receipts.find((r) => r.user_id === memberId);
        if (!memberReceipt) {
          continue;
        }

        // Check read (read implies delivered)
        if (memberReceipt.last_read_message_id) {
          const readMsg = await this.messageModel
            .findOne({ message_id: memberReceipt.last_read_message_id })
            .exec();
          if (readMsg && readMsg.server_ts >= message.server_ts) {
            readCount++;
            deliveredCount++; // Read implies delivered
            continue;
          }
        }

        // Check delivered
        if (memberReceipt.last_delivered_message_id) {
          const deliveredMsg = await this.messageModel
            .findOne({ message_id: memberReceipt.last_delivered_message_id })
            .exec();
          if (deliveredMsg && deliveredMsg.server_ts >= message.server_ts) {
            deliveredCount++;
          }
        }
      }

      // Determine overall status
      let status: 'sent' | 'delivered' | 'read' = 'sent';
      if (readCount === membersExcludingSender.length) {
        status = 'read';
      } else if (deliveredCount > 0) {
        status = 'delivered';
      }

      return {
        status,
        delivered_count: deliveredCount,
        read_count: readCount,
        member_count_excluding_sender: membersExcludingSender.length,
        is_fully_delivered: deliveredCount === membersExcludingSender.length,
        is_fully_read: readCount === membersExcludingSender.length,
      };
    }
  }
}

