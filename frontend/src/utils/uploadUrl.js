const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;

export function isLikelyImageUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  const isUploadPath = /^\/uploads\/[\w.-]+\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(normalized);
  if (isUploadPath) return true;

  if (!/^https?:\/\//i.test(normalized)) return false;

  try {
    const parsed = new URL(normalized);
    return IMAGE_EXT_RE.test(parsed.pathname || '');
  } catch {
    return IMAGE_EXT_RE.test(normalized.split('?')[0] || normalized);
  }
}

export function resolveUploadUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  if (normalized.startsWith('api/uploads/')) {
    return `/${normalized.slice('api/'.length)}`;
  }

  if (/^https?:\/\//i.test(normalized)) return normalized;

  const configuredBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!configuredBase || configuredBase.startsWith('/')) {
    return normalized;
  }

  try {
    const parsedBase = new URL(configuredBase);
    return `${parsedBase.origin}${normalized}`;
  } catch {
    return normalized;
  }
}

export function resolveUploadImageUrl(value) {
  if (!isLikelyImageUrl(value)) return '';
  return resolveUploadUrl(value);
}

export function isPrivateUploadUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized.startsWith('/uploads/')) return true;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      return parsed.pathname.startsWith('/uploads/');
    } catch {
      return false;
    }
  }

  return false;
}
