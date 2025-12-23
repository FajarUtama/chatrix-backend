import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
    constructor(private readonly reportService: ReportService) { }

    @Post()
    @ApiOperation({ summary: 'Report a user' })
    @ApiResponse({
        status: 200,
        description: 'Report created successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                id: { type: 'string', example: 'c0d5ec9f5824f70015a1c010' },
                created_at: { type: 'string', example: '2023-04-10T20:30:00.000Z' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async createReport(
        @CurrentUser() user: { userId: string },
        @Body() createReportDto: CreateReportDto,
    ) {
        const result = await this.reportService.createReport(
            user.userId,
            createReportDto,
        );
        return {
            success: true,
            ...result,
        };
    }
}
