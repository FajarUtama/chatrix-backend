// src/modules/storage/storage.service.ts
import { Injectable, StreamableFile } from '@nestjs/common';
import { MinioService as MinioClientService } from '../../infrastructure/minio/minio.service';
import { ConfigService } from '../../config/config.service';
import * as mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other',
}

export interface UploadedFileResponse {
  url: string;
  key: string;
  type: string;
  size: number;
  originalName: string;
  mimeType: string;
  fileType: FileType;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  metadata: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly bucketName: string;
  private readonly cdnUrl: string;

  constructor(
    private readonly minioService: MinioClientService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.minioConfig.defaultBucket;
    this.cdnUrl = this.configService.minioConfig.cdnUrl || '';
  }

  private getFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) return FileType.IMAGE;
    if (mimeType.startsWith('video/')) return FileType.VIDEO;
    if (mimeType.startsWith('audio/')) return FileType.AUDIO;
    if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) return FileType.DOCUMENT;
    return FileType.OTHER;
  }

  private generateKey(originalName: string, fileType: FileType): string {
    const extension = originalName.split('.').pop() || '';
    const timestamp = Date.now();
    const randomString = uuidv4().substring(0, 8);
    return `${fileType}s/${timestamp}-${randomString}.${extension}`;
  }

  async uploadFile(
    file: Express.Multer.File,
    fileType?: FileType,
  ): Promise<UploadedFileResponse> {
    console.log('Uploading file:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      buffer: file?.buffer ? `Buffer of ${file.buffer.length} bytes` : 'No buffer',
      keys: Object.keys(file)
    });

    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.originalname) {
      console.error('Invalid file object received:', file);
      throw new Error('Invalid file: missing originalname');
    }

    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      console.error('Invalid file buffer:', file);
      throw new Error('Invalid file: missing or invalid buffer');
    }

    const mimeType = mime.lookup(file.originalname) || file.mimetype || 'application/octet-stream';
    const detectedFileType = fileType || this.getFileType(mimeType);
    
    // Ensure we have a valid filename
    const originalName = file.originalname || `file-${Date.now()}`;
    const key = this.generateKey(originalName, detectedFileType);

    try {
      // Add metadata to the file
      const metadata = {
        'original-filename': file.originalname,
        'content-type': mimeType,
        'file-type': detectedFileType,
      };

      await this.minioService.upload(
        file.buffer,
        mimeType,
        key,
        metadata
      );

      const publicUrl = this.cdnUrl 
        ? `${this.cdnUrl}/${this.bucketName}/${key}`
        : `/${this.bucketName}/${key}`;

      return {
        url: publicUrl,
        key,
        type: mimeType,
        size: file.size,
        originalName: file.originalname,
        mimeType,
        fileType: detectedFileType,
      };
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unknown error occurred';
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      await this.minioService.deleteFile(key);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unknown error occurred';
      throw new Error(`Failed to delete file: ${errorMessage}`);
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    try {
      return await this.minioService.getFileStream(key);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to retrieve file';
      throw new Error(`Failed to get file stream: ${errorMessage}`);
    }
  }

  async getFileInfo(key: string): Promise<FileInfo> {
    try {
      const stat = await this.minioService.getFileStat(key);
      return {
        key,
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        metadata: stat.metaData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to get file info';
      throw new Error(`Failed to get file info: ${errorMessage}`);
    }
  }

  getMimeType(filename: string): string {
    const mimeType = mime.lookup(filename);
    return mimeType || 'application/octet-stream';
  }

  async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      return await this.minioService.getPresignedUrl(key, expiresIn);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to generate presigned URL';
      throw new Error(`Failed to generate presigned URL: ${errorMessage}`);
    }
  }
}