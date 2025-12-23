import { Controller, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BlockService } from './block.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Block')
@ApiBearerAuth('JWT-auth')
@Controller('block')
@UseGuards(JwtAuthGuard)
export class BlockController {
    constructor(private readonly blockService: BlockService) { }

  @Post(':userId')
  @ApiOperation({ summary: 'Block a user' })
  @ApiParam({ name: 'userId', description: 'ID of the user to block' })
  @ApiResponse({
    status: 200,
    description: 'User blocked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async blockUser(
    @CurrentUser() user: { userId: string },
    @Param('userId') blockedUserId: string,
  ) {
    await this.blockService.blockUser(user.userId, blockedUserId);
    return { success: true };
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'userId', description: 'ID of the user to unblock' })
  @ApiResponse({
    status: 200,
    description: 'User unblocked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Block relationship not found' })
  async unblockUser(
    @CurrentUser() user: { userId: string },
    @Param('userId') blockedUserId: string,
  ) {
    await this.blockService.unblockUser(user.userId, blockedUserId);
    return { success: true };
  }
}
