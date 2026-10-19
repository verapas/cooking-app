-- =====================================================================
-- V7__recipe_pin.sql — Rezepte anpinnen („heute kochen")
-- =====================================================================
-- Pin = das, was als Nächstes gekocht werden soll. Angepinnte Rezepte
-- stehen in der Liste zuoberst (vor den Favoriten) und werden orange
-- hervorgehoben. Mehrere Pins sind erlaubt — pinned_at sortiert sie
-- (zuletzt angepinnt zuerst) und muss beim Abpinnen auf NULL gesetzt
-- werden.
-- is_pinned als TINYINT(1) → mysql2 liefert echtes Boolean.
-- pinned_at als DATETIME → in RECIPE_DATES (db.ts) aufgenommen, damit
-- der Row-Mapper einen ISO-String liefert.
-- =====================================================================

ALTER TABLE recipes
  ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER is_favorite,
  ADD COLUMN pinned_at DATETIME NULL AFTER is_pinned;
