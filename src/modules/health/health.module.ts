import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AppConfigModule } from '../../config/config.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';
import { MqttModule } from '../../infrastructure/mqtt/mqtt.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        AppConfigModule,
        MinioModule,
        MqttModule,
    ],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule { }
