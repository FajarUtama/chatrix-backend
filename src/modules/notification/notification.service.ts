import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FcmService } from '../../infrastructure/fcm/fcm.service';
import { DeviceToken, DeviceTokenDocument } from '../auth/schemas/device-token.schema';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private fcmService: FcmService,
    @InjectModel(DeviceToken.name) private deviceTokenModel: Model<DeviceTokenDocument>,
  ) {}

  async sendChatMessageNotification(toUserId: string, payload: { title: string; body: string; data?: any }): Promise<void> {
    try {
      this.logger.debug(`Sending chat notification to user: ${toUserId}`);
      
      const tokens = await this.deviceTokenModel.find({ user_id: toUserId }).exec();
      this.logger.debug(`Found ${tokens.length} device token(s) for user ${toUserId}`);
      
      const fcmTokens = tokens.map(t => t.fcm_token).filter(Boolean);
      
      if (fcmTokens.length === 0) {
        this.logger.warn(`⚠️ No FCM tokens found for user ${toUserId}. Notification will not be sent.`);
        this.logger.warn(`   User needs to register device token via POST /auth/device-token`);
        return;
      }

      this.logger.log(`📤 Sending notification to ${fcmTokens.length} device(s) for user ${toUserId}`);
      this.logger.debug(`   Title: ${payload.title}`);
      this.logger.debug(`   Body: ${payload.body}`);
      
      await this.fcmService.sendNotification(fcmTokens, payload);
      
      this.logger.log(`✅ Notification sent successfully to user ${toUserId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send chat notification to user ${toUserId}:`, error);
      // Don't throw - notification failure shouldn't break message creation
    }
  }

  async sendLikeNotification(toUserId: string, payload: { title: string; body: string; data?: any }): Promise<void> {
    const tokens = await this.deviceTokenModel.find({ user_id: toUserId }).exec();
    const fcmTokens = tokens.map(t => t.fcm_token).filter(Boolean);

    if (fcmTokens.length > 0) {
      await this.fcmService.sendNotification(fcmTokens, payload);
    }
  }

  async sendCommentNotification(toUserId: string, payload: { title: string; body: string; data?: any }): Promise<void> {
    const tokens = await this.deviceTokenModel.find({ user_id: toUserId }).exec();
    const fcmTokens = tokens.map(t => t.fcm_token).filter(Boolean);

    if (fcmTokens.length > 0) {
      await this.fcmService.sendNotification(fcmTokens, payload);
    }
  }

  async sendFollowNotification(toUserId: string, payload: { title: string; body: string; data?: any }): Promise<void> {
    const tokens = await this.deviceTokenModel.find({ user_id: toUserId }).exec();
    const fcmTokens = tokens.map(t => t.fcm_token).filter(Boolean);

    if (fcmTokens.length > 0) {
      await this.fcmService.sendNotification(fcmTokens, payload);
    }
  }
}

