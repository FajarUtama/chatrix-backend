import { Controller, Post, Get, Param, Body, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post('conversations/ensure')
  @ApiOperation({ 
    summary: 'Ensure conversation exists',
    description: 'Ensure a direct conversation exists with a user. If it exists, returns it. If not, creates a new one. Messages are automatically marked as read when this endpoint is called (when opening an existing conversation).'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        recipientId: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved or created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '80d5ec9f5824f70015a1c004' },
        isGroup: { type: 'boolean', example: false },
        participants: { type: 'array', items: { type: 'object' } },
        lastMessage: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot chat with self' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async ensureConversation(
    @CurrentUser() user: { userId: string },
    @Body() body: { recipientId: string },
  ) {
    return this.chatService.ensureConversation(user.userId, body.recipientId);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', example: '80d5ec9f5824f70015a1c004' },
        content: { type: 'string', example: 'This is a new message' },
        attachments: { type: 'array', items: { type: 'object' } },
        text: { type: 'string' },
        type: { type: 'string', example: 'text', enum: ['text', 'image', 'video'] },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '90d5ec9f5824f70015a1c007' },
        conversation_id: { type: 'string', example: '80d5ec9f5824f70015a1c004' },
        sender_id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
        content: { type: 'string', example: 'This is a new message' },
        type: { type: 'string', example: 'text' },
        media: { type: 'array', items: { type: 'object' } },
        created_at: { type: 'string', example: '2023-04-10T19:00:00.000Z' },
        status: { type: 'string', example: 'sent' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid message content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant in this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async sendMessage(
    @CurrentUser() user: { userId: string },
    @Body() body: { conversationId: string; content: string; attachments?: any, text?: string; type?: string },
  ) {
    // Map 'content' to 'text' if needed or let service handle it.
    // Map 'attachments' to 'media' if needed.
    // Default type to 'text' if not provided (though user requirement implies content usually means text).
    const payload = {
      type: body.type || (body.attachments ? 'image' : 'text'), // Simplistic type inference
      text: body.content,
      media: body.attachments,
      // Pass original body just in case
      ...body
    };
    return this.chatService.createMessage(body.conversationId, user.userId, payload);
  }

  // Legacy endpoint support (optional, but good to keep for now or verify if user wants to keep it)
  // User didn't ask to remove it, but said "Flow send message agar SELALU menggunakan conversationId".
  // Meaning the NEW flow. I will keep the old one for backward compatibility or remove it if I feel confident.
  // I will keep it but maybe it's less important. I'll focus on the new requirements.

  @Post(':userId/messages')
  @ApiOperation({ summary: 'Send a message (legacy endpoint)' })
  @ApiParam({ name: 'userId', description: 'Recipient user ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'text', enum: ['text', 'image', 'video'] },
        text: { type: 'string', example: 'Hello!' },
        media: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendMessageLegacy(
    @CurrentUser() user: { userId: string },
    @Param('userId') otherUserId: string,
    @Body() body: { type: string; text?: string; media?: any },
  ) {
    try {
      const conversation = await this.chatService.createOrGetDirectConversation(
        user.userId,
        otherUserId,
      );
      return this.chatService.createMessage(conversation._id.toString(), user.userId, body);
    } catch (error) {
      throw error;
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get conversations' })
  @ApiQuery({ name: 'limit', description: 'Number of conversations to return (default: 20, max: 50)', required: false, type: Number })
  @ApiQuery({ name: 'before', description: 'Cursor for pagination (ISO date string)', required: false })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        conversations: { type: 'array', items: { type: 'object' } },
        next_cursor: { type: 'string', example: '2023-04-09T10:15:00.000Z' },
        has_more: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConversations(@CurrentUser() user: { userId: string }) {
    return this.chatService.getConversations(user.userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ 
    summary: 'Get messages in a conversation',
    description: 'Get messages in a specific conversation. Messages are automatically marked as read when this endpoint is called without the "before" parameter (first page only). When paginating with "before" parameter, messages will not be automatically marked as read.'
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiQuery({ 
    name: 'limit', 
    description: 'Number of messages to return (default: 20, max: 50)', 
    required: false, 
    type: Number 
  })
  @ApiQuery({ 
    name: 'before', 
    description: 'Cursor for pagination (message ID). If not provided, messages will be automatically marked as read. If provided, messages will NOT be automatically marked as read (for pagination).', 
    required: false 
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        messages: { type: 'array', items: { type: 'object' } },
        next_cursor: { type: 'string', example: '90d5ec9f5824f70015a1c004' },
        has_more: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant in this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(
    @CurrentUser() user: { userId: string },
    @Param('id') conversationId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.chatService.getMessages(conversationId, user.userId, limit, before);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ 
    summary: 'Mark all messages in conversation as read',
    description: 'Manually mark all messages in a conversation as read. Note: This endpoint is now optional as messages are automatically marked as read when opening a chat via GET /chat/conversations/:id/messages (without "before" parameter) or POST /chat/conversations/ensure. This endpoint is still available for special use cases.'
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({
    status: 200,
    description: 'Messages marked as read',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Messages marked as read' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant in this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async markConversationAsRead(
    @CurrentUser() user: { userId: string },
    @Param('id') conversationId: string,
  ) {
    try {
      await this.chatService.markMessagesAsRead(conversationId, user.userId);
      return {
        success: true,
        message: 'Messages marked as read',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark as read';
      throw new BadRequestException(errorMessage);
    }
  }
}
