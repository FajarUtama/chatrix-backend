import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter!: nodemailer.Transporter;

    constructor(private configService: ConfigService) {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        const smtpHost = this.configService.smtpHost;

        if (smtpHost === 'dummy' || !smtpHost) {
            // Development mode - log emails instead of sending
            this.logger.log('Email service running in DUMMY mode - emails will be logged only');
            this.transporter = nodemailer.createTransport({
                streamTransport: true,
                newline: 'unix',
                buffer: true,
            });
        } else {
            // Production mode - use actual SMTP
            this.transporter = nodemailer.createTransport({
                host: smtpHost,
                port: this.configService.smtpPort,
                secure: this.configService.smtpPort === 465,
                auth: {
                    user: this.configService.smtpUser,
                    pass: this.configService.smtpPassword,
                },
            });
        }
    }

    async sendOtpEmail(email: string, otpCode: string, purpose: string): Promise<void> {
        const subject = this.getEmailSubject(purpose);
        const html = this.getEmailTemplate(otpCode, purpose);

        const mailOptions = {
            from: `"${this.configService.smtpFromName}" <${this.configService.smtpFromEmail}>`,
            to: email,
            subject,
            html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);

            if (this.configService.smtpHost === 'dummy' || !this.configService.smtpHost) {
                this.logger.log(`[DUMMY EMAIL] To: ${email}, Subject: ${subject}, OTP: ${otpCode}`);
            } else {
                this.logger.log(`Email sent to ${email}: ${info.messageId}`);
            }
        } catch (error) {
            this.logger.error(`Failed to send email to ${email}:`, error);
            throw error;
        }
    }

    private getEmailSubject(purpose: string): string {
        switch (purpose) {
            case 'reset_password':
                return 'Reset Password - Chatrix';
            case 'register':
                return 'Verify Your Email - Chatrix';
            case 'login':
                return 'Login Verification - Chatrix';
            default:
                return 'Verification Code - Chatrix';
        }
    }

    private getEmailTemplate(otpCode: string, purpose: string): string {
        const title = purpose === 'reset_password' ? 'Reset Your Password' : 'Verify Your Email';
        const message = purpose === 'reset_password'
            ? 'You requested to reset your password. Use the code below to complete the process:'
            : 'Use the code below to verify your email:';

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-code { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; color: #667eea; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 ${title}</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${message}</p>
            <div class="otp-code">${otpCode}</div>
            <div class="warning">
              <strong>⚠️ Important:</strong> This code will expire in 10 minutes. Do not share this code with anyone.
            </div>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Chatrix. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }
}
