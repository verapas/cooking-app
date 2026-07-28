import { validateSession } from './db';

export function verifySession(sessionId: string): boolean {
  return validateSession(sessionId);
}