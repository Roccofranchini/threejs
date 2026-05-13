Cartella per le immagini dell'universo 3D.

Estensioni accettate:
  .jpg .jpeg .png .webp .gif .avif .tif .tiff .heic .heif .bmp

Workflow:
  1. Trascina qui dentro le foto, in qualsiasi formato e dimensione.
  2. Esegui `npm run build` (la prima volta serve `npm install`).
  3. Lo script `build.js`:
       - converte ogni file in WebP (max 1500 px di lato, qualità 78)
       - cancella l'originale e lascia solo il `.webp`
       - genera `images.json` con la lista
  4. `git add images/` poi commit e push.

Su Vercel `npm run build` parte automaticamente al push, ma se i file
sono già stati ottimizzati in locale lo script li salta in fretta.

Questo file e .gitkeep vengono ignorati dallo scanner.
