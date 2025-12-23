import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Conversation {
  @Prop({
    required: true,
    enum: ['direct', 'group'],
    index: true,
  })
  type!: 'direct' | 'group';

  @Prop({ required: true, type: [String], index: true })
  participant_ids!: string[];

  @Prop({ index: true })
  last_message_at?: Date;

  @Prop()
  last_message_preview?: string;

  created_at?: Date;
  updated_at?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ last_message_at: -1 });
ConversationSchema.index(
  { type: 1, participant_ids: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'direct' },
  },
);

