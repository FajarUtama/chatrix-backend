import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Story, StoryDocument, StoryMedia } from './schemas/story.schema';
import { StoryView, StoryViewDocument } from './schemas/story-view.schema';
import { FollowService } from '../follow/follow.service';
import { UserService } from '../user/user.service';
import { UrlNormalizerService } from '../../common/services/url-normalizer.service';

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(StoryView.name) private storyViewModel: Model<StoryViewDocument>,
    private followService: FollowService,
    private userService: UserService,
    private urlNormalizer: UrlNormalizerService,
  ) { }

  async createStory(storyData: {
    userId: string;
    username: string;
    media: string;  // This is the URL of the uploaded media
    mediaType: 'image' | 'video';
    mediaKey: string;
    caption?: string;
    visibility?: 'public' | 'followers' | 'following' | 'contacts';
  }): Promise<StoryDocument> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Ensure the media URL has a proper protocol and clean up any double slashes
      const cleanUrl = (url: string) => {
        const withProtocol = url.startsWith('http') ? url : `http://${url}`;
        return withProtocol.replace(/([^:]\/)\/+/g, '$1');
      };

      const storyDataToSave = {
        user_id: storyData.userId,
        username: storyData.username,
        media: {
          url: cleanUrl(storyData.media),
          type: storyData.mediaType,
          ...(storyData.mediaType === 'video' && { duration: 0 })
        },
        media_key: storyData.mediaKey,
        caption: storyData.caption || '',
        visibility: storyData.visibility || 'public',
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      };

      console.log('Creating story with data:', JSON.stringify(storyDataToSave, null, 2));

      const story = new this.storyModel(storyDataToSave);
      const savedStory = await story.save();
      console.log('Story created successfully');
      return savedStory;
    } catch (error) {
      console.error('Error saving story:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to save story: ${errorMessage}`);
    }
  }

  async getStories(userId: string): Promise<any[]> {
    // Get active stories for the current user
    const stories = await this.storyModel
      .find({
        user_id: userId,
        expires_at: { $gt: new Date() },
      })
      .sort({ created_at: -1 })
      .lean()
      .exec();

    // Manually fetch user data
    const user = await this.userService.findById(userId);

    return stories.map(story => {
      // Ensure media URL is full URL - handle both missing protocol and missing host
      let mediaUrl = story.media.url;
      if (!mediaUrl.startsWith('http://localhost') && !mediaUrl.startsWith('https://')) {
        // Remove any existing http:// prefix without hostname
        mediaUrl = mediaUrl.replace(/^https?:\/\//, '');
        mediaUrl = `http://localhost:9000/${mediaUrl}`;
      }

      return {
        id: story._id,
        user: user ? {
          id: user._id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: this.urlNormalizer.normalizeUrl(user.avatar_url)
        } : null,
        media: {
          ...story.media,
          url: this.urlNormalizer.normalizeUrl(mediaUrl)
        },
        caption: story.caption,
        visibility: story.visibility,
        is_viewed: true, // Own stories are always viewed
        expires_at: story.expires_at,
        created_at: story.created_at,
      };
    });
  }

  async markAsViewed(storyId: string, viewerId: string): Promise<void> {
    try {
      await this.storyViewModel.findOneAndUpdate(
        { story_id: storyId, viewer_id: viewerId },
        { story_id: storyId, viewer_id: viewerId },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('Error marking story as viewed:', error);
      // Don't throw error, just log it
    }
  }

  async getStoryViewers(storyId: string, ownerId: string): Promise<any[]> {
    // Verify that the story belongs to the owner
    const story = await this.storyModel.findById(storyId).lean().exec();
    if (!story || story.user_id !== ownerId) {
      throw new Error('Story not found or unauthorized');
    }

    // Get all view records for this story
    const viewRecords = await this.storyViewModel
      .find({ story_id: storyId })
      .sort({ viewed_at: -1 }) // Most recent first
      .lean()
      .exec();

    // Fetch user details for all viewers
    const viewerIds = viewRecords.map(v => v.viewer_id);
    const users = await Promise.all(
      viewerIds.map(uid => this.userService.findById(uid))
    );

    // Map to response format
    return viewRecords.map((record, index) => {
      const user = users[index];
      return {
        user: user ? {
          id: user._id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: this.urlNormalizer.normalizeUrl(user.avatar_url)
        } : null,
        viewed_at: record.viewed_at
      };
    }).filter(v => v.user !== null); // Remove null users
  }

  async getFeedStories(userId: string): Promise<any[]> {
    try {
      // Get users that the current user follows
      const following = await this.followService.getFollowing(userId);
      const followingIds = following.map(u => u.id.toString());

      // Add current user to see their own stories
      followingIds.push(userId);

      // Get active stories from followed users and public stories
      const stories = await this.storyModel
        .find({
          $or: [
            {
              user_id: { $in: followingIds },
              visibility: { $in: ['public', 'followers'] },
              expires_at: { $gt: new Date() }
            },
            {
              visibility: 'public',
              expires_at: { $gt: new Date() }
            }
          ]
        })
        .sort({ created_at: -1 })
        .lean()
        .exec();

      // Get unique user IDs
      const uniqueUserIds = [...new Set(stories.map(story => story.user_id))];

      // Fetch all users at once
      const users = await Promise.all(
        uniqueUserIds.map(uid => this.userService.findById(uid))
      );

      // Create a map for quick lookup
      const userMap = new Map();
      users.forEach(user => {
        if (user) {
          userMap.set(user._id.toString(), {
            id: user._id,
            username: user.username,
            full_name: user.full_name,
            avatar_url: this.urlNormalizer.normalizeUrl(user.avatar_url)
          });
        }
      });

      // Batch fetch view records for current user
      const storyIds = stories.map(s => s._id.toString());
      const viewRecords = await this.storyViewModel
        .find({
          story_id: { $in: storyIds },
          viewer_id: userId
        })
        .lean()
        .exec();

      // Create a set of viewed story IDs for quick lookup
      const viewedStoryIds = new Set(viewRecords.map(v => v.story_id));

      return stories.map(story => {
        const user = userMap.get(story.user_id);
        const isOwnStory = story.user_id === userId;

        // Ensure media URL is full URL - handle both missing protocol and missing host
        let mediaUrl = story.media.url;
        if (!mediaUrl.startsWith('http://localhost') && !mediaUrl.startsWith('https://')) {
          // Remove any existing http:// prefix without hostname
          mediaUrl = mediaUrl.replace(/^https?:\/\//, '');
          mediaUrl = `http://localhost:9000/${mediaUrl}`;
        }

        return {
          id: story._id,
          user: user || null,
          media: {
            ...story.media,
            url: this.urlNormalizer.normalizeUrl(mediaUrl)
          },
          caption: story.caption,
          visibility: story.visibility,
          is_viewed: isOwnStory || viewedStoryIds.has(story._id.toString()),
          expires_at: story.expires_at,
          created_at: story.created_at,
        };
      });
    } catch (error) {
      console.error('Error in getFeedStories:', error);
      throw error;
    }
  }
}

