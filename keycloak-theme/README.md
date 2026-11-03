# Koch-App — Keycloak Login-Theme „koch"

Login-Theme für **Keycloak 26.x** (erstellt gegen 26.7.0), passend zum
Dark-Theme der Koch-App (Paprika/Amber-Akzent, Palette aus `src/app.css`).
Reines **CSS-Overlay** auf dem Default-Theme `keycloak.v2` — keine
`.ftl`-Template-Overrides → möglichst unempfindlich gegen Keycloak-Updates.

```
keycloak-theme/
└── koch/                        ← das ist DER Theme-Ordner (Name = „koch")
    └── login/
        ├── theme.properties     ← Parent, Import, Styles-Reihenfolge
        └── resources/
            ├── css/koch.css     ← das komplette Styling
            └── img/
                ├── logo.svg     ← Topf-Logo auf der Login-Seite
                └── favicon.ico  ← Browser-Tab-Icon (Kopie aus static/)
```

## Installation auf dem Keycloak-Server

**Variante A — Ordner kopieren** (Container-Image unverändert):

```bash
# Host-Ordner in den laufenden Container kopieren:
docker cp koch <keycloak-container>:/opt/keycloak/themes/koch
docker restart <keycloak-container>
```

**Variante B — Mount in der Keycloak-Compose** (überlebt Recreate):

```yaml
services:
  keycloak:
    volumes:
      - ./koch:/opt/keycloak/themes/koch:ro
```

Dann: `docker compose up -d` (Container neu erstellen lassen).

## Aktivieren

1. Keycloak Admin Console → Realm (`master`) → **Realm Settings → Themes**
   → **Login Theme** → `koch` → Save
2. Login-Seite testen: `https://auth.lkit.ch/realms/master/protocol/openid-connect/auth?client_id=koch-app&response_type=code&redirect_uri=https://recipes.lkit.ch/auth/callback&scope=openid`
   (oder einfach App-Logout/Login)

### Nur für die Koch-App, nicht für die Admin-Console?

Der Login-Theme gilt realm-weit — auch für die Admin-Console-Anmeldung.
Wenn das nicht gewünscht ist: Realm-Theme auf Default lassen und stattdessen
**pro Client** überschreiben: Clients → `koch-app` → Settings → „Login theme"
= `koch` (Feld je nach Version unter „Advanced"/„Login settings").

## Empfohlene Realm-Einstellungen (passend zum Branding)

- **Realm Settings → General → Display name**: `Koch-App`
  (erscheint als Titel über der Login-Karte; unser Logo sitzt darüber)
- **Realm Settings → Localization → Internationalization: ON**, Default
  Locale `German` → Login-Texte („Anmelden", „Passwort vergessen?", …) sind
  automatisch deutsch, inkl. der „Passwort ändern"-Seite nach temporären
  Passwörtern aus der App-Verwaltung

## Anpassen

- **Farben/Radien**: oben in `resources/css/koch.css` unter
  `--kc-*` ändern (gespiegelt zu `src/app.css` der App — bei Änderungen
  dort am besten beide Dateien synchron halten)
- **Logo**: `resources/img/logo.svg` durch ein eigenes SVG ersetzen
  (transparenter Hintergrund, quadratisch). Das violettblaue
  `static/favicon.svg` der App ist ein Generator-Default und passt nicht
  zur Palette — deshalb liegt ein einfacher Topf bei.

## Beim Entwickeln/Iterieren

Keycloak cached Themes. Für schnelle Zyklen ohne Neustart den Server mit
starten:

```bash
/opt/keycloak/bin/kc.sh start \
  --spi-theme-cache-themes=false \
  --spi-theme-cache-templates=false \
  --spi-theme-static-max-age=-1
```

In Produktion Caching **an** lassen (Performance).

## Hinweise

- Das Theme erzwingt **immer** Dark-Mode, unabhängig von der OS-Einstellung
  (`prefers-color-scheme`): Keycloak setzt bei OS-Dunkel die Klasse
  `pf-v5-theme-dark` auf `<html>` — `koch.css` definiert die Palette für
  beide Zustände identisch.
- `styles=css/styles.css css/koch.css` in `theme.properties` ist Absicht:
  Die `styles`-Property **ersetzt** die Parent-Liste, deshalb muss das
  Parent-Stylesheet explizit mitgeladen werden (Auflösung über die
  Theme-Hierarchie), unser CSS kommt als letztes.
- Keine `messages_*.properties` nötig: Deutsche Texte kommen über die
  Realm-Internationalization (s. o.), nicht über das Theme.
