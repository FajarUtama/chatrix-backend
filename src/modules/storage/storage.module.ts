// src/modules/storage/storage.module.ts
import { Global, Module } from '@nestjs/common';
import { MinioModule } from '../../infrastructure/minio/minio.module';
import { AppConfigModule } from '../../config/config.module';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  imports: [MinioModule, AppConfigModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}