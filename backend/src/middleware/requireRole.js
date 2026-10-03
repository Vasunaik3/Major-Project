export function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles);
  return (request, response, next) => {
    const role = request.user?.role === 'USER' ? 'OPERATOR' : request.user?.role;
    if (!role || !allowed.has(role)) {
      return response.status(403).json({
        error: 'You do not have permission to perform this action.',
        requiredRoles: [...allowed],
      });
    }
    request.user.role = role;
    next();
  };
}
