import { Controller, Post, UseGuards, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Media')
@ApiBearerAuth('JWT-auth')
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) { }

  @Post('upload')
  @ApiOperation({ summary: 'Upload media file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Media file to upload',
        },
        type: {
          type: 'string',
          enum: ['post', 'story', 'chat', 'avatar'],
          example: 'post',
          description: 'Media type',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'c0d5ec9f5824f70015a1c012' },
        url: { type: 'string', example: 'https://example.com/media/uploaded123.jpg' },
        type: { type: 'string', example: 'image' },
        width: { type: 'number', example: 1080 },
        height: { type: 'number', example: 1350 },
        size: { type: 'number', example: 1234567 },
        mime_type: { type: 'string', example: 'image/jpeg' },
        created_at: { type: 'string', example: '2023-04-10T21:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or file type not supported' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type?: 'post' | 'story' | 'chat' | 'avatar',
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const result = await this.mediaService.uploadFile(
      file.buffer,
      file.mimetype,
      type || 'post',
    );

    return {
      key: result.key,
      url: result.url,
    };
  }
}

