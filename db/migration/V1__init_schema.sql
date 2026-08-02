-- =====================================================================
-- V1__init_schema.sql — Initial-Schema der Koch-App (MariaDB)
-- =====================================================================
-- Wird vom Flyway-Container einmalig beim ersten Deploy ausgeführt.
-- Spätere Schema-Änderungen als V2__.., V3__.. etc. anlegen (niemals
-- diese Datei nachträglich ändern — Flyway checksummt den Inhalt).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Kategorien
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(255) NOT NULL,
  icon       VARCHAR(255) NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Rezepte (Haupttabelle)
--   is_favorite als TINYINT(1) → mysql2 liefert echtes Boolean.
--   created_at/updated_at als DATETIME → mysql2 liefert Date-Objekte,
--   die in db.ts zentral zu ISO-Strings serialisiert werden.
-- ---------------------------------------------------------------------
CREATE TABLE recipes (
  id              INT          NOT NULL AUTO_INCREMENT,
  title           VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  category_id     INT          NULL,
  base_servings   INT          NOT NULL DEFAULT 2,
  prep_time_min   INT          NULL,
  cook_time_min   INT          NULL,
  image_url       VARCHAR(512) NULL,
  source          VARCHAR(255) NULL,
  is_favorite     TINYINT(1)   NOT NULL DEFAULT 0,
  parent_recipe_id INT         NULL,
  version_name    VARCHAR(255) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recipes_category (category_id),
  KEY idx_recipes_parent (parent_recipe_id),
  CONSTRAINT fk_recipes_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_recipes_parent FOREIGN KEY (parent_recipe_id)
    REFERENCES recipes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Zubereitungsschritte
--   "order" ist in MariaDB reserviert → zwingend backticken.
-- ---------------------------------------------------------------------
CREATE TABLE steps (
  id           INT          NOT NULL AUTO_INCREMENT,
  recipe_id    INT          NOT NULL,
  `order`      INT          NOT NULL,
  instruction  TEXT         NOT NULL,
  duration_sec INT          NULL,
  PRIMARY KEY (id),
  KEY idx_steps_recipe (recipe_id),
  CONSTRAINT fk_steps_recipe FOREIGN KEY (recipe_id)
    REFERENCES recipes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Zutaten
--   quantity als DOUBLE, damit Portionen-Skalierung sauber rechnet.
-- ---------------------------------------------------------------------
CREATE TABLE ingredients (
  id         INT          NOT NULL AUTO_INCREMENT,
  recipe_id  INT          NOT NULL,
  step_id    INT          NULL,
  name       VARCHAR(255) NOT NULL,
  quantity   DOUBLE       NULL,
  unit       VARCHAR(64)  NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ingredients_recipe (recipe_id),
  KEY idx_ingredients_step (step_id),
  CONSTRAINT fk_ingredients_recipe FOREIGN KEY (recipe_id)
    REFERENCES recipes (id) ON DELETE CASCADE,
  CONSTRAINT fk_ingredients_step FOREIGN KEY (step_id)
    REFERENCES steps (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Benutzer (nur der Admin-Login)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT          NOT NULL AUTO_INCREMENT,
  username      VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sessions (Cookie-basiert, 7 Tage Ablauf via cleanupExpiredSessions)
--   id ist der zufällige Session-Token (64 Hex-Zeichen), keine
--   Autoincrement-Spalte → CHAR(64) als PRIMARY KEY.
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id         CHAR(64)  NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Trigger: updated_at bei jedem UPDATE auf recipes automatisch setzen.
--   Entspricht dem früheren SQLite-Trigger, nun mit MariaDB-Syntax.
--   BEFORE UPDATE (statt AFTER UPDATE) vermeidet Rekursion: der
--   Trigger schreibt direkt den neuen Wert, ohne ein weiteres UPDATE
--   auf dieselbe Zeile auszulösen.
-- ---------------------------------------------------------------------
DELIMITER //
CREATE TRIGGER recipes_updated_at
BEFORE UPDATE ON recipes
FOR EACH ROW
BEGIN
  SET NEW.updated_at = NOW();
END//
DELIMITER ;
