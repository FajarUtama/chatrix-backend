import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

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
                    },
                },
            },
        },
    })
    async getHealth() {
        return this.healthService.getHealth();
    }
}
