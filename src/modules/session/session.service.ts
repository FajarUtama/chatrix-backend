import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';

@Injectable()
export class SessionService {
  constructor(@InjectModel(Session.name) private sessionModel: Model<SessionDocument>) {}

  async createSession(sessionData: Partial<Session>): Promise<SessionDocument> {
    return this.sessionModel.create(sessionData);
  }

  async findSession(userId: string, deviceId: string): Promise<SessionDocument | null> {
    return this.sessionModel.findOne({ user_id: userId, device_id: deviceId }).exec();
  }

  async revokeSession(userId: string, deviceId: string): Promise<void> {
    await this.sessionModel.deleteOne({ user_id: userId, device_id: deviceId }).exec();
  }
}

