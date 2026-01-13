import { Controller, Post, Body, Headers, UnauthorizedException, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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
        email: { type: 'string', example: 'user@example.com' },
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
            email: { type: 'string', example: 'user@example.com' },
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

  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent to email successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'OTP sent to email' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email format' })
  @ApiResponse({ status: 401, description: 'Email not found' })
  async requestPasswordReset(@Body() requestDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestDto.email);
  }

  @Post('password-reset/verify-otp')
  @ApiOperation({ summary: 'Verify password reset OTP code' })
  @ApiResponse({
    status: 200,
    description: 'OTP verification result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async verifyResetOtp(@Body() verifyDto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(verifyDto.email, verifyDto.username, verifyDto.otp_code);
  }

  @Post('password-reset/reset')
  @ApiOperation({ summary: 'Reset password with verified OTP' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password reset successful' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP / User not found' })
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetDto.email,
      resetDto.username,
      resetDto.otp_code,
      resetDto.new_password,
    );
  }

  @Post('email/request-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Request email verification OTP' })
  @ApiResponse({
    status: 200,
    description: 'Verification OTP sent to email',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Verification OTP sent to email' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized / Email does not match user account' })
  @ApiResponse({ status: 409, description: 'Email is already verified' })
  async requestEmailVerification(@Request() req: any, @Body() dto: RequestEmailVerificationDto) {
    const userId = req.user.userId;
    return this.authService.requestEmailVerification(userId, dto.email);
  }

  @Post('email/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email verified successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized / Invalid or expired OTP / Email does not match user account' })
  @ApiResponse({ status: 409, description: 'Email is already verified' })
  async verifyEmail(@Request() req: any, @Body() dto: VerifyEmailDto) {
    const userId = req.user.userId;
    return this.authService.verifyEmail(userId, dto.email, dto.otp_code);
  }

  @Post('device-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register or update FCM device token for push notifications' })
  @ApiResponse({
    status: 200,
    description: 'Device token registered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Device token registered successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async registerDeviceToken(@Request() req: any, @Body() dto: RegisterDeviceTokenDto) {
    const userId = req.user.userId;
    return this.authService.registerDeviceToken(
      userId,
      dto.device_id,
      dto.fcm_token,
      dto.platform,
    );
  }
}

