import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';
import { Block, BlockSchema } from './schemas/block.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Block.name, schema: BlockSchema }]),
    ],
    controllers: [BlockController],
    providers: [BlockService],
    exports: [BlockService],
})
export class BlockModule { }
