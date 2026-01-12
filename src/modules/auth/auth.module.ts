import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Session, SessionSchema } from '../session/schemas/session.schema';
import { DeviceToken, DeviceTokenSchema } from './schemas/device-token.schema';
import { UserModule } from '../user/user.module';
import { AppConfigModule } from '../../config/config.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
    ]),
    UserModule,
    MinioModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule { }

