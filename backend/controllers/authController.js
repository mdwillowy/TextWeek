import { User } from '../models/User.js';
import crypto from 'crypto';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sanitizeUser } from '../utils/sanitizeUser.js';
import { env } from '../config/env.js';

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getClientMeta(req) {
  return {
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    ip: String(req.ip || ''),
  };
}

async function addRefreshSession(user, refreshToken, req) {
  const tokenHash = hashToken(refreshToken);
  const clientMeta = getClientMeta(req);

  user.refreshSessions.push({
    tokenHash,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    ...clientMeta,
  });

  if (user.refreshSessions.length > 20) {
    user.refreshSessions = user.refreshSessions.slice(-20);
  }

  await user.save();
}

export async function signup(req, res, next) {
  try {
    if (!env.enableNewRegistrations) {
      return res.status(503).json({
        success: false,
        code: 'REGISTRATION_DISABLED',
        message: 'New registrations are temporarily disabled',
      });
    }

    const { fullName, dateOfBirth, gender, username, password, phoneNumber } = req.body;

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'That username is already taken' });
    }

    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        return res.status(409).json({ success: false, message: 'That phone number is already in use' });
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      fullName,
      dateOfBirth,
      gender,
      username,
      phoneNumber: phoneNumber || undefined,
      passwordHash,
      lastSeen: new Date(),
    });

    const payload = { sub: String(user._id), username: user.username };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await addRefreshSession(user, refreshToken, req);

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user: sanitizeUser(user), accessToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { username, phoneNumber, password } = req.body;
    const query = username ? { username } : { phoneNumber };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(401).json({ success: false, code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    user.lastSeen = new Date();
    await user.save();

    const payload = { sub: String(user._id), username: user.username };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await addRefreshSession(user, refreshToken, req);

    setRefreshCookie(res, refreshToken);

    return res.json({
      success: true,
      message: 'Logged in successfully',
      data: { user: sanitizeUser(user), accessToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res) {
  try {
    const tokenFromCookie = req.cookies.refreshToken;
    const tokenFromBody = req.body.refreshToken;
    const refreshToken = tokenFromCookie || tokenFromBody;

    if (!refreshToken) {
      return res.status(401).json({ success: false, code: 'AUTH_REFRESH_MISSING', message: 'Refresh token missing' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);

    if (!user) {
      clearRefreshCookie(res);
      return res.status(419).json({ success: false, code: 'AUTH_REFRESH_INVALID', message: 'Invalid refresh token' });
    }

    const oldHash = hashToken(refreshToken);
    const oldSession = user.refreshSessions.find((item) => item.tokenHash === oldHash);
    if (!oldSession) {
      clearRefreshCookie(res);
      return res.status(419).json({ success: false, code: 'AUTH_REFRESH_REVOKED', message: 'Refresh token revoked' });
    }

    const nextPayload = { sub: String(user._id), username: user.username };
    const nextAccessToken = signAccessToken(nextPayload);
    const nextRefreshToken = signRefreshToken(nextPayload);

    user.refreshSessions = user.refreshSessions.filter((item) => item.tokenHash !== oldHash);
    user.refreshSessions.push({
      tokenHash: hashToken(nextRefreshToken),
      createdAt: oldSession.createdAt || new Date(),
      lastUsedAt: new Date(),
      ...getClientMeta(req),
    });
    if (user.refreshSessions.length > 20) {
      user.refreshSessions = user.refreshSessions.slice(-20);
    }
    await user.save();

    setRefreshCookie(res, nextRefreshToken);

    return res.json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken: nextAccessToken },
    });
  } catch {
    clearRefreshCookie(res);
    return res.status(419).json({ success: false, code: 'AUTH_REFRESH_EXPIRED', message: 'Invalid or expired refresh token' });
  }
}

export async function logout(req, res) {
  const tokenFromCookie = req.cookies.refreshToken;
  const tokenFromBody = req.body.refreshToken;
  const refreshToken = tokenFromCookie || tokenFromBody;

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await User.findById(payload.sub);
      if (user) {
        const hash = hashToken(refreshToken);
        user.refreshSessions = user.refreshSessions.filter((item) => item.tokenHash !== hash);
        await user.save();
      }
    } catch {
      // Ignore invalid refresh tokens on logout.
    }
  }

  clearRefreshCookie(res);
  return res.json({ success: true, message: 'Logged out successfully' });
}

export async function logoutAll(req, res, next) {
  try {
    req.authUser.refreshSessions = [];
    await req.authUser.save();
    clearRefreshCookie(res);

    return res.json({ success: true, message: 'Logged out from all sessions' });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  return res.json({
    success: true,
    data: { user: sanitizeUser(req.authUser) },
  });
}
