import { Controller, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../chat/schemas/conversation.schema';

@ApiTags('Admin')
@Controller('admin/conversations')
export class AdminConversationController {
    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    ) { }

    @Get('inspect')
    @ApiOperation({ summary: 'Inspect all conversations for data integrity issues' })
    @ApiResponse({
        status: 200,
        description: 'Inspection report',
        schema: {
            type: 'object',
            properties: {
                total: { type: 'number', example: 150 },
                valid: { type: 'number', example: 140 },
                corrupted: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            participant_ids: { type: 'string', example: 'invalid_format' },
                            issue: { type: 'string', example: 'not_an_array' },
                        },
                    },
                },
                selfConversations: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            participant_ids: { type: 'array', items: { type: 'string' } },
                        },
                    },
                },
                unsorted: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            current: { type: 'array', items: { type: 'string' } },
                            sorted: { type: 'array', items: { type: 'string' } },
                        },
                    },
                },
            },
        },
    })
    async inspectConversations() {
        const conversations = await this.conversationModel.find({ type: 'direct' }).exec();

        const report: {
            total: number;
            valid: number;
            corrupted: any[];
            selfConversations: any[];
            unsorted: any[];
        } = {
            total: conversations.length,
            valid: 0,
            corrupted: [],
            selfConversations: [],
            unsorted: [],
        };

        for (const conv of conversations) {
            // Check if participant_ids is an array
            if (!Array.isArray(conv.participant_ids)) {
                report.corrupted.push({
                    id: conv._id,
                    participant_ids: conv.participant_ids,
                    issue: 'not_an_array',
                });
            } else if (conv.participant_ids.length !== 2) {
                report.corrupted.push({
                    id: conv._id,
                    participant_ids: conv.participant_ids,
                    issue: `invalid_length_${conv.participant_ids.length}`,
                });
            } else if (conv.participant_ids[0] === conv.participant_ids[1]) {
                report.selfConversations.push({
                    id: conv._id,
                    participant_ids: conv.participant_ids,
                });
            } else {
                const sorted = [...conv.participant_ids].sort();
                if (conv.participant_ids[0] !== sorted[0] || conv.participant_ids[1] !== sorted[1]) {
                    report.unsorted.push({
                        id: conv._id,
                        current: conv.participant_ids,
                        sorted: sorted,
                    });
                } else {
                    report.valid++;
                }
            }
        }

        return report;
    }

    @Delete('cleanup')
    @ApiOperation({ summary: 'Clean up corrupted conversations and fix unsorted participant IDs' })
    @ApiResponse({
        status: 200,
        description: 'Cleanup completed',
        schema: {
            type: 'object',
            properties: {
                deleted: { type: 'number', example: 5 },
                fixed: { type: 'number', example: 3 },
            },
        },
    })
    async cleanupConversations() {
        // Delete conversations where participant_ids is a string instead of array
        const stringTypeResult = await this.conversationModel.deleteMany({
            type: 'direct',
            participant_ids: { $type: 'string' } as any,
        }).exec();

        // Delete conversations where participant_ids is not an array of length 2
        const conversations = await this.conversationModel.find({ type: 'direct' }).exec();

        let deletedCount = stringTypeResult.deletedCount || 0;
        let fixedCount = 0;

        for (const conv of conversations) {
            // Delete corrupted or self-conversations
            if (!Array.isArray(conv.participant_ids) ||
                conv.participant_ids.length !== 2 ||
                conv.participant_ids[0] === conv.participant_ids[1]) {
                await this.conversationModel.deleteOne({ _id: conv._id });
                deletedCount++;
            } else {
                // Fix unsorted
                const sorted = [...conv.participant_ids].sort();
                if (conv.participant_ids[0] !== sorted[0] || conv.participant_ids[1] !== sorted[1]) {
                    await this.conversationModel.updateOne(
                        { _id: conv._id },
                        { $set: { participant_ids: sorted } }
                    );
                    fixedCount++;
                }
            }
        }

        return {
            deleted: deletedCount,
            fixed: fixedCount,
        };
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a specific conversation by ID' })
    @ApiParam({ name: 'id', description: 'Conversation ID to delete' })
    @ApiResponse({
        status: 200,
        description: 'Conversation deleted successfully',
        schema: {
            type: 'object',
            properties: {
                deleted: { type: 'boolean', example: true },
                id: { type: 'string', example: '80d5ec9f5824f70015a1c004' },
            },
        },
    })
    async deleteConversation(@Param('id') id: string) {
        await this.conversationModel.deleteOne({ _id: id });
        return { deleted: true, id };
    }
}
