import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtpCode, OtpCodeDocument } from '../../modules/auth/schemas/otp-code.schema';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectModel(OtpCode.name) private otpCodeModel: Model<OtpCodeDocument>,
    private configService: ConfigService,
  ) { }

  async generateOtp(
    phone: string,
    email?: string,
    purpose: 'register' | 'login' | 'reset_password' = 'register',
  ): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes
    const expired_at = new Date();
    expired_at.setMinutes(expired_at.getMinutes() + 10);

    // Save OTP code
    await this.otpCodeModel.create({
      phone,
      email,
      code,
      purpose,
      expired_at,
      used: false,
    });

    // Send OTP (dummy implementation)
    await this.sendOtp(phone, email, code, purpose);

    this.logger.log(`Generated OTP for ${phone}, purpose: ${purpose}`);
    return code;
  }

  async verifyOtp(
    phone: string,
    code: string,
    purpose: 'register' | 'login' | 'reset_password',
  ): Promise<boolean> {
    const otpRecord = await this.otpCodeModel
      .findOne({
        phone,
        code,
        purpose,
        used: false,
      })
      .sort({ created_at: -1 })
      .exec();

    if (!otpRecord) {
      return false;
    }

    // Check if expired
    if (new Date() > otpRecord.expired_at) {
      this.logger.warn(`OTP expired for ${phone}`);
      return false;
    }

    // Mark as used
    otpRecord.used = true;
    await otpRecord.save();

    return true;
  }

  private async sendOtp(
    phone: string,
    email: string | undefined,
    code: string,
    purpose: string,
  ): Promise<void> {
    const provider = this.configService.otpProvider;

    if (provider === 'dummy') {
      // Dummy implementation - just log
      this.logger.log(`[DUMMY OTP] Phone: ${phone}, Email: ${email || 'N/A'}, Code: ${code}, Purpose: ${purpose}`);
      return;
    }

    // TODO: Implement actual SMS/Email sending
    // For now, just log
    this.logger.log(`[OTP] Sending to ${phone}${email ? ` and ${email}` : ''}: ${code}`);
  }
}

