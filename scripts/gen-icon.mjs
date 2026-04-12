import sharp from 'sharp';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>

  <!-- Suspension cables -->
  <path d="M 80 320 Q 180 180 256 220 Q 332 180 432 320" stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round"/>

  <!-- Left tower -->
  <rect x="148" y="170" width="22" height="200" fill="#ffffff" rx="3"/>
  <rect x="138" y="160" width="42" height="14" fill="#ffffff" rx="3"/>

  <!-- Right tower -->
  <rect x="342" y="170" width="22" height="200" fill="#ffffff" rx="3"/>
  <rect x="332" y="160" width="42" height="14" fill="#ffffff" rx="3"/>

  <!-- Vertical hangers -->
  <line x1="120" y1="304" x2="120" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="200" y1="232" x2="200" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="228" y1="222" x2="228" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="256" y1="218" x2="256" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="284" y1="222" x2="284" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="312" y1="232" x2="312" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="392" y1="304" x2="392" y2="335" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>

  <!-- Roadway / deck -->
  <rect x="56" y="335" width="400" height="14" fill="#ffffff" rx="2"/>

  <!-- Pylons under deck -->
  <rect x="60" y="349" width="14" height="36" fill="#ffffff"/>
  <rect x="438" y="349" width="14" height="36" fill="#ffffff"/>
</svg>`;

await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(root, 'public/icons/icon-512.png'));
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(root, 'public/icons/icon-192.png'));
writeFileSync(path.join(root, 'public/icons/icon.svg'), svg);

console.log('Icons generated');
