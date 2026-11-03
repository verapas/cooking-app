-- =====================================================================
-- V10__spaces.sql — Multi-Space: eigene Rezepte/Kategorien/Tags pro Space
-- =====================================================================
-- Ein Space ist ein abgeschlossener Datenbereich (z. B. "Familie" oder
-- "Pascals Rezepte"). Mehrere Benutzer (Keycloak-Konten) können MEMBER
-- desselben Spaces sein und sehen/bearbeiten dann dieselben Daten —
-- so teilen sich z. B. zwei Partner einen Space, während Freunde je
-- einen eigenen privaten Space bekommen.
--
-- Tabellen:
--   spaces        — der Space selbst (Name, invite-frei in Phase 1)
--   space_members — n:m Benutzer↔Space mit Rolle (owner/member)
--
-- Spalten:
--   categories/tags/kitchen_tools/settings . space_id  → Isolation
--   recipes . space_id + is_published/published_at/created_by
--             (Veröffentlichen kommt in Phase 3, Spalten jetzt anlegen)
--   users . active_space_id → welcher Space gerade "aktiv" ist
--   users . is_admin        → App-Admin (Phase 2: Benutzerverwaltung)
--
-- Backfill: Space "Familie" (id=1, spaces ist neu) erhält ALLE vorhande-
-- nen Daten; alle vorhandenen Benutzer werden owner; der FRÜHESTE
-- Benutzer wird App-Admin. Auf einer frischen DB sind alle Tabellen leer
-- und die UPDATEs laufen ins Leere — der erste Login provisioniert dann
-- einen persönlichen Space (siehe src/lib/server/spaces.ts).
--
-- UNIQUE-Keys werden space-lokal: gleicher slug/name darf in verschiedenen
-- Spaces existieren (Duplikat-Erkennung via Collation bleibt pro Space).
-- =====================================================================

CREATE TABLE spaces (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE space_members (
  space_id  INT      NOT NULL,
  user_id   INT      NOT NULL,
  role      ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (space_id, user_id),
  KEY idx_space_members_user (user_id),
  CONSTRAINT fk_space_members_space
    FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE CASCADE,
  CONSTRAINT fk_space_members_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- users: aktiver Space + Admin-Flag ---

ALTER TABLE users
  ADD COLUMN active_space_id INT NULL AFTER name,
  ADD COLUMN is_admin        TINYINT(1) NOT NULL DEFAULT 0 AFTER active_space_id,
  ADD KEY idx_users_active_space (active_space_id),
  ADD CONSTRAINT fk_users_active_space
    FOREIGN KEY (active_space_id) REFERENCES spaces (id) ON DELETE SET NULL;

-- --- Backfill-Space anlegen. spaces ist neu → AUTO_INCREMENT startet
--     bei 1, die id ist also deterministisch. ---

INSERT INTO spaces (name) VALUES ('Familie');

-- --- categories ---

ALTER TABLE categories
  ADD COLUMN space_id INT NOT NULL DEFAULT 0 AFTER id,
  ADD KEY idx_categories_space (space_id);

UPDATE categories SET space_id = 1;

ALTER TABLE categories
  DROP KEY uq_categories_slug,
  ADD UNIQUE KEY uq_categories_space_slug (space_id, slug),
  ADD CONSTRAINT fk_categories_space
    FOREIGN KEY (space_id) REFERENCES spaces (id);

-- --- tags ---

ALTER TABLE tags
  ADD COLUMN space_id INT NOT NULL DEFAULT 0 AFTER id,
  ADD KEY idx_tags_space (space_id);

UPDATE tags SET space_id = 1;

ALTER TABLE tags
  DROP KEY uq_tags_name,
  ADD UNIQUE KEY uq_tags_space_name (space_id, name),
  ADD CONSTRAINT fk_tags_space
    FOREIGN KEY (space_id) REFERENCES spaces (id);

-- --- kitchen_tools ---

ALTER TABLE kitchen_tools
  ADD COLUMN space_id INT NOT NULL DEFAULT 0 AFTER id,
  ADD KEY idx_kitchen_tools_space (space_id);

UPDATE kitchen_tools SET space_id = 1;

ALTER TABLE kitchen_tools
  DROP KEY uq_kitchen_tools_name,
  ADD UNIQUE KEY uq_kitchen_tools_space_name (space_id, name),
  ADD CONSTRAINT fk_kitchen_tools_space
    FOREIGN KEY (space_id) REFERENCES spaces (id);

-- --- recipes: Space + Veröffentlichen (Phase 3) + Urheber ---

ALTER TABLE recipes
  ADD COLUMN space_id     INT          NOT NULL DEFAULT 0 AFTER id,
  ADD COLUMN is_published TINYINT(1)   NOT NULL DEFAULT 0 AFTER version_name,
  ADD COLUMN published_at DATETIME     NULL AFTER is_published,
  ADD COLUMN created_by   INT          NULL AFTER published_at,
  ADD KEY idx_recipes_space (space_id),
  ADD KEY idx_recipes_published (is_published),
  ADD KEY idx_recipes_created_by (created_by);

UPDATE recipes SET space_id = 1;

ALTER TABLE recipes
  ADD CONSTRAINT fk_recipes_space
    FOREIGN KEY (space_id) REFERENCES spaces (id),
  ADD CONSTRAINT fk_recipes_created_by
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;

-- --- settings: KI-Konfiguration pro Space (Freunde bringen ihren
--     eigenen API-Key mit, statt den globalen zu teilen). ---

ALTER TABLE settings
  ADD COLUMN space_id INT NOT NULL DEFAULT 0 FIRST,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (space_id, `key`);

UPDATE settings SET space_id = 1;

ALTER TABLE settings
  ADD KEY idx_settings_space (space_id),
  ADD CONSTRAINT fk_settings_space
    FOREIGN KEY (space_id) REFERENCES spaces (id);

-- --- Backfill: alle vorhandenen Benutzer werden owner des Familien-
--     Spaces und haben ihn aktiv; der früheste Benutzer wird Admin.
--     (Auf frischer DB: keine Benutzer → nichts passiert; Provisioning
--      beim Erstlogin übernimmt spaces.ts.) ---

INSERT INTO space_members (space_id, user_id, role)
SELECT 1, u.id, 'owner' FROM users u;

UPDATE users SET active_space_id = 1;

UPDATE users SET is_admin = 1
WHERE id = (
  SELECT id FROM (
    SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1
  ) earliest_user
);
