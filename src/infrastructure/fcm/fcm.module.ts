import { Module, Global } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { AppConfigModule } from '../../config/config.module';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}

