import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Express } from 'express';
import { Post, PostDocument } from './schemas/post.schema';
import { PostLike, PostLikeDocument } from './schemas/post-like.schema';
import { PostComment, PostCommentDocument } from './schemas/post-comment.schema';
import { FollowService } from '../follow/follow.service';
import { ChatService } from '../chat/chat.service';
import { StorageService, FileType } from '../storage/storage.service';
import { UserService } from '../user/user.service';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(PostLike.name) private postLikeModel: Model<PostLikeDocument>,
    @InjectModel(PostComment.name) private postCommentModel: Model<PostCommentDocument>,
    private followService: FollowService,
    @Inject(forwardRef(() => ChatService)) private chatService: ChatService,
    private storageService: StorageService,
    private userService: UserService,
    private configService: ConfigService,
  ) { }

  async createPost(
    userId: string,
    postData: {
      file: Express.Multer.File;
      caption?: string;
      visibility?: 'public' | 'followers' | 'following' | 'contacts';
      tags?: string[];
      location?: string;
    }
  ): Promise<any> {
    try {
      console.log('Creating post with file:', {
        userId,
        file: postData.file.originalname,
        size: postData.file.size
      });

      // Upload the file to storage
      const isImage = postData.file.mimetype.startsWith('image/');
      const fileType = isImage ? FileType.IMAGE : FileType.VIDEO;

      console.log('Uploading file to storage...');
      const uploadedFile = await this.storageService.uploadFile(
        postData.file,
        fileType
      );

      // Create the post with the uploaded file URL
      const postDataToSave = {
        user_id: userId,
        media: {
          url: uploadedFile.url,
          type: isImage ? 'image' : 'video'
        },
        media_key: uploadedFile.key,
        caption: postData.caption || '',
        visibility: postData.visibility || 'public',
        tags: postData.tags || [],
        ...(postData.location && { location: postData.location }),
        created_at: new Date(),
        updated_at: new Date()
      };

      console.log('Creating post with data:', JSON.stringify(postDataToSave, null, 2));

      const post = new this.postModel(postDataToSave);
      const savedPost = await post.save();

      console.log('Post created successfully');
      return savedPost.toObject();
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }
  async getFeed(userId: string): Promise<any[]> {
    // Get users that the current user follows
    const following = await this.followService.getFollowing(userId);
    const followingIds = following.map(u => u.id.toString());

    // Get posts from followed users and public posts
    const posts = await this.postModel
      .find({
        $or: [
          { user_id: { $in: followingIds } },
          { visibility: 'public' },
        ],
      })
      .sort({ created_at: -1 })
      .limit(50)
      .exec();

    // Get MinIO config for constructing full URLs
    const minioConfig = this.configService.minioConfig;
    const protocol = minioConfig.useSSL ? 'https' : 'http';
    const port = minioConfig.port ? `:${minioConfig.port}` : '';
    const baseUrl = minioConfig.cdnUrl || `${protocol}://${minioConfig.endPoint}${port}`;

    // Populate user information for each post
    const postsWithUsers = await Promise.all(
      posts.map(async (post: PostDocument) => {
        // Construct full media URL
        const fullMediaUrl = post.media.url.startsWith('http')
          ? post.media.url
          : `${baseUrl}${post.media.url}`;

        // Get user information
        const user = await this.userService.findById(post.user_id);

        return {
          id: post._id,
          user_id: post.user_id,
          user: user ? {
            id: user._id,
            username: user.username,
            full_name: user.full_name || '',
            avatar_url: user.avatar_url || ''
          } : null,
          media: {
            url: fullMediaUrl,
            type: post.media.type
          },
          caption: post.caption,
          visibility: post.visibility,
          like_count: post.like_count,
          comment_count: post.comment_count,
          created_at: post.created_at,
        };
      })
    );

    return postsWithUsers;
  }

  async getPost(postId: string): Promise<any> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Get MinIO config for constructing full URLs
    const minioConfig = this.configService.minioConfig;
    const protocol = minioConfig.useSSL ? 'https' : 'http';
    const port = minioConfig.port ? `:${minioConfig.port}` : '';
    const baseUrl = minioConfig.cdnUrl || `${protocol}://${minioConfig.endPoint}${port}`;

    // Construct full media URL
    const fullMediaUrl = post.media.url.startsWith('http')
      ? post.media.url
      : `${baseUrl}${post.media.url}`;

    // Get user information
    const user = await this.userService.findById(post.user_id);

    return {
      id: post._id,
      user_id: post.user_id,
      user: user ? {
        id: user._id,
        username: user.username,
        full_name: user.full_name || '',
        avatar_url: user.avatar_url || ''
      } : null,
      media: {
        url: fullMediaUrl,
        type: post.media.type
      },
      caption: post.caption,
      visibility: post.visibility,
      like_count: post.like_count,
      comment_count: post.comment_count,
      created_at: post.created_at,
    };
  }

  async likePost(postId: string, userId: string): Promise<void> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingLike = await this.postLikeModel.findOne({ post_id: postId, user_id: userId }).exec();
    if (existingLike) {
      return; // Already liked
    }

    await this.postLikeModel.create({ post_id: postId, user_id: userId });
    await this.postModel.findByIdAndUpdate(postId, { $inc: { like_count: 1 } }).exec();
  }

  async commentOnPost(
    postId: string,
    userId: string,
    text: string,
    type: 'public' | 'private',
  ): Promise<void> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.postCommentModel.create({
      post_id: postId,
      user_id: userId,
      text,
      type,
    });

    await this.postModel.findByIdAndUpdate(postId, { $inc: { comment_count: 1 } }).exec();

    // If private comment, create DM
    if (type === 'private') {
      await this.chatService.createPrivateCommentMessage(postId, post.user_id, userId, text);
    }
  }

  async getComments(postId: string): Promise<any[]> {
    // Verify post exists
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Get all public comments for this post
    const comments = await this.postCommentModel
      .find({
        post_id: postId,
        type: 'public' // Only return public comments
      })
      .sort({ created_at: 1 }) // Oldest first
      .exec();

    // Populate user information for each comment
    const commentsWithUsers = await Promise.all(
      comments.map(async (comment: PostCommentDocument) => {
        const user = await this.userService.findById(comment.user_id);

        return {
          id: comment._id,
          post_id: comment.post_id,
          user_id: comment.user_id,
          user: user ? {
            id: user._id,
            username: user.username,
            full_name: user.full_name || '',
            avatar_url: user.avatar_url || ''
          } : null,
          text: comment.text,
          type: comment.type,
          created_at: comment.created_at,
        };
      })
    );

    return commentsWithUsers;
  }
}

