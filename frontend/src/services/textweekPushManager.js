import api from '../api/axios';

function ensureAuthHeader() {
  const token = sessionStorage.getItem('textweek_access_token');
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

export function supportsBrowserPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermissionState() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function registerTextweekServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/textweek-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('[TextWeek Push] Service worker registration failed', error);
    return null;
  }
}

function encodePushKey(keyBuffer) {
  if (!keyBuffer) {
    return '';
  }

  const bytes = new Uint8Array(keyBuffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export async function getActivePushSubscription() {
  if (!supportsBrowserPush()) {
    return null;
  }

  const registration = await registerTextweekServiceWorker();
  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
}

export async function subscribeToTextweekPush({ vapidPublicKey, force = false } = {}) {
  if (!supportsBrowserPush()) {
    throw new Error('This browser does not support web push notifications');
  }

  const currentPermission = getNotificationPermissionState();
  if (currentPermission === 'denied') {
    throw new Error('Notifications are blocked for this browser');
  }

  if (currentPermission === 'default') {
    const requested = await Notification.requestPermission();
    if (requested !== 'granted') {
      throw new Error('Notification permission was not granted');
    }
  }

  if (!vapidPublicKey) {
    throw new Error('Missing VAPID public key for browser push registration');
  }

  const registration = await registerTextweekServiceWorker();
  if (!registration) {
    throw new Error('Unable to register the TextWeek service worker');
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription && !force) {
    return existingSubscription;
  }

  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });

  const p256dhKey = subscription.getKey('p256dh');
  const authKey = subscription.getKey('auth');

  ensureAuthHeader();

  try {
    await api.post('/users/me/push/subscribe', {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: {
        p256dh: encodePushKey(p256dhKey),
        auth: encodePushKey(authKey),
      },
    });
  } catch (error) {
    if (error?.response?.status === 401) {
      try {
        await api.post('/auth/refresh', {});
        ensureAuthHeader();
        await api.post('/users/me/push/subscribe', {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime ?? null,
          keys: {
            p256dh: encodePushKey(p256dhKey),
            auth: encodePushKey(authKey),
          },
        });
      } catch (refreshError) {
        throw refreshError;
      }
    } else {
      throw error;
    }
  }

  return subscription;
}

export async function unsubscribeFromTextweekPush() {
  if (!supportsBrowserPush()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return false;
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await api.post('/users/me/push/unsubscribe', { endpoint });
    return true;
  } catch (error) {
    console.error('[TextWeek Push] Unsubscribe failed', error);
    return false;
  }
}
