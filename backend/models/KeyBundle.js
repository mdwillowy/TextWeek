import mongoose from 'mongoose';

const preKeySchema = new mongoose.Schema(
  {
    keyId: { type: Number, required: true },
    publicKey: { type: String, required: true, trim: true },
    signature: { type: String, trim: true, default: '' },
    used: { type: Boolean, default: false },
  },
  { _id: false }
);

const keyBundleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    identityPublicKey: {
      type: String,
      required: true,
      trim: true,
    },
    signedPreKey: {
      keyId: { type: Number, required: true },
      publicKey: { type: String, required: true, trim: true },
      signature: { type: String, required: true, trim: true },
    },
    oneTimePreKeys: {
      type: [preKeySchema],
      default: [],
    },
    keyUpdatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const KeyBundle = mongoose.model('KeyBundle', keyBundleSchema);
