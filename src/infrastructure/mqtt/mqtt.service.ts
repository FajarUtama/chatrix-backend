import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client!: mqtt.MqttClient;
  private topicHandlers: Map<string, (payload: any) => void> = new Map();
  private messageHandlerRegistered = false;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    try {
      const url = this.configService.mqttUrl;
      this.logger.log(`Connecting to MQTT broker at ${url}`);

      this.client = mqtt.connect(url, {
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        // Optimize for immediate publish - no buffering
        queueQoSZero: false, // Don't queue QoS 0 messages
      });

      this.client.on('connect', () => {
        this.logger.log('MQTT client connected');
        // Resubscribe to all topics after reconnection
        this.resubscribeAll();
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

      // Register a single message handler for all topics
      this.registerMessageHandler();
    } catch (error) {
      this.logger.error('Failed to initialize MQTT client:', error as any);
    }
  }

  private registerMessageHandler(): void {
    if (this.messageHandlerRegistered) {
      return;
    }

    this.client.on('message', (receivedTopic: string, message: Buffer) => {
      const handler = this.topicHandlers.get(receivedTopic);
      if (handler) {
        try {
          const payload = JSON.parse(message.toString());
          handler(payload);
        } catch (error) {
          // If not JSON, pass as string
          handler(message.toString());
        }
      }
    });

    this.messageHandlerRegistered = true;
    this.logger.debug('MQTT message handler registered');
  }

  private resubscribeAll(): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    const topics = Array.from(this.topicHandlers.keys());
    if (topics.length > 0) {
      this.logger.log(`Resubscribing to ${topics.length} topics after reconnection`);
      topics.forEach(topic => {
        this.client.subscribe(topic, (error: Error | null) => {
          if (error) {
            this.logger.error(`Failed to resubscribe to ${topic}:`, error);
          } else {
            this.logger.debug(`Resubscribed to ${topic}`);
          }
        });
      });
    }
  }

  /**
   * Publish message to MQTT topic immediately (no queue, no delay)
   * This is a fire-and-forget operation - message is sent immediately without blocking
   * QoS 1 ensures guaranteed delivery to subscribers
   * Optimized for real-time delivery with no buffering
   */
  publish(topic: string, payload: any): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn('MQTT client not connected, skipping publish');
      return;
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      // Immediate publish - no delay, no queue, no buffering
      // Publish directly without setImmediate to minimize latency
      // retain: false ensures message is not stored by broker (immediate delivery only)
      this.client.publish(
        topic, 
        message, 
        { 
          qos: 1, 
          retain: false, // Don't retain message - immediate delivery only, no persistence
          dup: false 
        }, 
        (error: Error | undefined) => {
          if (error) {
            this.logger.error(`Failed to publish to ${topic}:`, error);
          } else {
            this.logger.debug(`Published to ${topic}: ${message.substring(0, 100)}...`);
          }
        }
      );
    } catch (error: any) {
      this.logger.error(`Error publishing to ${topic}:`, error);
    }
  }

  subscribe(topic: string, handler: (payload: any) => void): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn('MQTT client not connected, skipping subscribe');
      return;
    }

    // Store the handler
    this.topicHandlers.set(topic, handler);

    this.client.subscribe(topic, { qos: 1 }, (error: Error | null) => {
      if (error) {
        this.logger.error(`Failed to subscribe to ${topic}:`, error);
      } else {
        this.logger.log(`Subscribed to ${topic}`);
      }
    });
  }

  unsubscribe(topic: string): void {
    if (!this.client || !this.client.connected) {
      this.logger.warn('MQTT client not connected, skipping unsubscribe');
      return;
    }

    this.topicHandlers.delete(topic);
    this.client.unsubscribe(topic, (error: Error | undefined) => {
      if (error) {
        this.logger.error(`Failed to unsubscribe from ${topic}:`, error);
      } else {
        this.logger.log(`Unsubscribed from ${topic}`);
      }
    });
  }

  getClient(): mqtt.MqttClient {
    return this.client;
  }
}

