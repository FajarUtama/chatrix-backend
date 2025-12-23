import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
    constructor(
        @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    ) { }

    async createReport(
        reporterId: string,
        dto: CreateReportDto,
    ): Promise<{ reportId: string; status: string }> {
        const report = await this.reportModel.create({
            reporter_id: reporterId,
            reported_user_id: dto.reported_user_id,
            conversation_id: dto.conversation_id,
            message_ids: dto.message_ids || [],
            reason: dto.reason,
            status: 'open',
        });

        return {
            reportId: report._id.toString(),
            status: report.status,
        };
    }
}
