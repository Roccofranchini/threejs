import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// IMAGE UNIVERSE
// Tutte le immagini provengono dalla cartella `images/`,
// indicizzata dallo script `build.js` che genera `images.json`.
// =============================================================================

const $        = (sel) => document.querySelector(sel);
const loading  = $('#loading');
const emptySt  = $('#empty-state');

// ─── Scene / renderer ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f5f2);
scene.fog = new THREE.Fog(0xf6f5f2, 100, 320);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#app').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 90);

scene.add(new THREE.AmbientLight(0xffffff, 1.0));

// ─── OrbitControls ──────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.panSpeed = 0.7;
controls.zoomSpeed = 0.9;
controls.minDistance = 5;
controls.maxDistance = 260;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.22;
controls.addEventListener('start', () => { controls.autoRotate = false; });

// ─── Loader & helpers ───────────────────────────────────────────────────────
const loader = new THREE.TextureLoader();

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => resolve(tex), undefined, reject);
  });
}

function makeImageMaterial(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return new THREE.MeshBasicMaterial({
    map: texture, side: THREE.DoubleSide, transparent: true,
  });
}

// ─── Particelle (image planes) ──────────────────────────────────────────────
const particles = [];
const universeRadius = 70;
const baseSize = 7;

function randomPositionInBall(radius) {
  const r = Math.cbrt(Math.random()) * radius;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta) * 0.65,
    r * Math.cos(phi)
  );
}

function spawnParticle(position, texture) {
  const img = texture.image;
  const aspect = (img && img.width && img.height) ? img.width / img.height : 1;
  const size = baseSize * (0.85 + Math.random() * 0.55);
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), makeImageMaterial(texture));
  mesh.position.copy(position);
  mesh.rotation.set(
    (Math.random() - 0.5) * 0.55,
    Math.random() * Math.PI * 2,
    (Math.random() - 0.5) * 0.55
  );
  mesh.userData = {
    basePos: position.clone(),
    baseRot: mesh.rotation.clone(),
    seed: Math.random() * 1000,
    bobAmp: 0.4 + Math.random() * 0.6,
    bobSpeed: 0.2 + Math.random() * 0.4,
  };
  scene.add(mesh);
  particles.push(mesh);
  return mesh;
}

// ─── Carica il manifest e popola la scena ───────────────────────────────────
const MAX_PARTICLES = 100;

async function loadManifest() {
  try {
    const res = await fetch('images.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[image-universe] images.json non trovato o non leggibile:', err);
    return [];
  }
}

async function bootstrap() {
  const manifest = await loadManifest();

  if (manifest.length === 0) {
    loading.classList.add('hidden');
    emptySt.classList.remove('hidden');
    return;
  }

  // Carica tutte le texture in parallelo (le immagini falliscono in silenzio).
  const settled = await Promise.allSettled(manifest.map(loadTexture));
  const textures = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  if (textures.length === 0) {
    loading.classList.add('hidden');
    emptySt.classList.remove('hidden');
    return;
  }

  // Una particella per ogni immagine, con un tetto a MAX_PARTICLES.
  // Se ci sono più immagini del cap, si usano le prime in ordine alfabetico.
  const count = Math.min(textures.length, MAX_PARTICLES);
  for (let i = 0; i < count; i++) {
    spawnParticle(randomPositionInBall(universeRadius), textures[i]);
  }

  loading.classList.add('hidden');
}

bootstrap();

// ─── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Loop di animazione ─────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  for (const p of particles) {
    const u = p.userData;
    p.position.y = u.basePos.y + Math.sin(t * u.bobSpeed + u.seed) * u.bobAmp;
    p.position.x = u.basePos.x + Math.cos(t * u.bobSpeed * 0.7 + u.seed * 1.3) * u.bobAmp * 0.4;
    p.rotation.y = u.baseRot.y + Math.sin(t * 0.18 + u.seed) * 0.06;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
