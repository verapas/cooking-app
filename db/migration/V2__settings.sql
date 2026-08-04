-- =====================================================================
-- V2__settings.sql — App-Settings (Key/Value)
-- =====================================================================
-- Nimmt App-Konfiguration auf, die zur Laufzeit editierbar sein soll
-- (aktuell: OpenRouter API-Key + Modell für die KI-Chat-Funktion).
-- Die Werte werden über /api/settings gelesen/geschrieben und in
-- src/lib/server/settings.ts gekapselt.
-- `key` ist ein reserviertes Wort → zwingend backticken.
-- =====================================================================

CREATE TABLE settings (
  `key`      VARCHAR(64)  NOT NULL,
  `value`    TEXT         NOT NULL,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
