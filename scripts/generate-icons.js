import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

const publicDir = path.join(process.cwd(), 'public');

async function generateIcons() {
  const sizes = [192, 512];
  
  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#15110d';
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#ff7a3d';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#1a0e06';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍲', size / 2, size / 2 + size * 0.05);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), buffer);
    console.log(`Generated icon-${size}.png`);
  }
  
  const faviconCanvas = createCanvas(32, 32);
  const faviconCtx = faviconCanvas.getContext('2d');
  
  faviconCtx.fillStyle = '#15110d';
  faviconCtx.fillRect(0, 0, 32, 32);
  
  faviconCtx.fillStyle = '#ff7a3d';
  faviconCtx.beginPath();
  faviconCtx.arc(16, 16, 12, 0, Math.PI * 2);
  faviconCtx.fill();
  
  faviconCtx.fillStyle = '#1a0e06';
  faviconCtx.font = 'bold 14px Arial';
  faviconCtx.textAlign = 'center';
  faviconCtx.textBaseline = 'middle';
  faviconCtx.fillText('🍲', 16, 18);
  
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