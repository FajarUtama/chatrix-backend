import { IsString, IsNotEmpty, MinLength, IsOptional, Matches, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+1234567890',
    pattern: '^\\+?[1-9]\\d{1,14}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be in valid international format' })
  phone!: string;

  @ApiProperty({
    description: 'Username, minimum 3 characters',
    example: 'johndoe',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @ApiProperty({
    description: 'Password, minimum 6 characters',
    example: 'secure123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    description: 'Email address (optional)',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Full name',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  full_name?: string;
}

