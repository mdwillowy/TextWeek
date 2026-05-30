import mongoose from 'mongoose';

const userBlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export const UserBlock = mongoose.model('UserBlock', userBlockSchema);
