-- =====================================================================
-- V8__tags.sql — Tags für Rezepte (Querschnitts-Merkmale)
-- =====================================================================
-- Tags sind frei kombinierbare Merkmale über Kategorien hinweg
-- (z. B. "vegetarisch", "schnell", "für Gäste") — im Gegensatz zur
-- exklusiven Kategorie. n:m über recipe_tags.
-- Wie kitchen_tags gilt: UNIQUE auf name, die Collation
-- utf8mb4_unicode_ci ist case-/akzent-insensitiv → "Vegetarisch" und
-- "vegetarisch" sind dasselbe Tag (Get-or-Create per Upsert).
-- count in listTags zählt Rezept-FAMILIEN (Hauptrezept + Varianten
-- zusammen), passend zum Familien-Filter in listRecipes.
-- ON DELETE CASCADE: Rezept löschen → Links weg; Tag löschen → Links weg.
-- Keine DATETIME-Spalten → kein RECIPE_DATES-Eintrag nötig.
-- =====================================================================

CREATE TABLE tags (
  id   INT         NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recipe_tags (
  recipe_id INT NOT NULL,
  tag_id    INT NOT NULL,
  PRIMARY KEY (recipe_id, tag_id),
  KEY idx_recipe_tags_tag (tag_id),
  CONSTRAINT fk_recipe_tags_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
  CONSTRAINT fk_recipe_tags_tag
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
