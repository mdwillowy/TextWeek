import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    attachment: {
      type: {
        type: String,
        enum: ['image'],
        default: null,
      },
      url: {
        type: String,
        default: null,
        trim: true,
        maxlength: 600,
      },
      sizeBytes: {
        type: Number,
        default: null,
        min: 0,
      },
      mimeType: {
        type: String,
        default: null,
        trim: true,
        maxlength: 100,
      },
      originalName: {
        type: String,
        default: null,
        trim: true,
        maxlength: 255,
      },
    },
    encryptionMode: {
      type: String,
      enum: ['plain', 'e2ee'],
      default: 'plain',
      index: true,
    },
    encryptedPayload: {
      type: String,
      default: null,
      trim: true,
    },
    nonce: {
      type: String,
      default: null,
      trim: true,
    },
    aad: {
      type: String,
      default: null,
      trim: true,
    },
    keyInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    readBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    replyTo: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      text: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160,
      },
      encryptionMode: {
        type: String,
        enum: ['plain', 'e2ee'],
        default: 'plain',
      },
    },
    reactions: {
      type: [
        {
          emoji: {
            type: String,
            required: true,
            trim: true,
            maxlength: 16,
          },
          users: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'User',
            default: [],
          },
        },
      ],
      default: [],
    },
    deletedForEveryoneAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

messageSchema.index({ chat: 1, createdAt: -1 });

messageSchema.pre('validate', function onValidate() {
  const mode = this.encryptionMode || 'plain';

  if (mode === 'plain') {
    const hasText = Boolean(String(this.text || '').trim());
    const hasAttachment = Boolean(String(this.attachment?.url || '').trim());

    if (!hasText && !hasAttachment) {
      throw new Error('text or attachment is required in plain mode');
    }
    return;
  }

  if (!String(this.encryptedPayload || '').trim() || !String(this.nonce || '').trim()) {
    throw new Error('encryptedPayload and nonce are required in e2ee mode');
  }
});

export const Message = mongoose.model('Message', messageSchema);
