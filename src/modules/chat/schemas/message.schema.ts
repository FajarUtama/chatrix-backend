import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

export interface MessageMedia {
  url: string;
  type: string;
  file_name?: string;
  size?: number;
  thumb_url?: string;
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Message {
  /**
   * Unique message ID (ULID/UUID) for idempotency
   * Can be client-generated or server-generated
   */
  @Prop({ required: true, unique: true, index: true, type: String })
  message_id!: string;

  @Prop({ required: true, index: true, type: String })
  conversation_id!: string;

  @Prop({ required: true, index: true, type: String })
  sender_id!: string;

  /**
   * Server timestamp when message was received/stored
   * Used for ordering messages
   */
  @Prop({ required: true, type: Date, index: true })
  server_ts!: Date;

  @Prop({
    required: true,
    type: String,
    enum: ['text', 'image', 'video', 'file', 'voice', 'system'],
  })
  type!: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';

  @Prop({ type: String })
  text?: string;

  @Prop({
    type: {
      url: String,
      type: String,
      file_name: String,
      size: Number,
      thumb_url: String,
    },
  })
  media?: MessageMedia;

  @Prop()
  reply_to_message_id?: string;

  /**
   * DEPRECATED: Use conversation_receipts watermark instead
   * Kept for backward compatibility, but status is computed from receipts
   */
  @Prop({ type: [String], default: [] })
  delivered_to!: string[];

  @Prop({ type: [String], default: [] })
  read_by!: string[];

  /**
   * DEPRECATED: Status is now computed from conversation_receipts
   * Kept for backward compatibility, defaults to 'sent'
   * Computed status should be returned in API response, not stored
   */
  @Prop({
    type: String,
    enum: ['pending', 'failed', 'sent', 'delivered', 'read'],
    default: 'sent'
  })
  status!: 'pending' | 'failed' | 'sent' | 'delivered' | 'read';

  @Prop({ type: Date })
  sent_at?: Date;

  @Prop({ type: Date })
  delivered_at?: Date;

  @Prop({ type: Date })
  read_at?: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Unique index on message_id for idempotency
MessageSchema.index({ message_id: 1 }, { unique: true });

// Index for querying messages in conversation (ordered by server_ts)
MessageSchema.index({ conversation_id: 1, server_ts: -1 });

// Index for querying messages by conversation and message_id (for ordering if ULID)
MessageSchema.index({ conversation_id: 1, message_id: 1 });

// Index for querying messages by sender
MessageSchema.index({ sender_id: 1, server_ts: -1 });

