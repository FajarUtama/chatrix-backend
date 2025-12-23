import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostLikeDocument = PostLike & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class PostLike {
  @Prop({ required: true, index: true })
  post_id!: string;

  @Prop({ required: true, index: true })
  user_id!: string;

  created_at?: Date;
  updated_at?: Date;
}

export const PostLikeSchema = SchemaFactory.createForClass(PostLike);

PostLikeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });
PostLikeSchema.index({ user_id: 1, created_at: -1 });

