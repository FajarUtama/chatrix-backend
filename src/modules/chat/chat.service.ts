import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { UserService } from '../user/user.service';
import { BlockService } from '../block/block.service';
import { ContactService } from '../contact/contact.service';
import { UrlNormalizerService } from '../../common/services/url-normalizer.service';
import { ReceiptService } from './receipt.service';
import { generateUlid } from '../../common/utils/ulid.util';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private mqttService: MqttService,
    private userService: UserService,
    private blockService: BlockService,
    private contactService: ContactService,
    private urlNormalizer: UrlNormalizerService,
    private receiptService: ReceiptService,
  ) { }

  async createOrGetDirectConversation(userId1: string, userId2: string): Promise<ConversationDocument> {
    // Prevent users from creating conversations with themselves
    if (userId1 === userId2) {
      throw new Error('Cannot create a conversation with yourself');
    }

    const participantIds = [userId1, userId2].sort();
    this.logger.log(`Looking for conversation between: ${participantIds.join(', ')}`);

    // Try to find existing conversation with exact array match
    let conversation = await this.conversationModel.findOne({
      type: 'direct',
      participant_ids: participantIds,
    }).exec();

    if (!conversation) {
      this.logger.log('No existing conversation found, creating new one...');
      try {
        conversation = await this.conversationModel.create({
          type: 'direct',
          participant_ids: participantIds,
        });
        this.logger.log(`Created new conversation: ${conversation._id}`);
      } catch (error: any) {
        // If we get a duplicate key error, try to find the conversation again
        if (error.code === 11000) {
          this.logger.warn('Duplicate key error, attempting to find existing conversation...');
          conversation = await this.conversationModel.findOne({
            type: 'direct',
            participant_ids: participantIds,
          }).exec();

          if (!conversation) {
            // Log all conversations to debug
            const allConvs = await this.conversationModel.find({ type: 'direct' }).exec();
            this.logger.error(`All direct conversations: ${JSON.stringify(allConvs.map(c => ({ id: c._id, participants: c.participant_ids })))}`);
            this.logger.error(`Looking for: ${JSON.stringify(participantIds)}`);
            this.logger.error(`Duplicate key error details: ${JSON.stringify(error.keyValue)}`);
            throw new Error('Database inconsistency detected. Please contact support.');
          } else {
            this.logger.log(`Found conversation after duplicate key error: ${conversation._id}`);
          }
        } else {
          throw error;
        }
      }
    } else {
      this.logger.log(`Found existing conversation: ${conversation._id}`);
    }

    return conversation;
  }

  async ensureConversation(currentUserId: string, recipientId: string): Promise<any> {
    const conversation = await this.createOrGetDirectConversation(currentUserId, recipientId);

    // Get user's contacts for name resolution
    const contacts = await this.contactService.getContacts(currentUserId);

    // Get participants details
    const participants = await Promise.all(
      conversation.participant_ids.map(async (id) => {
        const user = await this.userService.findById(id);
        const contact = contacts.find((c: any) => c.id.toString() === id.toString());
        return {
          id: user?._id.toString(),
          username: user?.username,
          full_name: user?.full_name,
          contact_name: contact?.contact_name,
          avatarUrl: user?.avatar_url,
        };
      })
    );

    // Get last message
    let lastMessage = null;
    if (conversation.last_message_at) {
      const msg = await this.messageModel
        .findOne({ conversation_id: conversation._id })
        .sort({ created_at: -1 })
        .exec();
      if (msg) {
        lastMessage = {
          id: msg._id,
          content: msg.text,
          createdAt: msg.created_at,
          senderId: msg.sender_id,
          status: msg.status
        };
      }
    }

    // Automatically mark messages as read when user opens/ensures conversation
    // This handles the case when user opens chat from conversation list
    try {
      await this.markMessagesAsRead(conversation._id.toString(), currentUserId);
    } catch (error) {
      // Log error but don't fail the request
      this.logger.warn(`Failed to auto-mark messages as read in ensureConversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      id: conversation._id,
      isGroup: conversation.type === 'group',
      participants,
      lastMessage
    };
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    payload: { type: string; text?: string; content?: string; media?: any; message_id?: string },
  ): Promise<MessageDocument> {
    // ... existing implementation ...
    try {
      this.logger.log(`Creating message: conversationId=${conversationId}, senderId=${senderId}, type=${payload.type}`);

      // Get conversation to find the recipient
      const conversation = await this.conversationModel.findById(conversationId).exec();
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Find recipient (the other participant)
      const recipientId = conversation.participant_ids.find(id => id !== senderId);

      if (recipientId) {
        // Check block status in both directions
        const blockStatus = await this.blockService.getBlockStatus(senderId, recipientId);

        if (!blockStatus.canMessage) {
          this.logger.warn(`Message blocked: senderId=${senderId}, recipientId=${recipientId}, iBlocked=${blockStatus.iBlocked}, theyBlocked=${blockStatus.theyBlocked}`);
          throw new ForbiddenException('Cannot send message due to block status');
        }
      }

      // Generate message_id if not provided (idempotency: client can provide to prevent duplicates)
      const messageId = payload.message_id || generateUlid();
      const serverTs = new Date();

      const messageData: any = {
        message_id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        server_ts: serverTs,
        type: payload.type,
        status: 'sent', // DEPRECATED: Status is computed from receipts
        sent_at: serverTs,
      };

      // Handle both 'content' and 'text' fields for backward compatibility
      const messageText = payload.text || payload.content || '';
      if (messageText) {
        messageData.text = messageText;
      }

      if (payload.media) {
        messageData.media = payload.media;
      }

      // Idempotency: upsert by message_id (if client provides same message_id, return existing)
      this.logger.debug(`Creating message with message_id: ${messageId}`);
      let message = await this.messageModel.findOne({ message_id: messageId }).exec();
      
      if (message) {
        this.logger.debug(`Message with message_id ${messageId} already exists (idempotent)`);
        return message;
      }

      message = await this.messageModel.create(messageData);
      this.logger.debug(`Message created with message_id: ${messageId}, _id: ${message._id}`);

      // Immediately publish to MQTT BEFORE updating conversation for real-time delivery
      // This ensures message arrives instantly to recipient without waiting for conversation update
      // QoS 1 ensures guaranteed delivery to recipient
      // Also publish to sender for real-time update in their own chat detail
      const messagePayload = {
        type: 'message',
        message_id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        server_ts: serverTs.toISOString(),
        payload: {
          text: messageText,
          media: payload.media,
        },
      };

      // Publish to all conversation members (for multi-device support)
      // For 1-1: recipient + sender
      // For group: all members
      const membersToNotify = conversation.participant_ids;

      for (const memberId of membersToNotify) {
        const topic = `chat/v1/users/${memberId}/messages`;
        this.mqttService.publishAsync(topic, messagePayload).catch((error) => {
          this.logger.error(`Failed to publish message to ${topic}:`, error);
        });
        this.logger.debug(`Published new message to ${topic}`);
      }

      // Update conversation (this can happen in parallel, doesn't block MQTT)
      this.logger.debug('Updating conversation...');
      await this.conversationModel.findByIdAndUpdate(conversationId, {
        last_message_at: new Date(),
        last_message_preview: messageText || '[Media]',
      }).exec();

      // Also publish conversation update for real-time list update
      if (conversation && recipientId) {
        // Count unread messages for recipient using watermark receipts (accurate)
        const recipientReceipt = await this.receiptService.getReceiptForUser(conversationId, recipientId);
        let unreadCount = 0;
        
        if (recipientReceipt && recipientReceipt.last_read_message_id) {
          // If recipient has read some messages, count messages after last_read_message_id
          const lastReadMessage = await this.messageModel
            .findOne({ message_id: recipientReceipt.last_read_message_id })
            .exec();
          
          if (lastReadMessage) {
            // Count messages sent by sender after the last read message (including this new message)
            unreadCount = await this.messageModel.countDocuments({
              conversation_id: conversationId,
              sender_id: senderId,
              server_ts: { $gt: lastReadMessage.server_ts },
            }).exec();
          } else {
            // If last_read_message_id not found, count all messages from sender (fallback)
            unreadCount = await this.messageModel.countDocuments({
              conversation_id: conversationId,
              sender_id: senderId,
            }).exec();
          }
        } else {
          // No receipt yet, count all messages from sender as unread (including this new message)
          unreadCount = await this.messageModel.countDocuments({
            conversation_id: conversationId,
            sender_id: senderId,
          }).exec();
        }

        this.mqttService.publishAsync(`chat/v1/users/${recipientId}/conversations`, {
          conversation_id: conversationId,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText || '[Media]',
          last_message_sender_id: senderId,
          unread_count: unreadCount, // Accurate unread count using watermark receipts
          action: 'updated',
        }).catch((error) => {
          this.logger.error(`Failed to publish conversation update to recipient ${recipientId}:`, error);
        });
        this.logger.debug(`Published conversation update to chat/v1/users/${recipientId}/conversations`);
      }

      // Also publish conversation update for sender (to update last_message_status)
      if (conversation && recipientId) {
        this.mqttService.publishAsync(`chat/v1/users/${senderId}/conversations`, {
          conversation_id: conversationId,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageText || '[Media]',
          last_message_sender_id: senderId,
          last_message_status: 'sent', // Initial status when message is sent
          action: 'updated',
        }).catch((error) => {
          this.logger.error(`Failed to publish conversation update to sender ${senderId}:`, error);
        });
        this.logger.debug(`Published conversation update to chat/v1/users/${senderId}/conversations`);
      }

      this.logger.log(`Message created successfully: ${message._id}`);
      return message;
    } catch (error: any) {
      this.logger.error(`Error creating message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getConversations(userId: string): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({ participant_ids: userId })
      .sort({ last_message_at: -1 })
      .exec();

    // Fetch user's contacts once
    const contacts = await this.contactService.getContacts(userId);

    // Fetch contact information for each conversation
    const conversationsWithContacts = await Promise.all(
      conversations.map(async (conv) => {
        // Get the other participant's ID (the contact)
        const contactId = conv.participant_ids.find(id => id !== userId);

        let contactName = null;
        let contactUsername = null;
        let contactAvatarUrl = null;
        let contactFullName = null;
        let isContact = false;
        let iBlockedThem = false;
        let theyBlockedMe = false;

        // Get last message for this conversation
        const lastMessage = await this.messageModel
          .findOne({ conversation_id: conv._id.toString() })
          .sort({ server_ts: -1 })
          .exec();

        // Get last message sender ID
        const lastMessageSenderId = lastMessage?.sender_id?.toString() || null;
        const isLastMessageFromMe = lastMessageSenderId === userId;

        // Get computed status for last message if it's from current user
        let lastMessageStatus = null;
        if (isLastMessageFromMe && lastMessage) {
          const statusResult = await this.receiptService.computeMessageStatus(
            conv._id.toString(),
            lastMessage.message_id,
            userId,
            conv.type,
          );
          lastMessageStatus = statusResult.status;
        }

        // Count unread messages using watermark receipts (more accurate)
        // Get receipt watermark for current user
        const userReceipt = await this.receiptService.getReceiptForUser(conv._id.toString(), userId);
        
        let unreadCount = 0;
        if (userReceipt && userReceipt.last_read_message_id) {
          // If user has read some messages, count messages after last_read_message_id
          const lastReadMessage = await this.messageModel
            .findOne({ message_id: userReceipt.last_read_message_id })
            .exec();
          
          if (lastReadMessage) {
            // Count messages sent by others after the last read message
            unreadCount = await this.messageModel.countDocuments({
              conversation_id: conv._id.toString(),
              sender_id: { $ne: userId },
              server_ts: { $gt: lastReadMessage.server_ts },
            }).exec();
          } else {
            // If last_read_message_id not found, count all unread (fallback)
            unreadCount = await this.messageModel.countDocuments({
              conversation_id: conv._id.toString(),
              sender_id: { $ne: userId },
            }).exec();
          }
        } else {
          // No receipt yet, count all messages from others as unread
          unreadCount = await this.messageModel.countDocuments({
            conversation_id: conv._id.toString(),
            sender_id: { $ne: userId },
          }).exec();
        }

        if (contactId) {
          const user = await this.userService.findById(contactId);
          // Check if this user is in contacts
          const contact = contacts.find((c: any) => c.id.toString() === contactId);

          if (user) {
            contactFullName = user.full_name;
            contactUsername = user.username;
            contactAvatarUrl = user.avatar_url;

            // Use contact name if available, otherwise fallback to full name or username
            contactName = contact?.contact_name;
          }

          if (contact) {
            isContact = true;
          }

          // Get block status
          const blockStatus = await this.blockService.getBlockStatus(userId, contactId);
          iBlockedThem = blockStatus.iBlocked;
          theyBlockedMe = blockStatus.theyBlocked;
        }

        return {
          id: conv._id,
          type: conv.type,
          participant_ids: conv.participant_ids,
          contact: {
            id: contactId,
            name: contactName || contactFullName || contactUsername, // Display name priority: Contact Name -> Full Name -> Username
            contact_name: contactName, // Specific contact name field
            full_name: contactFullName, // Original full name
            username: contactUsername,
            avatar_url: this.urlNormalizer.normalizeUrl(contactAvatarUrl),
          },
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview,
          last_message_sender_id: lastMessageSenderId,
          // If last message is from current user, show status (sent, delivered, read)
          // If last message is from contact, show unread count
          ...(isLastMessageFromMe ? {
            last_message_status: lastMessageStatus, // sent, delivered, or read
          } : {
            unread_count: unreadCount, // Number of unread messages
          }),
          // Only include relationship field if is_contact is false
          ...(!isContact ? {
            relationship: {
              is_contact: isContact,
              i_blocked_them: iBlockedThem,
              they_blocked_me: theyBlockedMe,
              can_message: !iBlockedThem && !theyBlockedMe,
            },
          } : {}),
        };
      })
    );

    return conversationsWithContacts;
  }

  async getMessages(conversationId: string, userId: string, limit: number = 20, before?: string): Promise<any> {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation || !conversation.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or access denied');
    }

    // Build query for pagination
    const queryFilter: any = { conversation_id: conversationId };
    
    if (before) {
      // Assuming 'before' is a message ID for cursor-based pagination
      try {
        const beforeMessage = await this.messageModel.findOne({ message_id: before }).exec();
        if (beforeMessage && beforeMessage.server_ts) {
          // Filter messages before this server_ts
          queryFilter.server_ts = { $lt: beforeMessage.server_ts };
        }
      } catch (e) {
        // Ignore invalid ID for before param
      }
    }

    const messages = await this.messageModel
      .find(queryFilter)
      .sort({ server_ts: -1 }) // Use server_ts for ordering (consistent with message ordering)
      .limit(limit + 1) // Fetch one extra to check if there are more messages
      .exec();

    // Check if there are more messages
    const hasMore = messages.length > limit;
    const messagesToReturn = hasMore ? messages.slice(0, limit) : messages;

    // Automatically mark messages as read when user opens/views the chat
    // Only mark as read if this is the first page (no 'before' parameter)
    // This prevents marking old messages as read when paginating
    // IMPORTANT: This ensures real-time mark as read every time user views the latest messages
    if (!before && messagesToReturn.length > 0) {
      try {
        // Mark as read immediately - this will trigger MQTT publish for real-time updates
        // Use the latest message_id as watermark
        const latestMessage = messagesToReturn[0]; // Already sorted by server_ts desc
        await this.markMessagesAsRead(conversationId, userId, latestMessage.message_id);
        this.logger.debug(`Auto-marked messages as read for conversationId=${conversationId}, userId=${userId}`);
      } catch (error) {
        // Log error but don't fail the request
        this.logger.warn(`Failed to auto-mark messages as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Conversation already fetched at the beginning, reuse it for status computation

    // Compute status for each message if it's outgoing (sent by current user)
    const messagesWithStatus = await Promise.all(
      messagesToReturn.map(async (msg) => {
        const isOutgoing = msg.sender_id === userId;
        
        let computedStatus: any = {
          status: 'sent' as const,
        };

        if (isOutgoing) {
          // Compute status from receipts
          computedStatus = await this.receiptService.computeMessageStatus(
            conversationId,
            msg.message_id,
            userId,
            conversation.type,
          );
        }

        return {
          id: msg._id,
          message_id: msg.message_id,
          text: msg.text,
          sender_id: msg.sender_id,
          type: msg.type,
          media: msg.media,
          status: computedStatus.status, // Computed status, not stored status
          ...(conversation.type === 'group' && isOutgoing && 'delivered_count' in computedStatus
            ? {
                delivered_count: computedStatus.delivered_count,
                read_count: computedStatus.read_count,
                member_count_excluding_sender: computedStatus.member_count_excluding_sender,
                is_fully_delivered: computedStatus.is_fully_delivered,
                is_fully_read: computedStatus.is_fully_read,
              }
            : {}),
          sent_at: msg.sent_at,
          delivered_at: msg.delivered_at,
          read_at: msg.read_at,
          server_ts: msg.server_ts,
          created_at: msg.created_at,
        };
      })
    );

    // Get relationship info (only for direct conversations and only if is_contact = false)
    let relationship: any = undefined;
    if (conversation.type === 'direct') {
      const contactId = conversation.participant_ids.find(id => id !== userId);
      if (contactId) {
        const contacts = await this.contactService.getContacts(userId);
        const contact = contacts.find((c: any) => c.id.toString() === contactId);
        const isContact = !!contact;

        // Only include relationship if is_contact is false
        if (!isContact) {
          const blockStatus = await this.blockService.getBlockStatus(userId, contactId);
          relationship = {
            is_contact: false,
            i_blocked_them: blockStatus.iBlocked,
            they_blocked_me: blockStatus.theyBlocked,
            can_message: !blockStatus.iBlocked && !blockStatus.theyBlocked,
          };
        }
      }
    }

    // Get next_cursor (message_id of the last message if there are more)
    const nextCursor = hasMore && messagesToReturn.length > 0 
      ? messagesToReturn[messagesToReturn.length - 1].message_id 
      : undefined;

    return {
      messages: messagesWithStatus,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
      has_more: hasMore,
      ...(relationship ? { relationship } : {}),
    };
  }

  async createPrivateCommentMessage(
    postId: string,
    postOwnerId: string,
    commenterId: string,
    commentText: string,
  ): Promise<void> {
    const conversation = await this.createOrGetDirectConversation(postOwnerId, commenterId);

    await this.createMessage(conversation._id.toString(), commenterId, {
      type: 'text',
      text: `Comment on post ${postId}: ${commentText}`,
    });
  }

  async markMessagesAsRead(
    conversationId: string,
    userId: string,
    lastReadMessageId?: string,
  ): Promise<void> {
    // Verify user is participant
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation || !conversation.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or access denied');
    }

    // If lastReadMessageId is provided, use watermark-based approach
    if (lastReadMessageId) {
      await this.receiptService.processReadUpTo(conversationId, userId, lastReadMessageId);
      this.logger.log(`Marked messages as read (watermark): conversationId=${conversationId}, userId=${userId}, lastReadMessageId=${lastReadMessageId}`);
      return;
    }

    // Legacy approach: find last message and use watermark
    const lastMessage = await this.messageModel
      .findOne({ conversation_id: conversationId, sender_id: { $ne: userId } })
      .sort({ server_ts: -1 })
      .exec();

    if (lastMessage) {
      await this.receiptService.processReadUpTo(conversationId, userId, lastMessage.message_id);
      this.logger.log(`Marked messages as read (auto): conversationId=${conversationId}, userId=${userId}, lastMessageId=${lastMessage.message_id}`);
    }
    
    // Note: Receipt publishing is handled by receiptService.processReadUpTo()
    // which publishes to chat/v1/users/{uid}/receipts for all relevant users
  }
}

