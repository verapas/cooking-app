-- =====================================================================
-- V6__kitchen_tools.sql — Küchenutensilien der Person
-- =====================================================================
-- Was steht in der Küche (z. B. Ofen, Airfryer, Knethacken)? Die KI
-- berücksichtigt diese Liste beim Vorschlagen von Rezepten.
-- Kein created_at nötig → kein Date-Mapping in db.ts erforderlich.
-- UNIQUE auf name; die Collation utf8mb4_unicode_ci ist case- und
-- akzent-insensitiv → "Airfryer" und "airfryer" gelten als Duplikat.
-- =====================================================================

CREATE TABLE kitchen_tools (
  id   INT         NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kitchen_tools_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
