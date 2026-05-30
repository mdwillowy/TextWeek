const KEYSTORE = 'textweek_e2ee_keystore_v1';

function toBase64(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function exportPair(pair) {
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicJwk, privateJwk };
}

async function importEcdhPublic(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

async function importEcdhPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

async function generateBundleMaterial() {
  const identityPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const signedPreKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

  const identity = await exportPair(identityPair);
  const signedPreKey = await exportPair(signedPreKeyPair);

  const oneTimePreKeys = [];
  for (let i = 0; i < 10; i += 1) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const exported = await exportPair(pair);
    oneTimePreKeys.push({
      keyId: Date.now() + i,
      publicJwk: exported.publicJwk,
      privateJwk: exported.privateJwk,
    });
  }

  const signatureSource = new TextEncoder().encode(
    `${JSON.stringify(identity.publicJwk)}:${JSON.stringify(signedPreKey.publicJwk)}`
  );
  const digest = await crypto.subtle.digest('SHA-256', signatureSource);

  return {
    identity,
    signedPreKey,
    oneTimePreKeys,
    signedPreKeySignature: toBase64(new Uint8Array(digest)),
    signedPreKeyId: Date.now(),
    keyVersion: 'mvp-v1',
    createdAt: new Date().toISOString(),
  };
}

function readStored() {
  const raw = localStorage.getItem(KEYSTORE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStored(payload) {
  localStorage.setItem(KEYSTORE, JSON.stringify(payload));
}

export async function ensureLocalKeyBundle() {
  let stored = readStored();
  if (!stored) {
    stored = await generateBundleMaterial();
    writeStored(stored);
  }

  return {
    identityPublicKey: JSON.stringify(stored.identity.publicJwk),
    signedPreKey: {
      keyId: stored.signedPreKeyId,
      publicKey: JSON.stringify(stored.signedPreKey.publicJwk),
      signature: stored.signedPreKeySignature,
    },
    oneTimePreKeys: stored.oneTimePreKeys.map((item) => ({
      keyId: item.keyId,
      publicKey: JSON.stringify(item.publicJwk),
      signature: '',
      used: false,
    })),
  };
}

export async function rotateSignedPreKey() {
  const stored = readStored();
  if (!stored) {
    return ensureLocalKeyBundle();
  }

  const signedPreKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const exported = await exportPair(signedPreKeyPair);
  const next = {
    ...stored,
    signedPreKey: exported,
    signedPreKeyId: Date.now(),
  };
  writeStored(next);
  return ensureLocalKeyBundle();
}

async function deriveMessageKey({ myPrivateKey, theirPublicKey, chatId }) {
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: theirPublicKey,
    },
    myPrivateKey,
    256
  );

  const baseKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`tw:salt:${chatId}`),
      info: new TextEncoder().encode('textweek:e2ee:v1'),
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptForRecipient({ plaintext, chatId, recipientBundle }) {
  const stored = readStored() || (await generateBundleMaterial());
  if (!readStored()) {
    writeStored(stored);
  }

  const myIdentityPrivate = await importEcdhPrivate(stored.identity.privateJwk);
  const theirSignedPreKey = await importEcdhPublic(JSON.parse(String(recipientBundle.signedPreKey.publicKey)));
  const aesKey = await deriveMessageKey({
    myPrivateKey: myIdentityPrivate,
    theirPublicKey: theirSignedPreKey,
    chatId,
  });

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const aadText = `tw:aad:${chatId}:${recipientBundle.userId || 'unknown'}`;
  const cipher = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: new TextEncoder().encode(aadText),
    },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    encryptionMode: 'e2ee',
    text: '',
    encryptedPayload: toBase64(new Uint8Array(cipher)),
    nonce: toBase64(nonce),
    aad: toBase64(new TextEncoder().encode(aadText)),
    keyInfo: {
      preKeyId: recipientBundle.signedPreKey.keyId,
      sessionId: `${chatId}:${recipientBundle.userId || 'unknown'}`,
      version: stored.keyVersion || 'mvp-v1',
      senderIdentityKey: JSON.stringify(stored.identity.publicJwk),
    },
  };
}

export async function decryptFromSender({ message }) {
  const stored = readStored();
  if (!stored) {
    throw new Error('local_key_bundle_missing');
  }

  const senderIdentityKey = message?.keyInfo?.senderIdentityKey;
  if (!senderIdentityKey) {
    throw new Error('sender_identity_key_missing');
  }

  const mySignedPreKeyPrivate = await importEcdhPrivate(stored.signedPreKey.privateJwk);
  const theirIdentityPublic = await importEcdhPublic(JSON.parse(String(senderIdentityKey)));
  const aesKey = await deriveMessageKey({
    myPrivateKey: mySignedPreKeyPrivate,
    theirPublicKey: theirIdentityPublic,
    chatId: String(message.chatId || ''),
  });

  const cipherBytes = fromBase64(String(message.encryptedPayload || ''));
  const nonce = fromBase64(String(message.nonce || ''));
  const aadBytes = fromBase64(String(message.aad || ''));

  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aadBytes,
    },
    aesKey,
    cipherBytes
  );

  return new TextDecoder().decode(plainBuffer);
}
