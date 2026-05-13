// Genera `images.json` leggendo la cartella `images/`.
// Chiamato da `npm run build` (locale) e da Vercel come buildCommand.

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT       = resolve(process.cwd());
const IMAGES_DIR = join(ROOT, 'images');
const OUT_FILE   = join(ROOT, 'images.json');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

function listImages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => {
      const dot = name.lastIndexOf('.');
      if (dot < 0) return false;
      return ALLOWED_EXT.has(name.slice(dot).toLowerCase());
    })
    .sort();
}

const images = listImages(IMAGES_DIR).map((name) => `images/${name}`);
writeFileSync(OUT_FILE, JSON.stringify(images, null, 2) + '\n');

console.log(`[build] ${images.length} immagini → images.json`);
if (images.length === 0) {
  console.log(`[build] cartella ${IMAGES_DIR} vuota — l'universo sarà vuoto.`);
}
