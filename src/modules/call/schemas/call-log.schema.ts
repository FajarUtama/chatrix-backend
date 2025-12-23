import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CallLogDocument = CallLog & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class CallLog {
  @Prop({ required: true, index: true })
  caller_id!: string;

  @Prop({ required: true, index: true })
  callee_id!: string;

  @Prop({
    required: true,
    enum: ['voice', 'video'],
  })
  type!: 'voice' | 'video';

  @Prop()
  started_at?: Date;

  @Prop()
  ended_at?: Date;

  @Prop({
    required: true,
    enum: ['ringing', 'answered', 'missed', 'rejected', 'failed'],
    default: 'ringing',
  })
  status!: 'ringing' | 'answered' | 'missed' | 'rejected' | 'failed';

  created_at?: Date;
  updated_at?: Date;
}

export const CallLogSchema = SchemaFactory.createForClass(CallLog);

CallLogSchema.index({ caller_id: 1, created_at: -1 });
CallLogSchema.index({ callee_id: 1, created_at: -1 });

