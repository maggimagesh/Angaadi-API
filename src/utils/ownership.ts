import type { NextApiRequest } from 'next'

/**
 * True when `userId` (from a request body or path) is the authenticated user.
 * Routes wrapped in withAuth must check this before acting on a client-supplied
 * userId, otherwise any signed-in user can read or write another user's data.
 */
export function isAuthenticatedUser(req: NextApiRequest, userId: unknown): boolean {
  const authUserId = String((req as { user?: { sub?: string } }).user?.sub || '')
  if (!authUserId) return false
  if (typeof userId !== 'string' && typeof userId !== 'number' && typeof userId !== 'bigint') return false
  return String(userId).trim() === authUserId
}
