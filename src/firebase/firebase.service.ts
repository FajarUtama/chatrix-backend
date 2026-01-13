import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ConfigService } from '../config/config.service';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.init();
  }

  async init() {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      this.initialized = true;
      this.logger.log('Firebase Admin already initialized, using existing app');
      return;
    }

    try {
      // Try Secret Manager first (for production/cloud)
      const secretName = process.env.FIREBASE_SECRET_NAME;
      if (secretName) {
        await this.initFromSecretManager(secretName);
        return;
      }

      // Fallback: Try environment variable (for local/dev)
      const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson) {
        await this.initFromEnvVar(serviceAccountJson);
        return;
      }

      // Fallback: Try file path (for local/dev)
      const serviceAccountPath = this.configService.fcmServiceAccountPath;
      await this.initFromFile(serviceAccountPath);
    } catch (error: any) {
      this.logger.error('❌ Failed to initialize Firebase Admin:', error);
      this.logger.error('   FCM notifications will not work until this is fixed.');
      this.initialized = false;
    }
  }

  private async initFromSecretManager(secretName: string) {
    try {
      this.logger.log(`Initializing Firebase from Secret Manager: ${secretName}`);
      
      const client = new SecretManagerServiceClient();
      const [version] = await client.accessSecretVersion({
        name: secretName,
      });

      const serviceAccountJson = version.payload?.data?.toString();
      if (!serviceAccountJson) {
        throw new Error('Secret version payload is empty');
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      this.logger.log('✅ Firebase initialized via Secret Manager');
      this.logger.log(`   Project ID: ${serviceAccount.project_id || 'N/A'}`);
    } catch (error: any) {
      this.logger.error('Failed to initialize from Secret Manager:', error.message);
      throw error;
    }
  }

  private async initFromEnvVar(serviceAccountJson: string) {
    try {
      this.logger.log('Initializing Firebase from environment variable');
      
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      this.logger.log('✅ Firebase initialized from FCM_SERVICE_ACCOUNT_JSON environment variable');
      this.logger.log(`   Project ID: ${serviceAccount.project_id || 'N/A'}`);
    } catch (error: any) {
      this.logger.error('Failed to parse FCM_SERVICE_ACCOUNT_JSON:', error.message);
      throw error;
    }
  }

  private async initFromFile(serviceAccountPath: string) {
    const path = require('path');
    const fs = require('fs');
    
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);

    this.logger.log(`Looking for Firebase service account at: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      this.logger.warn(`⚠️ FCM service account file not found at ${absolutePath}`);
      this.logger.warn('   FCM features will be disabled.');
      this.logger.warn('   To enable FCM:');
      this.logger.warn('   1. Set FIREBASE_SECRET_NAME for Secret Manager');
      this.logger.warn('   2. Or set FCM_SERVICE_ACCOUNT_JSON environment variable');
      this.logger.warn('   3. Or place firebase-service-account.json in project root');
      return;
    }

    try {
      const serviceAccount = require(absolutePath);

      // Validate required fields
      if (!serviceAccount.project_id) {
        throw new Error('Service account file missing project_id field');
      }
      if (!serviceAccount.private_key) {
        throw new Error('Service account file missing private_key field');
      }
      if (!serviceAccount.client_email) {
        throw new Error('Service account file missing client_email field');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      this.logger.log('✅ Firebase Admin initialized successfully');
      this.logger.log(`   Service Account: ${absolutePath}`);
      this.logger.log(`   Project ID: ${serviceAccount.project_id || 'N/A'}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to load service account file: ${absolutePath}`);
      this.logger.error(`   Error: ${error.message}`);
      throw error;
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      apps: admin.apps.length,
      messagingAvailable: admin.apps.length > 0 && this.initialized,
    };
  }

  getMessaging() {
    if (!this.initialized || admin.apps.length === 0) {
      throw new Error('Firebase not initialized');
    }
    return admin.messaging();
  }

  getApp() {
    if (!this.initialized || admin.apps.length === 0) {
      throw new Error('Firebase not initialized');
    }
    return admin.app();
  }
}
