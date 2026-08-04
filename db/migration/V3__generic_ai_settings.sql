-- =====================================================================
-- V3__generic_ai_settings.sql — generische KI-Provider-Konfiguration
-- =====================================================================
-- Die App unterstützt beliebige OpenAI-kompatible Provider (z. B. z.ai
-- direkt, OpenRouter, OpenAI, LM Studio). Statt OpenRouter fest zu
-- verbauen, gibt es nun drei generische Settings:
--   AI_API_KEY  — Provider-API-Key
--   AI_MODEL    — Modell-String (z. B. "glm-4.6")
--   AI_BASE_URL — OpenAI-kompatible Base-URL (z. B. "https://api.z.ai/api/paas/v4")
--
-- Diese Migration übernimmt bestehende Werte aus den alten OPENROUTER_*
-- Keys (aus V2), korrigiert das Modell-Präfix (OpenRouter "z-ai/glm-4.6"
-- → z.ai direkt "glm-4.6") und räumt die alten Keys anschließend weg.
-- Damit funktioniert ein laufendes Setup nahtlos weiter.
-- =====================================================================

-- 1) API-Key übernehmen, falls noch nicht gesetzt.
INSERT INTO settings (`key`, `value`, updated_at)
SELECT 'AI_API_KEY', s.value, NOW()
FROM settings s
WHERE s.`key` = 'OPENROUTER_API_KEY'
  AND s.value IS NOT NULL
  AND s.value <> ''
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2) Modell übernehmen, dabei das OpenRouter-Präfix "z-ai/" abschneiden,
--    damit z.ai direkt den korrekten Modell-String ("glm-4.6") bekommt.
INSERT INTO settings (`key`, `value`, updated_at)
SELECT 'AI_MODEL',
       TRIM(LEADING 'z-ai/' FROM s.value),
       NOW()
FROM settings s
WHERE s.`key` = 'OPENROUTER_MODEL'
  AND s.value IS NOT NULL
  AND s.value <> ''
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 3) Default Base-URL (z.ai direkt), falls noch nicht gesetzt.
INSERT INTO settings (`key`, `value`, updated_at)
VALUES ('AI_BASE_URL', 'https://api.z.ai/api/paas/v4', NOW())
ON DUPLICATE KEY UPDATE updated_at = updated_at;

-- 4) Altlasten entfernen — OPENROUTER_* werden nicht mehr gelesen.
DELETE FROM settings WHERE `key` IN ('OPENROUTER_API_KEY', 'OPENROUTER_MODEL');
