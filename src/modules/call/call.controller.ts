import { Controller, Post, Get, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CallService } from './call.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Calls')
@ApiBearerAuth('JWT-auth')
@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallController {
  constructor(private readonly callService: CallService) { }

  @Post('log')
  @ApiOperation({ summary: 'Log a call' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        callee_id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
        type: { type: 'string', enum: ['voice', 'video'], example: 'video' },
        started_at: { type: 'string', format: 'date-time', example: '2023-04-10T22:00:00.000Z' },
        ended_at: { type: 'string', format: 'date-time', example: '2023-04-10T22:05:30.000Z' },
        status: { type: 'string', example: 'ended' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Call logged successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'd0d5ec9f5824f70015a1c013' },
        caller_id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        callee_id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
        type: { type: 'string', example: 'video' },
        status: { type: 'string', example: 'ended' },
        started_at: { type: 'string', example: '2023-04-10T22:00:00.000Z' },
        ended_at: { type: 'string', example: '2023-04-10T22:05:30.000Z' },
        duration: { type: 'number', example: 330 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid call data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logCall(
    @CurrentUser() user: { userId: string },
    @Body() body: {
      callee_id: string;
      type: 'voice' | 'video';
      started_at?: Date;
      ended_at?: Date;
      status: string;
    },
  ) {
    return this.callService.logCall({
      caller_id: user.userId,
      ...body,
    });
  }

  @Get('history')
  @ApiOperation({ summary: 'Get call history' })
  @ApiResponse({
    status: 200,
    description: 'Call history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          caller_id: { type: 'string' },
          callee_id: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string' },
          started_at: { type: 'string' },
          ended_at: { type: 'string' },
          duration: { type: 'number' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCallHistory(@CurrentUser() user: { userId: string }) {
    return this.callService.getCallHistory(user.userId);
  }
}

