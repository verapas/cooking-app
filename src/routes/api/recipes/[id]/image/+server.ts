import { error, json } from '@sveltejs/kit';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

const IMAGES_DIR = resolve(env.IMAGES_DIR ?? './data/images');
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

// POST /api/recipes/[id]/image  (Token-geschützt via hooks.server.ts)
// multipart/form-data, Feld "image". Überschreibt ein vorhandenes Bild.
export const POST: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);

  const row = db
    .prepare('SELECT id, image_url FROM recipes WHERE id = ?')
    .get(id) as { id: number; image_url: string | null } | undefined;
  if (!row) throw error(404, 'Rezept nicht gefunden');

  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw error(400, 'Feld "image" fehlt');
  if (file.size === 0) throw error(400, 'Leere Datei');
  if (file.size > MAX_BYTES) throw error(413, 'Datei zu groß (max. 5 MB)');

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw error(415, 'Nur JPG, PNG, WebP oder GIF');

  await mkdir(IMAGES_DIR, { recursive: true });

  const name = `recipe-${id}-${Date.now()}${ext}`;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(resolve(IMAGES_DIR, name), buf);
  } catch (e) {
    throw error(500, 'Speichern fehlgeschlagen: ' + (e as Error).message);
  }

  const url = `/images/${name}`;
  db.prepare('UPDATE recipes SET image_url = ? WHERE id = ?').run(url, id);

  // Altes Bild aufräumen (nur eigene Uploads unter /images/)
  if (row.image_url?.startsWith('/images/')) {
    const oldName = row.image_url.slice('/images/'.length);
    if (!/[\\/]/.test(oldName)) {
      await unlink(resolve(IMAGES_DIR, oldName)).catch(() => {});
    }
  }

  return json({ image_url: url });
};
