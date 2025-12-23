import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallController } from './call.controller';
import { CallService } from './call.service';
import { CallLog, CallLogSchema } from './schemas/call-log.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: CallLog.name, schema: CallLogSchema }])],
  controllers: [CallController],
  providers: [CallService],
})
export class CallModule {}

