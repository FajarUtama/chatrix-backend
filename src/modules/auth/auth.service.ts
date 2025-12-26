import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { User, UserDocument } from '../user/schemas/user.schema';
import { Session, SessionDocument } from '../session/schemas/session.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '../../config/config.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { OtpService } from '../../infrastructure/otp/otp.service';
import { UrlNormalizerService } from '../../common/services/url-normalizer.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private configService: ConfigService,
    private minioService: MinioService,
    private otpService: OtpService,
    private urlNormalizer: UrlNormalizerService,
  ) { }

  async register(registerDto: RegisterDto, deviceId: string, avatar?: Express.Multer.File): Promise<{ user: any; access_token: string; refresh_token: string }> {
    const { phone, username, password, full_name, email } = registerDto;

    // Check if phone already exists
    const existingPhone = await this.userModel.findOne({ phone }).exec();
    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    // Check if username already exists
    const existingUsername = await this.userModel.findOne({ username }).exec();
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await this.userModel.findOne({ email }).exec();
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Upload avatar if provided
    let avatarUrl: string | undefined;
    if (avatar) {
      const timestamp = Date.now();
      const key = `avatars/temp-${timestamp}-${avatar.originalname}`;
      const uploaded = await this.minioService.upload(
        avatar.buffer,
        avatar.mimetype,
        key
      );
      avatarUrl = uploaded.url;
    }

    // Create user
    const user = await this.userModel.create({
      phone,
      username,
      password_hash: passwordHash,
      full_name: full_name || username,
      ...(email && { email, email_verified: false }),
      ...(avatarUrl && { avatar_url: avatarUrl }),
    });

    // If avatar was uploaded, update the key with the actual user ID
    if (avatar && avatarUrl) {
      const timestamp = Date.now();
      const newKey = `avatars/${user._id}/${timestamp}-${avatar.originalname}`;
      const uploaded = await this.minioService.upload(
        avatar.buffer,
        avatar.mimetype,
        newKey
      );

      // Delete the temporary file
      const tempKey = `avatars/temp-${timestamp}-${avatar.originalname}`;
      try {
        await this.minioService.deleteFile(tempKey);
      } catch (error) {
        // Ignore deletion errors
      }

      // Update user with new avatar URL
      user.avatar_url = uploaded.url;
      await user.save();
    }

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), deviceId);

    return {
      user: {
        id: user._id,
        phone: user.phone,
        username: user.username,
        full_name: user.full_name,
        avatar_url: this.urlNormalizer.normalizeUrl(user.avatar_url),
        email: user.email,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, deviceId: string): Promise<{ user: any; access_token: string; refresh_token: string }> {
    const { phoneOrUsername, password } = loginDto;

    // Find user by phone or username
    const user = await this.userModel.findOne({
      $or: [{ phone: phoneOrUsername }, { username: phoneOrUsername }],
    }).exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.last_login_at = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), deviceId);

    return {
      user: {
        id: user._id,
        phone: user.phone,
        username: user.username,
        full_name: user.full_name,
        avatar_url: this.urlNormalizer.normalizeUrl(user.avatar_url),
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string, deviceId: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.configService.jwtRefreshSecret) as { userId: string; deviceId: string };

      if (decoded.deviceId !== deviceId) {
        throw new UnauthorizedException('Invalid device');
      }

      // Find session
      const session = await this.sessionModel.findOne({
        user_id: decoded.userId,
        device_id: deviceId,
      }).exec();

      if (!session) {
        throw new UnauthorizedException('Session not found');
      }

      // Check if session expired
      if (new Date() > session.expires_at) {
        throw new UnauthorizedException('Session expired');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(decoded.userId, deviceId);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(userId: string, deviceId: string): Promise<{ access_token: string; refresh_token: string }> {
    // Generate access token
    const accessToken = jwt.sign(
      { userId, deviceId },
      this.configService.jwtAccessSecret,
      { expiresIn: this.configService.jwtAccessExpiresIn as any },
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId, deviceId },
      this.configService.jwtRefreshSecret,
      { expiresIn: this.configService.jwtRefreshExpiresIn as any },
    );

    // Hash refresh token for storage
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save or update session
    await this.sessionModel.findOneAndUpdate(
      { user_id: userId, device_id: deviceId },
      {
        user_id: userId,
        device_id: deviceId,
        refresh_token_hash: refreshTokenHash,
        expires_at: expiresAt,
      },
      { upsert: true, new: true },
    ).exec();

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    // Find user by email
    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      throw new UnauthorizedException('Email not found');
    }

    // Generate and send OTP
    await this.otpService.generateOtpForEmail(email, 'reset_password');

    return {
      message: 'OTP sent to email',
    };
  }

  async verifyResetOtp(email: string, username: string | undefined, otpCode: string): Promise<{ valid: boolean }> {
    // If username is provided, verify both email and username match
    if (username) {
      const user = await this.userModel.findOne({ email, username }).exec();
      if (!user) {
        throw new UnauthorizedException('Invalid email or username');
      }
    } else {
      // If username not provided, just verify email exists
      const user = await this.userModel.findOne({ email }).exec();
      if (!user) {
        throw new UnauthorizedException('Email not found');
      }
    }

    const isValid = await this.otpService.verifyOtpByEmail(
      email,
      otpCode,
      'reset_password',
    );

    return { valid: isValid };
  }

  async resetPassword(
    email: string,
    username: string | undefined,
    otpCode: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Verify OTP one final time
    const isValid = await this.otpService.verifyOtpByEmail(
      email,
      otpCode,
      'reset_password',
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Find user by email first (case-insensitive)
    console.log('🔍 DEBUG: Searching for user with email:', email);
    console.log('🔍 DEBUG: Email type:', typeof email);
    console.log('🔍 DEBUG: Email length:', email?.length);
    const user = await this.userModel.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    }).exec();
    console.log('🔍 DEBUG: User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('🔍 DEBUG: User email from DB:', user.email);
      console.log('🔍 DEBUG: User username from DB:', user.username);
    }
    if (!user) {
      throw new UnauthorizedException('Email not found');
    }

    // If username is provided, verify it matches
    if (username && user.username !== username) {
      throw new UnauthorizedException('Invalid email or username');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password_hash = passwordHash;
    await user.save();

    // Invalidate all existing sessions for security
    await this.sessionModel.deleteMany({ user_id: user._id.toString() }).exec();

    return {
      message: 'Password reset successful',
    };
  }

  async requestEmailVerification(userId: string, email: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.email !== email) {
      throw new UnauthorizedException('Email does not match user account');
    }
    if (user.email_verified) {
      throw new ConflictException('Email is already verified');
    }
    await this.otpService.generateOtpForEmail(email, 'email_verification');
    return { message: 'Verification OTP sent to email' };
  }

  async verifyEmail(userId: string, email: string, otpCode: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.email !== email) {
      throw new UnauthorizedException('Email does not match user account');
    }
    if (user.email_verified) {
      throw new ConflictException('Email is already verified');
    }
    const isValid = await this.otpService.verifyOtpByEmail(email, otpCode, 'email_verification');
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    user.email_verified = true;
    await user.save();
    return { message: 'Email verified successfully' };
  }
}

