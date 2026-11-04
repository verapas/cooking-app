// === Bild-Datei-Management (server-only) ===
//
// Rezept-Bilder liegen als Dateien in $IMAGES_DIR; in der DB steht nur die
// URL (/images/<name>). Diese Helper räumen Dateien weg, wenn die letzte
// DB-Referenz fällt — sonst hängen Geister-Bilder im Dateisystem.

import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '$env/dynamic/private';

const IMAGES_DIR = resolve(env.IMAGES_DIR ?? './data/images');

/** Löscht die Datei hinter einer /images/-URL (ignoriert Fremd-URLs und
 *  fehlende Dateien still — kein Grund, einen erfolgreichen DB-Delete
 *  wegen Dateisystem-Resten platzen zu lassen). */
export async function removeImageFile(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith('/images/')) return;
  const name = url.slice('/images/'.length);
  // Keine Pfade/Trouwversuche — nur flache Dateinamen im Images-Dir.
  if (/[\\/]/.test(name)) return;
  await unlink(resolve(IMAGES_DIR, name)).catch(() => {});
}
