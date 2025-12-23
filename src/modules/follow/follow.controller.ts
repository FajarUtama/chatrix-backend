import { Controller, Post, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { FollowService } from './follow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Follows')
@ApiBearerAuth('JWT-auth')
@Controller('follow')
@UseGuards(JwtAuthGuard)
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':username')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiParam({ name: 'username', description: 'Username of the user to follow' })
  @ApiResponse({
    status: 201,
    description: 'User followed successfully',
    schema: {
      type: 'object',
      properties: {
        follower_id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        following_id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
        status: { type: 'string', example: 'pending', enum: ['pending', 'accepted'] },
        created_at: { type: 'string', example: '2023-04-10T20:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already following this user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async follow(
    @CurrentUser() user: { userId: string },
    @Param('username') username: string,
  ) {
    await this.followService.follow(user.userId, username);
    return { message: 'Followed successfully' };
  }

  @Delete(':username')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiParam({ name: 'username', description: 'Username of the user to unfollow' })
  @ApiResponse({ status: 204, description: 'User unfollowed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Follow relationship not found' })
  async unfollow(
    @CurrentUser() user: { userId: string },
    @Param('username') username: string,
  ) {
    await this.followService.unfollow(user.userId, username);
    return { message: 'Unfollowed successfully' };
  }

  @Get('me/followers')
  @ApiOperation({ summary: 'Get followers' })
  @ApiResponse({
    status: 200,
    description: 'Followers retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          full_name: { type: 'string' },
          avatar_url: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFollowers(@CurrentUser() user: { userId: string }) {
    return this.followService.getFollowers(user.userId);
  }

  @Get('me/following')
  @ApiOperation({ summary: 'Get following' })
  @ApiResponse({
    status: 200,
    description: 'Following list retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          full_name: { type: 'string' },
          avatar_url: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFollowing(@CurrentUser() user: { userId: string }) {
    return this.followService.getFollowing(user.userId);
  }
}

