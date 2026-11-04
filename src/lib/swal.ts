// Zentrales SweetAlert2-Theming — ein Ort, damit Dialoge überall der
// Design-Language der App folgen (Dark-Surfaces, Akzent-Buttons).
// Feuer bitte jeden Swal über `swalFire({...})`; Seiten-spezifische
// Optionen (Text, Buttons, danger-Farbe) überschreiben die Defaults.
import Swal from 'sweetalert2';
import type { SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

const theme: SweetAlertOptions = {
  background: 'var(--surface)',
  color: 'var(--text)',
  confirmButtonColor: 'var(--accent)',
  cancelButtonColor: 'var(--surface-3)',
  customClass: { popup: 'koch-swal' }
};

/** Swal.fire mit App-Design (siehe auch .swal2-Regeln in app.css). */
export function swalFire(options: SweetAlertOptions): Promise<SweetAlertResult> {
  // Cast: SweetAlert2s Overloads verlieren die input-spezifischen
  // Validator-Typen beim Mergen mit den Defaults — zur Laufzeit egal.
  return Swal.fire({ ...theme, ...options } as SweetAlertOptions);
}
