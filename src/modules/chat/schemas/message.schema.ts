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
  @Prop({ required: true, index: true, type: String })
  conversation_id!: string;

  @Prop({ required: true, index: true, type: String })
  sender_id!: string;

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

  @Prop({ type: [String], default: [] })
  delivered_to!: string[];

  @Prop({ type: [String], default: [] })
  read_by!: string[];

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

MessageSchema.index({ conversation_id: 1, created_at: 1 });
MessageSchema.index({ sender_id: 1, created_at: -1 });

