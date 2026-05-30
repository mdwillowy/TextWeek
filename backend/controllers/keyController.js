import { KeyBundle } from '../models/KeyBundle.js';

function validateBundle(payload) {
  const errors = [];

  const identityKey = String(payload.identityPublicKey || '').trim();
  if (!identityKey || identityKey.length < 16) {
    errors.push('identityPublicKey is required and must be valid');
  }

  const signedPreKey = payload.signedPreKey || {};
  if (!Number.isInteger(signedPreKey.keyId)) {
    errors.push('signedPreKey.keyId must be an integer');
  }
  if (!String(signedPreKey.publicKey || '').trim()) {
    errors.push('signedPreKey.publicKey is required');
  }
  if (!String(signedPreKey.signature || '').trim()) {
    errors.push('signedPreKey.signature is required');
  }

  const oneTimePreKeys = Array.isArray(payload.oneTimePreKeys) ? payload.oneTimePreKeys : [];
  for (const [index, key] of oneTimePreKeys.entries()) {
    if (!Number.isInteger(key?.keyId) || !String(key?.publicKey || '').trim()) {
      errors.push(`oneTimePreKeys[${index}] is invalid`);
      break;
    }
  }

  return errors;
}

export async function putMyKeyBundle(req, res, next) {
  try {
    const validationErrors = validateBundle(req.body || {});
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid key bundle payload',
        errors: validationErrors,
      });
    }

    const payload = {
      user: req.authUser._id,
      identityPublicKey: String(req.body.identityPublicKey).trim(),
      signedPreKey: {
        keyId: req.body.signedPreKey.keyId,
        publicKey: String(req.body.signedPreKey.publicKey).trim(),
        signature: String(req.body.signedPreKey.signature).trim(),
      },
      oneTimePreKeys: (req.body.oneTimePreKeys || []).map((item) => ({
        keyId: item.keyId,
        publicKey: String(item.publicKey).trim(),
        signature: String(item.signature || '').trim(),
        used: Boolean(item.used),
      })),
      keyUpdatedAt: new Date(),
    };

    await KeyBundle.findOneAndUpdate(
      { user: req.authUser._id },
      payload,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: 'Key bundle updated',
    });
  } catch (err) {
    next(err);
  }
}

export async function rotateMyPreKey(req, res, next) {
  return putMyKeyBundle(req, res, next);
}

export async function getUserKeyBundle(req, res, next) {
  try {
    const bundle = await KeyBundle.findOne({ user: req.params.userId })
      .select('identityPublicKey signedPreKey oneTimePreKeys keyUpdatedAt user')
      .lean();

    if (!bundle) {
      return res.status(404).json({ success: false, message: 'Key bundle not found' });
    }

    return res.json({
      success: true,
      data: {
        bundle: {
          userId: String(bundle.user),
          identityPublicKey: bundle.identityPublicKey,
          signedPreKey: bundle.signedPreKey,
          oneTimePreKeys: bundle.oneTimePreKeys,
          keyUpdatedAt: bundle.keyUpdatedAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
