// Settings that are fine on your laptop but dangerous on a real server.
// Returns a list of problems; empty means OK. Pure function, so it is easy to test.
export function productionProblems(env) {
  if (env.NODE_ENV !== 'production') return [];

  const problems = [];
  if (env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production.');
  }
  if (/replace-with|change.?me|example|your[-_ ]?secret|password/i.test(env.JWT_SECRET)) {
    problems.push('JWT_SECRET looks like a placeholder. Generate a random one.');
  }
  if (!env.CLIENT_URL.startsWith('https://')) {
    problems.push('CLIENT_URL must use https:// in production.');
  }
  if (/\/\/postgres:postgres@/.test(env.DATABASE_URL)) {
    problems.push('DATABASE_URL uses the default development password (postgres:postgres).');
  }
  return problems;
}
