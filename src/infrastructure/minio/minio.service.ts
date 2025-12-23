import { Injectable, OnModuleInit, Logger, StreamableFile } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '../../config/config.service';
import { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient!: Minio.Client;
  private defaultBucket: string;

  constructor(private configService: ConfigService) {
    const config = this.configService.minioConfig;
    this.defaultBucket = config.defaultBucket;

    this.minioClient = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  async onModuleInit() {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.defaultBucket);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.defaultBucket, 'us-east-1');
        this.logger.log(`Created bucket: ${this.defaultBucket}`);
      } else {
        this.logger.log(`Bucket ${this.defaultBucket} already exists`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize MinIO bucket:', error);
    }
  }

  async upload(
    buffer: Buffer,
    contentType: string,
    key: string,
    metaData: Record<string, string> = {},
  ): Promise<{ key: string; url: string }> {
    try {
      this.logger.debug(`Starting upload for key: ${key}, content type: ${contentType}, buffer size: ${buffer.length} bytes`);

      // Ensure bucket exists before upload
      const bucketExists = await this.minioClient.bucketExists(this.defaultBucket);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.defaultBucket, 'us-east-1');
        this.logger.log(`Created bucket: ${this.defaultBucket}`);
      }

      metaData['Content-Type'] = contentType;

      this.logger.debug(`Uploading to bucket: ${this.defaultBucket}, key: ${key}`);
      const etag = await this.minioClient.putObject(this.defaultBucket, key, buffer, metaData);

      this.logger.debug(`Upload successful. ETag: ${etag}`);
      const url = this.getPublicUrl(key);

      return { key, url };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Error uploading to MinIO. Bucket: ${this.defaultBucket}, Key: ${key}, Error: ${errorMessage}`, error);
      throw new Error(`Failed to upload file to storage: ${errorMessage}`);
    }
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    try {
      return await this.minioClient.getObject(this.defaultBucket, key);
    } catch (error) {
      this.logger.error(`Error getting object stream for ${key}:`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.defaultBucket, key);
      this.logger.log(`File ${key} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw error;
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    try {
      return await this.minioClient.getObject(this.defaultBucket, key);
    } catch (error) {
      this.logger.error(`Failed to get file stream for ${key}:`, error);
      throw new Error(`Failed to retrieve file: ${(error as any).message}`);
    }
  }

  async getFileStat(key: string): Promise<Minio.BucketItemStat> {
    try {
      return await this.minioClient.statObject(this.defaultBucket, key);
    } catch (error) {
      this.logger.error(`Failed to get file stat for ${key}:`, error);
      throw new Error(`Failed to get file info: ${(error as any).message}`);
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.defaultBucket, key, expiresIn);
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${key}:`, error);
      throw new Error(`Failed to generate presigned URL: ${(error as any).message}`);
    }
  }

  async listFiles(prefix: string = ''): Promise<Minio.BucketItem[]> {
    return new Promise((resolve, reject) => {
      const items: Minio.BucketItem[] = [];
      const stream = this.minioClient.listObjectsV2(this.defaultBucket, prefix, true);

      stream.on('data', (item: any) => items.push(item));
      stream.on('end', () => resolve(items));
      stream.on('error', (err: any) => {
        this.logger.error(`Error listing files in bucket ${this.defaultBucket}:`, err);
        reject(err);
      });
    });
  }

  private getPublicUrl(key: string): string {
    const config = this.configService.minioConfig;
    // If CDN URL is configured, use that
    if (config.cdnUrl) {
      return `${config.cdnUrl}/${this.defaultBucket}/${key}`;
    }
    // Otherwise, construct URL from MinIO config
    const protocol = config.useSSL ? 'https' : 'http';
    const port = config.port ? `:${config.port}` : '';
    return `${protocol}://${config.endPoint}${port}/${this.defaultBucket}/${key}`;
  }

  getClient(): Minio.Client {
    return this.minioClient;
  }
}

