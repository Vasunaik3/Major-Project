import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(request, response, next) {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id name email role tokenVersion');
    if (!user) return response.status(401).json({ error: 'Invalid authentication token.' });
    if (payload.tokenVersion !== user.tokenVersion) {
      return response.status(401).json({ error: 'This session has been signed out. Please log in again.' });
    }
    if (user.role === 'USER') user.role = 'OPERATOR';
    request.user = user;
    next();
  } catch {
    return response.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}
