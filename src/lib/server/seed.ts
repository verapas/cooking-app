// === Seed-Daten ===
// Legt beim ersten Start Beispiel-Kategorien + Rezepte an, damit die App
// nicht leer startet. Idempotent: läuft nur, wenn noch keine Rezepte da sind.

import { countRecipes, createCategory, createRecipe } from './queries';
import { deleteUser, createUser, getDb } from './db';
import { listRecipes } from './queries';
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';
import type { CategoryInput, RecipeInput } from '$lib/types';

const CATEGORIES: CategoryInput[] = [
  { name: 'Suppen', slug: 'suppen', icon: '🍲', sort_order: 1 },
  { name: 'Salate', slug: 'salate', icon: '🥗', sort_order: 2 },
  { name: 'Brot & Backwerk', slug: 'brot-backwerk', icon: '🍞', sort_order: 3 },
  { name: 'Pasta', slug: 'pasta', icon: '🍝', sort_order: 4 },
  { name: 'Hauptgerichte', slug: 'hauptgerichte', icon: '🍽️', sort_order: 5 },
  { name: 'Desserts', slug: 'desserts', icon: '🍰', sort_order: 6 },
  { name: 'Snacks', slug: 'snacks', icon: '🥨', sort_order: 7 }
];

const RECIPES: RecipeInput[] = [
  {
    title: 'Cremige Tomatensuppe',
    description: 'Schnelle, wärmende Suppe — püriert mit einem Schuss Sahne.',
    category_slug: 'suppen',
    base_servings: 2,
    prep_time_min: 5,
    cook_time_min: 20,
    source: 'Demo-Rezept',
    steps: [
      { order: 1, instruction: 'Zwiebel würfeln und im Olivenöl andünsten.' },
      { order: 2, instruction: 'Passierte Tomaten und Gemüsebrühe zugeben, aufkochen und zugedeckt köcheln lassen.', duration_sec: 600 },
      { order: 3, instruction: 'Suppe mit einem Pürierstab glatt pürieren, mit Salz, Pfeffer und einer Prise Zucker abschmecken.' },
      { order: 4, instruction: 'Mit einem Schuss Sahne verfeinern und heiß servieren.' }
    ],
    ingredients: [
      { name: 'Zwiebeln', quantity: 1, unit: 'Stück', step_order: 1, sort_order: 0 },
      { name: 'Olivenöl', quantity: 1, unit: 'EL', step_order: 1, sort_order: 1 },
      { name: 'Passierte Tomaten', quantity: 500, unit: 'g', step_order: 2, sort_order: 2 },
      { name: 'Gemüsebrühe', quantity: 300, unit: 'ml', step_order: 2, sort_order: 3 },
      { name: 'Salz', quantity: 1, unit: 'Prise', step_order: 3, sort_order: 4 },
      { name: 'Pfeffer', quantity: 0, unit: 'nach Geschmack', step_order: 3, sort_order: 5 },
      { name: 'Zucker', quantity: 1, unit: 'Prise', step_order: 3, sort_order: 6 },
      { name: 'Sahne', quantity: 50, unit: 'ml', step_order: 4, sort_order: 7 }
    ]
  },
  {
    title: 'Bunter Gemüsesalat',
    description: 'Frischer, knuspriger Salat mit herzhaftem Senf-Dressing.',
    category_slug: 'salate',
    base_servings: 2,
    prep_time_min: 15,
    cook_time_min: 0,
    source: 'Demo-Rezept',
    steps: [
      { order: 1, instruction: 'Gemüse waschen und in mundgerechte Stücke schneiden.' },
      { order: 2, instruction: 'Für das Dressing Essig, Öl, Senf, Salz und Pfeffer in einer Schüssel verrühren.' },
      { order: 3, instruction: 'Dressing unter das Gemüse heben und kurz durchziehen lassen.', duration_sec: 300 }
    ],
    ingredients: [
      { name: 'Gurke', quantity: 1, unit: 'Stück', step_order: 1, sort_order: 0 },
      { name: 'Tomaten', quantity: 200, unit: 'g', step_order: 1, sort_order: 1 },
      { name: 'Paprika', quantity: 1, unit: 'Stück', step_order: 1, sort_order: 2 },
      { name: 'Rote Zwiebel', quantity: 0.5, unit: 'Stück', step_order: 1, sort_order: 3 },
      { name: 'Essig', quantity: 1, unit: 'EL', step_order: 2, sort_order: 4 },
      { name: 'Olivenöl', quantity: 3, unit: 'EL', step_order: 2, sort_order: 5 },
      { name: 'Senf', quantity: 1, unit: 'TL', step_order: 2, sort_order: 6 },
      { name: 'Salz', quantity: 1, unit: 'Prise', step_order: 2, sort_order: 7 },
      { name: 'Pfeffer', quantity: 0, unit: 'nach Geschmack', step_order: 2, sort_order: 8 }
    ]
  },
  {
    title: 'Schnelles Fladenbrot',
    description: 'Saftiges Pfannenbrot ohne Hefe — in 30 Minuten fertig.',
    category_slug: 'brot-backwerk',
    base_servings: 4,
    prep_time_min: 10,
    cook_time_min: 10,
    source: 'Demo-Rezept',
    steps: [
      { order: 1, instruction: 'Mehl, Salz und Backpulver in einer Schüssel mischen.' },
      { order: 2, instruction: 'Olivenöl und lauwarmes Wasser zugeben und zu einem geschmeidigen Teig verkneten.' },
      { order: 3, instruction: 'Teig abgedeckt ruhen lassen.', duration_sec: 600 },
      { order: 4, instruction: 'Teig in Portionen teilen, flach ausrollen und in einer heißen Pfanne ohne Fett von jeder Seite goldbraun backen.', duration_sec: 180 }
    ],
    ingredients: [
      { name: 'Mehl', quantity: 300, unit: 'g', step_order: 1, sort_order: 0 },
      { name: 'Salz', quantity: 1, unit: 'TL', step_order: 1, sort_order: 1 },
      { name: 'Backpulver', quantity: 1, unit: 'TL', step_order: 1, sort_order: 2 },
      { name: 'Olivenöl', quantity: 2, unit: 'EL', step_order: 2, sort_order: 3 },
      { name: 'Wasser (lauwarm)', quantity: 150, unit: 'ml', step_order: 2, sort_order: 4 }
    ]
  },
  {
    title: 'Spaghetti Bolognese',
    description: 'Klassische italienische Hackfleischsauce mit langer Köchelzeit.',
    category_slug: 'pasta',
    base_servings: 4,
    prep_time_min: 15,
    cook_time_min: 45,
    source: 'Demo-Rezept',
    steps: [
      { order: 1, instruction: 'Zwiebeln und Knoblauch schälen und fein würfeln. In Olivenöl in einem großen Topf glasig dünsten.', duration_sec: 300 },
      { order: 2, instruction: 'Hackfleisch zugeben und krümelig anbraten, bis es Farbe bekommt. Mit Salz und Pfeffer würzen.' },
      { order: 3, instruction: 'Passierte Tomaten, Tomatenmark und Rotwein einrühren. Aufkochen, dann bei niedriger Hitze sanft köcheln lassen.', duration_sec: 1200 },
      { order: 4, instruction: 'Spaghetti in reichlich Salzwasser kochen, bis sie al dente sind. Abgießen und etwas Kochwasser aufheben.', duration_sec: 540 },
      { order: 5, instruction: 'Sauce mit den Nudeln vermengen, bei Bedarf etwas Nudelwasser unterrühren. Mit Parmesan servieren.' }
    ],
    ingredients: [
      { name: 'Zwiebeln', quantity: 2, unit: 'Stück', step_order: 1, sort_order: 0 },
      { name: 'Knoblauch', quantity: 2, unit: 'Zehen', step_order: 1, sort_order: 1 },
      { name: 'Olivenöl', quantity: 2, unit: 'EL', step_order: 1, sort_order: 2 },
      { name: 'Hackfleisch (Rind)', quantity: 500, unit: 'g', step_order: 2, sort_order: 3 },
      { name: 'Salz', quantity: 1, unit: 'TL', step_order: 2, sort_order: 4 },
      { name: 'Pfeffer', quantity: 0, unit: 'nach Geschmack', step_order: 2, sort_order: 5 },
      { name: 'Passierte Tomaten', quantity: 800, unit: 'g', step_order: 3, sort_order: 6 },
      { name: 'Tomatenmark', quantity: 2, unit: 'EL', step_order: 3, sort_order: 7 },
      { name: 'Rotwein', quantity: 100, unit: 'ml', step_order: 3, sort_order: 8 },
      { name: 'Spaghetti', quantity: 400, unit: 'g', step_order: 4, sort_order: 9 },
      { name: 'Parmesan', quantity: 0, unit: 'zum Bestreuen', step_order: 5, sort_order: 10 }
    ]
  },
  {
    title: 'Fluffige Pancakes',
    description: 'Luftige amerikanische Pfannkuchen — klassisch mit Ahornsirup.',
    category_slug: 'desserts',
    base_servings: 3,
    prep_time_min: 10,
    cook_time_min: 15,
    source: 'Demo-Rezept',
    steps: [
      { order: 1, instruction: 'Mehl, Zucker, Backpulver und eine Prise Salz in einer Schüssel mischen.' },
      { order: 2, instruction: 'Butter in einer kleinen Pfanne schmelzen.' },
      { order: 3, instruction: 'Eier mit Milch und geschmolzener Butter verquirlen, dann unter die trockenen Zutaten rühren — nicht zu lange, Klümpchen sind okay.' },
      { order: 4, instruction: 'Pfanne auf mittlerer Stufe erhitzen, etwas Butter zugeben und pro Pfannkuchen ca. 3 EL Teig ins heiße Fett geben. Beidseitig goldgelb backen.', duration_sec: 150 }
    ],
    ingredients: [
      { name: 'Mehl', quantity: 200, unit: 'g', step_order: 1, sort_order: 0 },
      { name: 'Zucker', quantity: 2, unit: 'EL', step_order: 1, sort_order: 1 },
      { name: 'Backpulver', quantity: 2, unit: 'TL', step_order: 1, sort_order: 2 },
      { name: 'Salz', quantity: 1, unit: 'Prise', step_order: 1, sort_order: 3 },
      { name: 'Butter', quantity: 50, unit: 'g', step_order: 2, sort_order: 4 },
      { name: 'Eier', quantity: 2, unit: 'Stück', step_order: 3, sort_order: 5 },
      { name: 'Milch', quantity: 300, unit: 'ml', step_order: 3, sort_order: 6 },
      { name: 'Ahornsirup', quantity: 0, unit: 'nach Geschmack', sort_order: 7 }
    ]
  }
];

const RECIPE_VARIANTS: RecipeInput[] = [
  {
    title: 'Spaghetti Bolognese',
    parent_recipe_id: 0,
    version_name: 'Schnelle Version',
    description: 'Schnelle Variante mit weniger Kochzeit für den Alltag.',
    category_slug: 'pasta',
    base_servings: 4,
    prep_time_min: 10,
    cook_time_min: 30,
    source: 'Demo-Variante',
    steps: [
      { order: 1, instruction: 'Zwiebeln und Knoblauch fein würfeln. In Olivenöl kurz anbraten.' },
      { order: 2, instruction: 'Hackfleisch zugeben und krümelig anbraten.' },
      { order: 3, instruction: 'Passierte Tomaten und Tomatenmark einrühren. 15 Minuten köcheln lassen.', duration_sec: 900 },
      { order: 4, instruction: 'Spaghetti kochen bis al dente.' },
      { order: 5, instruction: 'Sauce mit Nudeln vermengen und servieren.' }
    ],
    ingredients: [
      { name: 'Zwiebeln', quantity: 1, unit: 'Stück', step_order: 1, sort_order: 0 },
      { name: 'Knoblauch', quantity: 1, unit: 'Zehe', step_order: 1, sort_order: 1 },
      { name: 'Olivenöl', quantity: 2, unit: 'EL', step_order: 1, sort_order: 2 },
      { name: 'Hackfleisch (Rind)', quantity: 500, unit: 'g', step_order: 2, sort_order: 3 },
      { name: 'Passierte Tomaten', quantity: 800, unit: 'g', step_order: 3, sort_order: 4 },
      { name: 'Tomatenmark', quantity: 2, unit: 'EL', step_order: 3, sort_order: 5 },
      { name: 'Spaghetti', quantity: 400, unit: 'g', step_order: 4, sort_order: 6 }
    ]
  },
  {
    title: 'Spaghetti Bolognese',
    parent_recipe_id: 0,
    version_name: 'Vegetarisch',
    description: 'Vegetarische Variante mit Tofu anstelle von Hackfleisch.',
    category_slug: 'pasta',
    base_servings: 4,
    prep_time_min: 15,
    cook_time_min: 40,
    source: 'Demo-Variante',
    steps: [
      { order: 1, instruction: 'Zwiebeln und Knoblauch fein würfeln. In Olivenöl glasig dünsten.', duration_sec: 300 },
      { order: 2, instruction: 'Tofu krümelig zerdrücken und mitbraten. Mit Paprikapulver würzen.' },
      { order: 3, instruction: 'Passierte Tomaten, Tomatenmark und Gemüsebrühe einrühren. Aufkochen, dann 20 Minuten köcheln lassen.', duration_sec: 1200 },
      { order: 4, instruction: 'Spaghetti in Salzwasser kochen bis al dente.', duration_sec: 540 },
      { order: 5, instruction: 'Sauce mit Nudeln vermengen. Mit frischem Basilikum garnieren.' }
    ],
    ingredients: [
      { name: 'Zwiebeln', quantity: 2, unit: 'Stück', step_order: 1, sort_order: 0 },
      { name: 'Knoblauch', quantity: 2, unit: 'Zehen', step_order: 1, sort_order: 1 },
      { name: 'Olivenöl', quantity: 2, unit: 'EL', step_order: 1, sort_order: 2 },
      { name: 'Tofu', quantity: 300, unit: 'g', step_order: 2, sort_order: 3 },
      { name: 'Paprikapulver', quantity: 1, unit: 'TL', step_order: 2, sort_order: 4 },
      { name: 'Passierte Tomaten', quantity: 800, unit: 'g', step_order: 3, sort_order: 5 },
      { name: 'Tomatenmark', quantity: 2, unit: 'EL', step_order: 3, sort_order: 6 },
      { name: 'Gemüsebrühe', quantity: 100, unit: 'ml', step_order: 3, sort_order: 7 },
      { name: 'Spaghetti', quantity: 400, unit: 'g', step_order: 4, sort_order: 8 },
      { name: 'Basilikum (frisch)', quantity: 0, unit: 'zum Garnieren', sort_order: 9 }
    ]
  }
];

export async function seedUser(): Promise<void> {
  const adminUsername = env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = env.ADMIN_PASSWORD ?? 'change-me-please';

  deleteUser(adminUsername);
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  createUser(adminUsername, passwordHash);
}

export function seedIfEmpty(): void {
  if (countRecipes() > 0) return;
  
  for (const c of CATEGORIES) createCategory(c);
  for (const r of RECIPES) createRecipe(r);

  const db = getDb();
  const mainRecipe = db.prepare('SELECT id FROM recipes WHERE title = ? AND parent_recipe_id IS NULL').get('Spaghetti Bolognese') as { id: number } | undefined;

  if (mainRecipe) {
    for (const variant of RECIPE_VARIANTS) {
      createRecipe({
        ...variant,
        parent_recipe_id: mainRecipe.id
      });
    }
  }
}
