import { Controller, Post, Body, Headers, UnauthorizedException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '+1234567890' },
        username: { type: 'string', example: 'johndoe' },
        password: { type: 'string', example: 'secure123' },
        full_name: { type: 'string', example: 'John Doe' },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Profile picture file (image only)',
        },
      },
    },
  })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device ID for session management (optional, will be generated if not provided)',
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
            phone: { type: 'string', example: '+1234567890' },
            username: { type: 'string', example: 'johndoe' },
            full_name: { type: 'string', example: 'John Doe' },
            avatar_url: { type: 'string', example: 'https://example.com/avatars/60d5ec9f5824f70015a1c001/1234567890-avatar.jpg' },
          },
        },
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or invalid file type' })
  @ApiResponse({ status: 409, description: 'Phone number or username already exists' })
  @UseInterceptors(FileInterceptor('avatar'))
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('x-device-id') deviceId: string,
    @UploadedFile() avatar?: Express.Multer.File
  ) {
    if (!deviceId) {
      deviceId = require('uuid').v4();
    }
    return this.authService.register(registerDto, deviceId, avatar);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device ID for session management (optional, will be generated if not provided)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '60d5ec9f5824f70015a1c001' },
            phone: { type: 'string', example: '+1234567890' },
            username: { type: 'string', example: 'johndoe' },
            full_name: { type: 'string', example: 'John Doe' },
            avatar_url: { type: 'string', example: 'https://example.com/avatar.jpg' },
          },
        },
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Headers('x-device-id') deviceId: string) {
    if (!deviceId) {
      deviceId = require('uuid').v4();
    }
    return this.authService.login(loginDto, deviceId);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device ID that was used during login/registration',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Headers('x-device-id') deviceId: string) {
    if (!deviceId) {
      throw new UnauthorizedException('Device ID required');
    }
    return this.authService.refreshToken(refreshTokenDto.refresh_token, deviceId);
  }
}

