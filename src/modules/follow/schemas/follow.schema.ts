import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FollowDocument = Follow & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Follow {
  @Prop({ required: true, index: true })
  follower_id!: string;

  @Prop({ required: true, index: true })
  following_id!: string;

  created_at?: Date;
  updated_at?: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

FollowSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

