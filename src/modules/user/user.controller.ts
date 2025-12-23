import { Controller, Get, Patch, Post, Put, Delete, Body, UseGuards, Query, Param, NotFoundException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        phone: { type: 'string', example: '+1234567890' },
        username: { type: 'string', example: 'johndoe' },
        full_name: { type: 'string', example: 'John Doe' },
        avatar_url: { type: 'string', example: 'https://example.com/avatar.jpg' },
        bio: { type: 'string', example: 'Hello, I\'m John!' },
        email: { type: 'string', example: 'john@example.com' },
        email_verified: { type: 'boolean', example: false },
        created_at: { type: 'string', example: '2023-01-01T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: { userId: string }) {
    const userDoc = await this.userService.findById(user.userId);
    if (!userDoc) {
      throw new Error('User not found');
    }

    return {
      id: userDoc._id,
      phone: userDoc.phone,
      username: userDoc.username,
      full_name: userDoc.full_name,
      avatar_url: userDoc.avatar_url,
      bio: userDoc.bio,
      email: userDoc.email,
      email_verified: userDoc.email_verified,
      created_at: userDoc.created_at,
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string', example: 'John Updated' },
        bio: { type: 'string', example: 'New bio here' },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Profile picture file (image only)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        phone: { type: 'string', example: '+1234567890' },
        username: { type: 'string', example: 'johndoe' },
        full_name: { type: 'string', example: 'John Updated' },
        avatar_url: { type: 'string', example: 'https://example.com/avatars/60d5ec9f5824f70015a1c001/1234567890-avatar.jpg' },
        bio: { type: 'string', example: 'New bio here' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or invalid file type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('avatar'))
  async updateMe(
    @CurrentUser() user: { userId: string },
    @Body() updateData: { full_name?: string; bio?: string },
    @UploadedFile() avatar?: Express.Multer.File
  ) {
    // Prepare update data with proper typing
    const updatePayload: { full_name?: string; bio?: string; avatar_url?: string } = { ...updateData };

    // Handle avatar upload if provided
    if (avatar) {
      // Validate file type
      if (!avatar.mimetype.startsWith('image/')) {
        throw new BadRequestException('Only image files are allowed for avatar');
      }

      // Upload avatar and get URL
      const avatarUrl = await this.userService.uploadAvatar(user.userId, avatar);
      updatePayload.avatar_url = avatarUrl;
    }

    const updated = await this.userService.updateUser(user.userId, updatePayload);
    if (!updated) {
      throw new Error('User not found');
    }

    return {
      id: updated._id,
      phone: updated.phone,
      username: updated.username,
      full_name: updated.full_name,
      avatar_url: updated.avatar_url,
      bio: updated.bio,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', description: 'Search query (minimum 2 characters)', required: true })
  @ApiResponse({
    status: 200,
    description: 'Users found',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
          phone: { type: 'string', example: '+1234567891' },
          username: { type: 'string', example: 'janedoe' },
          full_name: { type: 'string', example: 'Jane Doe' },
          avatar_url: { type: 'string', example: 'https://example.com/jane-avatar.jpg' },
          bio: { type: 'string', example: 'Photography enthusiast' },
        },
      },
    },
  })
  async searchUsers(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return [];
    }

    const users = await this.userService.searchUsers(query);

    return users.map(user => ({
      id: user._id,
      phone: user.phone,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
    }));
  }

  @Get(':phone')
  @ApiOperation({ summary: 'Get user by phone number' })
  @ApiParam({ name: 'phone', description: 'Phone number' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
        phone: { type: 'string', example: '+1234567891' },
        username: { type: 'string', example: 'janedoe' },
        full_name: { type: 'string', example: 'Jane Doe' },
        avatar_url: { type: 'string', example: 'https://example.com/jane-avatar.jpg' },
        bio: { type: 'string', example: 'Photography enthusiast' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByPhone(@Param('phone') phone: string) {
    // Remove any non-digit characters and the leading '+' if present
    const cleanPhone = phone.replace(/\D/g, '').replace(/^\+/, '');

    const user = await this.userService.findByPhone(cleanPhone);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user._id,
      phone: user.phone,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
    };
  }
}
