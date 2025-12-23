import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { UserService } from '../user/user.service';
import { BlockService } from '../block/block.service';
import { ContactService } from '../contact/contact.service';

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
    payload: { type: string; text?: string; content?: string; media?: any },
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

      const messageData: any = {
        conversation_id: conversationId,
        sender_id: senderId,
        type: payload.type,
        status: 'sent',
        sent_at: new Date(),
      };

      // Handle both 'content' and 'text' fields for backward compatibility
      const messageText = payload.text || payload.content || '';
      if (messageText) {
        messageData.text = messageText;
      }

      if (payload.media) {
        messageData.media = payload.media;
      }

      this.logger.debug('Creating message document...');
      const message = await this.messageModel.create(messageData);
      this.logger.debug(`Message created with ID: ${message._id}`);

      // Update conversation
      this.logger.debug('Updating conversation...');
      await this.conversationModel.findByIdAndUpdate(conversationId, {
        last_message_at: new Date(),
        last_message_preview: messageText || '[Media]',
      }).exec();

      // Publish to MQTT
      this.logger.debug('Publishing to MQTT...');
      if (conversation && recipientId) {
        this.mqttService.publish(`chat/${recipientId}/messages`, {
          conversation_id: conversationId,
          message: {
            id: message._id,
            sender_id: senderId,
            type: payload.type,
            text: messageText,
            media: payload.media,
            status: message.status,
            created_at: message.created_at,
          },
        });
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
            avatar_url: contactAvatarUrl,
          },
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview,
          relationship: {
            is_contact: isContact,
            i_blocked_them: iBlockedThem,
            they_blocked_me: theyBlockedMe,
            can_message: !iBlockedThem && !theyBlockedMe,
          },
        };
      })
    );

    return conversationsWithContacts;
  }

  async getMessages(conversationId: string, userId: string, limit: number = 20, before?: string): Promise<any[]> {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation || !conversation.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or access denied');
    }

    const query = this.messageModel
      .find({ conversation_id: conversationId })
      .sort({ created_at: -1 });

    if (before) {
      // Assuming 'before' is a message ID for cursor-based pagination
      try {
        const beforeMessage = await this.messageModel.findById(before).exec();
        if (beforeMessage && beforeMessage.created_at) {
          query.where('created_at').lt(beforeMessage.created_at.getTime() as any);
        }
      } catch (e) {
        // Ignore invalid ID for before param
      }
    }

    const messages = await query.limit(limit).exec();

    return messages.map(msg => ({
      id: msg._id,
      text: msg.text,
      sender_id: msg.sender_id,
      type: msg.type,
      media: msg.media,
      status: msg.status,
      sent_at: msg.sent_at,
      delivered_at: msg.delivered_at,
      read_at: msg.read_at,
      created_at: msg.created_at,
    }));
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

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    // Verify user is participant
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation || !conversation.participant_ids.includes(userId)) {
      throw new Error('Conversation not found or access denied');
    }

    // Update all unread messages from other participants
    const now = new Date();
    await this.messageModel.updateMany(
      {
        conversation_id: conversationId,
        sender_id: { $ne: userId }, // Not sent by current user
        status: { $in: ['sent', 'delivered'] } // Only update if not already read
      },
      {
        $set: {
          status: 'read',
          read_at: now
        },
        $addToSet: { read_by: userId }
      }
    ).exec();

    this.logger.log(`Marked messages as read: conversationId=${conversationId}, userId=${userId}`);
  }
}

