import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private configService: ConfigService) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.error('No authorization header found');
      throw new UnauthorizedException('Missing authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.logger.error(`Invalid authorization header format: ${authHeader.substring(0, 20)}...`);
      throw new UnauthorizedException('Invalid authorization header format. Expected: Bearer <token>');
    }

    const token = authHeader.substring(7);

    if (!token) {
      this.logger.error('Empty token provided');
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = jwt.verify(token, this.configService.jwtAccessSecret) as { userId: string; deviceId: string };

      if (!decoded.userId || !decoded.deviceId) {
        this.logger.error('Token missing required fields', { hasUserId: !!decoded.userId, hasDeviceId: !!decoded.deviceId });
        throw new UnauthorizedException('Invalid token payload');
      }
      request.user = { userId: decoded.userId, deviceId: decoded.deviceId };
      return true;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        this.logger.error('Token has expired');
        throw new UnauthorizedException('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        this.logger.error(`JWT error: ${error.message}`, error.stack);
        throw new UnauthorizedException(`Invalid token: ${error.message}`);
      } else {
        this.logger.error(`Unexpected error during token verification: ${(error as any).message}`, (error as any).stack);
        throw new UnauthorizedException('Failed to authenticate token');
      }
    }
  }
}

