import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

// Generiert die PWA-Icons (icon-192/512.png, favicon.ico).
//
// Motiv: das Topf-Icon („pot") aus src/lib/icons.ts — dasselbe wie in der
// Sidebar als Markenzeichen. Die SVG-Pfade werden hier mit Canvas-Primitiven
// nachgezeichnet (node-canvas kann keine SVG-Path-Strings):
//   M5 10h14                                  → oberer Rand
//   M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8  → Körper mit runden Ecken
//   M3 10h2 / M19 10h2                        → Henkel
//   M9 7c0-1 1-1 1-2s-1-1-1-2                 → Dampf links
//   M14 7c0-1 1-1 1-2s-1-1-1-2                → Dampf rechts
// Farben: App-Palette aus src/app.css (--bg, --accent).

const BG = '#15110d'; // var(--bg)
const ACCENT = '#ff7a3d'; // var(--accent)

// SvelteKit: statische Dateien liegen in static/ (nicht public/).
const publicDir = path.join(process.cwd(), 'static');

/** Zeichnet das pot-Icon im 24er-Koordinatensystem (stroke, currentColor). */
function drawPot(ctx) {
  ctx.beginPath();
  // oberer Rand
  ctx.moveTo(5, 10);
  ctx.lineTo(19, 10);
  // Körper: links runter, runde Ecke, Boden, runde Ecke, rechts hoch
  ctx.moveTo(5, 10);
  ctx.lineTo(5, 18);
  ctx.arc(7, 18, 2, Math.PI, Math.PI / 2, true); // (5,18) → (7,20)
  ctx.lineTo(17, 20);
  ctx.arc(17, 18, 2, Math.PI / 2, 0, true); // (17,20) → (19,18)
  ctx.lineTo(19, 10);
  // Henkel
  ctx.moveTo(3, 10);
  ctx.lineTo(5, 10);
  ctx.moveTo(19, 10);
  ctx.lineTo(21, 10);
  // Dampf links
  ctx.moveTo(9, 7);
  ctx.bezierCurveTo(9, 6, 10, 6, 10, 5);
  ctx.bezierCurveTo(10, 4, 9, 4, 9, 3);
  // Dampf rechts
  ctx.moveTo(14, 7);
  ctx.bezierCurveTo(14, 6, 15, 6, 15, 5);
  ctx.bezierCurveTo(15, 4, 14, 4, 14, 3);
  ctx.stroke();
}

/**
 * Rendert das Icon auf eine size×size-Fläche.
 * Motiv-Bounding im 24er-Grid: x 3–21 (Breite 18), y 3–20 → Zentrum (12, 11.5).
 * Motivbreite ≈ widthFactor × size (maskable-Safe-Zone: ≤ 0.64 empfohlen).
 */
function renderPotIcon(ctx, size, { widthFactor = 0.6, lineWidth = 2.2 } = {}) {
  // Vollflächiger Hintergrund (nötig für purpose "any maskable")
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale((size * widthFactor) / 18, (size * widthFactor) / 18);
  ctx.translate(-12, -11.5);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawPot(ctx);
  ctx.restore();
}

async function generateIcons() {
  // PWA-Icons (manifest: purpose "any maskable")
  for (const size of [192, 512]) {
    const canvas = createCanvas(size, size);
    renderPotIcon(canvas.getContext('2d'), size);
    fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), canvas.toBuffer('image/png'));
    console.log(`Generated icon-${size}.png`);
  }

  // Favicon 32×32 — etwas breitere Linien für Sichtbarkeit in klein.
  const faviconCanvas = createCanvas(32, 32);
  renderPotIcon(faviconCanvas.getContext('2d'), 32, { widthFactor: 0.66, lineWidth: 3 });

  const faviconBuffer = faviconCanvas.toBuffer('image/png');

  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0);
  icoHeader.writeUInt16LE(1, 2);
  icoHeader.writeUInt16LE(1, 4);
  icoHeader.writeUInt8(32, 6);
  icoHeader.writeUInt8(32, 7);
  icoHeader.writeUInt8(0, 8);
  icoHeader.writeUInt8(0, 9);
  icoHeader.writeUInt16LE(1, 10);
  icoHeader.writeUInt16LE(32, 12);
  icoHeader.writeUInt32LE(faviconBuffer.length, 14);
  icoHeader.writeUInt32LE(22, 18);

  const icoBuffer = Buffer.concat([icoHeader, faviconBuffer]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Generated favicon.ico');

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
