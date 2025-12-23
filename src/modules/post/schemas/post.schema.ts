// In post.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

class Media {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ 
    type: String, 
    enum: ['image', 'video'],
    required: true 
  })
  type!: 'image' | 'video';
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Post extends Document {
  @Prop({ required: true, type: String })
  user_id!: string;

  @Prop({ type: Media, required: true })
  media!: Media;

  @Prop({ type: String, required: true })
  media_key!: string;

  @Prop({ type: String, default: '' })
  caption!: string;

  @Prop({
    type: String,
    enum: ['public', 'followers', 'following', 'contacts'],
    default: 'public'
  })
  visibility!: 'public' | 'followers' | 'following' | 'contacts';

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: String, default: null })
  location!: string;

  @Prop({ type: Number, default: 0 })
  like_count!: number;

  @Prop({ type: Number, default: 0 })
  comment_count!: number;

  @Prop({ type: Date, default: null })
  expires_at!: Date;

  @Prop({ type: Date })
  created_at?: Date;

  @Prop({ type: Date })
  updated_at?: Date;
}

export type PostDocument = Post & Document;

export const PostSchema = SchemaFactory.createForClass(Post);

// Add TTL index for expired posts
PostSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Add any additional validation if needed
PostSchema.pre('validate', function(next) {
  // Additional validation logic can be added here if needed
  next();
});