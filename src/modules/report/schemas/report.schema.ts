import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Report {
    @Prop({ required: true, index: true })
    reporter_id!: string;

    @Prop({ required: true, index: true })
    reported_user_id!: string;

    @Prop()
    conversation_id?: string;

    @Prop({ type: [String], default: [] })
    message_ids!: string[];

    @Prop({ required: true })
    reason!: string;

    @Prop({
        required: true,
        enum: ['open', 'reviewed', 'action_taken'],
        default: 'open',
    })
    status!: 'open' | 'reviewed' | 'action_taken';

    created_at?: Date;
    updated_at?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Indexes for efficient querying
ReportSchema.index({ reporter_id: 1, created_at: -1 });
ReportSchema.index({ reported_user_id: 1, created_at: -1 });
