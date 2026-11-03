import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { createAuthService } from './authCore.service.js';

// The real database, bcrypt and JWT wired into the auth logic.
const service = createAuthService({
  db: prisma,
  hasher: bcrypt,
  tokens: {
    // The algorithm is pinned, so a forged token cannot ask the server to use a weaker one (like "none").
    sign: (userId) => jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN }),
    verify: (token) => jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }),
  },
});

export const { registerUser, loginUser, getUserById, signToken, verifyToken } = service;
