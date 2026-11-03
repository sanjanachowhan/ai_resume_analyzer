import { asyncHandler } from '../utils/asyncHandler.js';
import { registerUser, loginUser } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await registerUser(req.body);
  res.status(201).json({ success: true, user, token });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUser(req.body);
  res.json({ success: true, user, token });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});
