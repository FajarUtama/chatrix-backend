import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactDocument = Contact & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Contact {
  @Prop({ required: true, index: true })
  owner_id!: string;

  @Prop({ required: true, index: true })
  contact_user_id!: string;

  @Prop({
    required: true,
    enum: ['phone_sync', 'manual_add', 'follow_add'],
  })
  source!: 'phone_sync' | 'manual_add' | 'follow_add';

  @Prop({
    required: true,
    enum: ['phone', 'username', 'email'],
    default: 'phone'
  })
  contact_type!: 'phone' | 'username' | 'email';

  @Prop({ required: false })
  contact_name?: string;

  created_at?: Date;
  updated_at?: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

ContactSchema.index({ owner_id: 1, contact_user_id: 1 }, { unique: true });

