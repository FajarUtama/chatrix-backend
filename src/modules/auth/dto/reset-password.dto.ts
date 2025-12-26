import { IsEmail, IsNotEmpty, IsString, Length, MinLength, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Email address of the user',
        example: 'user@example.com',
    })
    @Transform(({ value }) => value?.trim())
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty({ message: 'Email is required' })
    email!: string;

    @ApiProperty({
        description: 'Username of the user (optional, for additional verification)',
        example: 'johndoe',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
    username?: string;

    @ApiProperty({
        description: '6-digit OTP code',
        example: '123456',
        minLength: 6,
        maxLength: 6,
    })
    @IsString()
    @IsNotEmpty({ message: 'OTP code is required' })
    @Length(6, 6, { message: 'OTP code must be 6 digits' })
    otp_code!: string;

    @ApiProperty({
        description: 'New password (minimum 6 characters)',
        example: 'newSecurePass123',
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty({ message: 'New password is required' })
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    new_password!: string;
}
