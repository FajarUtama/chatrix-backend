import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { Story, StorySchema } from './schemas/story.schema';
import { StoryView, StoryViewSchema } from './schemas/story-view.schema';
import { FollowModule } from '../follow/follow.module';
import { StorageModule } from '../storage/storage.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: StoryView.name, schema: StoryViewSchema },
    ]),
    FollowModule,
    StorageModule,
    UserModule,
  ],
  controllers: [StoryController],
  providers: [StoryService],
})
export class StoryModule { }

