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
      // Check if Firebase is already initialized
      if (admin.apps.length > 0) {
        this.app = admin.app();
        this.logger.log('Firebase Admin already initialized, using existing app');
        return;
      }

      // Try to get service account from environment variable first (as JSON string)
      const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson) {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson);
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log('✅ Firebase Admin initialized from FCM_SERVICE_ACCOUNT_JSON environment variable');
          return;
        } catch (parseError) {
          this.logger.error('Failed to parse FCM_SERVICE_ACCOUNT_JSON:', parseError);
        }
      }

      // Fallback to file path
      const serviceAccountPath = this.configService.fcmServiceAccountPath;
      
      // Resolve absolute path
      const absolutePath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);

      this.logger.log(`Looking for Firebase service account at: ${absolutePath}`);

      if (fs.existsSync(absolutePath)) {
        // Read and parse service account file
        const serviceAccount = require(absolutePath);

        // Initialize Firebase Admin
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        this.logger.log('✅ Firebase Admin initialized successfully');
        this.logger.log(`   Service Account: ${absolutePath}`);
        this.logger.log(`   Project ID: ${serviceAccount.project_id || 'N/A'}`);
      } else {
        this.logger.warn(`⚠️ FCM service account file not found at ${absolutePath}`);
        this.logger.warn('   FCM features will be disabled.');
        this.logger.warn('   To enable FCM:');
        this.logger.warn('   1. Download service account key from Firebase Console');
        this.logger.warn('   2. Save it as firebase-service-account.json in project root');
        this.logger.warn('   3. Or set FCM_SERVICE_ACCOUNT_JSON environment variable');
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize Firebase Admin:', error);
      this.logger.error('   FCM notifications will not work until this is fixed.');
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

