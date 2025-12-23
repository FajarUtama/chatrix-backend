import { Module, Global } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { AppConfigModule } from '../../config/config.module';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}

