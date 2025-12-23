import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { DeviceToken, DeviceTokenSchema } from '../auth/schemas/device-token.schema';
import { FcmModule } from '../../infrastructure/fcm/fcm.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeviceToken.name, schema: DeviceTokenSchema }]),
    FcmModule,
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

