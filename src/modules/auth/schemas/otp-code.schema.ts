import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpCodeDocument = OtpCode & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class OtpCode {
  @Prop({ index: true })
  user_id?: string;

  @Prop({ required: true, index: true })
  phone!: string;

  @Prop()
  email?: string;

  @Prop({ required: true })
  code!: string;

  @Prop({
    required: true,
    enum: ['register', 'login', 'reset_password'],
  })
  purpose!: 'register' | 'login' | 'reset_password';

  @Prop({ required: true, index: true })
  expired_at!: Date;

  @Prop({ default: false })
  used!: boolean;

  created_at?: Date;
  updated_at?: Date;
}

export const OtpCodeSchema = SchemaFactory.createForClass(OtpCode);

OtpCodeSchema.index({ phone: 1, purpose: 1, created_at: -1 });
OtpCodeSchema.index({ expired_at: 1 }, { expireAfterSeconds: 0 });

