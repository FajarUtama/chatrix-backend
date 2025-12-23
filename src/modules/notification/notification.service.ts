import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FcmService } from '../../infrastructure/fcm/fcm.service';
import { DeviceToken, DeviceTokenDocument } from '../auth/schemas/device-token.schema';

@Injectable()
export class NotificationService {
  constructor(
    private fcmService: FcmService,
    @InjectModel(DeviceToken.name) private deviceTokenModel: Model<DeviceTokenDocument>,
  ) {}

  async sendChatMessageNotification(toUserId: string, payload: { title: string; body: string; data?: any }): Promise<void> {
    const tokens = await this.deviceTokenModel.find({ user_id: toUserId }).exec();
    const fcmTokens = tokens.map(t => t.fcm_token).filter(Boolean);

    if (fcmTokens.length > 0) {
      await this.fcmService.sendNotification(fcmTokens, payload);
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

