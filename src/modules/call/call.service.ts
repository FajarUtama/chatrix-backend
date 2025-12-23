import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallLog, CallLogDocument } from './schemas/call-log.schema';

@Injectable()
export class CallService {
  constructor(@InjectModel(CallLog.name) private callLogModel: Model<CallLogDocument>) {}

  async logCall(callData: {
    caller_id: string;
    callee_id: string;
    type: 'voice' | 'video';
    started_at?: Date;
    ended_at?: Date;
    status: string;
  }): Promise<CallLogDocument> {
    return this.callLogModel.create(callData);
  }

  async getCallHistory(userId: string): Promise<any[]> {
    const calls = await this.callLogModel
      .find({
        $or: [{ caller_id: userId }, { callee_id: userId }],
      })
      .sort({ created_at: -1 })
      .limit(50)
      .exec();

    return calls.map(call => ({
      id: call._id,
      caller_id: call.caller_id,
      callee_id: call.callee_id,
      type: call.type,
      started_at: call.started_at,
      ended_at: call.ended_at,
      status: call.status,
      created_at: call.created_at,
    }));
  }
}

