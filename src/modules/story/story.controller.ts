import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { StoryService } from './story.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService, FileType } from '../storage/storage.service';

@ApiTags('Stories')
@ApiBearerAuth('JWT-auth')
@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoryController {
  constructor(
    private readonly storyService: StoryService,
    private readonly storageService: StorageService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new story' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        media: {
          type: 'string',
          format: 'binary',
          description: 'Media file (image or video)',
        },
        caption: { type: 'string', example: 'My story!' },
        visibility: { type: 'string', example: 'public', enum: ['public', 'followers', 'following'] },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Story created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'a0d5ec9f5824f70015a1c008' },
        user_id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        media: {
          type: 'object',
          properties: {
            url: { type: 'string', example: 'https://example.com/stories/story123.jpg' },
            type: { type: 'string', example: 'image' },
            width: { type: 'number', example: 1080 },
            height: { type: 'number', example: 1920 },
          },
        },
        caption: { type: 'string', example: 'My story!' },
        view_count: { type: 'number', example: 0 },
        expires_at: { type: 'string', example: '2023-04-11T20:00:00.000Z' },
        created_at: { type: 'string', example: '2023-04-10T20:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 413, description: 'Media file too large' })
  @UseInterceptors(FileInterceptor('media'))
  async createStory(
    @CurrentUser() user: { userId: string, username: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string, visibility?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No media file provided');
    }

    try {
      // Upload the file to storage
      const uploadResult = await this.storageService.uploadFile(file, FileType.IMAGE);

      // Get the public URL
      const mediaUrl = uploadResult.url.startsWith('http')
        ? uploadResult.url
        : `http://${uploadResult.url}`;  // Ensure URL has protocol

      // Create story with the uploaded file URL and user info
      return this.storyService.createStory({
        userId: user.userId,
        username: user.username,
        media: mediaUrl,
        mediaType: file.mimetype.startsWith('image/') ? 'image' : 'video',
        mediaKey: uploadResult.key,
        caption: body.caption || '',
        visibility: (body.visibility as 'public' | 'followers' | 'following') || 'public',
      });
    } catch (error) {
      console.error('Error creating story:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create story';
      throw new BadRequestException(errorMessage);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get stories' })
  @ApiResponse({
    status: 200,
    description: 'Stories retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'a0d5ec9f5824f70015a1c008' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
              username: { type: 'string', example: 'johndoe' },
              full_name: { type: 'string', example: 'John Doe' },
              avatar_url: { type: 'string', example: 'https://example.com/avatars/john-avatar.jpg' },
            },
          },
          media: {
            type: 'object',
            properties: {
              url: { type: 'string', example: 'https://example.com/stories/story123.jpg' },
              type: { type: 'string', example: 'image' },
            },
          },
          caption: { type: 'string', example: 'My story!' },
          visibility: { type: 'string', example: 'public' },
          is_viewed: { type: 'boolean', example: true },
          expires_at: { type: 'string', example: '2023-04-11T20:00:00.000Z' },
          created_at: { type: 'string', example: '2023-04-10T20:00:00.000Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStories(@CurrentUser() user: { userId: string }) {
    return this.storyService.getStories(user.userId);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get stories from following' })
  @ApiResponse({
    status: 200,
    description: 'Feed stories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        stories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
                  username: { type: 'string', example: 'janedoe' },
                  full_name: { type: 'string', example: 'Jane Doe' },
                  avatar_url: { type: 'string', example: 'https://example.com/avatars/jane-avatar.jpg' },
                },
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'a0d5ec9f5824f70015a1c008' },
                    media: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', example: 'https://example.com/stories/story123.jpg' },
                        type: { type: 'string', example: 'image' },
                      },
                    },
                    caption: { type: 'string', example: 'My story!' },
                    visibility: { type: 'string', example: 'public' },
                    is_viewed: { type: 'boolean', example: false },
                    expires_at: { type: 'string', example: '2023-04-11T20:00:00.000Z' },
                    created_at: { type: 'string', example: '2023-04-10T20:00:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFeedStories(@CurrentUser() user: { userId: string }) {
    try {
      return await this.storyService.getFeedStories(user.userId);
    } catch (error) {
      console.error('Error fetching feed stories:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch feed stories';
      throw new BadRequestException(errorMessage);
    }
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Mark story as viewed' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({
    status: 200,
    description: 'Story marked as viewed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Story marked as viewed' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markStoryAsViewed(
    @CurrentUser() user: { userId: string },
    @Param('id') storyId: string,
  ) {
    await this.storyService.markAsViewed(storyId, user.userId);
    return {
      success: true,
      message: 'Story marked as viewed',
    };
  }

  @Get(':id/viewers')
  @ApiOperation({ summary: 'Get list of users who viewed a story' })
  @ApiParam({ name: 'id', description: 'Story ID' })
  @ApiResponse({
    status: 200,
    description: 'List of viewers retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
              username: { type: 'string', example: 'janedoe' },
              full_name: { type: 'string', example: 'Jane Doe' },
              avatar_url: { type: 'string', example: 'http://localhost:9000/avatars/jane.jpg' },
            },
          },
          viewed_at: { type: 'string', example: '2023-04-10T20:30:00.000Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the owner of this story' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStoryViewers(
    @CurrentUser() user: { userId: string },
    @Param('id') storyId: string,
  ) {
    try {
      return await this.storyService.getStoryViewers(storyId, user.userId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get viewers';
      if (errorMessage.includes('not found') || errorMessage.includes('unauthorized')) {
        throw new BadRequestException(errorMessage);
      }
      throw new BadRequestException('Failed to get story viewers');
    }
  }
}
