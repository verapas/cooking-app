import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { togglePublish } from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';

// POST /api/recipes/[id]/publish  (session-geschützt, nur eigener Space)
//
// Schaltet den Veröffentlichungs-Status um: Veröffentlichen setzt
// published_at = NOW() und macht das Rezept im „Öffentlich"-Bereich für
// alle eingeloggten Benutzer sichtbar (inkl. Bild); zurückziehen nimmt
// beides zurück. Nachträgliche Änderungen am Rezept erscheinen auch
// öffentlich — wer nicht mehr veröffentlichen will, zieht es zurück.
export const POST: RequestHandler = async ({ locals, params }) => {
  const id = Number(params.id);
  if (isNaN(id)) throw error(400, 'Ungültige Rezept-ID');

  const isPublished = await togglePublish(requireSpaceId(locals), id);
  if (isPublished === null) throw error(404, 'Rezept nicht gefunden');

  return json({ ok: true, is_published: isPublished });
};
