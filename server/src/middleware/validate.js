// Validates req.body against a Zod schema. Invalid input becomes a 400 via errorHandler.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data; // trimmed / normalized values
  next();
};
