import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
    @ApiProperty({
        description: 'ID of the user being reported',
        example: '60d5ec9f5824f70015a1c002',
    })
    @IsString()
    @IsNotEmpty()
    reported_user_id!: string;

    @ApiPropertyOptional({
        description: 'ID of the conversation where the issue occurred',
        example: '80d5ec9f5824f70015a1c004',
    })
    @IsString()
    @IsOptional()
    conversation_id?: string;

    @ApiPropertyOptional({
        description: 'Array of message IDs related to the report',
        example: ['90d5ec9f5824f70015a1c005'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    message_ids?: string[];

    @ApiProperty({
        description: 'Reason for the report',
        example: 'Spam or harassment',
    })
    @IsString()
    @IsNotEmpty()
    reason!: string;
}
