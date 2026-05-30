export function requireAdmin(req, res, next) {
  const role = String(req.authUser?.role || 'user');
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_REQUIRED',
      message: 'Admin access required',
    });
  }

  return next();
}
