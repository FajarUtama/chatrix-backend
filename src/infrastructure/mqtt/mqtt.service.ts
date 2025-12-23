import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client!: mqtt.MqttClient;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    try {
      const url = this.configService.mqttUrl;
      this.logger.log(`Connecting to MQTT broker at ${url}`);

      this.client = mqtt.connect(url, {
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      this.client.on('connect', () => {
        this.logger.log('MQTT client connected');
      });

      this.client.on('error', (error: Error) => {
        this.logger.error('MQTT client error:', error);
      });

      this.client.on('offline', () => {
        this.logger.warn('MQTT client offline');
      });

      this.client.on('reconnect', () => {
        this.logger.log('MQTT client reconnecting');
      });
    } catch (error) {
      this.logger.error('Failed to initialize MQTT client:', error as any);
    }
  }

  publish(topic: string, payload: any): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn('MQTT client not connected, skipping publish');
      return;
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.client.publish(topic, message, (error: Error | undefined) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}:`, error);
        } else {
          this.logger.debug(`Published to ${topic}`);
        }
      });
    } catch (error: any) {
      this.logger.error(`Error publishing to ${topic}:`, error);
    }
  }

  subscribe(topic: string, handler: (payload: any) => void): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn('MQTT client not connected, skipping subscribe');
      return;
    }

    this.client.subscribe(topic, (error: Error | null) => {
      if (error) {
        this.logger.error(`Failed to subscribe to ${topic}:`, error);
      } else {
        this.logger.log(`Subscribed to ${topic}`);
      }
    });

    this.client.on('message', (receivedTopic: string, message: Buffer) => {
      if (receivedTopic === topic) {
        try {
          const payload = JSON.parse(message.toString());
          handler(payload);
        } catch (error) {
          // If not JSON, pass as string
          handler(message.toString());
        }
      }
    });
  }

  getClient(): mqtt.MqttClient {
    return this.client;
  }
}

