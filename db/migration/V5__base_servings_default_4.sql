-- =====================================================================
-- V5__base_servings_default_4.sql — Standard-Portionen 2 → 4
-- =====================================================================
-- Koch-Annahme: Es wird immer für 4 Personen gekocht, sofern nichts
-- anderes gesagt wird. Der bisherige Default (2) passt nicht dazu.
-- Nur der Spalten-Default wird angehoben — bestehende Rezepte behalten
-- ihre eingetragene Portionenzahl.
-- =====================================================================

ALTER TABLE recipes
  MODIFY COLUMN base_servings INT NOT NULL DEFAULT 4;
