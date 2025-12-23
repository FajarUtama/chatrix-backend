import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Phone number or username',
    example: 'johndoe',
  })
  @IsString()
  @IsNotEmpty()
  @IsString()
  @IsNotEmpty()
  phoneOrUsername!: string;

  @ApiProperty({
    description: 'Password',
    example: 'secure123',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

