import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) { }

  get port(): number {
    return parseInt(this.nestConfigService.get<string>('PORT', '3000'), 10);
  }

  get mongoUri(): string {
    return this.nestConfigService.get<string>('MONGO_URI', 'mongodb://localhost:27017/chatrix');
  }

  get jwtAccessSecret(): string {
    return this.nestConfigService.get<string>('JWT_ACCESS_SECRET', '');
  }

  get jwtRefreshSecret(): string {
    return this.nestConfigService.get<string>('JWT_REFRESH_SECRET', '');
  }

  get jwtAccessExpiresIn(): string {
    // Default: 7 days for chat app (user can open app anytime within 7 days without refresh)
    return this.nestConfigService.get<string>('JWT_ACCESS_EXPIRES_IN', '7d');
  }

  get jwtRefreshExpiresIn(): string {
    // Default: 90 days (3 months) for better UX in chat app that's not always opened
    return this.nestConfigService.get<string>('JWT_REFRESH_EXPIRES_IN', '90d');
  }

  get redisHost(): string {
    return this.nestConfigService.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return parseInt(this.nestConfigService.get<string>('REDIS_PORT', '6379'), 10);
  }

  get mqttUrl(): string {
    return this.nestConfigService.get<string>('MQTT_URL', 'mqtt://localhost:1883');
  }

  get minioConfig() {
    return {
      endPoint: this.nestConfigService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.nestConfigService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.nestConfigService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.nestConfigService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.nestConfigService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      cdnUrl: this.nestConfigService.get<string>('MINIO_CDN_URL', ''),
      publicEndpoint: this.nestConfigService.get<string>('MINIO_PUBLIC_ENDPOINT', ''),
      defaultBucket: this.nestConfigService.get<string>('MINIO_DEFAULT_BUCKET', 'chatrix-media'),
    };
  }

  get fcmServiceAccountPath(): string {
    return this.nestConfigService.get<string>('FCM_SERVICE_ACCOUNT_PATH', './firebase-service-account.json');
  }

  get otpFromEmail(): string {
    return this.nestConfigService.get<string>('OTP_FROM_EMAIL', 'noreply@chatrix.com');
  }

  get otpProvider(): string {
    return this.nestConfigService.get<string>('OTP_PROVIDER', 'dummy');
  }

  get smtpHost(): string {
    return this.nestConfigService.get<string>('SMTP_HOST', 'dummy');
  }

  get smtpPort(): number {
    return parseInt(this.nestConfigService.get<string>('SMTP_PORT', '587'), 10);
  }

  get smtpUser(): string {
    return this.nestConfigService.get<string>('SMTP_USER', '');
  }

  get smtpPassword(): string {
    return this.nestConfigService.get<string>('SMTP_PASSWORD', '');
  }

  get smtpFromEmail(): string {
    return this.nestConfigService.get<string>('SMTP_FROM_EMAIL', 'noreply@chatrix.com');
  }

  get smtpFromName(): string {
    return this.nestConfigService.get<string>('SMTP_FROM_NAME', 'Chatrix');
  }
}

