import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { MinioService } from '../../infrastructure/minio/minio.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private minioService: MinioService,
  ) { }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    // Clean the phone number by removing all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Try to find the user with the exact phone number or with different formats
    return this.userModel.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+${cleanPhone}` },
        { phone: `+${cleanPhone.replace(/^0+/, '')}` },
        { phone: cleanPhone.replace(/^0+/, '') },
        { phone: `0${cleanPhone}` },
        { phone: `+62${cleanPhone.replace(/^62|^0|^\+62/, '')}` },
        { phone: `62${cleanPhone.replace(/^62|^0|^\+62/, '')}` },
        { phone: `0${cleanPhone.replace(/^62|^0|^\+62/, '')}` }
      ]
    }).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async createUser(userData: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(userData);
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async searchUsers(query: string): Promise<UserDocument[]> {
    // If query is a phone number, search by phone only
    const phoneRegex = /^[+0-9\s-]+$/;
    if (phoneRegex.test(query)) {
      const cleanPhone = query.replace(/\D/g, '');
      const users = await this.userModel
        .find({
          $or: [
            { phone: { $regex: `^${cleanPhone}`, $options: 'i' } },
            { phone: { $regex: `^0${cleanPhone}`, $options: 'i' } },
            { phone: { $regex: `^62${cleanPhone}`, $options: 'i' } },
            { phone: { $regex: `^\+62${cleanPhone}`, $options: 'i' } }
          ]
        })
        .select('-password_hash -__v -google_id')
        .limit(10)
        .exec();
      return users;
    }

    // For non-phone queries, search in username and full name
    const searchQuery = {
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { full_name: { $regex: query, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$full_name'] },
              regex: query.split(' ').join('.*'),
              options: 'i'
            }
          }
        }
      ]
    };

    return this.userModel
      .find(searchQuery)
      .select('-password_hash -__v -google_id')
      .limit(10)
      .exec();
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<string> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('User not found');
    }

    // Delete old avatar if exists
    if (user.avatar_url) {
      await this.deleteAvatarFile(user.avatar_url);
    }

    // Upload new avatar
    const timestamp = Date.now();
    const key = `avatars/${userId}/${timestamp}-${file.originalname}`;
    const uploaded = await this.minioService.upload(
      file.buffer,
      file.mimetype,
      key
    );

    // Update user with new avatar URL
    user.avatar_url = uploaded.url;
    await user.save();

    return uploaded.url;
  }

  async deleteAvatar(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('User not found');
    }

    if (user.avatar_url) {
      await this.deleteAvatarFile(user.avatar_url);
      user.avatar_url = undefined;
      await user.save();
    }
  }

  private async deleteAvatarFile(avatarUrl: string): Promise<void> {
    try {
      // Extract key from URL
      // URL format: http://localhost:9000/chatrix/avatars/userId/timestamp-filename
      const urlParts = avatarUrl.split('/chatrix/');
      if (urlParts.length > 1) {
        const key = urlParts[1];
        await this.minioService.deleteFile(key);
      }
    } catch (error) {
      // Ignore deletion errors (file might not exist)
      console.error('Error deleting avatar file:', error);
    }
  }
}

