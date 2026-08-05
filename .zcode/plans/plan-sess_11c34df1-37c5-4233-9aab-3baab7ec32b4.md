## Problem & Lösung

### Problem: Timer-Zeit wird beim Schrittwechsel übernommen
Die `StepTimer`-Komponente initialisiert `remaining` nur einmal per `untrack(() => durationSec)`. Svelte 5 behält den `$state`-Wert jedoch bei, wenn sich der Prop ändert – der Timer läuft also mit der alten Restzeit auf dem neuen Schritt weiter.

**Fix in `StepTimer.svelte`:** Einen `$effect` hinzufügen, der `remaining` auf den neuen `durationSec` zurücksetzt und den laufenden Timer stoppt, sobald sich `durationSec` ändert (also beim Schrittwechsel).

### Neu: ±1 Min / ±5 Min Buttons
In der `StepTimer.svelte`-Komponente vier kleine Buttons hinzufügen (+1 Min, +5 Min, -1 Min, -5 Min), die `remaining` um die entsprechenden Sekunden anpassen. Diese werden immer angezeigt, wenn der Timer nicht im "fertig"-Zustand ist.

### Änderungen nur in **einer Datei**:
**`src/lib/components/StepTimer.svelte`**

1. **`$effect` für Prop-Reset** (nach den `$state`-Deklarationen):
   - Reagiert auf `durationSec`
   - Stoppt laufenden Timer (`stopInterval()`, `running = false`)
   - Setzt `remaining = durationSec` und `finished = false`

2. **Neue Funktion `adjustTime(delta: number)`**:
   - Erhöht/verringert `remaining` um `delta` Sekunden
   - Verhindert negative Werte (Minimum 0)

3. **Neue Buttons im Template** (neben dem Start/Pause-Button in `.actions`):
   - Vier kleine Buttons: +1 Min, +5 Min, -1 Min, -5 Min
   - Compact-Style (nur Icon + Kurztext, z.B. "+1"), passend zum bestehenden Design
   - Nicht sichtbar wenn `finished === true` (im "fertig"-Zustand gibt es nur Reset)

4. **Neuer CSS-Style `.adj`** für die kleinen Anpassungs-Buttons:
   - Klein, dezentes Aussehen, passend zum Timer-Design
   - -1 Min Button deaktiviert/optisch ausgegraut wenn `remaining <= 59`
