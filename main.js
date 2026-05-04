import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

// =============================================================================
// ITALSIDER · BAGNOLI — Ricostruzione interattiva
// Tutto è modellato con primitive geometriche di Three.js + materiali PBR.
// =============================================================================

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(28, 1.7, -45);
camera.lookAt(-15, 14, 70);

const FOG_COLOR = new THREE.Color(0xb8a890);
scene.fog = new THREE.Fog(FOG_COLOR, 60, 1100);
scene.background = FOG_COLOR;

// =============================================================================
// SKY — Cielo italiano polveroso, luce di tardo pomeriggio sui Campi Flegrei
// =============================================================================
const sky = new Sky();
sky.scale.setScalar(2500);
scene.add(sky);

const sun = new THREE.Vector3();
const skyU = sky.material.uniforms;
skyU.turbidity.value = 8.5;
skyU.rayleigh.value = 2.4;
skyU.mieCoefficient.value = 0.012;
skyU.mieDirectionalG.value = 0.85;
const phi = THREE.MathUtils.degToRad(90 - 12); // sole basso
const theta = THREE.MathUtils.degToRad(-65);
sun.setFromSphericalCoords(1, phi, theta);
skyU.sunPosition.value.copy(sun);

// =============================================================================
// LUCI
// =============================================================================
const hemi = new THREE.HemisphereLight(0xd9c8a0, 0x3a2a1c, 0.55);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xffd0a0, 1.45);
sunLight.position.set(-220, 180, -340);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -250;
sunLight.shadow.camera.right = 250;
sunLight.shadow.camera.top = 250;
sunLight.shadow.camera.bottom = -250;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 800;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.04;
scene.add(sunLight);

// luce d'ambiente calda riflessa dalla polvere
const fillLight = new THREE.DirectionalLight(0x6a5a78, 0.35);
fillLight.position.set(150, 100, 200);
scene.add(fillLight);

// =============================================================================
// MATERIALI riutilizzabili
// =============================================================================
function noiseTexture(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b, a] = fn(x, y, size);
      img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rng(x, y, seed) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x, y, freq) {
  const xi = Math.floor(x * freq), yi = Math.floor(y * freq);
  const xf = x * freq - xi, yf = y * freq - yi;
  const a = rng(xi, yi, 1), b = rng(xi+1, yi, 1);
  const c = rng(xi, yi+1, 1), d = rng(xi+1, yi+1, 1);
  const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,u), THREE.MathUtils.lerp(c,d,u), v);
}

function fbm(x, y) {
  let v = 0, amp = 1, freq = 1, n = 0;
  for (let i = 0; i < 4; i++) { v += valueNoise(x, y, freq) * amp; n += amp; amp *= 0.5; freq *= 2; }
  return v / n;
}

// Texture di ruggine procedurale
const rustTex = noiseTexture(256, (x, y, s) => {
  const u = x / s, v = y / s;
  const n = fbm(u * 4, v * 4);
  const n2 = fbm(u * 16 + 5, v * 16 + 5);
  const r = Math.floor(80 + 90 * n + 20 * n2);
  const g = Math.floor(45 + 55 * n + 12 * n2);
  const b = Math.floor(25 + 30 * n + 6 * n2);
  return [r, g, b, 255];
});
rustTex.repeat.set(2, 2);

// Cemento sporco
const concreteTex = noiseTexture(256, (x, y, s) => {
  const u = x / s, v = y / s;
  const n = fbm(u * 6, v * 6);
  const stains = fbm(u * 2 + 3, v * 2 + 3);
  const dark = stains < 0.4 ? 0.7 : 1.0;
  const base = (110 + 50 * n) * dark;
  return [base | 0, (base * 0.97) | 0, (base * 0.93) | 0, 255];
});
concreteTex.repeat.set(3, 3);

// Vernice scrostata (rosso-arancio Italsider)
const paintTex = noiseTexture(256, (x, y, s) => {
  const u = x / s, v = y / s;
  const n = fbm(u * 5, v * 5);
  const flake = fbm(u * 24 + 7, v * 24 + 7);
  if (flake > 0.62) {
    return [80 + 40 * n | 0, 45 + 20 * n | 0, 25 | 0, 255]; // ruggine sotto
  }
  const r = 150 + 60 * n;
  const g = 65 + 30 * n;
  const b = 35 + 15 * n;
  return [r | 0, g | 0, b | 0, 255];
});
paintTex.repeat.set(2, 2);

// Terreno polveroso
const groundTex = noiseTexture(512, (x, y, s) => {
  const u = x / s, v = y / s;
  const n = fbm(u * 4, v * 4);
  const cracks = fbm(u * 12 + 1, v * 12 + 1);
  const grass = fbm(u * 3 + 9, v * 3 + 9);
  let r = 120 + 50 * n, g = 100 + 40 * n, b = 75 + 25 * n;
  if (grass > 0.62) { r *= 0.6; g *= 0.95; b *= 0.55; } // chiazze d'erba
  if (cracks > 0.78) { r *= 0.65; g *= 0.65; b *= 0.65; }
  return [r | 0, g | 0, b | 0, 255];
});
groundTex.repeat.set(40, 40);

// Mattoni
const brickTex = noiseTexture(256, (x, y, s) => {
  const row = Math.floor(y / 16);
  const offset = (row % 2) * 16;
  const xb = (x + offset) % 32;
  const yb = y % 16;
  const mortar = xb < 2 || xb > 30 || yb < 2 || yb > 14;
  const u = x / s, v = y / s;
  const n = fbm(u * 8, v * 8);
  if (mortar) {
    const m = 90 + 25 * n;
    return [m | 0, (m * 0.95) | 0, (m * 0.9) | 0, 255];
  }
  const r = 130 + 40 * n;
  const g = 65 + 20 * n;
  const b = 50 + 15 * n;
  return [r | 0, g | 0, b | 0, 255];
});
brickTex.repeat.set(4, 4);

// Materiali condivisi
const M = {
  concrete: new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xcfc0a8, roughness: 0.95, metalness: 0.05 }),
  concreteDark: new THREE.MeshStandardMaterial({ map: concreteTex, color: 0x8a7e6a, roughness: 0.98, metalness: 0.02 }),
  rust: new THREE.MeshStandardMaterial({ map: rustTex, color: 0xb87049, roughness: 0.85, metalness: 0.55 }),
  rustDark: new THREE.MeshStandardMaterial({ map: rustTex, color: 0x6e3a1f, roughness: 0.9, metalness: 0.4 }),
  paint: new THREE.MeshStandardMaterial({ map: paintTex, color: 0xc05030, roughness: 0.75, metalness: 0.35 }),
  brick: new THREE.MeshStandardMaterial({ map: brickTex, color: 0xa05438, roughness: 0.95, metalness: 0.0 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.55, metalness: 0.85 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.7, metalness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1a2630, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.55 }),
  glassBroken: new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.9, metalness: 0.3 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x6b6058, roughness: 0.7, metalness: 0.6 }),
  metalCorr: new THREE.MeshStandardMaterial({ map: rustTex, color: 0x80675a, roughness: 0.7, metalness: 0.5 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x2a2722, roughness: 0.95, metalness: 0.0 }),
  vegetation: new THREE.MeshStandardMaterial({ color: 0x556b3a, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide }),
};

// =============================================================================
// MARE — piano con onde animate via vertex shader
// =============================================================================
const seaGeom = new THREE.PlaneGeometry(2200, 1400, 80, 50);
const seaMat = new THREE.MeshStandardMaterial({
  color: 0x2c4858, roughness: 0.18, metalness: 0.6, transparent: true, opacity: 0.92,
});
seaMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  seaMat.userData.shader = shader;
  shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    `vec3 transformed = vec3(position);
     float w1 = sin(position.x * 0.05 + uTime * 0.7) * 0.3;
     float w2 = cos(position.y * 0.07 + uTime * 0.5) * 0.25;
     float w3 = sin((position.x + position.y) * 0.09 + uTime * 1.1) * 0.15;
     transformed.z += w1 + w2 + w3;`
  );
};
const sea = new THREE.Mesh(seaGeom, seaMat);
sea.rotation.x = -Math.PI / 2;
sea.position.set(0, -0.4, -540);
sea.receiveShadow = true;
scene.add(sea);

// schiuma alla riva
const foamGeom = new THREE.PlaneGeometry(900, 6, 60, 1);
const foamMat = new THREE.MeshBasicMaterial({ color: 0xe8e0d0, transparent: true, opacity: 0.55 });
const foam = new THREE.Mesh(foamGeom, foamMat);
foam.rotation.x = -Math.PI / 2;
foam.position.set(0, 0.05, 155);
scene.add(foam);

// =============================================================================
// TERRENO
// =============================================================================
const groundGeom = new THREE.PlaneGeometry(1600, 1200, 120, 90);
{
  const pos = groundGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const dist = Math.sqrt(x*x + y*y);
    const n = fbm(x * 0.012 + 100, y * 0.012 + 100);
    let h = (n - 0.5) * 1.6;
    // Colline sul lato sud (Posillipo)
    if (y < -200) {
      const k = THREE.MathUtils.smoothstep(-200, -550, y);
      h += k * (40 + n * 40);
    }
    // Spianamento area fabbrica
    const inFactory = Math.abs(x) < 250 && y > -180 && y < 100;
    if (inFactory) h *= 0.18;
    pos.setZ(i, h);
  }
  pos.needsUpdate = true;
  groundGeom.computeVertexNormals();
}
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: 0xa8957a, roughness: 0.98, metalness: 0.02 });
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
// Ruoto la mesh: la geometria ha y=Z (asse profondità), correggo
ground.geometry.rotateX(0); // lasciamo così, è già su -PI/2
scene.add(ground);
// Notare: dopo rotation.x = -PI/2, il vecchio asse Y diventa -Z scena
// quindi y < -200 nella geometria == z > 200 nella scena → colline a sud (lontane dal mare)

// Asfalto piazzale fabbrica
const yardGeom = new THREE.PlaneGeometry(420, 280);
const yard = new THREE.Mesh(yardGeom, M.asphalt);
yard.rotation.x = -Math.PI / 2;
yard.position.set(0, 0.02, 60);
yard.receiveShadow = true;
scene.add(yard);

// =============================================================================
// HELPERS GEOMETRICI
// =============================================================================
function makeBox(w, h, d, mat, x=0, y=0, z=0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function makeCyl(rt, rb, h, seg, mat, x=0, y=0, z=0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function makeBeam(length, w, mat, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geom = new THREE.BoxGeometry(w, w, len);
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.lookAt(to);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Capriata reticolare (truss) - rettangolo con incroci
function makeTruss(length, height, mat) {
  const g = new THREE.Group();
  const bar = 0.18;
  // tubi superiori e inferiori
  const top = new THREE.Mesh(new THREE.BoxGeometry(length, bar, bar), mat);
  top.position.y = height/2;
  const bot = new THREE.Mesh(new THREE.BoxGeometry(length, bar, bar), mat);
  bot.position.y = -height/2;
  g.add(top, bot);
  const n = Math.max(2, Math.floor(length / (height * 1.1)));
  for (let i = 0; i <= n; i++) {
    const x = -length/2 + (length / n) * i;
    const v = new THREE.Mesh(new THREE.BoxGeometry(bar, height, bar), mat);
    v.position.set(x, 0, 0);
    g.add(v);
    if (i < n) {
      // diagonale
      const dx = length / n;
      const dlen = Math.sqrt(dx*dx + height*height);
      const d = new THREE.Mesh(new THREE.BoxGeometry(bar, dlen, bar), mat);
      d.position.set(x + dx/2, 0, 0);
      d.rotation.z = Math.atan2(dx, height) * (i % 2 === 0 ? 1 : -1);
      g.add(d);
    }
  }
  g.children.forEach(c => { c.castShadow = c.receiveShadow = true; });
  return g;
}

// =============================================================================
// COSTRUZIONI - INDUSTRIAL HALL (Capannone)
// =============================================================================
function buildHall(w, h, d, opts={}) {
  const g = new THREE.Group();
  const wallMat = opts.wallMat || M.brick;
  const roofMat = opts.roofMat || M.metalCorr;

  // Pareti (4)
  const wallTh = 0.4;
  const wallN = makeBox(w, h, wallTh, wallMat, 0, h/2, -d/2);
  const wallS = makeBox(w, h, wallTh, wallMat, 0, h/2,  d/2);
  const wallE = makeBox(wallTh, h, d, wallMat,  w/2, h/2, 0);
  const wallW = makeBox(wallTh, h, d, wallMat, -w/2, h/2, 0);
  g.add(wallN, wallS, wallE, wallW);

  // Tetto a falda doppia
  const roofH = h * 0.18;
  const roofGeom = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -w/2, h, -d/2,   w/2, h, -d/2,   0, h+roofH, -d/2,
    -w/2, h,  d/2,   w/2, h,  d/2,   0, h+roofH,  d/2,
  ]);
  roofGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  roofGeom.setIndex([0,1,2, 3,5,4, 0,2,5, 0,5,3, 1,4,5, 1,5,2]);
  roofGeom.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);

  // Finestre (file di vetri rotti)
  if (opts.windows !== false) {
    const winRows = opts.winRows || 1;
    const winCols = Math.max(4, Math.floor(w / 4));
    const winW = w / (winCols * 1.4);
    const winH = Math.min(2.4, h * 0.22);
    for (let r = 0; r < winRows; r++) {
      const yy = h * (0.5 + r * 0.32);
      for (let c = 0; c < winCols; c++) {
        const xx = -w/2 + (w / (winCols)) * (c + 0.5);
        const broken = Math.random() > 0.55;
        const winMat = broken ? M.glassBroken : M.glass;
        const fN = makeBox(winW, winH, 0.05, winMat, xx, yy, -d/2 - 0.22);
        const fS = makeBox(winW, winH, 0.05, winMat, xx, yy,  d/2 + 0.22);
        g.add(fN, fS);
      }
    }
    // finestre laterali
    const sideRows = Math.max(6, Math.floor(d / 5));
    for (let c = 0; c < sideRows; c++) {
      const zz = -d/2 + (d / sideRows) * (c + 0.5);
      const yy = h * 0.6;
      const broken = Math.random() > 0.5;
      const winMat = broken ? M.glassBroken : M.glass;
      const fE = makeBox(0.05, winH, winW, winMat,  w/2 + 0.22, yy, zz);
      const fW = makeBox(0.05, winH, winW, winMat, -w/2 - 0.22, yy, zz);
      g.add(fE, fW);
    }
  }

  // Portoni (su parete sud)
  if (opts.doors !== false) {
    const doorH = Math.min(h * 0.55, 7);
    const doorW = Math.min(w * 0.18, 6);
    const door = makeBox(doorW, doorH, 0.15, M.rustDark, 0, doorH/2, d/2 + 0.3);
    g.add(door);
  }

  // Lucernai (skylights)
  for (let i = 0; i < Math.floor(d / 8); i++) {
    const z = -d/2 + (d / Math.floor(d/8)) * (i + 0.5);
    const sky1 = makeBox(w * 0.6, 0.1, 1.5, M.glassBroken, 0, h + roofH * 0.55, z);
    g.add(sky1);
  }
  return g;
}

// =============================================================================
// CIMINIERA (Chimney)
// =============================================================================
function buildChimney(height, baseR, opts={}) {
  const g = new THREE.Group();
  const topR = baseR * 0.55;
  // basamento in cemento
  const base = makeCyl(baseR * 1.4, baseR * 1.6, height * 0.05, 16, M.concreteDark, 0, height * 0.025, 0);
  g.add(base);
  // fusto in mattoni
  const shaft = makeCyl(topR, baseR, height * 0.95, 24, opts.brick !== false ? M.brick : M.concrete, 0, height * 0.05 + height * 0.475, 0);
  g.add(shaft);
  // Bande nere decorative
  for (let i = 0; i < 3; i++) {
    const y = height * 0.2 + i * height * 0.25;
    const r = THREE.MathUtils.lerp(baseR, topR, (y - height*0.05) / (height*0.95)) * 1.04;
    const band = makeCyl(r, r, height * 0.025, 24, M.steelDark, 0, y, 0);
    g.add(band);
  }
  // colletto sommitale
  const collar = makeCyl(topR * 1.25, topR * 1.1, height * 0.04, 24, M.steelDark, 0, height * 1.0, 0);
  g.add(collar);
  // scaletta esterna
  const ladderH = height * 0.85;
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.3, ladderH, 0.08), M.rustDark);
  ladder.position.set(baseR * 0.95, height * 0.5, 0);
  ladder.castShadow = true;
  g.add(ladder);
  return g;
}

// =============================================================================
// TORRE DI RAFFREDDAMENTO (iperboloidica)
// =============================================================================
function buildCoolingTower(height, baseR) {
  const g = new THREE.Group();
  const segs = 24;
  const rings = 16;
  const geom = new THREE.BufferGeometry();
  const verts = [];
  const idx = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = t * height;
    // forma iperbolica: minimo a 0.55t, larga in basso, leggermente svasata in alto
    const k = Math.cosh((t - 0.55) * 2.2) / Math.cosh(0.55 * 2.2);
    const radius = baseR * (0.55 + 0.45 * k);
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      verts.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const i = r * (segs + 1) + s;
      idx.push(i, i + segs + 1, i + 1);
      idx.push(i + 1, i + segs + 1, i + segs + 2);
    }
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  const mat = M.concreteDark.clone();
  mat.side = THREE.DoubleSide;
  const tower = new THREE.Mesh(geom, mat);
  tower.castShadow = tower.receiveShadow = true;
  g.add(tower);
  // Base (pilastri inclinati)
  const numLegs = 18;
  for (let i = 0; i < numLegs; i++) {
    const a = (i / numLegs) * Math.PI * 2;
    const x1 = Math.cos(a) * baseR * 1.05;
    const z1 = Math.sin(a) * baseR * 1.05;
    const a2 = a + Math.PI / numLegs;
    const x2 = Math.cos(a2) * baseR;
    const z2 = Math.sin(a2) * baseR;
    g.add(makeBeam(0, 0.5, M.concreteDark, new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, height * 0.08, z2)));
  }
  return g;
}

// =============================================================================
// SILOS
// =============================================================================
function buildSilo(height, radius) {
  const g = new THREE.Group();
  const body = makeCyl(radius, radius, height, 18, M.concrete, 0, height/2, 0);
  g.add(body);
  // tetto conico
  const top = makeCyl(0.1, radius * 1.05, radius * 0.7, 18, M.metalCorr, 0, height + radius * 0.35, 0);
  g.add(top);
  // bande
  for (let i = 1; i < 4; i++) {
    const band = makeCyl(radius * 1.02, radius * 1.02, 0.18, 18, M.steelDark, 0, height * (i / 4), 0);
    g.add(band);
  }
  // tubo di scarico in basso
  const out = makeCyl(0.4, 0.4, 2, 12, M.rustDark, 0, 1, radius + 0.4);
  out.rotation.x = Math.PI / 2;
  g.add(out);
  return g;
}

// =============================================================================
// ALTOFORNO — la struttura iconica della Italsider
// =============================================================================
function buildBlastFurnace(scale = 1) {
  const g = new THREE.Group();
  const s = scale;

  // Castelletto in acciaio (struttura portante)
  const frameH = 36 * s;
  const frameW = 14 * s;
  const legR = 0.5 * s;
  const legPositions = [
    [-frameW/2, -frameW/2], [frameW/2, -frameW/2],
    [-frameW/2,  frameW/2], [frameW/2,  frameW/2],
  ];
  for (const [x, z] of legPositions) {
    const leg = makeCyl(legR, legR * 1.2, frameH, 8, M.rustDark, x, frameH / 2, z);
    g.add(leg);
  }
  // Travi orizzontali tra le gambe (4 livelli)
  const beamMat = M.rustDark;
  for (let lv = 1; lv <= 4; lv++) {
    const y = (frameH / 5) * lv;
    g.add(makeBeam(0, 0.3*s, beamMat, new THREE.Vector3(-frameW/2, y, -frameW/2), new THREE.Vector3( frameW/2, y, -frameW/2)));
    g.add(makeBeam(0, 0.3*s, beamMat, new THREE.Vector3(-frameW/2, y,  frameW/2), new THREE.Vector3( frameW/2, y,  frameW/2)));
    g.add(makeBeam(0, 0.3*s, beamMat, new THREE.Vector3(-frameW/2, y, -frameW/2), new THREE.Vector3(-frameW/2, y,  frameW/2)));
    g.add(makeBeam(0, 0.3*s, beamMat, new THREE.Vector3( frameW/2, y, -frameW/2), new THREE.Vector3( frameW/2, y,  frameW/2)));
    // diagonali su due facce
    g.add(makeBeam(0, 0.22*s, beamMat,
      new THREE.Vector3(-frameW/2, y - frameH/5, -frameW/2),
      new THREE.Vector3( frameW/2, y, -frameW/2)));
    g.add(makeBeam(0, 0.22*s, beamMat,
      new THREE.Vector3(-frameW/2, y - frameH/5,  frameW/2),
      new THREE.Vector3( frameW/2, y,  frameW/2)));
  }

  // Crogiolo (parte inferiore, bassa e tozza)
  const crucible = makeCyl(4*s, 4.5*s, 6*s, 24, M.rust, 0, 3*s, 0);
  g.add(crucible);
  // Etalage (svasatura)
  const etal = makeCyl(3.2*s, 4*s, 3*s, 24, M.rust, 0, 7.5*s, 0);
  g.add(etal);
  // Ventre (bosh) - parte più larga
  const bosh = makeCyl(4.5*s, 3.2*s, 4*s, 24, M.rust, 0, 11*s, 0);
  g.add(bosh);
  // Tino (cuba) - svasatura inversa, lunga
  const stack = makeCyl(2.6*s, 4.5*s, 14*s, 24, M.rust, 0, 20*s, 0);
  g.add(stack);
  // Bocca con tramoggia
  const throat = makeCyl(2.8*s, 2.6*s, 2.5*s, 24, M.steelDark, 0, 28.5*s, 0);
  g.add(throat);
  // Cappello (gas uptake)
  const cap = makeCyl(3.4*s, 2.8*s, 2*s, 24, M.steelDark, 0, 30.8*s, 0);
  g.add(cap);

  // Quattro tubi di salita gas (uptakes)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 2.2*s;
    const z = Math.sin(a) * 2.2*s;
    const upH = 6*s;
    const up = makeCyl(0.55*s, 0.55*s, upH, 12, M.rust, x, 30.8*s + upH/2, z);
    g.add(up);
    // curva in alto (rappresentata da torus parziale)
    const curve = new THREE.Mesh(
      new THREE.TorusGeometry(1.2*s, 0.55*s, 8, 12, Math.PI * 0.55),
      M.rust
    );
    curve.position.set(x * 0.55, 30.8*s + upH + 0.5*s, z * 0.55);
    curve.rotation.y = a + Math.PI / 2;
    curve.rotation.z = Math.PI / 2;
    curve.castShadow = true;
    g.add(curve);
  }
  // Anello di raccolta (bustle pipe in alto)
  const downcomer = new THREE.Mesh(new THREE.TorusGeometry(2.4*s, 0.6*s, 8, 24), M.rust);
  downcomer.position.y = 30.8*s + 6*s + 1.5*s;
  downcomer.rotation.x = Math.PI / 2;
  downcomer.castShadow = true;
  g.add(downcomer);

  // Bustle pipe attorno al ventre (anello con tuyere)
  const bustleR = 5.0*s;
  const bustle = new THREE.Mesh(new THREE.TorusGeometry(bustleR, 0.55*s, 8, 24), M.rust);
  bustle.position.y = 8.5*s;
  bustle.rotation.x = Math.PI / 2;
  bustle.castShadow = true;
  g.add(bustle);
  // tuyere (12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.cos(a) * bustleR * 0.78;
    const tz = Math.sin(a) * bustleR * 0.78;
    const t = makeCyl(0.25*s, 0.25*s, bustleR * 0.5, 8, M.steelDark, tx, 8.5*s, tz);
    t.lookAt(0, 8.5*s, 0);
    t.rotateX(Math.PI / 2);
    g.add(t);
  }

  // Stoves (recuperatori Cowper) - 3 cilindri alti accanto
  for (let i = 0; i < 3; i++) {
    const stove = new THREE.Group();
    const sx = (i - 1) * 6*s + 14*s;
    const stoveH = 24*s;
    const stoveR = 2.4*s;
    const body = makeCyl(stoveR, stoveR, stoveH, 18, M.rust, 0, stoveH/2, 0);
    const dome = makeCyl(0.05, stoveR, stoveR, 18, M.rust, 0, stoveH + stoveR/2, 0);
    stove.add(body, dome);
    // banding
    for (let b = 1; b < 5; b++) {
      stove.add(makeCyl(stoveR*1.02, stoveR*1.02, 0.18, 18, M.steelDark, 0, stoveH * (b/5), 0));
    }
    stove.position.set(sx, 0, 0);
    g.add(stove);
    // collegamento al BF (tubo orizzontale)
    g.add(makeBeam(0, 0.7*s, M.rust,
      new THREE.Vector3(sx - stoveR, 8.5*s, 0),
      new THREE.Vector3(4.5*s, 8.5*s, 0)
    ));
  }

  // Skip car ramp (rampa tramoggie/skip cars)
  const rampLen = 28*s;
  const rampStart = new THREE.Vector3(-frameW * 1.2, 0.5, 0);
  const rampEnd = new THREE.Vector3(0, 26*s, 0);
  const rampVec = new THREE.Vector3().subVectors(rampEnd, rampStart);
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(2.2*s, 0.5*s, rampVec.length()),
    M.steelDark
  );
  ramp.position.copy(rampStart).add(rampEnd).multiplyScalar(0.5);
  ramp.lookAt(rampEnd);
  ramp.castShadow = true;
  g.add(ramp);
  // truss della rampa
  const truss = makeTruss(rampVec.length(), 1.6*s, M.rust);
  truss.position.copy(rampStart).add(rampEnd).multiplyScalar(0.5);
  truss.position.y += 1.2*s;
  truss.lookAt(rampEnd);
  truss.rotateY(Math.PI / 2);
  g.add(truss);

  // Piattaforma di sommità
  const platform = makeBox(8*s, 0.3*s, 8*s, M.rust, 0, 33*s, 0);
  g.add(platform);
  // ringhiera (4 lati)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const rail = makeBox(8*s, 1.0*s, 0.08*s, M.rustDark, 0, 33.7*s, 0);
    rail.position.x = Math.cos(a) * 4*s;
    rail.position.z = Math.sin(a) * 4*s;
    rail.rotation.y = a + Math.PI/2;
    g.add(rail);
  }

  // ============= Scaletta a chiocciola intorno al fusto =============
  const stairR = 5.2*s;
  const stairH = 28*s;
  const stairSteps = 80;
  for (let i = 0; i < stairSteps; i++) {
    const t = i / stairSteps;
    const a = t * Math.PI * 8;
    const y = 4*s + t * stairH;
    const x = Math.cos(a) * stairR;
    const z = Math.sin(a) * stairR;
    const step = makeBox(0.6*s, 0.06*s, 0.4*s, M.rustDark, x, y, z);
    step.lookAt(0, y, 0);
    g.add(step);
  }

  return g;
}

// =============================================================================
// PONTILE NORD (pier che entra nel mare)
// =============================================================================
function buildPier(length, width) {
  const g = new THREE.Group();
  const deckTh = 0.35;
  const deck = makeBox(width, deckTh, length, M.concrete, 0, 1.4, -length/2 - 5);
  g.add(deck);
  // Pile (file di pilastri)
  const cols = Math.floor(length / 8);
  for (let i = 0; i <= cols; i++) {
    const z = -5 - (length / cols) * i;
    for (let s = -1; s <= 1; s += 2) {
      const x = s * (width/2 - 0.6);
      const pile = makeCyl(0.4, 0.5, 4, 12, M.concreteDark, x, 0, z);
      g.add(pile);
      // crocera diagonale tra pile
      if (i > 0) {
        const zPrev = -5 - (length / cols) * (i - 1);
        g.add(makeBeam(0, 0.18, M.rustDark,
          new THREE.Vector3(x, -0.2, z),
          new THREE.Vector3(x, 1.2, zPrev)
        ));
      }
    }
    // barra trasversale
    g.add(makeBeam(0, 0.22, M.rustDark,
      new THREE.Vector3(-(width/2 - 0.6), 0.6, z),
      new THREE.Vector3( (width/2 - 0.6), 0.6, z)
    ));
  }
  // Ringhiera laterale (pali + corrimano)
  for (let i = 0; i <= cols * 2; i++) {
    const z = -5 - (length / (cols * 2)) * i;
    for (let s = -1; s <= 1; s += 2) {
      const x = s * (width/2 - 0.3);
      g.add(makeBox(0.06, 1.1, 0.06, M.rustDark, x, 2.15, z));
    }
  }
  // corrimano superiore
  for (let s = -1; s <= 1; s += 2) {
    const x = s * (width/2 - 0.3);
    const rail = makeBox(0.08, 0.08, length, M.rustDark, x, 2.6, -length/2 - 5);
    g.add(rail);
  }

  // Bitte di ormeggio in fondo al pontile
  for (let i = 0; i < 4; i++) {
    const bx = -3 + i * 2;
    const bitt = makeCyl(0.35, 0.45, 0.9, 12, M.rustDark, bx, 2.0, -length - 5 + 1);
    g.add(bitt);
  }
  // Lampione in fondo
  const lampPole = makeCyl(0.1, 0.12, 6, 8, M.rustDark, -width/2 + 1, 4.6, -length - 4);
  g.add(lampPole);
  const lampHead = makeBox(0.6, 0.4, 0.4, M.rustDark, -width/2 + 1, 7.5, -length - 4);
  g.add(lampHead);
  return g;
}

// =============================================================================
// PIPE BRIDGE (ponte tubazioni elevato)
// =============================================================================
function buildPipeBridge(from, to, height = 10) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mid = new THREE.Vector3().copy(from).add(to).multiplyScalar(0.5);
  // pilastri
  const numPiers = Math.max(2, Math.floor(len / 14));
  for (let i = 0; i <= numPiers; i++) {
    const t = i / numPiers;
    const x = THREE.MathUtils.lerp(from.x, to.x, t);
    const z = THREE.MathUtils.lerp(from.z, to.z, t);
    const pier = makeBox(0.6, height, 0.6, M.concreteDark, x, height/2, z);
    g.add(pier);
  }
  // truss
  const truss = makeTruss(len, 2.2, M.rust);
  truss.position.set(mid.x, height + 1, mid.z);
  truss.lookAt(to.x, height + 1, to.z);
  truss.rotateY(Math.PI / 2);
  g.add(truss);
  // tubi
  const pipeRadii = [0.45, 0.32, 0.32, 0.22];
  pipeRadii.forEach((r, i) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), i % 2 === 0 ? M.rust : M.metal);
    pipe.position.set(mid.x, height + 1 + (i - 1.5) * 0.6, mid.z);
    pipe.lookAt(to.x, height + 1 + (i - 1.5) * 0.6, to.z);
    pipe.rotateX(Math.PI / 2);
    pipe.castShadow = pipe.receiveShadow = true;
    g.add(pipe);
  });
  return g;
}

// =============================================================================
// SCATTERED DETAILS - detriti, vegetazione, cartelli
// =============================================================================
function buildDebrisField(centerX, centerZ, count, radius) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = centerX + Math.cos(a) * r;
    const z = centerZ + Math.sin(a) * r;
    const t = Math.floor(Math.random() * 4);
    let m;
    if (t === 0) {
      // blocco di cemento
      m = makeBox(0.6 + Math.random()*1.5, 0.3 + Math.random()*0.6, 0.4 + Math.random()*1.0, M.concreteDark, x, 0.3, z);
      m.rotation.y = Math.random() * Math.PI;
      m.rotation.z = (Math.random() - 0.5) * 0.4;
    } else if (t === 1) {
      // tubo arrugginito
      const len = 1 + Math.random() * 4;
      const r2 = 0.15 + Math.random() * 0.25;
      m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2, len, 8), M.rust);
      m.position.set(x, r2, z);
      m.rotation.z = Math.PI / 2;
      m.rotation.y = Math.random() * Math.PI;
      m.castShadow = m.receiveShadow = true;
    } else if (t === 2) {
      // travetto
      const len = 1 + Math.random() * 3;
      m = makeBox(0.2, 0.2, len, M.rustDark, x, 0.1, z);
      m.rotation.y = Math.random() * Math.PI;
    } else {
      // cespuglio (cono di vegetazione)
      const h = 0.5 + Math.random() * 1.4;
      m = new THREE.Mesh(new THREE.ConeGeometry(0.3 + Math.random()*0.5, h, 5), M.vegetation);
      m.position.set(x, h/2, z);
      m.castShadow = true;
    }
    g.add(m);
  }
  return g;
}

// =============================================================================
// ASSEMBLY DELLA SCENA
// =============================================================================

// --- Pontile Nord (entra nel mare verso -Z)
const pier = buildPier(180, 9);
pier.position.set(-30, 0, -10);
scene.add(pier);

// secondo pontile più piccolo
const pier2 = buildPier(110, 7);
pier2.position.set(80, 0, -10);
scene.add(pier2);

// --- Altoforni (i due grandi simboli di Bagnoli)
const bf1 = buildBlastFurnace(1.0);
bf1.position.set(-55, 0, 50);
bf1.rotation.y = Math.PI * 0.1;
scene.add(bf1);

const bf2 = buildBlastFurnace(0.85);
bf2.position.set(45, 0, 60);
bf2.rotation.y = -Math.PI * 0.15;
scene.add(bf2);

// --- Torri di raffreddamento (due, una dietro l'altra)
const ct1 = buildCoolingTower(38, 18);
ct1.position.set(-130, 0, 130);
scene.add(ct1);

const ct2 = buildCoolingTower(32, 15);
ct2.position.set(-100, 0, 165);
scene.add(ct2);

// --- Capannoni (acciaieria principale)
const mainHall = buildHall(70, 22, 110, { wallMat: M.brick, roofMat: M.metalCorr, winRows: 2 });
mainHall.position.set(0, 0, 145);
scene.add(mainHall);

const sideHall1 = buildHall(34, 16, 70, { wallMat: M.concrete, roofMat: M.metalCorr });
sideHall1.position.set(-90, 0, 140);
scene.add(sideHall1);

const sideHall2 = buildHall(34, 16, 70, { wallMat: M.brick, roofMat: M.metalCorr });
sideHall2.position.set(90, 0, 140);
scene.add(sideHall2);

const longHall = buildHall(20, 12, 90, { wallMat: M.concrete, roofMat: M.rust });
longHall.position.set(135, 0, 80);
scene.add(longHall);

const officeHall = buildHall(28, 9, 16, { wallMat: M.brick, roofMat: M.concrete, winRows: 2 });
officeHall.position.set(110, 0, -10);
scene.add(officeHall);

// --- Ciminiere
const ch1 = buildChimney(58, 2.0); ch1.position.set(-30, 0, 130); scene.add(ch1);
const ch2 = buildChimney(48, 1.7); ch2.position.set(20, 0, 175); scene.add(ch2);
const ch3 = buildChimney(42, 1.5); ch3.position.set(70, 0, 165); scene.add(ch3);
const ch4 = buildChimney(35, 1.3); ch4.position.set(-70, 0, 95); scene.add(ch4);

// --- Cluster di silos
for (let i = 0; i < 4; i++) {
  const s = buildSilo(18, 3.5);
  s.position.set(-20 + (i % 2) * 9, 0, 10 + Math.floor(i / 2) * 9);
  scene.add(s);
}
// silos secondari
for (let i = 0; i < 3; i++) {
  const s = buildSilo(14, 2.5);
  s.position.set(140 + i * 7, 0, 30);
  scene.add(s);
}

// --- Ponti tubazioni (pipe bridges) tra strutture
scene.add(buildPipeBridge(new THREE.Vector3(-55, 0, 65), new THREE.Vector3(-15, 0, 16), 12));
scene.add(buildPipeBridge(new THREE.Vector3(45, 0, 75), new THREE.Vector3(0, 0, 110), 14));
scene.add(buildPipeBridge(new THREE.Vector3(-15, 0, 18), new THREE.Vector3(-45, 0, 95), 11));
scene.add(buildPipeBridge(new THREE.Vector3(70, 0, 30), new THREE.Vector3(140, 0, 30), 9));
scene.add(buildPipeBridge(new THREE.Vector3(-90, 0, 100), new THREE.Vector3(-30, 0, 130), 12));

// --- Detriti sparsi
scene.add(buildDebrisField(0, 80, 80, 90));
scene.add(buildDebrisField(-80, 60, 30, 40));
scene.add(buildDebrisField(80, 100, 30, 40));
scene.add(buildDebrisField(0, 200, 25, 50));

// --- Cartello arrugginito "ITALSIDER" all'ingresso
{
  const signPost1 = makeBox(0.3, 6, 0.3, M.rustDark, -8, 3, -25);
  const signPost2 = makeBox(0.3, 6, 0.3, M.rustDark,  8, 3, -25);
  const signBoard = makeBox(20, 3, 0.2, M.paint, 0, 5, -25);
  scene.add(signPost1, signPost2, signBoard);
  // Lettere ITALSIDER ricostruite con piccoli box bianchi
  const txtMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.95, metalness: 0.0 });
  const text = "ITALSIDER";
  const charW = 1.3, charH = 1.6;
  for (let i = 0; i < text.length; i++) {
    const xx = (i - (text.length - 1) / 2) * (charW + 0.4);
    const c = makeBox(charW, charH, 0.08, txtMat, xx, 5, -24.85);
    scene.add(c);
  }
}

// --- Recinzione perimetrale con cancello aperto al centro
{
  const fenceMat = M.rustDark;
  const gateHalf = 14;
  for (let x = -200; x <= 200; x += 4) {
    if (Math.abs(x) < gateHalf) continue; // apertura del cancello
    const post = makeBox(0.1, 2.4, 0.1, fenceMat, x, 1.2, -22);
    scene.add(post);
  }
  // cavi orizzontali (due segmenti, separati dal cancello)
  for (let h = 0.6; h <= 2.0; h += 0.5) {
    const lenLeft = 200 - gateHalf;
    const wireL = makeBox(lenLeft, 0.04, 0.04, fenceMat, -(gateHalf + lenLeft / 2), h, -22);
    const wireR = makeBox(lenLeft, 0.04, 0.04, fenceMat,  (gateHalf + lenLeft / 2), h, -22);
    scene.add(wireL, wireR);
  }
  // Pilastri del cancello (più alti e robusti)
  const gateP1 = makeBox(0.6, 4.5, 0.6, M.brick, -gateHalf, 2.25, -22);
  const gateP2 = makeBox(0.6, 4.5, 0.6, M.brick,  gateHalf, 2.25, -22);
  scene.add(gateP1, gateP2);
  // Architrave
  const arch = makeBox(gateHalf * 2 + 0.6, 0.5, 0.4, M.steelDark, 0, 4.5, -22);
  scene.add(arch);
  // Cancello scorrevole semi-aperto (un'anta inclinata)
  const gateLeaf = makeBox(gateHalf, 3.6, 0.1, M.rustDark, -gateHalf - 0.5, 1.85, -22.5);
  gateLeaf.rotation.y = -0.15;
  scene.add(gateLeaf);
}

// --- Vagoni ferroviari abbandonati
function buildWagon(x, z, rot = 0) {
  const g = new THREE.Group();
  const body = makeBox(3.5, 2.4, 8, M.rustDark, 0, 2.0, 0);
  g.add(body);
  // tetto curvo (cilindro orizzontale lungo Z, schiacciato in altezza)
  const roof = makeCyl(1.8, 1.8, 8, 12, M.rust, 0, 3.5, 0);
  roof.rotation.x = Math.PI / 2;
  roof.scale.z = 0.42;
  g.add(roof);
  // ruote
  for (let s of [-1, 1]) for (let zz of [-2.5, 2.5]) {
    const w = makeCyl(0.7, 0.7, 0.4, 12, M.steelDark, s * 1.7, 0.7, zz);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }
  // base
  const base = makeBox(4, 0.4, 8.5, M.steelDark, 0, 0.7, 0);
  g.add(base);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}
scene.add(buildWagon(150, 90, Math.PI / 2));
scene.add(buildWagon(150, 100, Math.PI / 2));
scene.add(buildWagon(-160, 50, 0.3));

// --- Carro siviera (paiola/ladle car) - tipico delle acciaierie
{
  const ladleCar = new THREE.Group();
  const ladle = makeCyl(2.2, 1.8, 3.2, 18, M.rust, 0, 2.6, 0);
  ladleCar.add(ladle);
  const trun = makeCyl(0.3, 0.3, 5.5, 8, M.steelDark, 0, 2.6, 0);
  trun.rotation.z = Math.PI / 2;
  ladleCar.add(trun);
  const carBase = makeBox(5, 0.5, 4, M.steelDark, 0, 0.6, 0);
  ladleCar.add(carBase);
  for (let s of [-1, 1]) for (let zz of [-1.4, 1.4]) {
    const w = makeCyl(0.6, 0.6, 0.3, 12, M.rustDark, s * 2.2, 0.5, zz);
    w.rotation.z = Math.PI / 2;
    ladleCar.add(w);
  }
  ladleCar.position.set(-25, 0, 105);
  ladleCar.rotation.y = 0.4;
  scene.add(ladleCar);
}

// --- Binari ferroviari (rappresentazione semplice)
function buildRail(from, to) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mid = new THREE.Vector3().copy(from).add(to).multiplyScalar(0.5);
  for (let s of [-0.7175, 0.7175]) {
    const rail = makeBox(0.1, 0.12, len, M.steel, 0, 0.06, 0);
    rail.position.set(mid.x + s, 0.12, mid.z);
    rail.lookAt(to.x + s, 0.12, to.z);
    g.add(rail);
  }
  // traversine
  const ties = Math.floor(len / 0.6);
  for (let i = 0; i < ties; i++) {
    const t = (i + 0.5) / ties;
    const x = THREE.MathUtils.lerp(from.x, to.x, t);
    const z = THREE.MathUtils.lerp(from.z, to.z, t);
    const tie = makeBox(2.0, 0.1, 0.2, M.rustDark, x, 0.05, z);
    tie.lookAt(to.x, 0.05, to.z);
    g.add(tie);
  }
  return g;
}
scene.add(buildRail(new THREE.Vector3(-180, 0, 70), new THREE.Vector3(180, 0, 70)));
scene.add(buildRail(new THREE.Vector3(150, 0, 70), new THREE.Vector3(150, 0, 110)));

// --- Gabbiani in volo (semplici sprite a V)
const gulls = [];
const gullMat = new THREE.MeshBasicMaterial({ color: 0xece4d2, side: THREE.DoubleSide });
for (let i = 0; i < 14; i++) {
  const gull = new THREE.Group();
  const gullGeom = new THREE.BufferGeometry();
  gullGeom.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.2, 0.2, 0,   0, 0, 0,    1.2, 0.2, 0,
  ], 3));
  gullGeom.setIndex([0, 1, 2]);
  gullGeom.computeVertexNormals();
  const wing = new THREE.Mesh(gullGeom, gullMat);
  gull.add(wing);
  gull.userData = {
    cx: (Math.random() - 0.5) * 400,
    cz: -100 + (Math.random() - 0.5) * 400,
    r: 30 + Math.random() * 80,
    y: 30 + Math.random() * 30,
    speed: 0.2 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
  };
  scene.add(gull);
  gulls.push(gull);
}

// --- Polvere/foschia (particelle leggere)
{
  const dustCount = 400;
  const dustGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i*3] = (Math.random() - 0.5) * 600;
    positions[i*3+1] = 1 + Math.random() * 50;
    positions[i*3+2] = (Math.random() - 0.5) * 500 + 50;
  }
  dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xe8d8b8, size: 0.4, transparent: true, opacity: 0.32,
    sizeAttenuation: true, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeom, dustMat);
  scene.add(dust);
}

// =============================================================================
// CONTROLLI - Pointer Lock + WASD + fly mode
// =============================================================================
const controls = new PointerLockControls(camera, renderer.domElement);
const keys = {};
let flyMode = false;
let velocity = new THREE.Vector3();

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyF') flyMode = !flyMode;
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

const startBtn = document.getElementById('startBtn');
const instructions = document.getElementById('instructions');
const hud = document.getElementById('hud');

startBtn.addEventListener('click', () => {
  controls.lock();
});

controls.addEventListener('lock', () => {
  instructions.classList.add('hidden');
  hud.classList.add('visible');
});
controls.addEventListener('unlock', () => {
  instructions.classList.remove('hidden');
  hud.classList.remove('visible');
});

// =============================================================================
// LOOP DI ANIMAZIONE
// =============================================================================
const clock = new THREE.Clock();
const tmpDir = new THREE.Vector3();
const compass = document.getElementById('needle');

function update(dt) {
  // Movimento
  const speed = (keys['ShiftLeft'] || keys['ShiftRight'] ? 22 : 9) * dt;
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  if (!flyMode) fwd.y = 0;
  fwd.normalize();
  right.crossVectors(fwd, camera.up).normalize();

  const move = new THREE.Vector3();
  if (keys['KeyW']) move.add(fwd);
  if (keys['KeyS']) move.sub(fwd);
  if (keys['KeyA']) move.sub(right);
  if (keys['KeyD']) move.add(right);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

  if (flyMode) {
    if (keys['Space']) move.y += speed;
    if (keys['ControlLeft'] || keys['ControlRight']) move.y -= speed;
  }

  camera.position.add(move);

  if (!flyMode) {
    // Mantieni altezza occhi
    camera.position.y = 1.7;
  } else {
    camera.position.y = Math.max(camera.position.y, 1.0);
  }

  // limiti scena
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -380, 380);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -250, 350);

  // Bussola
  camera.getWorldDirection(tmpDir);
  const angle = Math.atan2(tmpDir.x, -tmpDir.z); // 0 = nord (-Z)
  compass.style.transform = `rotate(${angle}rad)`;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // onde mare
  if (seaMat.userData.shader) seaMat.userData.shader.uniforms.uTime.value = t;

  // gabbiani
  for (const g of gulls) {
    const u = g.userData;
    u.phase += dt * u.speed;
    g.position.x = u.cx + Math.cos(u.phase) * u.r;
    g.position.z = u.cz + Math.sin(u.phase) * u.r;
    g.position.y = u.y + Math.sin(u.phase * 3) * 1.5;
    g.lookAt(
      u.cx + Math.cos(u.phase + 0.05) * u.r,
      u.y,
      u.cz + Math.sin(u.phase + 0.05) * u.r
    );
    // sbattere d'ali
    g.children[0].rotation.x = Math.sin(t * 8 + u.phase * 2) * 0.4;
  }

  if (controls.isLocked) update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// =============================================================================
// RESIZE
// =============================================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =============================================================================
// LOADING SIMULATION (la scena è già pronta, simulo per UX)
// =============================================================================
let loadProgress = 0;
const loadFill = document.getElementById('loadingFill');
const loadInterval = setInterval(() => {
  loadProgress += 6 + Math.random() * 14;
  if (loadProgress >= 100) {
    loadProgress = 100;
    clearInterval(loadInterval);
    setTimeout(() => {
      document.getElementById('loadingBar').style.opacity = '0';
    }, 400);
  }
  loadFill.style.width = loadProgress + '%';
}, 110);

animate();
