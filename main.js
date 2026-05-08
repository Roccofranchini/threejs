import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// IMAGE UNIVERSE — 100 immagini sospese in uno spazio 3D
// Ispirato al tutorial @malik.code (three.js + OrbitControls)
// =============================================================================

const $ = (sel) => document.querySelector(sel);
const countEl  = $('#count');
const loading  = $('#loading');
const dropOv   = $('#dropzone-overlay');
const focusEl  = $('#focus-card');
const closeBtn = $('#focus-close');
const fileIn   = $('#file-input');

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

// luce ambientale leggera per dare un soffio di profondità ai bordi
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

// ─── OrbitControls (drag rotate, scroll zoom, right-drag pan) ───────────────
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
// stop dell'autorotazione alla prima interazione
controls.addEventListener('start', () => { controls.autoRotate = false; });

// ─── Loader ─────────────────────────────────────────────────────────────────
const loader = new THREE.TextureLoader();
loader.crossOrigin = 'anonymous';

const fallbackMat = new THREE.MeshBasicMaterial({
  color: 0xe9e7e2, side: THREE.DoubleSide, transparent: true,
});

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

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => resolve(tex), undefined, reject);
  });
}

// ─── Particelle (image planes) ──────────────────────────────────────────────
const particles = [];
const universeRadius = 70;
const baseSize = 7;

function randomPositionInBall(radius) {
  // distribuzione uniforme in volume, leggermente schiacciata su Y
  const r = Math.cbrt(Math.random()) * radius;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta) * 0.65,
    r * Math.cos(phi)
  );
}

function spawnParticle(position) {
  // dimensione di partenza random, poi corretta con l'aspect del texture
  const w = baseSize * (0.8 + Math.random() * 0.6);
  const h = baseSize * (0.8 + Math.random() * 0.6);
  const geom = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geom, fallbackMat.clone());
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
    targetScale: 1,
    currentScale: 1,
    bobAmp: 0.4 + Math.random() * 0.6,
    bobSpeed: 0.2 + Math.random() * 0.4,
    spinSpeed: (Math.random() - 0.5) * 0.04,
    aspect: 1,
    hasTexture: false,
  };
  scene.add(mesh);
  particles.push(mesh);
  return mesh;
}

function applyTexture(mesh, texture) {
  if (mesh.material) mesh.material.dispose();
  mesh.material = makeImageMaterial(texture);
  const img = texture.image;
  const aspect = (img && img.width && img.height) ? img.width / img.height : 1;
  const size = baseSize * (0.85 + Math.random() * 0.55);
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(w, h);
  mesh.userData.aspect = aspect;
  mesh.userData.hasTexture = true;
}

// ─── Genera 100 particelle ──────────────────────────────────────────────────
const NUM_PARTICLES = 100;
for (let i = 0; i < NUM_PARTICLES; i++) {
  spawnParticle(randomPositionInBall(universeRadius));
}

// ─── Placeholder URLs (Picsum, casuali deterministici per seed) ─────────────
const PLACEHOLDER_COUNT = 36;
function buildPlaceholderUrls() {
  const sizes = [
    [600, 400], [400, 600], [500, 500],
    [800, 500], [500, 800], [700, 500],
  ];
  const seeds = ['arc', 'sky', 'sea', 'art', 'edge', 'film', 'wave', 'ink', 'lab', 'noir',
    'leaf', 'glass', 'sand', 'fog', 'dune', 'mono', 'lens', 'iron', 'stone', 'echo',
    'pixel', 'orbit', 'vapor', 'silk', 'gold', 'cyan', 'rose', 'kiln', 'mist', 'rain',
    'hush', 'spark', 'palm', 'salt', 'opal', 'snow'];
  const urls = [];
  for (let i = 0; i < PLACEHOLDER_COUNT; i++) {
    const [w, h] = sizes[i % sizes.length];
    const seed = seeds[i % seeds.length] + i;
    urls.push(`https://picsum.photos/seed/${seed}/${w}/${h}`);
  }
  return urls;
}

const placeholderUrls = buildPlaceholderUrls();

let loadedCount = 0;
const updateCount = () => { countEl.textContent = loadedCount; };

async function loadAndDistributePlaceholders() {
  // carica le 36 texture, poi assegna a ciascuna delle 100 particelle una random
  const promises = placeholderUrls.map((url) =>
    loadTexture(url).catch(() => null)
  );
  const textures = (await Promise.all(promises)).filter((t) => t);

  if (textures.length === 0) {
    // fallback: nessuna immagine caricata (rete offline). Mostra rettangoli colorati.
    particles.forEach((p) => {
      p.material.color.setHSL(Math.random(), 0.18, 0.85);
    });
    loadedCount = particles.length;
    updateCount();
    loading.classList.add('hidden');
    return;
  }

  particles.forEach((p) => {
    const tex = textures[Math.floor(Math.random() * textures.length)];
    applyTexture(p, tex);
  });
  loadedCount = particles.length;
  updateCount();
  loading.classList.add('hidden');
}

loadAndDistributePlaceholders();

// ─── Aggiunta immagini caricate dall'utente ─────────────────────────────────
function addUserImage(file) {
  if (!file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  loadTexture(url).then((tex) => {
    // crea una nuova particella per questa immagine
    const pos = randomPositionInBall(universeRadius * 0.6);
    const mesh = spawnParticle(pos);
    applyTexture(mesh, tex);
    // entrata animata: parte piccolo e cresce
    mesh.userData.currentScale = 0.01;
    mesh.userData.targetScale = 1;
    loadedCount++;
    updateCount();
  }).catch(() => {});
}

function handleFiles(files) {
  for (const f of files) addUserImage(f);
}

fileIn.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  e.target.value = '';
});

// drag & drop sull'intera finestra
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
    dropOv.classList.add('active');
  }
});
window.addEventListener('dragover', (e) => { e.preventDefault(); });
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth--;
  if (dragDepth <= 0) {
    dragDepth = 0;
    dropOv.classList.remove('active');
  }
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOv.classList.remove('active');
  if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
});

// ─── Click → focus su un'immagine ───────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pointerDown = null;
let focused = null;
const focusState = { from: null, to: null, t: 0, duration: 0.9, target: null };

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, time: performance.now() };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  const dist = Math.hypot(dx, dy);
  const dt = performance.now() - pointerDown.time;
  pointerDown = null;
  // riconosce un click solo se il puntatore non si è spostato troppo
  if (dist > 6 || dt > 600) return;

  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(particles, false);
  if (hits.length > 0) {
    focusOn(hits[0].object);
  } else if (focused) {
    unfocus();
  }
});

function focusOn(mesh) {
  if (focused === mesh) return;
  focused = mesh;
  // calcola il target: posizione davanti all'immagine, lungo la sua normale
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
  const dim = Math.max(mesh.geometry.parameters.width, mesh.geometry.parameters.height);
  const dist = dim * 1.65;
  const target = mesh.position.clone();
  const eye = mesh.position.clone().add(normal.multiplyScalar(dist));

  focusState.from = { eye: camera.position.clone(), target: controls.target.clone() };
  focusState.to = { eye, target };
  focusState.t = 0;
  focusState.target = mesh;
  controls.autoRotate = false;
  controls.enabled = false;
  focusEl.classList.remove('hidden');
}

function unfocus() {
  if (!focused) return;
  // ritorno a una vista panoramica
  const eye = new THREE.Vector3(0, 0, 90);
  focusState.from = { eye: camera.position.clone(), target: controls.target.clone() };
  focusState.to = { eye, target: new THREE.Vector3(0, 0, 0) };
  focusState.t = 0;
  focusState.target = null;
  focused = null;
  focusEl.classList.add('hidden');
  controls.autoRotate = true;
  // controls.enabled si riabilita a fine animazione
}

closeBtn.addEventListener('click', unfocus);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') unfocus();
});

// hover: cambio cursore quando si è sopra un'immagine
let hoveredMesh = null;
renderer.domElement.addEventListener('pointermove', (e) => {
  // evitare hover-test mentre si trascina con il mouse
  if (pointerDown) return;
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(particles, false);
  const newHover = hits.length > 0 ? hits[0].object : null;
  if (newHover !== hoveredMesh) {
    if (hoveredMesh) hoveredMesh.userData.targetScale = 1;
    hoveredMesh = newHover;
    if (hoveredMesh) hoveredMesh.userData.targetScale = 1.18;
    document.body.style.cursor = hoveredMesh ? 'pointer' : 'default';
  }
});

// ─── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Loop di animazione ─────────────────────────────────────────────────────
const clock = new THREE.Clock();

function tickFocus(dt) {
  if (!focusState.from || !focusState.to) return;
  if (focusState.t >= 1) return;
  focusState.t = Math.min(1, focusState.t + dt / focusState.duration);
  // ease-out cubic
  const k = 1 - Math.pow(1 - focusState.t, 3);
  camera.position.lerpVectors(focusState.from.eye, focusState.to.eye, k);
  controls.target.lerpVectors(focusState.from.target, focusState.to.target, k);
  if (focusState.t >= 1) {
    if (!focusState.target) {
      controls.enabled = true; // unfocus completato
    } else {
      controls.enabled = true; // dopo il focus l'utente può ancora orbitare
    }
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t  = clock.elapsedTime;

  // bobbing + spin morbido per ogni particella
  for (const p of particles) {
    const u = p.userData;
    p.position.y = u.basePos.y + Math.sin(t * u.bobSpeed + u.seed) * u.bobAmp;
    p.position.x = u.basePos.x + Math.cos(t * u.bobSpeed * 0.7 + u.seed * 1.3) * u.bobAmp * 0.4;
    p.rotation.y = u.baseRot.y + Math.sin(t * 0.18 + u.seed) * 0.06;
    // smooth scale verso il target
    u.currentScale += (u.targetScale - u.currentScale) * Math.min(1, dt * 6);
    p.scale.setScalar(u.currentScale);
  }

  tickFocus(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
