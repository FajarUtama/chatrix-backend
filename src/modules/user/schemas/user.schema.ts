import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class User {
  @Prop({ required: true, unique: true, index: true })
  phone!: string;

  @Prop({ required: true, unique: true, index: true })
  username!: string;

  @Prop()
  full_name?: string;

  @Prop()
  avatar_url?: string;

  @Prop()
  bio?: string;

  @Prop({ unique: true, sparse: true, index: true })
  email?: string;

  @Prop({ default: false })
  email_verified?: boolean;

  @Prop()
  google_id?: string;

  @Prop({ required: true })
  password_hash!: string;

  @Prop()
  last_login_at?: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

