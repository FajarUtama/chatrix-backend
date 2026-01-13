import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { FcmService } from '../../infrastructure/fcm/fcm.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        private readonly healthService: HealthService,
        private readonly fcmService: FcmService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Health check for all services' })
    @ApiResponse({
        status: 200,
        description: 'Health status of all services',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'ok', enum: ['ok', 'degraded'] },
                timestamp: { type: 'string', example: '2025-12-26T14:36:00Z' },
                services: {
                    type: 'object',
                    properties: {
                        backend: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                uptime_seconds: { type: 'number', example: 12345 },
                                version: { type: 'string', example: '1.0.0' },
                            },
                        },
                        database: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                database_name: { type: 'string', example: 'chatrix' },
                                host: { type: 'string', example: '34.169.119.250' },
                                total_users: { type: 'number', example: 2 },
                                users_with_email: { type: 'number', example: 2 },
                            },
                        },
                        redis: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                ping: { type: 'string', example: 'PONG' },
                                host: { type: 'string', example: '34.169.119.250' },
                                port: { type: 'number', example: 6379 },
                            },
                        },
                        mqtt: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                url: { type: 'string', example: 'mqtt://34.169.119.250:1883' },
                            },
                        },
                        minio: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                endpoint: { type: 'string', example: '34.169.119.250' },
                                port: { type: 'number', example: 9000 },
                                bucket: { type: 'string', example: 'chatrix-media' },
                            },
                        },
                        firebase: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                initialized: { type: 'boolean', example: true },
                                project_id: { type: 'string', example: 'your-project-id' },
                                messaging_available: { type: 'boolean', example: true },
                            },
                        },
                    },
                },
            },
        },
    })
    async getHealth() {
        return this.healthService.getHealth();
    }

    @Get('firebase-debug')
    @ApiOperation({ summary: 'Debug Firebase initialization status' })
    @ApiResponse({
        status: 200,
        description: 'Firebase debug information',
    })
    async getFirebaseDebug() {
        return this.healthService.getFirebaseDebug();
    }

    @Get('test-notification')
    @ApiOperation({ summary: 'Test FCM notification (for testing only)' })
    @ApiQuery({ name: 'token', required: true, description: 'FCM device token' })
    @ApiResponse({
        status: 200,
        description: 'Test notification sent',
    })
    async testNotification(@Query('token') token: string) {
        try {
            await this.fcmService.sendNotification(token, {
                title: 'Test Notification',
                body: 'Ini adalah test notifikasi dari Chatrix Backend! 🎉',
                data: {
                    type: 'test',
                    timestamp: new Date().toISOString(),
                },
            });

            return {
                success: true,
                message: 'Test notification sent successfully',
                token: token.substring(0, 20) + '...',
            };
        } catch (error: any) {
            return {
                success: false,
                message: 'Failed to send test notification',
                error: error.message,
            };
        }
    }
}
