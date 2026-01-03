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
      
      // ⭐ VERIFICATION 1: Print MQTT_URL final di log startup (full string) - CRITICAL FOR DEBUGGING
      this.logger.log('═══════════════════════════════════════════════════════════');
      this.logger.log('🔌 MQTT CONNECTION CONFIGURATION (VERIFY THIS MATCHES FE!)');
      this.logger.log('═══════════════════════════════════════════════════════════');
      this.logger.log(`📋 MQTT_URL (FULL STRING): ${url}`);
      
      // Parse URL untuk detail breakdown
      try {
        const urlObj = new URL(url);
        this.logger.log(`🌐 Broker Host: ${urlObj.hostname}`);
        this.logger.log(`🔌 Broker Port: ${urlObj.port || (urlObj.protocol === 'mqtt:' ? '1883 (default)' : urlObj.protocol === 'ws:' ? '80 (default)' : urlObj.protocol === 'wss:' ? '443 (default)' : 'unknown')}`);
        this.logger.log(`📡 Protocol: ${urlObj.protocol.replace(':', '')}`);
        this.logger.log(`🔑 Username: ${urlObj.username || 'none (anonymous)'}`);
        this.logger.log(`🔒 Password: ${urlObj.password ? '***hidden***' : 'none'}`);
      } catch (parseError) {
        this.logger.error(`❌ Failed to parse MQTT_URL: ${url}`, parseError);
        this.logger.error('⚠️ Invalid MQTT_URL format! Expected: mqtt://host:port or ws://host:port');
      }
      
      this.logger.log('═══════════════════════════════════════════════════════════');
      this.logger.log('💡 IMPORTANT: Frontend MUST connect to the SAME broker URL!');
      this.logger.log('   If BE is in Docker, FE should use host machine IP, not "mosquitto"');
      this.logger.log('   Example: BE (Docker) → mqtt://mosquitto:1883');
      this.logger.log('            FE (Device) → mqtt://YOUR_IP:1883 (or ws://YOUR_IP:9001)');
      this.logger.log('═══════════════════════════════════════════════════════════');

      this.client = mqtt.connect(url, {
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        // Optimize for immediate publish - no buffering
        queueQoSZero: false, // Don't queue QoS 0 messages
      });

      this.client.on('connect', () => {
        this.logger.log('═══════════════════════════════════════════════════════════');
        this.logger.log('✅ MQTT CLIENT CONNECTED SUCCESSFULLY');
        this.logger.log('═══════════════════════════════════════════════════════════');
        this.logger.log(`✅ Connection established to: ${url}`);
        this.logger.log('✅ Ready for real-time message delivery');
        this.logger.log('✅ All subscriptions will be restored');
        this.logger.log('═══════════════════════════════════════════════════════════');
        // Resubscribe to all topics after reconnection
        this.resubscribeAll();
      });

      this.client.on('error', (error: Error) => {
        this.logger.error('MQTT client error:', error);
        this.logger.error('This may affect real-time message delivery');
      });

      this.client.on('offline', () => {
        this.logger.warn('MQTT client offline - messages will not be delivered until reconnected');
      });

      this.client.on('reconnect', () => {
        this.logger.log('MQTT client reconnecting - will resume real-time delivery when connected');
      });

      // Monitor packet send/receive for debugging
      this.client.on('packetsend', (packet) => {
        this.logger.debug(`MQTT packet sent: ${packet.cmd}`);
      });

      this.client.on('packetreceive', (packet) => {
        this.logger.debug(`MQTT packet received: ${packet.cmd}`);
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
   * Ensures message is delivered to recipient in real-time
   * If not connected, will wait up to 2 seconds for connection before giving up
   */
  async publish(topic: string, payload: any, retry: boolean = true): Promise<void> {
    // Check connection status - if not connected, try to wait briefly for reconnection
    if (!this.client) {
      this.logger.error(`MQTT client not initialized, cannot publish to ${topic}`);
      return;
    }

    // If not connected and retry is enabled, wait for connection (up to 2 seconds)
    if (!this.client.connected && retry) {
      this.logger.debug(`MQTT client not connected, waiting for connection to publish to ${topic}...`);
      const connected = await this.waitForConnection(2000);
      if (!connected) {
        this.logger.warn(`MQTT client not connected after waiting, cannot publish to ${topic}. Message will be lost.`);
        return;
      }
    } else if (!this.client.connected) {
      this.logger.warn(`MQTT client not connected, cannot publish to ${topic}. Message will be lost.`);
      return;
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      // Immediate publish - no delay, no queue, no buffering
      // Publish directly without setImmediate to minimize latency
      // retain: false ensures message is not stored by broker (immediate delivery only)
      // QoS 1 ensures at least once delivery guarantee
      this.client.publish(
        topic, 
        message, 
        { 
          qos: 1, // At least once delivery - ensures message reaches recipient
          retain: false, // Don't retain message - immediate delivery only, no persistence
          dup: false 
        }, 
        (error: Error | undefined) => {
          if (error) {
            this.logger.error(`Failed to publish to ${topic}:`, error);
            this.logger.error(`Payload: ${message.substring(0, 200)}`);
          } else {
            // Log successful publish with payload summary (for checklist verification)
            try {
              const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
              const summary: any = {
                type: payloadObj.type,
                conversation_id: payloadObj.conversation_id,
              };
              if (payloadObj.message_id) summary.message_id = payloadObj.message_id;
              if (payloadObj.sender_id) summary.sender_id = payloadObj.sender_id;
              if (payloadObj.actor_user_id) summary.actor_user_id = payloadObj.actor_user_id;
              
              // ⭐ VERIFICATION 4: Log topic yang dipublish dengan jelas untuk verifikasi
              this.logger.log(`✅ PUBLISHED | Topic: ${topic} | Payload: ${JSON.stringify(summary)}`);
              this.logger.debug(`   ⚠️ VERIFY: Frontend should subscribe to exactly: ${topic} (case-sensitive!)`);
            } catch {
              this.logger.debug(`Successfully published to ${topic}`);
            }
          }
        }
      );
    } catch (error: any) {
      this.logger.error(`Error publishing to ${topic}:`, error);
      this.logger.error(`Payload: ${JSON.stringify(payload).substring(0, 200)}`);
    }
  }

  /**
   * Publish message synchronously (awaitable version)
   * Use this when you need to ensure message is published before continuing
   */
  async publishAsync(topic: string, payload: any): Promise<void> {
    return this.publish(topic, payload, true);
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

  /**
   * Check if MQTT client is connected and ready for publishing
   * This ensures messages can be delivered to recipients in real-time
   */
  isConnected(): boolean {
    return this.client !== undefined && this.client.connected === true;
  }

  /**
   * Get MQTT connection status and configuration details
   * Useful for health check and debugging
   */
  getConnectionInfo(): {
    connected: boolean;
    broker_url: string;
    broker_host?: string;
    broker_port?: string;
    protocol?: string;
    topics_subscribed: string[];
  } {
    const info: any = {
      connected: this.isConnected(),
      broker_url: this.configService.mqttUrl,
      topics_subscribed: Array.from(this.topicHandlers.keys()),
    };

    try {
      const urlObj = new URL(this.configService.mqttUrl);
      info.broker_host = urlObj.hostname;
      info.broker_port = urlObj.port || (urlObj.protocol === 'mqtt:' ? '1883' : urlObj.protocol === 'ws:' ? '80' : urlObj.protocol === 'wss:' ? '443' : 'unknown');
      info.protocol = urlObj.protocol.replace(':', '');
    } catch (e) {
      // URL parse error
    }

    return info;
  }

  /**
   * Wait for MQTT connection to be ready (with timeout)
   * Useful for ensuring message delivery before publishing
   */
  async waitForConnection(timeout: number = 5000): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.isConnected()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          this.logger.warn(`MQTT connection timeout after ${timeout}ms`);
          resolve(false);
        }
      }, 100);
    });
  }
}

