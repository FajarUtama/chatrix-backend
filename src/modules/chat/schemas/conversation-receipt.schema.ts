import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationReceiptDocument = ConversationReceipt & Document;

/**
 * Watermark-based receipt tracking per user per conversation
 * Tracks last_delivered_message_id and last_read_message_id
 * 
 * This is more efficient than per-message receipts, especially for group chats.
 * 
 * Example:
 * - User uB in conversation conv_123 has read up to message_id "01HZ...ABC"
 * - This means uB has read ALL messages up to and including "01HZ...ABC"
 */
@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class ConversationReceipt {
  @Prop({ required: true, index: true, type: String })
  conversation_id!: string;

  @Prop({ required: true, index: true, type: String })
  user_id!: string;

  /**
   * Last message ID that has been delivered to this user
   * All messages up to and including this ID are considered delivered
   * null if no messages have been delivered yet
   */
  @Prop({ type: String, default: null })
  last_delivered_message_id?: string | null;

  /**
   * Last message ID that has been read by this user
   * All messages up to and including this ID are considered read
   * null if no messages have been read yet
   */
  @Prop({ type: String, default: null })
  last_read_message_id?: string | null;

  /**
   * Timestamp when last_delivered_message_id was updated
   */
  @Prop({ type: Date })
  last_delivered_at?: Date;

  /**
   * Timestamp when last_read_message_id was updated
   */
  @Prop({ type: Date })
  last_read_at?: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const ConversationReceiptSchema = SchemaFactory.createForClass(ConversationReceipt);

// Unique index: one receipt record per user per conversation
ConversationReceiptSchema.index(
  { conversation_id: 1, user_id: 1 },
  { unique: true }
);

// Index for querying all receipts for a conversation (for status computation)
ConversationReceiptSchema.index({ conversation_id: 1 });

// Index for querying all receipts for a user (optional, for admin queries)
ConversationReceiptSchema.index({ user_id: 1, updated_at: -1 });

