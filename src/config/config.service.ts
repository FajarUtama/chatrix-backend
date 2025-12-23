import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

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
    return this.nestConfigService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
  }

  get jwtRefreshExpiresIn(): string {
    return this.nestConfigService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
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
}

