// src/modules/storage/storage.controller.ts
import { 
  Controller, 
  Post, 
  Get, 
  UploadedFile, 
  UploadedFiles,
  UseInterceptors, 
  UseGuards, 
  Body, 
  Param, 
  Res, 
  BadRequestException,
  ParseUUIDPipe,
  StreamableFile,
  Header,
  Query
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService, FileType } from './storage.service';

export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB

type UploadResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

@ApiTags('Storage')
@ApiBearerAuth('JWT-auth')
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 20MB)',
        },
      },
    },
  })
  @ApiQuery({ name: 'type', description: 'File type (image, video, document, audio)', required: false, enum: FileType })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'uploads/1234567890-filename.jpg' },
            url: { type: 'string', example: 'http://localhost:9000/chatrix/uploads/1234567890-filename.jpg' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No file uploaded or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') fileType?: FileType,
  ): Promise<UploadResponse> {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      
      // Basic file validation
      if (file.size > MAX_UPLOAD_SIZE) {
        throw new BadRequestException(`File too large. Max size is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
      }

      const result = await this.storageService.uploadFile(file, fileType);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        };
      } else {
        return {
          success: false,
          error: 'Failed to upload file'
        };
      }
    }
  }

  @Post('upload/multiple')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Multiple files to upload (max 20MB each)',
        },
      },
    },
  })
  @ApiQuery({ name: 'type', description: 'File type (image, video, document, audio)', required: false, enum: FileType })
  @ApiResponse({
    status: 200,
    description: 'Files uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', example: 'uploads/1234567890-file1.jpg' },
              url: { type: 'string', example: 'http://localhost:9000/chatrix/uploads/1234567890-file1.jpg' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No files uploaded or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('type') fileType?: FileType,
  ): Promise<UploadResponse> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }

      // Validate each file
      for (const file of files) {
        if (file.size > MAX_UPLOAD_SIZE) {
          throw new BadRequestException(`File ${file.originalname} is too large. Max size is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
        }
      }

      const uploadPromises = files.map(file => 
        this.storageService.uploadFile(file, fileType)
      );
      
      const results = await Promise.all(uploadPromises);
      
      return {
        success: true,
        data: results
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  @Get('file/:key')
  @ApiOperation({ summary: 'Download a file' })
  @ApiParam({ name: 'key', description: 'File key/path in storage' })
  @ApiResponse({ status: 200, description: 'File download' })
  @ApiResponse({ status: 400, description: 'File not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Header('Content-Type', 'application/octet-stream')
  @Header('Content-Disposition', 'attachment')
  async getFile(
    @Param('key') key: string,
    @Res() res: Response
  ) {
    try {
      const fileStream = await this.storageService.getFileStream(key);
      fileStream.pipe(res);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'File not found';
      throw new BadRequestException(errorMessage);
    }
  }

  @Get('preview/:key')
  @ApiOperation({ summary: 'Preview a file' })
  @ApiParam({ name: 'key', description: 'File key/path in storage' })
  @ApiResponse({ status: 200, description: 'File preview' })
  @ApiResponse({ status: 400, description: 'File not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async previewFile(
    @Param('key') key: string,
    @Res() res: Response
  ) {
    try {
      const fileStream = await this.storageService.getFileStream(key);
      
      // Set appropriate content type for preview
      const mimeType = this.storageService.getMimeType(key);
      res.set('Content-Type', mimeType);
      
      fileStream.pipe(res);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'File not found';
      throw new BadRequestException(errorMessage);
    }
  }
}