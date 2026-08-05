import type { Handle } from '@sveltejs/kit';

// === Server-Hook ===
//
// Die App besitzt kein eigenes Login mehr. Der Zugriffsschutz liegt
// vollständig auf Infrastrukturebene (Reverse Proxy / VPN / internes
// Netz) — siehe README. Deshalb gibt es hier keinen Auth- oder Seed-
// Hook mehr; dieser Handle reicht die Anfrage einfach durch.
export const handle: Handle = ({ event, resolve }) => resolve(event);
