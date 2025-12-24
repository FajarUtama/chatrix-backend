import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetOtpDto {
    @ApiProperty({
        description: 'Email address of the user',
        example: 'user@example.com',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty({ message: 'Email is required' })
    email!: string;

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
}
