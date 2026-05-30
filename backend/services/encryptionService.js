function cleanString(value, maxLen = 10000) {
  return String(value || '').trim().slice(0, maxLen);
}

function sanitizeKeyInfo(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  return {
    preKeyId: Number.isInteger(input.preKeyId) ? input.preKeyId : null,
    sessionId: cleanString(input.sessionId, 200) || null,
    version: cleanString(input.version, 40) || null,
    senderIdentityKey: cleanString(input.senderIdentityKey, 4000) || null,
  };
}

export function normalizeEncryptionPayload(payload = {}) {
  const mode = payload.encryptionMode === 'e2ee' ? 'e2ee' : 'plain';
  const plainText = cleanString(payload.text, 2000);
  const encryptedPayload = cleanString(payload.encryptedPayload, 12000);
  const nonce = cleanString(payload.nonce, 2000);
  const aad = cleanString(payload.aad, 2000);
  const keyInfo = sanitizeKeyInfo(payload.keyInfo);

  if (mode === 'plain' && !plainText) {
    return {
      ok: false,
      status: 400,
      message: 'Message cannot be empty',
    };
  }

  if (mode === 'e2ee' && (!encryptedPayload || !nonce)) {
    return {
      ok: false,
      status: 400,
      message: 'encryptedPayload and nonce are required for e2ee mode',
    };
  }

  return {
    ok: true,
    mode,
    data: {
      text: mode === 'plain' ? plainText : '',
      encryptedPayload: mode === 'e2ee' ? encryptedPayload : null,
      nonce: mode === 'e2ee' ? nonce : null,
      aad: mode === 'e2ee' ? aad || null : null,
      keyInfo: mode === 'e2ee' ? keyInfo : null,
    },
  };
}
