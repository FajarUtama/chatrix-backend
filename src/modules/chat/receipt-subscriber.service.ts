import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { ReceiptService } from './receipt.service';

/**
 * MQTT subscriber service that listens for receipt events from clients
 * Subscribes to chat/v1/receipts topic and processes delivered_up_to and read_up_to receipts
 */
@Injectable()
export class ReceiptSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(ReceiptSubscriberService.name);
  private readonly RECEIPTS_TOPIC = 'chat/v1/receipts';

  constructor(
    private mqttService: MqttService,
    private receiptService: ReceiptService,
  ) {}

  async onModuleInit() {
    // Wait for MQTT connection
    await this.mqttService.waitForConnection(10000);

    // Subscribe to receipts topic
    this.mqttService.subscribe(this.RECEIPTS_TOPIC, this.handleReceipt.bind(this));
    this.logger.log(`Subscribed to MQTT topic: ${this.RECEIPTS_TOPIC}`);
  }

  /**
   * Handle receipt message from MQTT
   * Validates and processes delivered_up_to or read_up_to receipts
   */
  private async handleReceipt(payload: any): Promise<void> {
    try {
      // Validate payload structure
      if (!payload || typeof payload !== 'object') {
        this.logger.warn('Invalid receipt payload: not an object');
        return;
      }

      const { type, conversation_id, actor_user_id, last_delivered_message_id, last_read_message_id, ts } = payload;

      // Validate required fields
      if (!type || !conversation_id || !actor_user_id) {
        this.logger.warn('Invalid receipt payload: missing required fields', payload);
        return;
      }

      // Parse timestamp (optional, server will use server time anyway)
      const clientTs = ts ? new Date(ts) : undefined;

      // Process based on receipt type
      if (type === 'delivered_up_to') {
        if (!last_delivered_message_id) {
          this.logger.warn('Invalid delivered_up_to receipt: missing last_delivered_message_id', payload);
          return;
        }

        await this.receiptService.processDeliveredUpTo(
          conversation_id,
          actor_user_id,
          last_delivered_message_id,
          clientTs,
        );
      } else if (type === 'read_up_to') {
        if (!last_read_message_id) {
          this.logger.warn('Invalid read_up_to receipt: missing last_read_message_id', payload);
          return;
        }

        await this.receiptService.processReadUpTo(conversation_id, actor_user_id, last_read_message_id, clientTs);
      } else {
        this.logger.warn(`Unknown receipt type: ${type}`, payload);
      }
    } catch (error) {
      this.logger.error('Error processing receipt:', error);
      // Don't throw - we want to continue processing other receipts
    }
  }
}

