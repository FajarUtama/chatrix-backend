import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact, ContactDocument } from './schemas/contact.schema';
import { UserService } from '../user/user.service';
import { UrlNormalizerService } from '../../common/services/url-normalizer.service';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    private userService: UserService,
    private urlNormalizer: UrlNormalizerService,
  ) { }

  async syncContacts(ownerId: string, phoneNumbers: string[]): Promise<void> {
    for (const phone of phoneNumbers) {
      const contactUser = await this.userService.findByPhone(phone);
      if (contactUser && contactUser._id.toString() !== ownerId) {
        await this.contactModel.findOneAndUpdate(
          { owner_id: ownerId, contact_user_id: contactUser._id.toString() },
          {
            owner_id: ownerId,
            contact_user_id: contactUser._id.toString(),
            source: 'phone_sync',
            contact_type: 'phone',
          },
          { upsert: true },
        ).exec();
      }
    }
  }

  async getContacts(ownerId: string): Promise<any[]> {
    const contacts = await this.contactModel.find({ owner_id: ownerId }).exec();
    const userIds = contacts.map(c => c.contact_user_id);
    const users = await Promise.all(
      userIds.map(id => this.userService.findById(id)),
    );

    return users.filter((u): u is any => !!u).map(user => {
      const contact = contacts.find(c => c.contact_user_id === user._id.toString());

      // Ensure avatar URL is full URL
      let avatarUrl = user.avatar_url || '';
      if (avatarUrl && !avatarUrl.startsWith('http://localhost') && !avatarUrl.startsWith('https://')) {
        avatarUrl = avatarUrl.replace(/^https?:\/\//, '');
        avatarUrl = `http://localhost:9000/${avatarUrl}`;
      }

      return {
        id: user._id,
        username: user.username,
        full_name: user.full_name, // Nama asli dari akun
        contact_name: contact?.contact_name, // Nama yang diberikan oleh penyimpan kontak
        avatar_url: this.urlNormalizer.normalizeUrl(avatarUrl),
        phone: user.phone,
      };
    });
  }

  async addContact(
    ownerId: string,
    type: 'phone' | 'username' | 'email',
    identifier: string,
    name?: string
  ): Promise<{ success: boolean; message: string; contact?: any }> {
    try {
      let contactUser;

      // Find user based on the specified type
      switch (type) {
        case 'phone':
          contactUser = await this.userService.findByPhone(identifier);
          if (!contactUser) {
            return {
              success: false,
              message: 'User with this phone number not found'
            };
          }
          break;

        case 'username':
          contactUser = await this.userService.findByUsername(identifier);
          if (!contactUser) {
            return {
              success: false,
              message: 'User with this username not found'
            };
          }
          break;

        case 'email':
          // Add email search logic if available in UserService
          // contactUser = await this.userService.findByEmail(identifier);
          return {
            success: false,
            message: 'Adding by email is not yet supported'
          };

        default:
          return {
            success: false,
            message: 'Invalid contact type'
          };
      }

      // Common validation for all contact types
      if (contactUser._id.toString() === ownerId) {
        return {
          success: false,
          message: 'Cannot add yourself as a contact'
        };
      }

      // Check if contact already exists
      const existingContact = await this.contactModel.findOne({
        owner_id: ownerId,
        contact_user_id: contactUser._id.toString()
      }).exec();

      if (existingContact) {
        return {
          success: false,
          message: 'Contact already exists',
          contact: this.formatContactResponse(contactUser, name)
        };
      }

      // Create new contact
      await this.contactModel.create({
        owner_id: ownerId,
        contact_user_id: contactUser._id.toString(),
        source: 'manual_add',
        contact_type: type,
        contact_name: name
      });

      return {
        success: true,
        message: 'Contact added successfully',
        contact: this.formatContactResponse(contactUser, name)
      };
    } catch (error) {
      console.error('Error adding contact:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add contact';
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  private formatContactResponse(user: any, name?: string) {
    return {
      id: user._id,
      username: user.username,
      full_name: user.full_name || name,
      avatar_url: this.urlNormalizer.normalizeUrl(user.avatar_url),
      phone: user.phone,
      email: user.email,
      contact_name: name
    };
  }

  async updateContact(
    ownerId: string,
    contactUserId: string,
    contactName: string
  ): Promise<{ success: boolean; message: string; contact?: any }> {
    try {
      // Find the contact
      const contact = await this.contactModel.findOne({
        owner_id: ownerId,
        contact_user_id: contactUserId
      }).exec();

      if (!contact) {
        return {
          success: false,
          message: 'Contact not found'
        };
      }

      // Update contact name
      contact.contact_name = contactName;
      await contact.save();

      // Get user details
      const user = await this.userService.findById(contactUserId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      return {
        success: true,
        message: 'Contact updated successfully',
        contact: this.formatContactResponse(user, contactName)
      };
    } catch (error) {
      console.error('Error updating contact:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update contact';
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}
