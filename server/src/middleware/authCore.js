import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

// Builds the "must be logged in" middleware. Token checking and user lookup are injected so it can be tested.
export function createRequireAuth({ verifyToken, getUserById }) {
  return asyncHandler(async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError('Your session has expired. Please log in again.', 401, 'INVALID_TOKEN');
    }

    const user = await getUserById(payload.sub);
    if (!user) {
      throw new AppError('This account no longer exists.', 401, 'INVALID_TOKEN');
    }

    req.user = user;
    next();
  });
}
