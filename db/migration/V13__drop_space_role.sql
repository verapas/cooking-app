-- V13: Rollen in Spaces entfernen.
-- space_members.role (owner|member) wurde nie serverseitig durchgesetzt —
-- Rechte innerhalb eines Spaces hängen allein an der Mitgliedschaft,
-- Verwaltung liegt auf users.is_admin. Das Feld ist redundant.

ALTER TABLE space_members DROP COLUMN role;
