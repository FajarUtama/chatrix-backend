import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '../../../config/config.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('No token provided');
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, this.configService.jwtAccessSecret);
            request.user = decoded;
            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
