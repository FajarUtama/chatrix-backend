import { IsPhoneNumber, IsString, IsOptional, IsIn, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddContactDto {
  @ApiProperty({
    description: 'Contact type',
    enum: ['phone', 'username', 'email'],
    example: 'phone',
  })
  @IsIn(['phone', 'username', 'email'], { message: 'Invalid contact type' })
  type: 'phone' | 'username' | 'email' = 'phone';

  @ApiPropertyOptional({
    description: 'Phone number (required if type is phone)',
    example: '+1234567891',
  })
  @ValidateIf(o => o.type === 'phone')
  @IsPhoneNumber('ID', { message: 'Invalid phone number format' })
  phone!: string;

  @ApiPropertyOptional({
    description: 'Username (required if type is username)',
    example: 'janedoe',
  })
  @ValidateIf(o => o.type === 'username')
  @IsString({ message: 'Username must be a string' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Email (required if type is email)',
    example: 'jane@example.com',
  })
  @ValidateIf(o => o.type === 'email')
  @IsString({ message: 'Email must be a string' })
  email!: string;

  @ApiPropertyOptional({
    description: 'Contact name',
    example: 'Jane Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;
}
