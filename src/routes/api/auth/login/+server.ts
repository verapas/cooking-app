import { json } from '@sveltejs/kit';
import { getUserByUsername, createSession } from '$lib/server/db';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

export async function POST({ request, cookies }) {
  const { username, password } = await request.json();

  const user = getUserByUsername(username);
  if (!user) {
    return json({ error: 'Ungültige Zugangsdaten' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return json({ error: 'Ungültige Zugangsdaten' }, { status: 401 });
  }

  const sessionId = randomBytes(32).toString('hex');
  createSession(sessionId);

  cookies.set('session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  });

  return json({ success: true });
}