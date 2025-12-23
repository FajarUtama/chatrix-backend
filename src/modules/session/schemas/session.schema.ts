import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Session {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ required: true, index: true })
  device_id!: string;

  @Prop({ required: true })
  refresh_token_hash!: string;

  @Prop()
  user_agent?: string;

  @Prop({ required: true, index: true })
  expires_at!: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ user_id: 1, device_id: 1 }, { unique: true });

