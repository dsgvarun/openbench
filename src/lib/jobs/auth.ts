import "server-only";

// Cron auth. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We reject unless
// it matches — these endpoints run with the service role, so they must never be open.
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
