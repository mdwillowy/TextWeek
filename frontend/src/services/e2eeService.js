import { getUserKeyBundle } from '../api/keys';
import {
  decryptFromSender,
  encryptForRecipient,
  ensureLocalKeyBundle,
  rotateSignedPreKey,
} from './cryptoSessionStore';

export async function prepareOutboundMessage({ text, encryptionEnabled, chatId, recipientUserId }) {
  if (!encryptionEnabled) {
    return {
      encryptionMode: 'plain',
      text,
    };
  }

  if (!recipientUserId || !chatId) {
    throw new Error('Missing encryption context');
  }

  const response = await getUserKeyBundle(recipientUserId);
  const bundle = response?.data?.bundle;
  if (!bundle) {
    throw new Error('Recipient key bundle unavailable');
  }

  return encryptForRecipient({
    plaintext: text,
    chatId,
    recipientBundle: bundle,
  });
}

export async function decryptInboundMessage(message) {
  if (message.encryptionMode !== 'e2ee') {
    return message.text;
  }

  try {
    return await decryptFromSender({ message });
  } catch {
    return '[Unable to decrypt message]';
  }
}

export async function getPublicKeyBundleForUpload() {
  return ensureLocalKeyBundle();
}

export async function rotatePreKeyBundleForUpload() {
  return rotateSignedPreKey();
}
