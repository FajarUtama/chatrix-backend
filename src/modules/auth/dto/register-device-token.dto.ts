import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({
    description: 'FCM token from Firebase Cloud Messaging',
    example: 'dK3jH9fL2mN5pQ8rT1vW4xY7zA0bC3dE6fG9hI2jK5',
  })
  @IsString()
  @IsNotEmpty()
  fcm_token!: string;

  @ApiProperty({
    description: 'Device ID (should match the device_id used during login)',
    example: 'device-123-456',
  })
  @IsString()
  @IsNotEmpty()
  device_id!: string;

  @ApiProperty({
    description: 'Platform type',
    enum: ['android', 'ios'],
    example: 'android',
  })
  @IsString()
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}
