import crypto from 'crypto';

export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && incoming.trim() ? incoming.trim() : crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
