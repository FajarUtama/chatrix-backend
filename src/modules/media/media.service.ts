import { Injectable } from '@nestjs/common';
import { MinioService } from '../../infrastructure/minio/minio.service';

@Injectable()
export class MediaService {
  constructor(private minioService: MinioService) {}

  async uploadFile(
    buffer: Buffer,
    contentType: string,
    context: 'post' | 'story' | 'chat' | 'avatar',
  ): Promise<{ key: string; url: string }> {
    const prefix = context === 'post' ? 'posts' : context === 'story' ? 'stories' : context === 'chat' ? 'chat' : 'avatars';
    return this.minioService.upload(buffer, contentType, prefix);
  }
}

