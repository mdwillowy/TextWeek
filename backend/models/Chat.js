import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: 'Direct chat must have exactly two participants',
      },
    },
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatType: {
      type: String,
      enum: ['direct'],
      default: 'direct',
    },
    encryptionEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessagePreview: {
      type: String,
      default: '',
      maxlength: 160,
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ participants: 1 });
chatSchema.index({ lastMessageAt: -1 });

export const Chat = mongoose.model('Chat', chatSchema);
