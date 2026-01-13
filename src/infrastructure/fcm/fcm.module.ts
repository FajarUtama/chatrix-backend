import { Module, Global } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { FirebaseModule } from '../../firebase/firebase.module';

@Global()
@Module({
  imports: [FirebaseModule],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}

