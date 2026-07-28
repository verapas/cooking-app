import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const IMAGES_DIR = resolve(env.IMAGES_DIR ?? './data/images');

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

// Liefert ein hochgeladenes Bild aus dem lokalen Speicher (data/images/).
export const GET: RequestHandler = async ({ params }) => {
  const name = params.file;
  // Pfad-Traversierung verhindern
  if (!name || /[\\/]/.test(name)) throw error(404);

  const type = TYPES[extname(name).toLowerCase()];
  if (!type) throw error(415, 'Dateityp nicht unterstützt');

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
