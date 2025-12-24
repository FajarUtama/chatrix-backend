import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestEmailVerificationDto {
    @ApiProperty({
        description: 'Email address to verify',
        example: 'user@example.com',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty({ message: 'Email is required' })
    email!: string;
}
