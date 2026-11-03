import { AppError } from '../utils/AppError.js';

const SALT_ROUNDS = 12;

// Never return passwordHash to callers.
const publicUserSelect = { id: true, name: true, email: true, createdAt: true };

// db, hasher and tokens are injected: the app passes Prisma, bcrypt and JWT; tests pass simple fakes.
//   hasher: { hash(password, rounds), hashSync(password, rounds), compare(password, hash) }
//   tokens: { sign(userId), verify(token) }
export function createAuthService({ db, hasher, tokens }) {
  // Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
  const dummyHash = hasher.hashSync('timing-safe-placeholder', SALT_ROUNDS);

  async function registerUser({ name, email, password }) {
    const passwordHash = await hasher.hash(password, SALT_ROUNDS);
    try {
      const user = await db.user.create({ data: { name, email, passwordHash }, select: publicUserSelect });
      return { user, token: tokens.sign(user.id) };
    } catch (err) {
      // P2002 = unique constraint violation (email already registered)
      if (err.code === 'P2002') {
        throw new AppError('An account with this email already exists.', 409, 'EMAIL_TAKEN');
      }
      throw err;
    }
  }

  async function loginUser({ email, password }) {
    const user = await db.user.findUnique({ where: { email } });
    const passwordMatches = await hasher.compare(password, user?.passwordHash ?? dummyHash);

    // Same message for "no such user" and "wrong password" on purpose.
    if (!user || !passwordMatches) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      token: tokens.sign(user.id),
    };
  }

  const getUserById = (id) => db.user.findUnique({ where: { id }, select: publicUserSelect });

  return { registerUser, loginUser, getUserById, signToken: tokens.sign, verifyToken: tokens.verify };
}
