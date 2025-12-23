import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BlockDocument = Block & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Block {
    @Prop({ required: true, index: true })
    blocker_id!: string;

    @Prop({ required: true, index: true })
    blocked_id!: string;

    created_at?: Date;
    updated_at?: Date;
}

export const BlockSchema = SchemaFactory.createForClass(Block);

// Unique compound index to prevent duplicate blocks
BlockSchema.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });
