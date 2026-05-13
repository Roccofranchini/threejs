// Ottimizza le immagini in `images/` (WebP, max 1500 px di lato) e
// genera `images.json` con la lista finale.
//
//   - Locale:  `npm install && npm run build`
//   - Vercel:  esegue lo stesso comando come buildCommand
//
// Idempotente: i file già WebP entro i limiti vengono lasciati intatti.
// Gli altri vengono convertiti, il file originale viene rimosso.
// L'output sostituisce in-place i file dentro `images/`, quindi commitando
// la cartella si committano direttamente le versioni compresse.

import {
  readdirSync, writeFileSync, existsSync,
  renameSync, unlinkSync,
} from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import sharp from 'sharp';

const ROOT       = resolve(process.cwd());
const IMAGES_DIR = join(ROOT, 'images');
const OUT_FILE   = join(ROOT, 'images.json');

const MAX_SIDE = 1500;
const QUALITY  = 78;

const ACCEPTED = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif',
  '.tif', '.tiff', '.heic', '.heif', '.bmp',
]);

function listSourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => ACCEPTED.has(extname(name).toLowerCase()))
    .sort();
}

async function optimize(srcName) {
  const srcPath  = join(IMAGES_DIR, srcName);
  const baseName = basename(srcName, extname(srcName));
  const dstPath  = join(IMAGES_DIR, `${baseName}.webp`);
  const tmpPath  = `${dstPath}.tmp`;

  const meta = await sharp(srcPath).metadata();
  const isWebp     = meta.format === 'webp';
  const withinSize =
    (meta.width  || 0) <= MAX_SIDE &&
    (meta.height || 0) <= MAX_SIDE;

  if (isWebp && withinSize) {
    return { name: basename(dstPath), action: 'skip' };
  }

  try {
    await sharp(srcPath)
      .rotate() // applica l'orientamento EXIF
      .resize({
        width: MAX_SIDE,
        height: MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY, effort: 4 })
      .toFile(tmpPath);

    renameSync(tmpPath, dstPath);
    if (srcPath !== dstPath) unlinkSync(srcPath);
  } catch (err) {
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath); } catch {}
    }
    throw err;
  }

  return { name: basename(dstPath), action: isWebp ? 'resize' : 'convert' };
}

async function main() {
  const sources = listSourceFiles(IMAGES_DIR);

  if (sources.length === 0) {
    writeFileSync(OUT_FILE, '[]\n');
    console.log('[build] cartella images/ vuota — manifest creato vuoto.');
    return;
  }

  const finalNames = [];
  for (const name of sources) {
    try {
      const r = await optimize(name);
      finalNames.push(r.name);
      const tag =
        r.action === 'skip'    ? 'skip   ' :
        r.action === 'convert' ? 'convert' :
                                 'resize ';
      console.log(`[build] ${tag}  ${name}${r.name !== name ? ` → ${r.name}` : ''}`);
    } catch (err) {
      console.error(`[build] errore su ${name}: ${err.message}`);
    }
  }

  // Riscanno la cartella: dopo le conversioni potrebbe esserci stato un cambio
  // di nomi (foo.jpg → foo.webp) e voglio il manifest reale dello stato a disco.
  const finalList = listSourceFiles(IMAGES_DIR)
    .filter((name) => extname(name).toLowerCase() === '.webp')
    .map((name) => `images/${name}`);

  writeFileSync(OUT_FILE, JSON.stringify(finalList, null, 2) + '\n');
  console.log(`[build] manifest: ${finalList.length} immagini → images.json`);
}

main().catch((err) => {
  console.error('[build] fallito:', err);
  process.exit(1);
});
