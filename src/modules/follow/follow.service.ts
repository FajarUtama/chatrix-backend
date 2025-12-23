import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema';
import { UserService } from '../user/user.service';

@Injectable()
export class FollowService {
  constructor(
    @InjectModel(Follow.name) private followModel: Model<FollowDocument>,
    private userService: UserService,
  ) { }

  async follow(followerId: string, username: string): Promise<void> {
    const followingUser = await this.userService.findByUsername(username);
    if (!followingUser) {
      throw new NotFoundException('User not found');
    }

    if (followerId === followingUser._id.toString()) {
      throw new Error('Cannot follow yourself');
    }

    await this.followModel.findOneAndUpdate(
      { follower_id: followerId, following_id: followingUser._id.toString() },
      { follower_id: followerId, following_id: followingUser._id.toString() },
      { upsert: true },
    ).exec();
  }

  async unfollow(followerId: string, username: string): Promise<void> {
    const followingUser = await this.userService.findByUsername(username);
    if (!followingUser) {
      throw new NotFoundException('User not found');
    }

    await this.followModel.deleteOne({
      follower_id: followerId,
      following_id: followingUser._id.toString(),
    }).exec();
  }

  async getFollowers(userId: string): Promise<any[]> {
    const follows = await this.followModel.find({ following_id: userId }).exec();
    const userIds = follows.map(f => f.follower_id);
    const users = await Promise.all(userIds.map(id => this.userService.findById(id)));
    return users.filter((u): u is any => !!u).map(user => ({
      id: user._id.toString(),
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    }));
  }

  async getFollowing(userId: string): Promise<any[]> {
    const follows = await this.followModel.find({ follower_id: userId }).exec();
    const userIds = follows.map(f => f.following_id);
    const users = await Promise.all(userIds.map(id => this.userService.findById(id)));
    return users.filter((u): u is any => !!u).map(user => ({
      id: user._id.toString(),
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    }));
  }
}

