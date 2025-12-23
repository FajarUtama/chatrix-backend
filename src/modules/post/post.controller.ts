import { Controller, Post, Get, Param, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PostService } from './post.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService, FileType } from '../storage/storage.service';

@ApiTags('Posts')
@ApiBearerAuth('JWT-auth')
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly storageService: StorageService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Media file (image or video)',
        },
        caption: { type: 'string', example: 'Beautiful day at the beach! 🏖️' },
        visibility: { type: 'string', example: 'public', enum: ['public', 'followers', 'following', 'contacts'] },
        tags: { type: 'string', example: 'beach,sunset,vacation' },
        location: { type: 'string', example: 'Bondi Beach' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '70d5ec9f5824f70015a1c003' },
        user_id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        caption: { type: 'string', example: 'Beautiful day at the beach! 🏖️' },
        media: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', example: 'https://example.com/media/beach1.jpg' },
              type: { type: 'string', example: 'image' },
              width: { type: 'number', example: 1080 },
              height: { type: 'number', example: 1350 },
            },
          },
        },
        like_count: { type: 'number', example: 0 },
        comment_count: { type: 'number', example: 0 },
        is_liked: { type: 'boolean', example: false },
        is_saved: { type: 'boolean', example: false },
        created_at: { type: 'string', example: '2023-04-10T15:30:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 413, description: 'Media files too large' })
  @UseInterceptors(FileInterceptor('file'))
  async createPost(
    @CurrentUser() user: { userId: string, username: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      caption?: string,
      visibility?: string,
      tags?: string,
      location?: string
    },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type. Only images (JPEG, PNG, WebP) and videos (MP4) are allowed.');
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 50MB.');
    }

    try {
      const postData = {
        file,
        caption: body.caption,
        visibility: body.visibility as 'public' | 'followers' | 'following' | 'contacts',
        tags: body.tags ? body.tags.split(',').map(tag => tag.trim()) : [],
        ...(body.location && { location: body.location })
      };

      const createdPost = await this.postService.createPost(user.userId, postData);

      return createdPost;
    } catch (error) {
      console.error('Error creating post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
      throw new BadRequestException({
        success: false,
        message: errorMessage,
      });
    }
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get feed' })
  @ApiQuery({ name: 'limit', description: 'Number of posts to return (default: 10, max: 50)', required: false, type: Number })
  @ApiQuery({ name: 'before', description: 'Cursor for pagination (ISO date string)', required: false })
  @ApiResponse({
    status: 200,
    description: 'Feed retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        posts: {
          type: 'array',
          items: { type: 'object' },
        },
        next_cursor: { type: 'string', example: '2023-04-09T12:30:00.000Z' },
        has_more: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFeed(@CurrentUser() user: { userId: string }) {
    return this.postService.getFeed(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post by ID' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Post retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '70d5ec9f5824f70015a1c003' },
        user: { type: 'object' },
        caption: { type: 'string', example: 'Beautiful day at the beach! 🏖️' },
        media: { type: 'array', items: { type: 'object' } },
        like_count: { type: 'number', example: 42 },
        comment_count: { type: 'number', example: 5 },
        is_liked: { type: 'boolean', example: true },
        is_saved: { type: 'boolean', example: false },
        created_at: { type: 'string', example: '2023-04-10T15:30:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to view this post' })
  async getPost(@Param('id') id: string) {
    return this.postService.getPost(id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post liked successfully', schema: { type: 'object', properties: { message: { type: 'string', example: 'Post liked' } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async likePost(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    await this.postService.likePost(id, user.userId);
    return { message: 'Post liked' };
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Comment on a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', example: 'Great post!' },
        type: { type: 'string', example: 'public', enum: ['public', 'private'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Comment added successfully', schema: { type: 'object', properties: { message: { type: 'string', example: 'Comment added' } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async commentOnPost(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { text: string; type?: 'public' | 'private' },
  ) {
    await this.postService.commentOnPost(id, user.userId, body.text, body.type || 'public');
    return { message: 'Comment added' };
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Comments retrieved successfully',
    schema: {
      type: 'array',
      items: { type: 'object' },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getComments(@Param('id') id: string) {
    return this.postService.getComments(id);
  }
}

