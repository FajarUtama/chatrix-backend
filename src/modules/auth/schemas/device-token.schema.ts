import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceTokenDocument = DeviceToken & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class DeviceToken {
  @Prop({ required: true, index: true })
  user_id!: string;

  @Prop({ required: true, index: true })
  device_id!: string;

  @Prop({ required: true })
  fcm_token!: string;

  @Prop({
    required: true,
    enum: ['android', 'ios'],
  })
  platform!: 'android' | 'ios';

  @Prop()
  last_used_at?: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

DeviceTokenSchema.index({ user_id: 1 });
DeviceTokenSchema.index({ device_id: 1, user_id: 1 }, { unique: true });

