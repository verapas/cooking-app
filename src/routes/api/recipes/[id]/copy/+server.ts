import { json, error } from '@sveltejs/kit';
import { copyFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { env } from '$env/dynamic/private';
import {
  copyRecipeIntoSpace,
  getPublishedRecipe,
  getRecipe,
  setRecipeImageUrl
} from '$lib/server/queries';
import { requireSpaceId } from '$lib/server/spaces';
import type { RequestHandler } from './$types';

const IMAGES_DIR = resolve(env.IMAGES_DIR ?? './data/images');

// POST /api/recipes/[id]/copy — veröffentlichtes (oder eigenes) Rezept in
// den aktiven Space kopieren.
//
// Berechtigung: Das Rezept muss im eigenen Space sein ODER veröffentlicht
// (dieselbe Regel wie für die Bild-Anzeige). Die Kopie ist ein neues,
// unveröffentlichtes Hauptrezept mit Schritten, Zutaten und Tags (Tags per
// Get-or-Create im eigenen Space); Varianten werden nicht mitkopiert.
// Das Bild wird als eigene Datei dupliziert, damit das Löschen des
// Originals die Kopie nicht bricht.
export const POST: RequestHandler = async ({ locals, params }) => {
  const spaceId = requireSpaceId(locals);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw error(400, 'Ungültige Rezept-ID');

  // Quelle laden: eigenes Rezept (Space-Check inklusive) oder veröffentlicht.
  const source = (await getRecipe(spaceId, id)) ?? (await getPublishedRecipe(id));
  if (!source) throw error(404, 'Rezept nicht gefunden');
  if (source.space_id === spaceId) {
    throw error(422, 'Dieses Rezept ist bereits in deinem Space');
  }

  const newId = await copyRecipeIntoSpace(spaceId, source, locals.user?.id ?? null);

  // Bild-Datei duplizieren (nur eigene Uploads unter /images/). Schlägt das
  // fehl (z. B. Datei fehlt), verweist die Kopie weiter auf die Datei des
  // Originals — kein Grund, die ganze Kopie zu verwerfen.
  if (source.image_url?.startsWith('/images/')) {
    const oldName = source.image_url.slice('/images/'.length);
    if (!/[\\/]/.test(oldName)) {
      const newName = `recipe-${newId}-${Date.now()}${extname(oldName).toLowerCase()}`;
      try {
        await copyFile(resolve(IMAGES_DIR, oldName), resolve(IMAGES_DIR, newName));
        await setRecipeImageUrl(spaceId, newId, `/images/${newName}`);
      } catch (err) {
        console.error('Bild-Duplizieren fehlgeschlagen (Kopie nutzt Original-URL):', err);
      }
    }
  }

  return json({ id: newId }, { status: 201 });
};
