import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    try {
      this.client = new Redis({
        host: this.configService.redisHost,
        port: this.configService.redisPort,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.logger.log('Redis client connected');
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis client error:', error);
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error as any);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error as any);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.client.set(key, value);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error as any);
    }
  }

  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, value);
    } catch (error) {
      this.logger.error(`Error setting key ${key} with TTL:`, error as any);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error as any);
    }
  }

  getClient(): Redis {
    return this.client;
  }
}

