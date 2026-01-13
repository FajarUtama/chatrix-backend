import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/schemas/user.schema';
import { ConfigService } from '../../config/config.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { FcmService } from '../../infrastructure/fcm/fcm.service';
import Redis from 'ioredis';
import * as mqtt from 'mqtt';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class HealthService {
    private startTime: number;
    private redisClient: Redis;
    private mqttClient: mqtt.MqttClient;

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private configService: ConfigService,
        private minioService: MinioService,
        private mqttService: MqttService,
        private fcmService: FcmService,
    ) {
        this.startTime = Date.now();

        // Initialize Redis client for health check
        this.redisClient = new Redis({
            host: this.configService.redisHost,
            port: this.configService.redisPort,
            retryStrategy: () => null, // Don't retry on health check
            lazyConnect: true,
        });

        // Initialize MQTT client for health check
        this.mqttClient = mqtt.connect(this.configService.mqttUrl, {
            reconnectPeriod: 0, // Don't auto-reconnect
        });
    }

    async getHealth() {
        const timestamp = new Date().toISOString();
        const services = await Promise.allSettled([
            this.checkBackend(),
            this.checkDatabase(),
            this.checkRedis(),
            this.checkMqtt(),
            this.checkMinio(),
            this.checkFirebase(),
        ]);

        // Use MqttService connection info instead of separate client check
        const mqttInfo = this.mqttService.getConnectionInfo();
        const mqttHealth = {
            status: mqttInfo.connected ? 'up' : 'down',
            ...mqttInfo,
        };

        const [backend, database, redis, mqttOld, minio, firebase] = services.map(result =>
            result.status === 'fulfilled' ? result.value : { status: 'down' as const, error: (result.reason as Error)?.message || 'Unknown error' }
        );

        const allUp = [backend, database, redis, mqttHealth, minio, firebase].every((s: any) => s.status === 'up');

        return {
            status: allUp ? 'ok' : 'degraded',
            timestamp,
            services: {
                backend,
                database,
                redis,
                mqtt: mqttHealth,
                minio,
                firebase,
            },
        };
    }

    private async checkBackend() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        return {
            status: 'up',
            uptime_seconds: uptime,
            version: process.env.npm_package_version || '1.0.0',
        };
    }

    private async checkDatabase() {
        try {
            const connection = this.userModel.db;
            if (!connection.db) {
                return { status: 'down', error: 'Database connection not available' };
            }

            const userCount = await this.userModel.countDocuments().exec();
            const usersWithEmail = await this.userModel.countDocuments({
                email: { $exists: true, $ne: null }
            }).exec();

            return {
                status: 'up',
                database_name: connection.db.databaseName,
                host: connection.host,
                total_users: userCount,
                users_with_email: usersWithEmail,
            };
        } catch (error) {
            return {
                status: 'down',
                error: (error as Error).message,
            };
        }
    }

    private async checkRedis() {
        try {
            await this.redisClient.connect();
            const pong = await this.redisClient.ping();
            await this.redisClient.disconnect();

            return {
                status: 'up',
                ping: pong,
                host: this.configService.redisHost,
                port: this.configService.redisPort,
            };
        } catch (error) {
            return {
                status: 'down',
                error: (error as Error).message,
                host: this.configService.redisHost,
                port: this.configService.redisPort,
            };
        }
    }

    // DEPRECATED: Use MqttService.getConnectionInfo() instead
    // Keeping for backward compatibility but using MqttService in main health check
    private async checkMqtt() {
        try {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({
                        status: 'down',
                        error: 'Connection timeout',
                        url: this.configService.mqttUrl,
                    });
                }, 5000);

                this.mqttClient.once('connect', () => {
                    clearTimeout(timeout);
                    this.mqttClient.end();
                    resolve({
                        status: 'up',
                        url: this.configService.mqttUrl,
                    });
                });

                this.mqttClient.once('error', (error: Error) => {
                    clearTimeout(timeout);
                    resolve({
                        status: 'down',
                        error: error.message,
                        url: this.configService.mqttUrl,
                    });
                });

                // Trigger connection
                this.mqttClient.reconnect();
            });
        } catch (error) {
            return {
                status: 'down',
                error: (error as Error).message,
                url: this.configService.mqttUrl,
            };
        }
    }

    private async checkMinio() {
        try {
            const config = this.configService.minioConfig;
            // Try to list buckets as a health check
            await this.minioService.getClient().listBuckets();

            return {
                status: 'up',
                endpoint: config.endPoint,
                port: config.port,
                bucket: config.defaultBucket,
            };
        } catch (error) {
            const config = this.configService.minioConfig;
            return {
                status: 'down',
                error: (error as Error).message,
                endpoint: config.endPoint,
                port: config.port,
            };
        }
    }

    private async checkFirebase() {
        try {
            // Check if Firebase Admin is initialized
            if (admin.apps.length === 0) {
                return {
                    status: 'down',
                    error: 'Firebase Admin not initialized',
                    initialized: false,
                    messaging_available: false,
                };
            }

            const app = admin.app();
            const projectId = app.options.projectId || 'N/A';

            // Test if messaging() is available
            let messagingAvailable = false;
            try {
                const messaging = admin.messaging();
                messagingAvailable = messaging !== null && messaging !== undefined;
            } catch (error) {
                return {
                    status: 'down',
                    error: `Messaging not available: ${(error as Error).message}`,
                    initialized: true,
                    project_id: projectId,
                    messaging_available: false,
                };
            }

            return {
                status: 'up',
                initialized: true,
                project_id: projectId,
                messaging_available: messagingAvailable,
            };
        } catch (error) {
            return {
                status: 'down',
                error: (error as Error).message,
                initialized: false,
                messaging_available: false,
            };
        }
    }

    getFirebaseDebug() {
        const debug: any = {
            firebase_apps_count: admin.apps.length,
            current_working_directory: process.cwd(),
            environment_variable_set: !!process.env.FCM_SERVICE_ACCOUNT_JSON,
            service_account_path: this.configService.fcmServiceAccountPath,
        };

        // Check file path
        const serviceAccountPath = this.configService.fcmServiceAccountPath;
        const absolutePath = path.isAbsolute(serviceAccountPath)
            ? serviceAccountPath
            : path.resolve(process.cwd(), serviceAccountPath);
        
        debug.absolute_path = absolutePath;
        debug.file_exists = fs.existsSync(absolutePath);

        // Check file if exists
        if (fs.existsSync(absolutePath)) {
            try {
                const fileContent = fs.readFileSync(absolutePath, 'utf8');
                const parsed = JSON.parse(fileContent);
                debug.file_valid_json = true;
                debug.file_has_project_id = !!parsed.project_id;
                debug.file_has_private_key = !!parsed.private_key;
                debug.file_has_client_email = !!parsed.client_email;
                debug.file_project_id = parsed.project_id || 'N/A';
            } catch (error: any) {
                debug.file_valid_json = false;
                debug.file_error = error.message;
            }
        }

        // Check Firebase initialization
        if (admin.apps.length > 0) {
            try {
                const app = admin.app();
                debug.firebase_initialized = true;
                debug.firebase_project_id = app.options.projectId || 'N/A';
                
                // Test messaging
                try {
                    const messaging = admin.messaging();
                    debug.messaging_available = messaging !== null && messaging !== undefined;
                } catch (error: any) {
                    debug.messaging_available = false;
                    debug.messaging_error = error.message;
                }
            } catch (error: any) {
                debug.firebase_initialized = false;
                debug.firebase_error = error.message;
            }
        } else {
            debug.firebase_initialized = false;
            debug.firebase_error = 'No Firebase apps initialized';
        }

        return debug;
    }

    onModuleDestroy() {
        // Cleanup connections
        if (this.redisClient) {
            this.redisClient.disconnect();
        }
        if (this.mqttClient) {
            this.mqttClient.end();
        }
    }
}
