import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post, PostSchema } from './schemas/post.schema';
import { PostLike, PostLikeSchema } from './schemas/post-like.schema';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import { FollowModule } from '../follow/follow.module';
import { ChatModule } from '../chat/chat.module';
import { StorageModule } from '../storage/storage.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: PostComment.name, schema: PostCommentSchema },
    ]),
    FollowModule,
    StorageModule,
    UserModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule { }

