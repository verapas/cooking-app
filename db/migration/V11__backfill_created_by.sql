-- =====================================================================
-- V11__backfill_created_by.sql — Urheber für Alt-Rezepte nachtragen
-- =====================================================================
-- Rezepte aus der Zeit vor V10 (Single-User-App ohne Login) haben kein
-- created_by — deshalb zeigte der „Öffentlich“-Bereich „von Unbekannt“.
-- Der V10-Backfill hat alle Altdaten in den Space „Familie“ gelegt;
-- dort (und in jedem anderen Space mit Alt-Daten) ordnen wir Rezepte
-- ohne Urheber dem FRÜHESTEN Mitglied des Spaces zu: users.id ist
-- AUTO_INCREMENT, die kleinste id im Space = erstelltes Konto zuerst —
-- bei der Vor-Spaces-App praktisch immer derjenige, der die Rezepte
-- eingegeben hat. Neue Rezepte setzen created_by direkt beim Anlegen
-- (POST /api/recipes bzw. Kopieren), dieser Backfill läuft ins Leere.
-- =====================================================================

UPDATE recipes r
JOIN (
  SELECT sm.space_id, MIN(sm.user_id) AS first_user_id
  FROM space_members sm
  GROUP BY sm.space_id
) first_member ON first_member.space_id = r.space_id
SET r.created_by = first_member.first_user_id
WHERE r.created_by IS NULL;
