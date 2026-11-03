import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Single shared client; avoids exhausting connections on hot reload.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Quiet during automated tests: expected errors (like a duplicate email) would otherwise fill the output.
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : env.NODE_ENV === 'test' ? [] : ['error'],
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
