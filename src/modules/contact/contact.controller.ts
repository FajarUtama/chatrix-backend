import { Controller, Post, Get, Patch, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddContactDto } from './dto/add-contact.dto';

@ApiTags('Contacts')
@ApiBearerAuth('JWT-auth')
@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) { }

  @Post('sync')
  @ApiOperation({ summary: 'Sync contacts from phone numbers' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phones: {
          type: 'array',
          items: { type: 'string' },
          example: ['+1234567891', '+1234567892'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Contacts synced successfully', schema: { type: 'object', properties: { message: { type: 'string', example: 'Contacts synced' } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncContacts(
    @CurrentUser() user: { userId: string },
    @Body() body: { phones: string[] },
  ) {
    await this.contactService.syncContacts(user.userId, body.phones);
    return { message: 'Contacts synced' };
  }

  @Get()
  @ApiOperation({ summary: 'Get user contacts' })
  @ApiQuery({ name: 'query', description: 'Search query', required: false })
  @ApiQuery({ name: 'limit', description: 'Number of contacts to return (default: 20, max: 100)', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Contacts retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
          username: { type: 'string', example: 'janedoe' },
          full_name: { type: 'string', example: 'Jane Doe', description: 'Nama asli dari akun' },
          contact_name: { type: 'string', example: 'Jane - Teman Kantor', description: 'Nama yang diberikan oleh penyimpan kontak (optional)' },
          avatar_url: { type: 'string', example: 'http://localhost:9000/chatrix-bucket/avatars/jane-avatar.jpg' },
          phone: { type: 'string', example: '+1234567891' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getContacts(@CurrentUser() user: { userId: string }) {
    return this.contactService.getContacts(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a contact' })
  @ApiResponse({
    status: 200,
    description: 'Contact added successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Contact added successfully' },
        data: {
          type: 'object',
          properties: {
            contact: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addContact(
    @CurrentUser() user: { userId: string },
    @Body() addContactDto: AddContactDto
  ) {
    let identifier: string;

    // Determine which identifier to use based on the type
    switch (addContactDto.type) {
      case 'phone':
        if (!addContactDto.phone) {
          throw new BadRequestException('Phone number is required');
        }
        identifier = addContactDto.phone;
        break;

      case 'username':
        if (!addContactDto.username) {
          throw new BadRequestException('Username is required');
        }
        identifier = addContactDto.username;
        break;

      case 'email':
        if (!addContactDto.email) {
          throw new BadRequestException('Email is required');
        }
        identifier = addContactDto.email;
        break;

      default:
        throw new BadRequestException('Invalid contact type');
    }

    const result = await this.contactService.addContact(
      user.userId,
      addContactDto.type,
      identifier,
      addContactDto.name
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      status: 'success',
      message: result.message,
      data: {
        contact: result.contact
      }
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact name' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contact_name: { type: 'string', example: 'Jane - Teman Kantor' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Contact updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Contact updated successfully' },
        contact: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '60d5ec9f5824f70015a1c002' },
            username: { type: 'string', example: 'janedoe' },
            full_name: { type: 'string', example: 'Jane Doe' },
            contact_name: { type: 'string', example: 'Jane - Teman Kantor' },
            avatar_url: { type: 'string', example: 'http://localhost:9000/avatars/jane.jpg' },
            phone: { type: 'string', example: '+1234567891' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async updateContact(
    @CurrentUser() user: { userId: string },
    @Param('id') contactUserId: string,
    @Body() body: { contact_name: string }
  ) {
    const result = await this.contactService.updateContact(
      user.userId,
      contactUserId,
      body.contact_name
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      success: true,
      message: result.message,
      contact: result.contact
    };
  }
}
