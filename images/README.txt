Metti qui le tue immagini (.jpg .jpeg .png .webp .gif .avif).

Alla build (`npm run build` in locale, oppure automaticamente su Vercel)
lo script `build.js` legge questa cartella e genera `images.json`,
che viene poi caricato dall'app per popolare l'universo 3D.

Suggerimenti:
  - sotto i 500 KB per file (la pagina ne carica anche 100+)
  - lati massimi ~1500px
  - pre-comprime in WebP per velocità

Questo file README e .gitkeep vengono ignorati dal builder.
