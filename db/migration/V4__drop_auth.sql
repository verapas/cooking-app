-- =====================================================================
-- V4__drop_auth.sql — Auth-Tabellen entfernen
-- =====================================================================
-- Die App nutzt kein eigenes Login mehr. Der Zugriffsschutz erfolgt
-- vollständig auf Infrastrukturebene (Reverse Proxy / VPN / internes
-- Netz). Die session-basierte Authentifizierung wird deshalb including
-- der beiden Tabellen entfernt.
--
-- Reihenfolge unkritisch: sessions hat keinen FK zu users.
-- =====================================================================

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
