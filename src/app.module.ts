import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { MqttModule } from './infrastructure/mqtt/mqtt.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { FcmModule } from './infrastructure/fcm/fcm.module';
import { OtpModule } from './infrastructure/otp/otp.module';
import { EmailModule } from './infrastructure/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { SessionModule } from './modules/session/session.module';
import { ContactModule } from './modules/contact/contact.module';
import { FollowModule } from './modules/follow/follow.module';
import { PostModule } from './modules/post/post.module';
import { StoryModule } from './modules/story/story.module';
import { ChatModule } from './modules/chat/chat.module';
import { CallModule } from './modules/call/call.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationModule } from './modules/notification/notification.module';
import { StorageModule } from './modules/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { BlockModule } from './modules/block/block.module';
import { ReportModule } from './modules/report/report.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    CommonModule,
    MongooseModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.mongoUri,
      }),
      inject: [ConfigService],
    }),
    MqttModule,
    RedisModule,
    MinioModule,
    FcmModule,
    EmailModule,
    OtpModule,
    AuthModule,
    UserModule,
    SessionModule,
    ContactModule,
    FollowModule,
    PostModule,
    StoryModule,
    ChatModule,
    CallModule,
    MediaModule,
    NotificationModule,
    StorageModule,
    AdminModule,
    BlockModule,
    ReportModule,
    HealthModule,
  ],
})
export class AppModule { }

