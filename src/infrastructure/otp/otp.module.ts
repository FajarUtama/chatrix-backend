import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OtpService } from './otp.service';
import { OtpCode, OtpCodeSchema } from '../../modules/auth/schemas/otp-code.schema';
import { AppConfigModule } from '../../config/config.module';

@Global()
@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forFeature([{ name: OtpCode.name, schema: OtpCodeSchema }]),
  ],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}

