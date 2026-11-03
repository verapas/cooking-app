import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { env } from '$env/dynamic/private';
import { canViewRecipeImage } from '$lib/server/queries';
import type { RequestHandler } from './$types';

const IMAGES_DIR = resolve(env.IMAGES_DIR ?? './data/images');

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

// Liefert ein hochgeladenes Bild aus dem localen Speicher (data/images/).
//
// Zugriffsprüfung (V10): Dateinamen sind zwar mit Recipe-ID + Timestamp
// schwer ratbar, aber das soll nicht das einzige Schutzkonzept sein.
// Sichtbar ist ein Bild nur, wenn der Benutzer Mitglied im Space des
// Rezepts ist ODER das Rezept veröffentlicht ist (Phase 3 „Öffentlich").
// Vor V10 durfte jede beliebige Session jedes Bild laden.
export const GET: RequestHandler = async ({ locals, params }) => {
  const name = params.file;
  // Pfad-Traversierung verhindern
  if (!name || /[\\/]/.test(name)) throw error(404);

  const type = TYPES[extname(name).toLowerCase()];
  if (!type) throw error(415, 'Dateityp nicht unterstützt');

  // Ohne Login (Pfad ist nicht öffentlich, aber defensiv) oder ohne
  // Berechtigung: 404 statt 403 — verrät nichts über Existenz des Bilds.
  const userId = locals.user?.id;
  if (userId == null || !(await canViewRecipeImage(userId, name))) {
    throw error(404);
  }

  try {
    const buf = await readFile(join(IMAGES_DIR, name));
    return new Response(buf, {
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400'
      }
    });
  } catch {
    throw error(404, 'Bild nicht gefunden');
  }
};
