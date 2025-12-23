import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '../../config/config.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app!: admin.app.App;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    try {
      const serviceAccountPath = this.configService.fcmServiceAccountPath;

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        if (!admin.apps.length) {
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log('Firebase Admin initialized');
        } else {
          this.app = admin.app();
        }
      } else {
        this.logger.warn(`FCM service account file not found at ${serviceAccountPath}. FCM features will be disabled.`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin:', error);
    }
  }

  async sendNotification(
    to: string | string[],
    payload: { title: string; body: string; data?: Record<string, any> },
  ): Promise<void> {
    if (!this.app) {
      this.logger.warn('FCM not initialized, skipping notification');
      return;
    }

    try {
      const tokens = Array.isArray(to) ? to : [to];
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        tokens: tokens.filter(token => token && token.length > 0),
      };

      const response = await admin.messaging().sendEachForMulticast(message);
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

