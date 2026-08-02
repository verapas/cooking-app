import { json } from '@sveltejs/kit';
import { validateSession } from '$lib/server/db';

export async function GET({ cookies }) {
  const sessionId = cookies.get('session');
  if (!sessionId || !(await validateSession(sessionId))) {
    return json({ ok: false }, { status: 401 });
  }
  return json({ ok: true });
}