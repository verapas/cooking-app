-- =====================================================================
-- V12__user_settings.sql — KI-Settings vom Space auf den Benutzer umstellen
-- =====================================================================
-- Scoping-Regeln der App:
--   Rezepte/Kategorien/Tags/Küchenutensilien → pro Space
--     (persönlicher Space = nutzerspezifisch, geteilter Space =
--      „familienpezifisch" — dort führen Mitglieder zusammen)
--   KI-Settings (API-Key, Modell, Base-URL) → rein pro BENUTZER
--
-- Vor V12 lag die KI-Konfiguration pro Space. Jedes Space-Mitglied
-- bekam beim Backfill eine Kopie der bisherigen Werte seines Spaces
-- (Priorität: aktiver Space, sonst Space mit kleinster id) — so
-- verliert niemand seine funktionierende Konfiguration, und ab jetzt
-- verwaltet jeder Benutzer seinen eigenen Key unabhängig.
--
-- Auf einer frischen DB ist die Tabelle leer — alle Statements laufen
-- ins Leere bis auf die Struktur-Änderungen selbst.
-- =====================================================================

-- --- 1. user_id anlegen, alte Space-Constraints lösen (der alte PK
--        (space_id, `key`) würde die Kopien für weitere Mitglieder
--        blockieren) ---

ALTER TABLE settings
  ADD COLUMN user_id INT NULL AFTER space_id,
  ADD KEY idx_settings_user (user_id);

ALTER TABLE settings
  DROP PRIMARY KEY,
  DROP FOREIGN KEY fk_settings_space,
  DROP KEY idx_settings_space;

-- --- 2. Backfill: jedes Mitglied eines Spaces erhält seine Werte.
--        Pro (Benutzer, Key) gewinnt der Eintrag aus dem aktiven Space,
--        sonst der aus dem Space mit der kleinsten id. ---

INSERT INTO settings (user_id, `key`, `value`, updated_at)
SELECT user_id, `key`, `value`, updated_at
FROM (
  SELECT sm.user_id, s.`key`, s.`value`, s.updated_at,
         ROW_NUMBER() OVER (
           PARTITION BY sm.user_id, s.`key`
           ORDER BY (sm.space_id = u.active_space_id) DESC, sm.space_id ASC
         ) AS rn
  FROM settings s
  JOIN space_members sm ON sm.space_id = s.space_id
  JOIN users u ON u.id = sm.user_id
) ranked
WHERE ranked.rn = 1;

-- --- 3. Alte (space-gebundene) Zeilen entsorgen: alles, was kein
--        Mitglied mehr hat (Space ohne Mitglieder — kann via FK nicht
--        vorkommen, nur zur Sicherheit) ---

DELETE FROM settings WHERE user_id IS NULL;

-- --- 4. Constraints auf Benutzer umstellen, space_id entfernen ---

ALTER TABLE settings
  MODIFY user_id INT NOT NULL,
  ADD PRIMARY KEY (user_id, `key`),
  ADD CONSTRAINT fk_settings_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  DROP COLUMN space_id;
