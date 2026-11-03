import { verifyToken, getUserById } from '../services/auth.service.js';
import { createRequireAuth } from './authCore.js';

// Protects a route: requires "Authorization: Bearer <token>" and attaches req.user.
export const requireAuth = createRequireAuth({ verifyToken, getUserById });
