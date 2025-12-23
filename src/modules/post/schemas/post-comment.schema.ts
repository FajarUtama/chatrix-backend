import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostCommentDocument = PostComment & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class PostComment {
  @Prop({ required: true, index: true })
  post_id!: string;

  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ required: true })
  text!: string;

  @Prop({
    required: true,
    enum: ['public', 'private'],
    default: 'public',
  })
  type!: 'public' | 'private';

  created_at?: Date;
  updated_at?: Date;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

PostCommentSchema.index({ post_id: 1, created_at: 1 });
PostCommentSchema.index({ user_id: 1, created_at: -1 });

