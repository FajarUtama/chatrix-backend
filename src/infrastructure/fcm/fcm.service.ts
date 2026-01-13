import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor(private firebaseService: FirebaseService) {}

  async sendNotification(
    to: string | string[],
    payload: { title: string; body: string; data?: Record<string, any> },
  ): Promise<void> {
    const status = this.firebaseService.getStatus();
    if (!status.messagingAvailable) {
      this.logger.warn('FCM not initialized, skipping notification');
      return;
    }

    try {
      const messaging = this.firebaseService.getMessaging();
      const tokens = Array.isArray(to) ? to : [to];
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        tokens: tokens.filter(token => token && token.length > 0),
      };

      const response = await messaging.sendEachForMulticast(message);
      this.logger.log(`Sent ${response.successCount} notifications, ${response.failureCount} failed`);

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
          }
        });
      }
    } catch (error) {
      this.logger.error('Error sending FCM notification:', error);
      throw error;
    }
  }

  private stringifyData(data: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }
}

