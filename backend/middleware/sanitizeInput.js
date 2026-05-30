const skipTrimKeys = new Set(['password', 'currentPassword', 'newPassword']);

function cleanString(value, key = '') {
  if (typeof value !== 'string') return value;

  const withoutControlChars = value.replace(/[\u0000-\u001F\u007F]/g, '');
  if (skipTrimKeys.has(key)) {
    return withoutControlChars;
  }

  return withoutControlChars.trim();
}

function deepSanitize(input, parentKey = '') {
  if (Array.isArray(input)) {
    return input.map((item) => deepSanitize(item, parentKey));
  }

  if (input && typeof input === 'object') {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = deepSanitize(value, key);
    }
    return output;
  }

  return cleanString(input, parentKey);
}

export function sanitizeInput(req, _res, next) {
  req.body = deepSanitize(req.body);

  const sanitizedQuery = deepSanitize(req.query || {});
  for (const key of Object.keys(req.query || {})) {
    delete req.query[key];
  }
  Object.assign(req.query, sanitizedQuery);

  next();
}
