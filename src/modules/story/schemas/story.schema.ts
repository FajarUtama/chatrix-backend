import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoryDocument = Story & Document;

export interface StoryMedia {
  url: string;
  thumb_url?: string;
  type: 'image' | 'video';
  duration?: number;
}

class StoryMediaSchema {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String })
  thumb_url?: string;

  @Prop({ type: String, enum: ['image', 'video'], required: true })
  type!: 'image' | 'video';

  @Prop({ type: Number })
  duration?: number;
}

export interface IStoryMedia {
  url: string;
  thumb_url?: string;
  type: 'image' | 'video';
  duration?: number;
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Story {
  @Prop({ type: String, required: true })
  user_id!: string;

  @Prop({ type: String })
  username!: string;

  @Prop({ type: StoryMediaSchema, required: true })
  media!: IStoryMedia;

  @Prop({ type: String })
  media_key!: string;

  @Prop({ type: String, default: '' })
  caption!: string;

  @Prop({
    type: String,
    enum: ['public', 'followers', 'following', 'contacts'],
    default: 'public'
  })
  visibility!: 'public' | 'followers' | 'following' | 'contacts';

  @Prop({ type: Date, required: true })
  expires_at!: Date;

  @Prop({ type: Date })
  created_at?: Date;

  @Prop({ type: Date })
  updated_at?: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);

// Add indexes
StorySchema.index({ user_id: 1, expires_at: 1 });
StorySchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

