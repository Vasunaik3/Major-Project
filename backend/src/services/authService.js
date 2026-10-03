import jwt from 'jsonwebtoken';

export function createAccessToken(user) {
  return jwt.sign(
    { sub: user.id, tokenVersion: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  );
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'USER' ? 'OPERATOR' : user.role,
  };
}
