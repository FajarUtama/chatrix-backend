import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Block, BlockDocument } from './schemas/block.schema';

@Injectable()
export class BlockService {
    constructor(
        @InjectModel(Block.name) private blockModel: Model<BlockDocument>,
    ) { }

    async blockUser(blockerId: string, blockedId: string): Promise<void> {
        // Idempotent: use upsert to avoid duplicate key errors
        await this.blockModel.findOneAndUpdate(
            { blocker_id: blockerId, blocked_id: blockedId },
            { blocker_id: blockerId, blocked_id: blockedId },
            { upsert: true },
        ).exec();
    }

    async unblockUser(blockerId: string, blockedId: string): Promise<void> {
        await this.blockModel.deleteOne({
            blocker_id: blockerId,
            blocked_id: blockedId,
        }).exec();
    }

    async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
        const block = await this.blockModel.findOne({
            blocker_id: blockerId,
            blocked_id: blockedId,
        }).exec();
        return !!block;
    }

    async getBlockStatus(
        userId1: string,
        userId2: string,
    ): Promise<{
        iBlocked: boolean;
        theyBlocked: boolean;
        canMessage: boolean;
    }> {
        const [iBlocked, theyBlocked] = await Promise.all([
            this.isBlocked(userId1, userId2),
            this.isBlocked(userId2, userId1),
        ]);

        return {
            iBlocked,
            theyBlocked,
            canMessage: !iBlocked && !theyBlocked,
        };
    }
}
