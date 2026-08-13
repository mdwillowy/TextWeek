import webPush from 'web-push';
import { env } from '../config/env.js';

const vapidPublicKey = env.vapidPublicKey || '';
const vapidPrivateKey = env.vapidPrivateKey || '';
const vapidContactEmail = env.vapidContactEmail || 'mailto:admin@example.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('[TextWeek Push] Missing VAPID keys. Push service is disabled until both are set.');
} else {
  webPush.setVapidDetails(vapidContactEmail, vapidPublicKey, vapidPrivateKey);
}

export function getPushConfig() {
  return {
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
    contactEmail: vapidContactEmail,
    enabled: Boolean(vapidPublicKey && vapidPrivateKey),
  };
}

export function isPushSubscriptionUnavailableError(err) {
  if (!err) return false;

  const statusCode = Number(err.statusCode || err?.response?.status || 0);
  const message = String(err.message || err?.response?.data?.message || '');

  return statusCode === 404 || statusCode === 410 || /expired|gone|no longer valid|no longer available|not found/i.test(message);
}

export async function sendTextweekPushNotification(user, payload) {
  if (!user || !Array.isArray(user.devicePushSubscriptions) || user.devicePushSubscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[TextWeek Push] Push disabled because VAPID keys are not configured.');
    return { sent: 0, failed: 0 };
  }

  const options = {
    TTL: 60,
    urgency: 'high',
  };

  const results = { sent: 0, failed: 0 };

  const subscriptionList = user.devicePushSubscriptions.filter(
    (item) => item?.endpoint && item?.keys?.p256dh && item?.keys?.auth
  );

  for (const subscription of subscriptionList) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        },
        JSON.stringify(payload),
        options
      );

      results.sent += 1;
    } catch (err) {
      if (isPushSubscriptionUnavailableError(err)) {
        console.warn('[TextWeek Push] Expired or stale push subscription detected', {
          userId: String(user._id),
          endpoint: subscription.endpoint,
          message: err?.message || 'Expired push subscription',
        });
        throw err;
      }

      results.failed += 1;
      console.warn('[TextWeek Push] Notification send failed', {
        userId: String(user._id),
        endpoint: subscription.endpoint,
        message: err?.message || 'Unknown push error',
      });
    }
  }

  return results;
}
