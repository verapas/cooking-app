import { validateSession } from './db';

export async function verifySession(sessionId: string): Promise<boolean> {
  return validateSession(sessionId);
}
