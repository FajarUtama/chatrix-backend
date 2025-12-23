import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StoryViewDocument = StoryView & Document;

@Schema({ timestamps: { createdAt: 'viewed_at', updatedAt: false } })
export class StoryView {
    @Prop({ type: String, required: true, index: true })
    story_id!: string;

    @Prop({ type: String, required: true, index: true })
    viewer_id!: string;

    @Prop({ type: Date })
    viewed_at?: Date;
}

export const StoryViewSchema = SchemaFactory.createForClass(StoryView);

// Compound index for fast lookups
StoryViewSchema.index({ story_id: 1, viewer_id: 1 }, { unique: true });
