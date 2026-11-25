import * as THREE from './lib/three.module.min.js';
import { MONSTERS, SPAWNS, NPCS, QUESTS, ITEMS, ZONES, CLASSES } from './data.js';
import { TEX, rep } from './textures.js';
import { makeHero } from './heroes.js';
import { loadHero } from './models.js';
import { mergeGeometries } from './lib/utils/BufferGeometryUtils.js';

// ====================================================================
// Utilitaires
// ====================================================================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = (id) => document.getElementById(id);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

function hash(x, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
function fbm(x, z) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < 4; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// ====================================================================
// Monde : zones & relief
// ====================================================================
const WORLD = 300, WATER = -3;
const ZDIR = { forest: [0, -1], marsh: [1, 0], volcanic: [0, 1], plains: [-1, 0] };

function zoneWeights(x, z) {
  const d = Math.hypot(x, z) || 1;
  const wob = (fbm(x * 0.02 + 9, z * 0.02 + 9) - 0.5) * 0.8;
  const a = Math.atan2(z, x) + wob;
  const nx = Math.cos(a), nz = Math.sin(a);
  const ring = smooth(70, 120, d);
  const w = {};
  for (const k in ZDIR) w[k] = Math.pow(Math.max(0, nx * ZDIR[k][0] + nz * ZDIR[k][1]), 2) * ring;
  w.plains += 1 - ring;
  return w;
}
function zoneAt(x, z) {
  if (Math.hypot(x, z) < 42) return 'village';
  const w = zoneWeights(x, z);
  let best = 'plains', bv = -1;
  for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
  return best;
}
function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const w = zoneWeights(x, z);
  let h = (fbm(x * 0.012 + 50, z * 0.012 + 50) - 0.5) * 20 + (fbm(x * 0.06, z * 0.06) - 0.5) * 3;
  h += w.marsh * -7;
  h += w.volcanic * (fbm(x * 0.03 + 3, z * 0.03) * 30 - 4);
  h += w.forest * 3;
  h *= smooth(28, 70, d);
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(250, 300, edge) * 45;
  return h;
}

// ====================================================================
// Rendu
// ====================================================================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const SKY = new THREE.Color(0xeab9bd); // horizon rosé
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 60, 240);
// Ciel en dégradé (sphère qui suit la caméra)
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x34408f) }, mid: { value: new THREE.Color(0x9a86c8) }, bot: { value: SKY.clone() }, sunDir: { value: new THREE.Vector3(0.75, 0.12, 0.3).normalize() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vP;
    void main(){ float h = clamp(vP.y * 1.6 + 0.04, 0.0, 1.0);
      vec3 c = h < 0.35 ? mix(bot, mid, h / 0.35) : mix(mid, top, (h - 0.35) / 0.65);
      float s = max(dot(vP, sunDir), 0.0); c += vec3(1.0, 0.7, 0.45) * (pow(s, 300.0) * 3.0 + pow(s, 8.0) * 0.35);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -1;
scene.add(sky);
// Reflets du ciel sur les armures et armes en métal
{
  const envScene = new THREE.Scene();
  const s2 = sky.clone(); s2.scale.setScalar(0.02); envScene.add(s2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x6a5a40 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2; envScene.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  pm.dispose();
}
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 900);

scene.add(new THREE.HemisphereLight(0xc8c0ff, 0x6a4a50, 1.25));
const sun = new THREE.DirectionalLight(0xffd6b0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 75 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Terrain
const ZCOL = {
  village: new THREE.Color(0.58, 0.5, 0.34), plains: new THREE.Color(0.42, 0.64, 0.28),
  forest: new THREE.Color(0.86, 0.9, 0.98), marsh: new THREE.Color(0.3, 0.42, 0.3),
  volcanic: new THREE.Color(0.32, 0.22, 0.19),
};
{
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(WORLD * 2, WORLD * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = [];
  const c = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    const w = zoneWeights(x, z);
    c.setRGB(0, 0, 0);
    let tot = 0;
    for (const k in w) { tmp.copy(ZCOL[k]).multiplyScalar(w[k]); c.add(tmp); tot += w[k]; }
    c.multiplyScalar(1 / tot);
    const d = Math.hypot(x, z);
    c.lerp(ZCOL.village, 1 - smooth(20, 45, d));
    const n = fbm(x * 0.15, z * 0.15) * 0.25 + 0.85;
    c.multiplyScalar(n * 1.15);
    if (h < WATER + 0.6) c.lerp(new THREE.Color(0.55, 0.5, 0.36), 0.6);
    if (h > 18) c.lerp(new THREE.Color(0.45, 0.42, 0.48), smooth(18, 30, h));
    if (h > 30) c.lerp(new THREE.Color(0.92, 0.94, 1.0), smooth(30, 42, h)); // neige des sommets
    if (w.forest > 0.4) c.lerp(new THREE.Color(0.62, 0.7, 0.9), (fbm(x * 0.05, z * 0.05) - 0.4) * 0.8 * w.forest); // ombres bleutées
    if (w.volcanic > 0.5 && fbm(x * 0.08, z * 0.08) > 0.68) c.lerp(new THREE.Color(0.9, 0.35, 0.1), 0.6);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.ground }));
  mesh.receiveShadow = true;
  scene.add(mesh);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2, WORLD * 2),
    new THREE.MeshStandardMaterial({ color: 0x2f6f84, transparent: true, opacity: 0.8, roughness: 0.08, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER;
  water.material.color.setHex(0x3a8aa8);
  scene.add(water);
}

// --- Végétation & rochers (instanciés) + grille de collision
const colGrid = new Map();
const CELL = 8;
function addCollider(x, z, r) {
  const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  if (!colGrid.has(k)) colGrid.set(k, []);
  colGrid.get(k).push({ x, z, r });
}
function pushOut(p, radius) {
  const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = colGrid.get(`${cx + i},${cz + j}`);
    if (!list) continue;
    for (const o of list) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + radius;
      if (d < m && d > 0.0001) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
    }
  }
}

{
  const dummy = new THREE.Object3D();
  const pines = [], rounds = [], deads = [], rocks = [];
  for (let i = 0; i < 9000 && pines.length + rounds.length + deads.length < 2600; i++) {
    const x = rand(-WORLD + 15, WORLD - 15), z = rand(-WORLD + 15, WORLD - 15);
    const d = Math.hypot(x, z);
    if (d < 48) continue;
    if (Math.abs(x) < 5 && z < -40 && z > -115) continue; // chemin vers l'avant-poste
    if (SPAWNS.some((sp) => sp.at && Math.hypot(x - sp.at[0], z - sp.at[1]) < 34)) continue; // arènes des colosses
    const h = heightAt(x, z);
    if (h < WATER + 0.3) continue;
    const zn = zoneAt(x, z), r = Math.random();
    if (zn === 'forest' && r < 0.55) pines.push([x, h, z]);
    else if (zn === 'plains' && r < 0.12) rounds.push([x, h, z]);
    else if (zn === 'marsh' && r < 0.25) deads.push([x, h, z]);
    else if (zn === 'volcanic' && r < 0.1) deads.push([x, h, z]);
  }
  for (let i = 0; i < 500; i++) {
    const x = rand(-WORLD, WORLD), z = rand(-WORLD, WORLD);
    if (Math.hypot(x, z) < 45) continue;
    const zn = zoneAt(x, z);
    if (zn === 'volcanic' || Math.random() < 0.35) rocks.push([x, heightAt(x, z), z]);
  }

  const trunkG = new THREE.CylinderGeometry(0.22, 0.38, 4, 6); trunkG.translate(0, 2, 0);
  const layers = (k, dy) => mergeGeometries([
    new THREE.ConeGeometry(2.3 * k, 3.4, 8).translate(0, 3.6 + dy, 0),
    new THREE.ConeGeometry(1.75 * k, 3.0, 8).translate(0, 5.5 + dy, 0),
    new THREE.ConeGeometry(1.15 * k, 2.6, 8).translate(0, 7.3 + dy, 0),
  ].map((g) => g.toNonIndexed()));
  const pineG = layers(1, 0);
  const snowG = layers(0.78, 0.45);
  const roundG = new THREE.IcosahedronGeometry(2.4, 0); roundG.translate(0, 4.2, 0);
  const deadG = new THREE.CylinderGeometry(0.15, 0.35, 5, 5); deadG.translate(0, 2.5, 0);
  const rockG = new THREE.DodecahedronGeometry(1.4, 0);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x6a4a2c, map: rep(TEX.bark, 1, 2) });
  const leafM = new THREE.MeshLambertMaterial({ color: 0xffffff, map: rep(TEX.leaves, 3) });
  const deadM = new THREE.MeshLambertMaterial({ color: 0x4b4238, map: rep(TEX.bark, 1, 3) });
  const rockM = new THREE.MeshLambertMaterial({ color: 0xffffff, map: TEX.stone });

  function inst(geo, mat, list, colorFn, scaleFn, collR) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    m.castShadow = true; m.receiveShadow = true;
    const col = new THREE.Color();
    list.forEach(([x, y, z], i) => {
      const s = scaleFn ? scaleFn() : rand(0.8, 1.3);
      dummy.position.set(x, y - 0.2, z);
      dummy.rotation.set(0, rand(0, 6.28), 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (colorFn) m.setColorAt(i, colorFn(col));
      if (collR) addCollider(x, z, collR * s);
    });
    scene.add(m);
  }
  const allTrees = [...pines, ...rounds];
  const scales = allTrees.map(() => rand(0.8, 1.4));
  let si = 0;
  inst(trunkG, trunkM, allTrees, null, () => scales[si++], 0.6);
  si = 0;
  inst(pineG, leafM, pines, (c) => c.setHSL(rand(0.44, 0.52), 0.42, rand(0.16, 0.24)), () => scales[si++]);
  si = 0;
  inst(snowG, new THREE.MeshLambertMaterial({ color: 0xf4f6ff }), pines, null, () => scales[si++]);
  inst(roundG, leafM, rounds, (c) => c.setHSL(rand(0.22, 0.3), 0.55, rand(0.3, 0.42)), () => scales[si++]);
  inst(deadG, deadM, deads, null, null, 0.4);
  inst(rockG, rockM, rocks, (c) => c.setHSL(0.08, 0.05, rand(0.8, 1.0)), () => rand(0.6, 2.2), 1.3);
}

// --- Touffes d'herbe (un seul appel de dessin pour des milliers de touffes)
{
  const a = new THREE.PlaneGeometry(1.4, 0.9).translate(0, 0.42, 0).toNonIndexed();
  const b = a.clone().rotateY(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const A = a.attributes[k], B = b.attributes[k];
    const arr = new Float32Array(A.array.length + B.array.length); arr.set(A.array); arr.set(B.array, A.array.length);
    geo.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
  }
  // Normales vers le haut : éclairage homogène comme le sol
  const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  // Matériau non éclairé : les deux faces de la touffe ont la même teinte
  const mat = new THREE.MeshBasicMaterial({ alphaMap: TEX.grass, alphaTest: 0.5, side: THREE.DoubleSide });
  const N = 7000, m = new THREE.InstancedMesh(geo, mat, N);
  const dm = new THREE.Object3D(), col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const x = rand(-WORLD + 15, WORLD - 15), z = rand(-WORLD + 15, WORLD - 15), h = heightAt(x, z), d = Math.hypot(x, z);
    if (h < WATER + 0.4 || d < 16) continue;
    const zn = zoneAt(x, z);
    if (zn === 'volcanic' || zn === 'forest' || (zn === 'village' && Math.random() < 0.6)) continue;
    dm.position.set(x, h - 0.05, z); dm.rotation.set(0, rand(0, 3), 0); dm.scale.setScalar(rand(0.7, 1.4)); dm.updateMatrix();
    m.setMatrixAt(n, dm.matrix);
    col.copy(ZCOL[zn === 'village' ? 'plains' : zn]).multiplyScalar(rand(0.45, 0.65));
    m.setColorAt(n, col);
    n++;
  }
  m.count = n;
  scene.add(m);
}

// --- Fleurs (taches roses, rouges, violettes et jaunes)
{
  const geo = new THREE.IcosahedronGeometry(0.22, 0).translate(0, 0.3, 0);
  const N = 2600, m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ emissive: 0x220a18 }), N);
  const dm = new THREE.Object3D(), col = new THREE.Color(), palette = [0xff5a8a, 0xe0304a, 0xb06aff, 0xffd84a, 0xff8ad0];
  let n = 0;
  for (let i = 0; i < 400 && n < N; i++) {
    // Les fleurs poussent en massifs
    const cx = rand(-WORLD + 20, WORLD - 20), cz = rand(-WORLD + 20, WORLD - 20), zn = zoneAt(cx, cz);
    if (!(zn === 'plains' || zn === 'marsh' || zn === 'forest')) continue;
    const hex = palette[Math.floor(Math.random() * palette.length)];
    for (let j = 0; j < 9 && n < N; j++) {
      const x = cx + rand(-4, 4), z = cz + rand(-4, 4), h = heightAt(x, z);
      if (h < WATER + 0.3) continue;
      dm.position.set(x, h, z); dm.scale.setScalar(rand(0.7, 1.5)); dm.updateMatrix();
      m.setMatrixAt(n, dm.matrix); m.setColorAt(n, col.setHex(hex)); n++;
    }
  }
  m.count = n;
  scene.add(m);
}

// --- Grandes formations rocheuses
{
  const geo = new THREE.CylinderGeometry(3.5, 6, 18, 7, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * rand(0.85, 1.15), pos.getY(i), pos.getZ(i) * rand(0.85, 1.15));
  geo.computeVertexNormals();
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, map: rep(TEX.stone, 5, 7) }), 40);
  m.castShadow = m.receiveShadow = true;
  const dm = new THREE.Object3D(), col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < 600 && n < 40; i++) {
    const x = rand(-WORLD + 30, WORLD - 30), z = rand(-WORLD + 30, WORLD - 30);
    if (Math.hypot(x, z) < 70 || (Math.abs(x) < 12 && z < -30 && z > -120)) continue;
    if (SPAWNS.some((sp) => sp.at && Math.hypot(x - sp.at[0], z - sp.at[1]) < 40)) continue;
    const h = heightAt(x, z);
    if (h < WATER + 0.5) continue;
    const s = rand(0.7, 1.6);
    dm.position.set(x, h + 6 * s, z); dm.rotation.set(rand(-0.08, 0.08), rand(0, 6), rand(-0.08, 0.08)); dm.scale.set(s, s * rand(0.8, 1.5), s); dm.updateMatrix();
    m.setMatrixAt(n, dm.matrix);
    const zn = zoneAt(x, z);
    m.setColorAt(n, col.setHex(zn === 'volcanic' ? 0xb08a8a : zn === 'forest' ? 0xe0e0ff : 0xf0d8cc));
    addCollider(x, z, 5.5 * s);
    n++;
  }
  m.count = n;
  scene.add(m);
}

// --- Îles flottantes à l'horizon (non affectées par le brouillard)
{
  const tint = new THREE.Color(0xb8a0d0);
  const rockM = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x8a7a90).lerp(tint, 0.35), map: rep(TEX.stone, 2), fog: false });
  const grassM = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x6aa070).lerp(tint, 0.35), fog: false });
  const pineM = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x2a5a5a).lerp(tint, 0.3), fog: false });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand(-0.2, 0.2), r = rand(430, 560), s = rand(14, 34);
    const g = new THREE.Group();
    const under = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 7, 2), rockM); under.rotation.x = Math.PI; under.position.y = -1.2;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1, 0.25, 7), grassM);
    g.add(under, top);
    for (let k = 0; k < 4; k++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), pineM);
      t.position.set(rand(-0.6, 0.6), 0.3, rand(-0.6, 0.6)); g.add(t);
    }
    g.scale.setScalar(s);
    g.position.set(Math.cos(a) * r, rand(60, 150), Math.sin(a) * r);
    g.rotation.y = rand(0, 6);
    scene.add(g);
  }
}

// --- Neige qui tombe dans la Sylve Givrée
const snow = (() => {
  const N = 1200, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rand(-35, 35); pos[i * 3 + 1] = rand(0, 30); pos[i * 3 + 2] = rand(-35, 35); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();
function updateSnow(dt) {
  const w = zoneWeights(player.pos.x, player.pos.z).forest;
  const target = w > 0.35 ? 0.85 : 0;
  snow.material.opacity += (target - snow.material.opacity) * Math.min(1, dt * 2);
  snow.visible = snow.material.opacity > 0.02;
  if (!snow.visible) return;
  snow.position.set(player.pos.x, player.pos.y - 5, player.pos.z);
  const p = snow.geometry.attributes.position, t = clock.elapsedTime;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i) - dt * 2.2;
    if (y < 0) y += 30;
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(t + i) * dt * 0.4);
  }
  p.needsUpdate = true;
}

// --- Village & avant-poste
const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
function house(x, z, rot, wallC = 0xcbb08a, roofC = 0x8a3b2a) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), new THREE.MeshLambertMaterial({ color: wallC, map: rep(TEX.planks, 2, 1) })); walls.position.y = 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.9, 6.4), new THREE.MeshLambertMaterial({ color: 0xb0aaa0, map: rep(TEX.stone, 2, 0.3) })); base.position.y = 0.3;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.5, 4, 1), new THREE.MeshLambertMaterial({ color: roofC, map: rep(TEX.tiles, 3, 2) })); roof.position.y = 5.75; roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), new THREE.MeshLambertMaterial({ color: 0x6a4020, map: TEX.planks })); door.position.set(0, 1.2, 3.05);
  const beamM = new THREE.MeshLambertMaterial({ color: 0x4a2e18, map: TEX.bark });
  for (const [bx, bz] of [[-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4, 0.35), beamM); post.position.set(bx, 2, bz); g.add(post);
  }
  const winM = new THREE.MeshLambertMaterial({ color: 0xffd27a, emissive: 0x6a4010 });
  for (const wx of [-2.2, 2.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), winM); w.position.set(wx, 2.4, 3.03); g.add(w); }
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), new THREE.MeshLambertMaterial({ color: 0x9a948a, map: rep(TEX.stone, 0.5) })); chim.position.set(1.8, 6.2, -1); g.add(chim);
  g.add(walls, base, roof, door);
  g.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  g.position.set(x, heightAt(x, z), z); g.rotation.y = rot;
  scene.add(g);
  addCollider(x, z, 4.2);
}
house(-18, -14, 0.6, 0xd8b890, 0xb04a32); house(18, -16, -0.6, 0xd8b890, 0xb04a32); house(-22, 12, 2.2, 0xc8a880, 0x4a6aa0); house(20, 15, -2.3, 0xd8b890, 0xb04a32); house(0, 26, Math.PI, 0xe0c8a0, 0x6a7b3a);
{
  // Puits & feu de camp
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 14), new THREE.MeshLambertMaterial({ color: 0xb0aaa0, map: rep(TEX.stone, 2, 0.5) }));
  well.position.set(0, 0.6, 0); well.castShadow = true; scene.add(well); addCollider(0, 0, 1.6);
  // Tour de l'avant-poste nord
  const tz = -112, tx = 7;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.6, 10, 10), new THREE.MeshLambertMaterial({ color: 0xa09a90, map: rep(TEX.stone, 3, 3) }));
  tower.position.set(tx, heightAt(tx, tz) + 5, tz); tower.castShadow = true; scene.add(tower); addCollider(tx, tz, 2.7);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2), lambert(0xc98a1e));
  flag.position.set(tx, heightAt(tx, tz) + 11.5, tz + 1); scene.add(flag);
}
// Feux de camp (lumière ponctuelle)
const fires = [];
function campfire(x, z) {
  const y = heightAt(x, z);
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
  f.position.set(x, y + 0.7, z); scene.add(f);
  const l = new THREE.PointLight(0xff9a40, 30, 18, 1.6); l.position.set(x, y + 2, z); scene.add(l);
  fires.push(f);
}
campfire(6, 6); campfire(-4, -108);

// ====================================================================
// Joueur
// ====================================================================
let hunter = makeHero('guerrier');
scene.add(hunter.g);
// Le modèle simple s'affiche tout de suite, puis il est remplacé par le personnage animé dès qu'il est chargé
let heroToken = 0;
function swapHero(h) {
  scene.remove(hunter.g);
  hunter = h;
  hunter.g.position.copy(player.pos);
  hunter.g.rotation.y = player.rot;
  scene.add(hunter.g);
}
function setHeroModel(id) {
  const token = ++heroToken;
  swapHero(makeHero(id));
  loadHero(id).then((h) => { if (token === heroToken) swapHero(h); }).catch((e) => console.warn('Modèle 3D indisponible', e));
}

const player = {
  pos: new THREE.Vector3(0, 0, 8), rot: Math.PI, hp: 100, maxHp: 100, st: 100,
  level: 1, xp: 0, gold: 0, weapon: 0, potions: 3, cls: null,
  atk: 0, atkT: 0, combo: 0, queued: false, hitDone: false, comboTimer: 0,
  dodgeT: 0, dodgeDir: new THREE.Vector3(), skillCd: 0, skillT: 0, potionCd: 0,
  lastHurt: -99, dead: false, inv: {},
};
const xpNext = (l) => Math.round(100 * Math.pow(l, 1.5));
const CLS = () => CLASSES[player.cls || 'guerrier'];
const maxHpFor = (lvl) => CLS().hp + CLS().hpLvl * (lvl - 1);
const playerDmg = () => (10 + 3 * player.level) * (1 + 0.3 * player.weapon) * CLS().dmg;

// ====================================================================
// Monstres
// ====================================================================
const monsters = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 40); ringGeo.rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40); discGeo.rotateX(-Math.PI / 2);
const rectGeo = new THREE.PlaneGeometry(1, 1); rectGeo.rotateX(-Math.PI / 2); rectGeo.translate(0, 0, 0.5);
const teleMat = () => new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.3, depthWrite: false, depthTest: false });

function makeMonsterMesh(def) {
  const g = new THREE.Group();
  const s = def.size;
  const skinTex = def.fur ? TEX.fur : TEX.scales;
  const mat = new THREE.MeshStandardMaterial({ color: def.color, map: rep(skinTex, 2), roughness: 0.85 });
  const mat2 = new THREE.MeshStandardMaterial({ color: def.color2, map: skinTex, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mat);
  body.scale.set(s * 0.8, s * 0.6, s * 1.1); body.position.y = s * 0.9;
  const head = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, s * 0.6, s * 0.7), mat2);
  head.position.set(0, s * 1.0, s * 1.1);
  const eyeM = new THREE.MeshBasicMaterial({ color: def.eye || 0xffe14a });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.08, 6, 6), eyeM);
    eye.position.set(sx * s * 0.25, s * 1.1, s * 1.46); g.add(eye);
    if (def.horns) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(s * 0.12, s * 0.7, 6), lambert(0xe8e0c8));
      horn.position.set(sx * s * 0.3, s * 1.45, s * 1.0); horn.rotation.set(-0.5, 0, sx * -0.4); g.add(horn);
    }
  }
  const legs = [];
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(s * 0.25, s * 0.7, s * 0.25), mat2);
    leg.position.set(lx * s * 0.5, s * 0.35, lz * s * 0.6); g.add(leg); legs.push(leg);
  }
  if (def.spikes) {
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(s * 0.15, s * 0.6, 5), mat2);
      sp.position.set(0, s * 1.45, s * (0.6 - i * 0.35)); sp.rotation.x = -0.3; g.add(sp);
    }
  }
  if (def.tail) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(s * 0.25, s * 1.4, 6), mat);
    tail.position.set(0, s * 0.9, -s * 1.5); tail.rotation.x = -Math.PI / 2 - 0.3; g.add(tail);
  }
  if (def.glow) {
    const l = new THREE.PointLight(def.glow, 25, s * 8, 1.5); l.position.y = s * 1.5; g.add(l);
  }
  g.add(body, head);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // Barre de vie flottante
  const hb = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, transparent: true, opacity: 0.6 }));
  const fgG = new THREE.PlaneGeometry(1.56, 0.13); fgG.translate(0.78, 0, 0);
  const fg = new THREE.Mesh(fgG, new THREE.MeshBasicMaterial({ color: 0xe2473b, depthTest: false }));
  fg.position.x = -0.78; fg.position.z = 0.01;
  bg.renderOrder = fg.renderOrder = 10;
  hb.add(bg, fg);
  hb.position.y = s * 2.1 + 0.6;
  hb.visible = false;
  g.add(hb);
  return { g, legs, hb, fg, body };
}

function spawnMonster(type, x, z, home) {
  const def = MONSTERS[type];
  const m = makeMonsterMesh(def);
  const mon = {
    type, def, mesh: m, pos: new THREE.Vector3(x, heightAt(x, z), z), home: home || new THREE.Vector3(x, 0, z),
    rot: rand(0, 6.28), hp: def.hp, maxHp: def.hp, state: 'idle', t: rand(0, 3), wanderTo: null,
    atk: null, tele: null, cd: rand(0.5, 1.5), dead: false, respawnT: 0, flash: 0, enraged: false, walk: 0, slowT: 0,
  };
  m.g.position.copy(mon.pos);
  scene.add(m.g);
  monsters.push(mon);
  return mon;
}

function randomPointInZone(zone, cx = 0, cz = 0, r = WORLD - 25) {
  for (let i = 0; i < 400; i++) {
    const x = cx + rand(-r, r), z = cz + rand(-r, r);
    if (Math.abs(x) > WORLD - 25 || Math.abs(z) > WORLD - 25) continue;
    if (zoneAt(x, z) === zone && heightAt(x, z) > WATER + 0.3 && Math.hypot(x, z) > 60) return [x, z];
  }
  return [cx, cz];
}

for (const sp of SPAWNS) {
  if (sp.at) { spawnMonster(sp.type, sp.at[0], sp.at[1]); continue; }
  for (let i = 0; i < sp.count; i++) {
    const [x, z] = randomPointInZone(sp.zone);
    spawnMonster(sp.type, x, z);
  }
}

// ====================================================================
// PNJ & objets à ramasser
// ====================================================================
const npcs = {};
function makeMarker() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(1.6, 1.6, 1); sp.renderOrder = 20;
  sp.userData = { cv, tex, cur: null };
  return sp;
}
function setMarker(sp, ch, color) {
  const key = ch + color;
  if (sp.userData.cur === key) return;
  sp.userData.cur = key;
  const ctx = sp.userData.cv.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  if (ch) {
    ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(ch, 32, 34);
    ctx.fillStyle = color; ctx.fillText(ch, 32, 34);
  }
  sp.userData.tex.needsUpdate = true;
}
for (const id in NPCS) {
  const n = NPCS[id];
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 8), lambert(n.color)); robe.position.y = 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), lambert(0xe8c4a0)); head.position.y = 2.3;
  g.add(robe, head);
  if (n.hat) { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 8), lambert(n.hat)); hat.position.y = 2.8; g.add(hat); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const marker = makeMarker(); marker.position.y = 3.8; g.add(marker);
  const [x, z] = n.at;
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = n.face || 0;
  scene.add(g);
  addCollider(x, z, 0.7);
  npcs[id] = { id, ...n, g, marker, pos: g.position };
}

const pickups = [];
{
  const geos = { flower: new THREE.OctahedronGeometry(0.4, 0), moss: new THREE.DodecahedronGeometry(0.4, 0), amber: new THREE.OctahedronGeometry(0.5, 0) };
  for (const id in ITEMS) {
    const it = ITEMS[id];
    const mat = new THREE.MeshBasicMaterial({ color: it.color });
    for (let i = 0; i < it.count; i++) {
      const [x, z] = randomPointInZone(it.zone);
      const m = new THREE.Mesh(geos[it.shape], mat);
      const y = heightAt(x, z) + 0.8;
      m.position.set(x, y, z);
      scene.add(m);
      pickups.push({ id, mesh: m, base: y, active: true, t: 0 });
    }
  }
}

// ====================================================================
// Quêtes & sauvegarde
// ====================================================================
let Q = {}; // id -> { s: 'active'|'done', p: [..] }
const SAVE_KEY = 'echo-colosses-v1';
function save() {
  const { level, xp, gold, weapon, potions, inv, cls } = player;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ level, xp, gold, weapon, potions, inv, cls, Q })); } catch (e) { /* stockage indisponible */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!d) return;
    Object.assign(player, { level: d.level, xp: d.xp, gold: d.gold, weapon: d.weapon, potions: d.potions, inv: d.inv || {}, cls: CLASSES[d.cls] ? d.cls : null });
    Q = d.Q || {};
  } catch (e) { /* sauvegarde illisible : on repart de zéro */ }
  player.maxHp = maxHpFor(player.level);
  player.hp = player.maxHp;
}
load();
if (player.cls) setHeroModel(player.cls);

const qById = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
const qAvailable = (q) => !Q[q.id] && (q.req || []).every((r) => Q[r]?.s === 'done') && player.level >= (q.minLvl || 1);
const qReady = (q) => Q[q.id]?.s === 'active' && q.obj.every((o, i) => Q[q.id].p[i] >= o.n);
const activeQuests = () => QUESTS.filter((q) => Q[q.id]?.s === 'active');

function progress(kind, id) {
  let changed = false;
  for (const q of activeQuests()) {
    q.obj.forEach((o, i) => {
      if (o.t === kind && o.id === id && Q[q.id].p[i] < o.n) {
        Q[q.id].p[i]++;
        changed = true;
        if (Q[q.id].p[i] === o.n) toast(`✔ ${objText(o)} (${o.n}/${o.n})`);
        if (qReady(q)) toast(`Quête prête : retournez voir ${NPCS[q.turnin].name}`);
      }
    });
  }
  if (changed) { save(); renderTracker(); }
  return changed;
}
function objText(o) {
  if (o.t === 'kill') return `Vaincre : ${MONSTERS[o.id].name}`;
  if (o.t === 'collect') return `Récolter : ${ITEMS[o.id].name}`;
  return '';
}
function rewardText(r) {
  const parts = [];
  if (r.xp) parts.push(`${r.xp} XP`);
  if (r.gold) parts.push(`${r.gold} 🪙`);
  if (r.weapon) parts.push(`Arme améliorée (+${r.weapon})`);
  if (r.potions) parts.push(`+${r.potions} potions`);
  return 'Récompense : ' + parts.join(' · ');
}

function renderTracker() {
  const el = $('tracker');
  el.innerHTML = activeQuests().map((q) => {
    const lines = q.obj.map((o, i) => {
      const p = Q[q.id].p[i], ok = p >= o.n;
      return `<div class="${ok ? 'ok' : ''}">${objText(o)} ${Math.min(p, o.n)}/${o.n}</div>`;
    });
    if (qReady(q)) lines.push(`<div class="ok">→ Parler à ${NPCS[q.turnin].name}</div>`);
    return `<div class="q"><b>${q.title}</b>${lines.join('')}</div>`;
  }).join('');
}

// ====================================================================
// Interface : dialogues, journal, toasts, dégâts
// ====================================================================
let uiOpen = false;
function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = msg;
  const wrap = document.createElement('div'); wrap.appendChild(d);
  $('toasts').appendChild(wrap);
  setTimeout(() => wrap.remove(), 3000);
}
const dmgNums = [];
const _v = new THREE.Vector3();
function dmgNum(pos, text, cls = '') {
  const el = document.createElement('div');
  el.className = 'dn ' + cls; el.textContent = text;
  $('dmg').appendChild(el);
  dmgNums.push({ el, p: pos.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6))), t: 0 });
}
function updateDmgNums(dt) {
  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i];
    d.t += dt; d.p.y += dt * 2;
    _v.copy(d.p).project(camera);
    if (d.t > 0.9 || _v.z > 1) { d.el.remove(); dmgNums.splice(i, 1); continue; }
    d.el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px';
    d.el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px';
    d.el.style.opacity = 1 - Math.max(0, d.t - 0.5) * 2.5;
  }
}

function openDialog(npc) {
  uiOpen = true;
  const dlg = $('dialog');
  $('dlgName').textContent = npc.name;
  const btns = $('dlgBtns'); btns.innerHTML = '';
  const addBtn = (label, fn, ghost) => {
    const b = document.createElement('button'); b.textContent = label; if (ghost) b.className = 'ghost';
    b.onclick = fn; btns.appendChild(b);
  };
  const close = () => { dlg.classList.add('hidden'); uiOpen = false; };

  // Priorité : rendre une quête, puis en proposer une, sinon bavarder
  const turnin = QUESTS.find((q) => q.turnin === npc.id && qReady(q));
  const offer = QUESTS.find((q) => q.giver === npc.id && qAvailable(q));
  const locked = QUESTS.find((q) => q.giver === npc.id && !Q[q.id] && (q.req || []).every((r) => Q[r]?.s === 'done') && player.level < (q.minLvl || 1));
  $('dlgRew').textContent = '';
  if (turnin) {
    $('dlgTitle').textContent = turnin.title;
    $('dlgText').textContent = turnin.done;
    $('dlgRew').textContent = rewardText(turnin.rew);
    addBtn('Terminer la quête', () => { completeQuest(turnin); close(); });
  } else if (offer) {
    $('dlgTitle').textContent = offer.title;
    $('dlgText').textContent = offer.text;
    $('dlgRew').textContent = rewardText(offer.rew);
    addBtn('Plus tard', close, true);
    addBtn('Accepter', () => {
      Q[offer.id] = { s: 'active', p: offer.obj.map(() => 0) };
      toast(`Nouvelle quête : ${offer.title}`);
      save(); renderTracker(); close();
    });
  } else {
    $('dlgTitle').textContent = '';
    let line = npc.idle;
    if (locked) line = `Reviens quand tu seras plus aguerri (niveau ${locked.minLvl}).`;
    const pending = QUESTS.find((q) => q.turnin === npc.id && Q[q.id]?.s === 'active');
    if (pending) line = pending.remind || 'Alors, ça avance ?';
    $('dlgText').textContent = line;
    addBtn('Au revoir', close);
  }
  // L'herboriste remplit toujours les potions
  if (npc.id === 'lysa' && player.potions < 3) {
    player.potions = 3; updatePotions(); save();
    $('dlgText').textContent += ' (Lysa remplit vos potions.)';
  }
  dlg.classList.remove('hidden');
}

function completeQuest(q) {
  Q[q.id].s = 'done';
  const r = q.rew;
  toast(`Quête terminée : ${q.title}`);
  if (r.gold) player.gold += r.gold;
  if (r.weapon) { player.weapon += r.weapon; toast('⚒ Votre hache est plus tranchante !'); }
  if (r.potions) { player.potions += r.potions; updatePotions(); }
  for (const o of q.obj) if (o.t === 'collect') player.inv[o.id] = Math.max(0, (player.inv[o.id] || 0) - o.n);
  if (r.xp) gainXp(r.xp);
  if (q.final) setTimeout(() => toast('🏆 Les Terres Sauvages sont sauvées. Vous êtes une légende !'), 1200);
  save(); renderTracker();
}

function gainXp(n) {
  player.xp += n;
  while (player.xp >= xpNext(player.level)) {
    player.xp -= xpNext(player.level);
    player.level++;
    player.maxHp = maxHpFor(player.level); player.hp = player.maxHp;
    toast(`⭐ Niveau ${player.level} !`);
  }
  save();
}

function openLog() {
  uiOpen = true;
  const list = QUESTS.filter((q) => Q[q.id]).map((q) => {
    const st = Q[q.id];
    const objs = q.obj.map((o, i) => `${objText(o)} ${Math.min(st.p[i], o.n)}/${o.n}`).join('<br>');
    return `<div class="q ${st.s === 'done' ? 'done' : ''}"><b>${q.title}</b> ${st.s === 'done' ? '✔' : ''}<br><small>${q.text}</small><br>${objs || `Parler à ${NPCS[q.turnin].name}`}</div>`;
  });
  const avail = QUESTS.filter(qAvailable).map((q) => `<div class="q">❗ <b>${q.title}</b> — voir ${NPCS[q.giver].name}</div>`);
  $('logList').innerHTML = (list.concat(avail).join('') || '<p>Aucune quête pour le moment. Cherchez les ❗ au village.</p>')
    + `<p><small>${CLS().icon} ${CLS().name} · Niveau ${player.level} · Arme +${player.weapon} · ${player.gold} 🪙</small></p>`;
  $('log').classList.remove('hidden');
}
$('bLog').onclick = openLog;
$('bClass').onclick = () => { $('log').classList.add('hidden'); uiOpen = false; showClassSelect(); };
$('bLogClose').onclick = () => { $('log').classList.add('hidden'); uiOpen = false; };
$('bReset').onclick = () => {
  if (!confirm('Effacer la progression et recommencer ?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ }
  location.reload();
};
function updatePotions() { $('potN').textContent = player.potions; }

// ====================================================================
// Entrées : tactile + clavier + souris
// ====================================================================
const input = { mx: 0, mz: 0, keys: {} };
let camYaw = Math.PI, camPitch = 0.42, camDist = 11;
let joyId = null, joyO = { x: 0, y: 0 }, camId = null, camLast = { x: 0, y: 0 };
const joy = $('joy'), knob = $('knob');

const touchLayer = $('touch');
touchLayer.addEventListener('pointerdown', (e) => {
  if (uiOpen) return;
  if (e.clientX < innerWidth * 0.45 && joyId === null) {
    joyId = e.pointerId; joyO = { x: e.clientX, y: e.clientY };
    joy.style.left = (e.clientX - 60) + 'px'; joy.style.top = (e.clientY - 60) + 'px'; joy.style.bottom = 'auto';
    joy.style.opacity = 1;
  } else if (camId === null) {
    camId = e.pointerId; camLast = { x: e.clientX, y: e.clientY };
  }
  touchLayer.setPointerCapture(e.pointerId);
});
touchLayer.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyO.x, dy = e.clientY - joyO.y;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    input.mx = dx / max; input.mz = dy / max;
  } else if (e.pointerId === camId) {
    camYaw -= (e.clientX - camLast.x) * 0.006;
    camPitch = clamp(camPitch + (e.clientY - camLast.y) * 0.004, 0.1, 1.2);
    camLast = { x: e.clientX, y: e.clientY };
  }
});
const endPtr = (e) => {
  if (e.pointerId === joyId) {
    joyId = null; input.mx = input.mz = 0; knob.style.transform = '';
    joy.style.left = '30px'; joy.style.top = ''; joy.style.bottom = '40px'; joy.style.opacity = '';
  }
  if (e.pointerId === camId) camId = null;
};
touchLayer.addEventListener('pointerup', endPtr);
touchLayer.addEventListener('pointercancel', endPtr);
window.addEventListener('wheel', (e) => { camDist = clamp(camDist + e.deltaY * 0.01, 6, 20); }, { passive: true });

const bindBtn = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!uiOpen) fn(); });
bindBtn('bAtk', attack);
bindBtn('bDodge', dodge);
bindBtn('bSkill', skill);
bindBtn('bPotion', potion);
bindBtn('bInteract', interact);

window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (uiOpen) { if (e.code === 'Escape') { $('dialog').classList.add('hidden'); $('log').classList.add('hidden'); uiOpen = false; } return; }
  if (e.repeat) return;
  if (e.code === 'KeyJ') attack();
  if (e.code === 'Space') { e.preventDefault(); dodge(); }
  if (e.code === 'KeyK') skill();
  if (e.code === 'KeyR') potion();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyL') openLog();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

// ====================================================================
// Actions du joueur
// ====================================================================
function nearestMonster(range) {
  let best = null, bd = range;
  for (const m of monsters) {
    if (m.dead) continue;
    const d = m.pos.distanceTo(player.pos) - m.def.size;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
function attack() {
  if (player.dead || player.dodgeT > 0 || player.skillT > 0) return;
  if (player.atk > 0) { if (player.atkT > 0.18) player.queued = true; return; }
  startSwing();
}
function startSwing() {
  player.combo = player.comboTimer > 0 ? (player.combo % 3) + 1 : 1;
  player.atk = player.combo; player.atkT = 0; player.hitDone = false; player.queued = false;
  const t = nearestMonster(CLS().kind === 'ranged' ? CLS().range : 7);
  if (t) player.rot = Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
  if (hunter.anim) {
    const list = hunter.cfg.atk;
    hunter.play(list[(player.combo - 1) % list.length], { once: true, dur: CLS().swing * (player.combo === 3 ? 1.4 : 1) * 1.1 });
  }
}
function dodge() {
  const cost = CLS().dodgeCost;
  if (player.dead || player.dodgeT > 0 || player.st < cost) return;
  player.st -= cost;
  player.atk = 0; player.queued = false;
  let dx = input.mx, dz = input.mz;
  const kx = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.KeyQ || input.keys.ArrowLeft ? 1 : 0);
  const kz = (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) - (input.keys.KeyW || input.keys.KeyZ || input.keys.ArrowUp ? 1 : 0);
  dx += kx; dz += kz;
  if (Math.hypot(dx, dz) < 0.1) player.dodgeDir.set(Math.sin(player.rot), 0, Math.cos(player.rot));
  else player.dodgeDir.copy(moveDir(dx, dz));
  player.rot = Math.atan2(player.dodgeDir.x, player.dodgeDir.z);
  player.dodgeT = 0.35;
  if (hunter.anim) hunter.play('Dodge_Forward', { once: true, dur: 0.45 });
}
function skill() {
  if (player.dead || player.skillCd > 0 || player.dodgeT > 0) return;
  const S = CLS().skill;
  player.skillCd = S.cd; player.skillT = 0.6; player.atk = 0; player.hitDone = false;
  if (hunter.anim) hunter.play(hunter.cfg.skill, { once: true, dur: 0.7 });
  if (S.type === 'shadow') shadowStep(S);
}
function potion() {
  if (player.dead || player.potions <= 0 || player.potionCd > 0 || player.hp >= player.maxHp) return;
  player.potions--; player.potionCd = 1.5;
  const heal = Math.round(player.maxHp * 0.5);
  player.hp = Math.min(player.maxHp, player.hp + heal);
  dmgNum(player.pos.clone().setY(player.pos.y + 2.5), `+${heal}`, 'heal');
  updatePotions(); save();
}
let interactTarget = null;
function interact() {
  if (!interactTarget || uiOpen) return;
  if (interactTarget.kind === 'npc') openDialog(interactTarget.ref);
  else {
    const p = interactTarget.ref;
    p.active = false; p.mesh.visible = false; p.t = 45;
    player.inv[p.id] = (player.inv[p.id] || 0) + 1;
    if (!progress('collect', p.id)) { player.gold += 3; dmgNum(p.mesh.position, '+3 🪙'); }
    else dmgNum(p.mesh.position, ITEMS[p.id].name);
    save();
  }
}

const _f = new THREE.Vector3();
function moveDir(ix, iz) {
  // Transforme l'entrée écran en direction monde relative à la caméra
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = -fz, rz = fx;
  return _f.set(rx * ix - fx * iz, 0, rz * ix - fz * iz).normalize();
}

function hitMonster(m, dmg, crit) {
  if (m.dead) return 0;
  const d = Math.round(dmg * (crit ? 1.6 : 1) * rand(0.9, 1.1));
  m.hp -= d; m.flash = 0.12;
  if (m.state === 'idle' || m.state === 'return') m.state = 'chase';
  dmgNum(m.pos.clone().setY(m.pos.y + m.def.size * 2), d, crit ? 'crit' : '');
  if (m.def.boss && !m.enraged && m.hp < m.maxHp * 0.4) { m.enraged = true; toast(`${m.def.name} entre en furie !`); }
  if (m.hp <= 0) killMonster(m);
  return d;
}
function killMonster(m) {
  m.dead = true; m.state = 'dead'; m.respawnT = m.def.boss ? 120 : 30;
  clearTele(m);
  m.mesh.g.visible = false;
  const lvlDiff = player.level - m.def.lvl;
  const xp = Math.round(m.def.xp * (lvlDiff > 3 ? 0.3 : 1));
  gainXp(xp);
  player.gold += m.def.gold;
  dmgNum(m.pos.clone().setY(m.pos.y + 1.5), `+${xp} XP`, 'heal');
  if (m.def.boss) toast(`🏆 ${m.def.name} est vaincu !`);
  progress('kill', m.type);
  save();
}
function hurtPlayer(dmg, from) {
  if (player.dead || player.dodgeT > 0 || (player.skillT > 0 && CLS().skill.type === 'shadow')) return;
  player.hp -= dmg; player.lastHurt = clock.elapsedTime;
  dmgNum(player.pos.clone().setY(player.pos.y + 2.4), `-${dmg}`, 'hurt');
  if (from) { // petit recul
    const dx = player.pos.x - from.x, dz = player.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    player.pos.x += dx / d * 1.2; player.pos.z += dz / d * 1.2;
  }
  if (player.hp <= 0) die();
}
function die() {
  player.dead = true; player.hp = 0;
  if (hunter.anim) hunter.play('Death_A', { once: true });
  $('dead').classList.remove('hidden');
  for (const m of monsters) { clearTele(m); if (!m.dead) { m.state = 'return'; m.hp = m.maxHp; m.enraged = false; } }
  setTimeout(() => {
    player.gold = Math.floor(player.gold * 0.9);
    player.pos.set(0, 0, 8); player.hp = player.maxHp; player.st = 100; player.dead = false;
    if (hunter.anim) hunter.play(hunter.cfg.idle, { once: false });
    player.potions = Math.max(player.potions, 1); updatePotions();
    $('dead').classList.add('hidden');
    save();
  }, 2500);
}

// ====================================================================
// IA des monstres
// ====================================================================
function clearTele(m) { if (m.tele) { scene.remove(m.tele); m.tele.geometry !== ringGeo && m.tele.material.dispose(); m.tele = null; } }

function startAttack(m) {
  const atks = m.def.attacks;
  const dist = m.pos.distanceTo(player.pos);
  // Choix pondéré selon la distance
  const usable = atks.filter((a) => dist <= (a.maxRange || a.range + m.def.size + 1.5) && (!a.minRange || dist >= a.minRange));
  if (!usable.length) return false;
  const a = usable[Math.floor(Math.random() * usable.length)];
  const fury = m.enraged ? 0.75 : 1;
  m.rot = Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z);
  const fwd = new THREE.Vector3(Math.sin(m.rot), 0, Math.cos(m.rot));
  m.atk = { a, t: 0, wind: a.windup * fury, fwd };
  m.state = 'windup';
  let mesh;
  if (a.type === 'charge') {
    mesh = new THREE.Mesh(rectGeo, teleMat());
    mesh.scale.set(a.width, 1, a.length);
    mesh.rotation.y = m.rot;
    mesh.position.set(m.pos.x, 0, m.pos.z);
    m.atk.origin = m.pos.clone();
  } else {
    const r = a.type === 'bite' ? m.def.size * 1.2 + 0.6 : a.radius;
    const c = a.type === 'bite' ? m.pos.clone().addScaledVector(fwd, m.def.size * 1.1 + 0.8) : (a.type === 'leap' ? player.pos.clone() : m.pos.clone());
    mesh = new THREE.Mesh(discGeo, teleMat());
    mesh.scale.set(r, 1, r);
    mesh.position.set(c.x, 0, c.z);
    m.atk.center = c; m.atk.r = r;
  }
  mesh.position.y = heightAt(mesh.position.x, mesh.position.z) + 0.15;
  mesh.renderOrder = 5;
  scene.add(mesh); m.tele = mesh;
  return true;
}

function resolveAttack(m) {
  const { a } = m.atk;
  const dmg = Math.round(a.dmg * (m.enraged ? 1.25 : 1));
  if (a.type === 'charge') {
    // Le joueur est-il dans le rectangle de charge ?
    const o = m.atk.origin, f = m.atk.fwd;
    const rx = player.pos.x - o.x, rz = player.pos.z - o.z;
    const along = rx * f.x + rz * f.z, side = Math.abs(rx * f.z - rz * f.x);
    if (along > 0 && along < a.length && side < a.width / 2 + 0.4) hurtPlayer(dmg, m.pos);
    m.state = 'charging'; m.atk.t = 0;
    m.atk.target = o.clone().addScaledVector(f, a.length - m.def.size);
  } else {
    const c = m.atk.center;
    const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
    if (a.type === 'leap') { m.pos.x = c.x; m.pos.z = c.z; }
    if (d < m.atk.r + 0.4) hurtPlayer(dmg, c);
    m.state = 'recover'; m.t = a.recover || 0.8;
    if (a.type !== 'bite') shake = 0.35;
  }
  clearTele(m);
}

function updateMonster(m, dt) {
  if (m.dead) {
    m.respawnT -= dt;
    if (m.respawnT <= 0) {
      m.dead = false; m.hp = m.maxHp; m.enraged = false; m.state = 'idle';
      m.pos.set(m.home.x, heightAt(m.home.x, m.home.z), m.home.z); m.mesh.g.visible = true;
    }
    return;
  }
  const def = m.def, toP = player.pos.distanceTo(m.pos), homeD = Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z);
  m.slowT = Math.max(0, m.slowT - dt);
  const speed = def.speed * (m.enraged ? 1.3 : 1) * (m.slowT > 0 ? 0.45 : 1);
  let moving = false;
  m.cd -= dt;

  const goTo = (tx, tz, sp) => {
    const dx = tx - m.pos.x, dz = tz - m.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    const tr = Math.atan2(dx, dz);
    m.rot += angDiff(m.rot, tr) * Math.min(1, dt * 8);
    m.pos.x += Math.sin(m.rot) * sp * dt; m.pos.z += Math.cos(m.rot) * sp * dt;
    moving = true;
    return false;
  };

  switch (m.state) {
    case 'idle':
      m.t -= dt;
      if (m.t <= 0) {
        m.wanderTo = Math.random() < 0.6 ? [m.home.x + rand(-12, 12), m.home.z + rand(-12, 12)] : null;
        m.t = rand(2, 5);
      }
      if (m.wanderTo) { if (goTo(m.wanderTo[0], m.wanderTo[1], speed * 0.35)) m.wanderTo = null; }
      if (!player.dead && toP < def.aggro) m.state = 'chase';
      break;
    case 'chase':
      if (player.dead || homeD > def.leash) { m.state = 'return'; break; }
      if (m.cd <= 0 && startAttack(m)) break;
      if (toP > def.size + 1.6) goTo(player.pos.x, player.pos.z, speed);
      else m.rot += angDiff(m.rot, Math.atan2(player.pos.x - m.pos.x, player.pos.z - m.pos.z)) * Math.min(1, dt * 6);
      break;
    case 'windup': {
      m.atk.t += dt;
      const k = m.atk.t / m.atk.wind;
      if (m.tele) m.tele.material.opacity = 0.2 + 0.45 * k;
      m.mesh.g.position.y = m.pos.y + (m.atk.a.type === 'leap' ? 0 : -0.15 * Math.sin(k * Math.PI));
      if (k >= 1) resolveAttack(m);
      break;
    }
    case 'charging':
      m.atk.t += dt;
      if (goTo(m.atk.target.x, m.atk.target.z, def.speed * 4) || m.atk.t > 0.8) { m.state = 'recover'; m.t = 1.0; shake = 0.3; }
      break;
    case 'recover':
      m.t -= dt;
      if (m.t <= 0) { m.state = 'chase'; m.cd = rand(0.6, 1.6) * (m.enraged ? 0.6 : 1); }
      break;
    case 'return':
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.2 * dt);
      if (goTo(m.home.x, m.home.z, speed * 1.2)) { m.state = 'idle'; m.enraged = false; }
      break;
  }

  // Séparation simple avec le joueur
  const dx = m.pos.x - player.pos.x, dz = m.pos.z - player.pos.z, d = Math.hypot(dx, dz), minD = def.size * 0.9 + 0.5;
  if (d < minD && d > 0.01 && m.state !== 'charging') { m.pos.x = player.pos.x + dx / d * minD; m.pos.z = player.pos.z + dz / d * minD; }

  m.pos.y = Math.max(heightAt(m.pos.x, m.pos.z), WATER - 0.6);
  const g = m.mesh.g;
  g.position.x = m.pos.x; g.position.z = m.pos.z;
  if (m.state !== 'windup') g.position.y = m.pos.y;
  g.rotation.y = m.rot;
  if (moving) { m.walk += dt * speed * 2; m.mesh.legs.forEach((l, i) => { l.rotation.x = Math.sin(m.walk + (i % 2) * Math.PI) * 0.6; }); }
  // Flash de dégâts
  m.flash -= dt;
  m.mesh.body.material.emissive.setHex(m.flash > 0 ? 0x884422 : m.slowT > 0 ? 0x1a3a66 : (m.enraged ? 0x331000 : 0));
  // Barre de vie
  const show = m.hp < m.maxHp && toP < 40;
  m.mesh.hb.visible = show && !def.boss;
  if (show) { m.mesh.fg.scale.x = Math.max(0.001, m.hp / m.maxHp); m.mesh.hb.quaternion.copy(camera.quaternion).premultiply(g.quaternion.clone().invert()); }
}

// ====================================================================
// Mini-carte
// ====================================================================
const mapCv = $('map'), mapCtx = mapCv.getContext('2d');
const mapBg = document.createElement('canvas'); mapBg.width = mapBg.height = 140;
{
  const ctx = mapBg.getContext('2d'), img = ctx.createImageData(140, 140);
  for (let j = 0; j < 140; j++) for (let i = 0; i < 140; i++) {
    const x = (i / 140) * WORLD * 2 - WORLD, z = (j / 140) * WORLD * 2 - WORLD;
    const h = heightAt(x, z);
    let c = ZCOL[zoneAt(x, z)];
    let r = c.r, g = c.g, b = c.b;
    if (h < WATER) { r = 0.25; g = 0.5; b = 0.6; }
    const k = clamp(0.8 + h * 0.012, 0.5, 1.3);
    const o = (j * 140 + i) * 4;
    img.data[o] = r * 255 * k; img.data[o + 1] = g * 255 * k; img.data[o + 2] = b * 255 * k; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const w2m = (v) => (v + WORLD) / (WORLD * 2) * 140;
function drawMap() {
  mapCtx.drawImage(mapBg, 0, 0);
  // Points d'intérêt : PNJ avec quête, boss
  for (const id in npcs) {
    const n = npcs[id];
    const ch = n.marker.userData.cur;
    if (!ch) continue;
    mapCtx.fillStyle = ch.startsWith('?') ? '#7dff7a' : '#ffd24a';
    mapCtx.fillRect(w2m(n.pos.x) - 2.5, w2m(n.pos.z) - 2.5, 5, 5);
  }
  for (const m of monsters) {
    if (m.dead) continue;
    if (m.def.boss) { mapCtx.fillStyle = '#ff3a2a'; mapCtx.beginPath(); mapCtx.arc(w2m(m.pos.x), w2m(m.pos.z), 4, 0, 7); mapCtx.fill(); }
    else if (m.pos.distanceTo(player.pos) < 50) { mapCtx.fillStyle = '#ff7a6a'; mapCtx.fillRect(w2m(m.pos.x) - 1, w2m(m.pos.z) - 1, 2, 2); }
  }
  // Joueur (flèche)
  const px = w2m(player.pos.x), pz = w2m(player.pos.z);
  mapCtx.save(); mapCtx.translate(px, pz); mapCtx.rotate(-player.rot + Math.PI);
  mapCtx.fillStyle = '#fff'; mapCtx.strokeStyle = '#000';
  mapCtx.beginPath(); mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 4); mapCtx.lineTo(-4, 4); mapCtx.closePath(); mapCtx.fill(); mapCtx.stroke();
  mapCtx.restore();
}

// ====================================================================
// Boucle de jeu
// ====================================================================
const clock = new THREE.Clock();
let shake = 0, started = false, hudTimer = 0, lastZone = '', preview = false;

function updatePlayer(dt) {
  const p = player, C = CLS();
  if (p.dead) return;
  p.skillCd = Math.max(0, p.skillCd - dt);
  p.potionCd = Math.max(0, p.potionCd - dt);
  p.comboTimer = Math.max(0, p.comboTimer - dt);
  const busy = p.atk > 0 || p.skillT > 0;
  p.st = Math.min(100, p.st + dt * (busy ? 10 : 22));
  if (clock.elapsedTime - p.lastHurt > 6) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (zoneAt(p.pos.x, p.pos.z) === 'village' ? 0.1 : 0.02) * dt);

  // Déplacement
  let ix = input.mx, iz = input.mz;
  const k = input.keys;
  ix += (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.KeyQ || k.ArrowLeft ? 1 : 0);
  iz += (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.KeyZ || k.ArrowUp ? 1 : 0);
  const mag = Math.min(1, Math.hypot(ix, iz));
  let moving = false;
  const inWater = heightAt(p.pos.x, p.pos.z) < WATER - 0.3;
  const swingDur = () => (p.atk === 3 ? C.swing * 1.4 : C.swing);

  if (p.dodgeT > 0) {
    p.dodgeT -= dt;
    p.pos.addScaledVector(p.dodgeDir, 22 * dt);
  } else if (p.skillT > 0) {
    p.skillT -= dt;
    if (!p.hitDone && p.skillT < 0.3) { p.hitDone = true; castSkill(C.skill); }
  } else if (p.atk > 0) {
    p.atkT += dt;
    const dur = swingDur();
    if (C.kind === 'melee' && p.atkT < 0.12) p.pos.addScaledVector(new THREE.Vector3(Math.sin(p.rot), 0, Math.cos(p.rot)), 5 * dt);
    if (!p.hitDone && p.atkT > dur * 0.45) {
      p.hitDone = true;
      if (C.kind === 'ranged') fireProjectile(p.atk === 3);
      else {
        const reach = C.reach * (p.atk === 3 ? 1.15 : 1);
        for (const m of monsters) {
          if (m.dead) continue;
          const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z, d = Math.hypot(dx, dz);
          if (d > reach + m.def.size) continue;
          if (Math.abs(angDiff(p.rot, Math.atan2(dx, dz))) > 1.2 && d > m.def.size + 1) continue;
          const dealt = hitMonster(m, playerDmg() * (p.atk === 3 ? 1.7 : 1), p.atk === 3 || Math.random() < C.crit);
          if (C.lifesteal && dealt) p.hp = Math.min(p.maxHp, p.hp + dealt * C.lifesteal);
        }
      }
    }
    if (p.atkT >= dur) {
      p.comboTimer = 0.7;
      if (p.queued) startSwing(); else p.atk = 0;
    }
  } else if (mag > 0.1) {
    const dir = moveDir(ix, iz);
    const sp = (inWater ? 5 : 9) * mag;
    p.pos.addScaledVector(dir, sp * dt);
    p.rot += angDiff(p.rot, Math.atan2(dir.x, dir.z)) * Math.min(1, dt * 12);
    moving = true;
  }

  pushOut(p.pos, 0.5);
  p.pos.x = clamp(p.pos.x, -WORLD + 12, WORLD - 12);
  p.pos.z = clamp(p.pos.z, -WORLD + 12, WORLD - 12);
  p.pos.y = Math.max(heightAt(p.pos.x, p.pos.z), WATER - 1.2);

  // Animation procédurale
  const g = hunter.g;
  g.position.copy(p.pos);
  g.rotation.y = p.rot;
  const glowHex = [0, 0x112244, 0x223366, 0x442266, 0x663300][Math.min(4, p.weapon)];
  if (hunter.anim) {
    // Personnage animé : on choisit simplement l'animation de déplacement
    if (!(p.atk > 0 || p.skillT > 0 || p.dodgeT > 0)) hunter.play(moving ? hunter.cfg.run : hunter.cfg.idle);
    for (const wm of hunter.weaponMats) wm.emissive.setHex(glowHex);
    return;
  }
  const tt = clock.elapsedTime;
  let armX = -0.15, armZ = 0, arm2X = -0.1, arm2Z = 0;
  if (moving) {
    const s = Math.sin(tt * 14);
    hunter.legL.rotation.x = s * 0.7; hunter.legR.rotation.x = -s * 0.7;
    armX = -0.15 - s * 0.5; arm2X = -0.1 + s * 0.5;
    g.position.y += Math.abs(s) * 0.08;
  } else { hunter.legL.rotation.x *= 0.8; hunter.legR.rotation.x *= 0.8; }
  let snap = false;
  if (p.atk > 0) {
    snap = true;
    const k2 = clamp(p.atkT / swingDur(), 0, 1);
    if (C.kind === 'ranged') {
      // Visée : bras tendus vers l'avant
      if (C.proj === 'arrow') { arm2X = -1.55; armX = -1.5; armZ = lerp(0, 0.5, Math.min(1, k2 * 2)); }
      else { armX = lerp(-0.6, -1.6, Math.min(1, k2 * 2)); arm2X = -1.2; }
    } else if (player.cls === 'voleur') {
      // Coups alternés des deux dagues
      if (p.atk === 2) { arm2X = lerp(-2.0, 0.4, k2); armX = -0.5; } else { armX = lerp(-2.0, 0.4, k2); arm2X = -0.5; }
    } else if (p.atk === 1) { armX = lerp(-2.6, 0.6, k2); }
    else if (p.atk === 2) { armX = -1.4; armZ = lerp(1.4, -1.0, k2); }
    else { armX = lerp(-3.0, 0.8, Math.pow(k2, 0.6)); arm2X = armX * 0.6; }
  } else if (p.skillT > 0) {
    snap = true;
    const t = C.skill.type;
    if (t === 'whirl') { armX = -1.5; armZ = 1.2; arm2X = -1.5; arm2Z = -1.2; g.rotation.y = p.rot + (0.6 - p.skillT) * 26; }
    else if (t === 'rain') { armX = -2.4; arm2X = -2.5; }
    else if (t === 'shadow') { armX = 0.6; arm2X = 0.6; g.position.y -= 0.3; }
    else { armX = -2.9; arm2X = -2.9; g.position.y += p.skillT > 0.3 ? (0.6 - p.skillT) * 1.5 : 0; }
  } else if (p.dodgeT > 0) {
    g.position.y -= 0.4;
  }
  const blend = snap ? 1 : 0.2;
  hunter.arm.rotation.x = lerp(hunter.arm.rotation.x, armX, blend);
  hunter.arm.rotation.z = lerp(hunter.arm.rotation.z, armZ, blend);
  hunter.arm2.rotation.x = lerp(hunter.arm2.rotation.x, arm2X, blend);
  hunter.arm2.rotation.z = lerp(hunter.arm2.rotation.z, arm2Z, blend);
  const glow = [0, 0x112244, 0x223366, 0x442266, 0x663300][Math.min(4, p.weapon)];
  for (const wm of hunter.weaponMats) if (player.cls !== 'mage') wm.emissive.setHex(glow);
}

// ---------- Effets temporaires (ondes, projectiles visuels, dégâts différés)
const fx = [];
function addFx(dur, upd, end) { fx.push({ t: 0, dur, upd, end }); }
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    if (f.upd) f.upd(Math.min(1, f.t / f.dur), dt);
    if (f.t >= f.dur) { fx.splice(i, 1); if (f.end) f.end(); }
  }
}
function shockwave(pos, color = 0xffd27a, radius = 8) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(pos.x, heightAt(pos.x, pos.z) + 0.3, pos.z);
  scene.add(m);
  addFx(0.4, (k) => { m.scale.setScalar(0.5 + k * radius); m.material.opacity = 0.9 * (1 - k); }, () => { scene.remove(m); m.material.dispose(); });
}
function aoe(center, radius, dmg, onHit) {
  for (const m of monsters) {
    if (m.dead || Math.hypot(m.pos.x - center.x, m.pos.z - center.z) > radius + m.def.size) continue;
    hitMonster(m, dmg, true);
    if (onHit) onHit(m);
  }
}

function castSkill(S) {
  const p = player, dmg = playerDmg() * S.mult;
  if (S.type === 'whirl') {
    aoe(p.pos, S.radius, dmg); shockwave(p.pos, 0xffffff, S.radius); shake = 0.3;
  } else if (S.type === 'holy') {
    const heal = Math.round(p.maxHp * S.heal);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    dmgNum(p.pos.clone().setY(p.pos.y + 2.5), `+${heal}`, 'heal');
    aoe(p.pos, S.radius, dmg); shockwave(p.pos, 0xffe066, S.radius);
    pillar(p.pos, 0xfff0a0);
  } else if (S.type === 'frost') {
    aoe(p.pos, S.radius, dmg, (m) => { m.slowT = 4; });
    shockwave(p.pos, 0x9ad8ff, S.radius); shake = 0.25;
  } else if (S.type === 'rain') {
    const t = nearestMonster(CLS().range);
    const c = t ? t.pos.clone() : p.pos.clone().add(new THREE.Vector3(Math.sin(p.rot) * 10, 0, Math.cos(p.rot) * 10));
    arrowRain(c, S.radius);
    addFx(0.45, null, () => { aoe(c, S.radius, dmg); shockwave(c, 0x9aff7a, S.radius); });
  }
}

function shadowStep(S) {
  const p = player, t = nearestMonster(16);
  shockwave(p.pos, 0x6a3a9a, 3);
  if (t) {
    const back = t.rot + Math.PI;
    p.pos.set(t.pos.x + Math.sin(back) * (t.def.size + 1.2), 0, t.pos.z + Math.cos(back) * (t.def.size + 1.2));
    p.rot = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
    hitMonster(t, playerDmg() * S.mult, true);
  } else {
    p.pos.x += Math.sin(p.rot) * 8; p.pos.z += Math.cos(p.rot) * 8;
  }
  pushOut(p.pos, 0.5);
  p.hitDone = true;
  p.dodgeT = 0; // invulnérable pendant l'animation grâce au skillT
  shockwave(p.pos, 0x6a3a9a, 3);
}

function pillar(pos, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.position.set(pos.x, pos.y + 7, pos.z);
  scene.add(m);
  addFx(0.6, (k) => { m.material.opacity = 0.5 * (1 - k); m.scale.x = m.scale.z = 1 + k; }, () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}

// ---------- Projectiles (flèches, boules de feu)
const arrowGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5).rotateX(Math.PI / 2);
const arrowTipGeo = new THREE.ConeGeometry(0.08, 0.25, 5).rotateX(Math.PI / 2).translate(0, 0, 0.6);
const arrowMat = new THREE.MeshBasicMaterial({ color: 0x6a4a2a }), tipMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
function makeArrow() { const g = new THREE.Group(); g.add(new THREE.Mesh(arrowGeo, arrowMat), new THREE.Mesh(arrowTipGeo, tipMat)); return g; }
const fireGeo = new THREE.SphereGeometry(0.35, 10, 8);
const fireMat = new THREE.MeshBasicMaterial({ color: 0xffb040 });
const fireHaloMat = new THREE.MeshBasicMaterial({ color: 0xff4a10, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
const projectiles = [];

function fireProjectile(big) {
  const p = player, C = CLS();
  const target = nearestMonster(C.range);
  const from = p.pos.clone().add(new THREE.Vector3(Math.sin(p.rot) * 0.8, 1.6, Math.cos(p.rot) * 0.8));
  let mesh;
  if (C.proj === 'fire') {
    mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(fireGeo, fireMat));
    const halo = new THREE.Mesh(fireGeo, fireHaloMat); halo.scale.setScalar(1.8); mesh.add(halo);
    if (big) mesh.scale.setScalar(1.5);
  } else mesh = makeArrow();
  mesh.position.copy(from);
  scene.add(mesh);
  const dir = new THREE.Vector3(Math.sin(p.rot), 0, Math.cos(p.rot));
  projectiles.push({
    mesh, pos: from, dir, target, life: 1.6, speed: C.proj === 'fire' ? 28 : 45,
    dmg: playerDmg() * (big ? 1.6 : 1), crit: big || Math.random() < C.crit, splash: C.splash || 0,
  });
}
function explode(pr) {
  if (pr.splash) {
    for (const m of monsters) if (!m.dead && m !== pr.hit && m.pos.distanceTo(pr.pos) < pr.splash + m.def.size) hitMonster(m, pr.dmg * 0.6, false);
    shockwave(pr.pos, 0xff7a20, pr.splash);
  }
  scene.remove(pr.mesh);
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.life -= dt;
    if (pr.target && !pr.target.dead) {
      const aim = pr.target.pos.clone().setY(pr.target.pos.y + pr.target.def.size * 0.9).sub(pr.pos).normalize();
      pr.dir.lerp(aim, Math.min(1, dt * 12)).normalize();
    }
    pr.pos.addScaledVector(pr.dir, pr.speed * dt);
    pr.mesh.position.copy(pr.pos);
    pr.mesh.lookAt(pr.pos.clone().add(pr.dir));
    let done = pr.life <= 0 || pr.pos.y < heightAt(pr.pos.x, pr.pos.z);
    for (const m of monsters) {
      if (done || m.dead) continue;
      const cy = m.pos.y + m.def.size * 0.9;
      if (Math.hypot(pr.pos.x - m.pos.x, pr.pos.y - cy, pr.pos.z - m.pos.z) < m.def.size + 0.5) {
        hitMonster(m, pr.dmg, pr.crit); pr.hit = m; done = true;
      }
    }
    if (done) { explode(pr); projectiles.splice(i, 1); }
  }
}
function arrowRain(center, radius) {
  for (let i = 0; i < 18; i++) {
    const a = makeArrow();
    const x = center.x + rand(-radius, radius) * 0.8, z = center.z + rand(-radius, radius) * 0.8, y0 = heightAt(x, z);
    a.rotation.x = Math.PI / 2; // pointe vers le bas
    scene.add(a);
    const delay = rand(0, 0.15);
    addFx(0.45, (k) => { const kk = clamp((k * 0.45 - delay) / 0.3, 0, 1); a.position.set(x, y0 + 14 * (1 - kk) + 0.3, z); }, () => scene.remove(a));
  }
}

function updateInteract() {
  interactTarget = null;
  let best = 4.5;
  for (const id in npcs) {
    const d = npcs[id].pos.distanceTo(player.pos);
    if (d < best) { best = d; interactTarget = { kind: 'npc', ref: npcs[id] }; }
  }
  if (!interactTarget) {
    best = 2.6;
    for (const p of pickups) {
      if (!p.active) continue;
      const d = p.mesh.position.distanceTo(player.pos);
      if (d < best) { best = d; interactTarget = { kind: 'item', ref: p }; }
    }
  }
  const b = $('bInteract');
  if (interactTarget && !player.dead) {
    b.classList.remove('hidden');
    b.textContent = interactTarget.kind === 'npc' ? `Parler à ${interactTarget.ref.name}` : `Ramasser ${ITEMS[interactTarget.ref.id].name}`;
  } else b.classList.add('hidden');
}

function updateMarkers() {
  for (const id in npcs) {
    const n = npcs[id];
    if (QUESTS.some((q) => q.turnin === id && qReady(q))) setMarker(n.marker, '?', '#7dff7a');
    else if (QUESTS.some((q) => q.giver === id && qAvailable(q))) setMarker(n.marker, '!', '#ffd24a');
    else setMarker(n.marker, '', '');
  }
}

function updateHud() {
  const p = player;
  $('lvl').textContent = p.level;
  $('hpF').style.width = (p.hp / p.maxHp * 100) + '%';
  $('hpT').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('stF').style.width = p.st + '%';
  $('xpF').style.width = (p.xp / xpNext(p.level) * 100) + '%';
  $('gold').textContent = `${p.gold} 🪙`;
  $('skCd').style.height = (p.skillCd / CLS().skill.cd * 100) + '%';
  const zn = zoneAt(p.pos.x, p.pos.z);
  if (zn !== lastZone) {
    lastZone = zn;
    $('zoneName').textContent = ZONES[zn].name;
    if (started) toast(`${ZONES[zn].name} — ${ZONES[zn].hint}`);
  }
  // Barre de boss
  const boss = monsters.find((m) => m.def.boss && !m.dead && m.state !== 'idle' && m.state !== 'return' && m.pos.distanceTo(p.pos) < 50);
  $('boss').classList.toggle('hidden', !boss);
  if (boss) { $('bossName').textContent = `${boss.def.name} — niv. ${boss.def.lvl}${boss.enraged ? ' (furie)' : ''}`; $('bossF').style.width = (boss.hp / boss.maxHp * 100) + '%'; }
}

function updateCamera(dt) {
  // La caméra suit doucement l'orientation du joueur quand on ne la touche pas
  if (camId === null && Math.hypot(input.mx, input.mz) > 0.2 && Math.abs(input.mz) < 0.6 && player.atk === 0) {
    camYaw += angDiff(camYaw, player.rot + Math.PI) * dt * 0.8 * Math.abs(input.mx);
  }
  const target = player.pos.clone().add(new THREE.Vector3(0, 1.8, 0));
  const cx = target.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cz = target.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  let cy = target.y + Math.sin(camPitch) * camDist;
  cy = Math.max(cy, heightAt(cx, cz) + 1.2);
  camera.position.set(cx, cy, cz);
  if (shake > 0) { shake -= dt; camera.position.x += rand(-1, 1) * shake * 0.6; camera.position.y += rand(-1, 1) * shake * 0.6; }
  camera.lookAt(target);
  sun.position.set(player.pos.x + 40, player.pos.y + 80, player.pos.z + 25);
  sun.target.position.copy(player.pos);
}

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  if (started && !uiOpen) {
    updatePlayer(dt);
    for (const m of monsters) updateMonster(m, dt);
    for (const p of pickups) {
      if (!p.active) { p.t -= dt; if (p.t <= 0) { p.active = true; p.mesh.visible = true; } continue; }
      p.mesh.rotation.y += dt * 2; p.mesh.position.y = p.base + Math.sin(clock.elapsedTime * 3 + p.base) * 0.2;
    }
    updateFx(dt);
    updateProjectiles(dt);
    updateSnow(dt);
    for (const f of fires) f.scale.y = 1 + Math.sin(clock.elapsedTime * 12 + f.position.x) * 0.2;
    updateInteract();
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.1; updateHud(); updateMarkers(); drawMap(); }
  }
  if (hunter.mixer) hunter.mixer.update(dt);
  if (preview) updatePreview(dt); else updateCamera(dt);
  sky.position.copy(camera.position);
  updateDmgNums(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ====================================================================
// Écran de choix de classe (le héros tourne sur lui-même au village)
// ====================================================================
let selCls = 'guerrier';
function updatePreview(dt) {
  const g = hunter.g;
  g.rotation.y += dt * 0.6;
  if (hunter.anim) hunter.play(hunter.cfg.idle);
  else {
    hunter.legL.rotation.x = hunter.legR.rotation.x = 0;
    hunter.arm.rotation.set(-0.15 + Math.sin(clock.elapsedTime * 2) * 0.05, 0, 0);
    hunter.arm2.rotation.set(-0.1, 0, 0);
  }
  const P = player.pos, portrait = innerHeight > innerWidth;
  g.position.copy(P);
  camera.position.set(P.x, P.y + (portrait ? 2.6 : 1.9), P.z + (portrait ? 7.5 : 5.2));
  camera.lookAt(P.x - (portrait ? 0 : 1.7), P.y + (portrait ? 0.2 : 1.15), P.z);
  sun.position.set(P.x + 40, P.y + 80, P.z + 25); sun.target.position.copy(P);
}
function renderClassList() {
  $('classList').innerHTML = Object.entries(CLASSES).map(([id, c]) => {
    const bars = Object.entries(c.stats).map(([k, v]) => `<div class="st"><span>${k}</span><i style="width:${v * 20}%"></i></div>`).join('');
    return `<div class="cc ${id === selCls ? 'sel' : ''}" data-id="${id}">
      <div class="ci">${c.icon}</div>
      <div class="cb"><b>${c.name}</b><small>${c.role}</small>
        ${id === selCls ? `<p>${c.desc}</p><div class="sk">${c.skill.icon} <b>${c.skill.name}</b> — ${c.skill.desc}</div><div class="stats">${bars}</div>` : ''}
      </div></div>`;
  }).join('');
  for (const el of document.querySelectorAll('.cc')) el.onclick = () => { selCls = el.dataset.id; setHeroModel(selCls); renderClassList(); };
}
function showClassSelect() {
  started = false; preview = true; uiOpen = true;
  selCls = player.cls || 'guerrier';
  player.pos.set(0, heightAt(0, 8), 8);
  setHeroModel(selCls);
  $('hud').classList.add('hidden');
  $('classSel').classList.remove('hidden');
  renderClassList();
}
function startGame() {
  preview = false; uiOpen = false; started = true;
  $('classSel').classList.add('hidden');
  $('hud').classList.remove('hidden');
  player.rot = Math.PI; camYaw = Math.PI;
  $('skIco').textContent = CLS().skill.icon;
  updatePotions(); renderTracker();
  if (!Object.keys(Q).length) setTimeout(() => toast("Parlez à l'Ancienne Maëlle (❗) au centre du village"), 600);
}
$('bStart').onclick = () => {
  const changed = player.cls && player.cls !== selCls;
  player.cls = selCls;
  player.maxHp = maxHpFor(player.level); player.hp = player.maxHp;
  player.skillCd = 0;
  save();
  startGame();
  if (changed) toast(`Vous êtes maintenant ${CLS().name}`);
};
$('bPlay').onclick = () => {
  $('title').classList.add('hidden');
  const el = document.documentElement;
  if (matchMedia('(pointer:coarse)').matches && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  if (player.cls) startGame(); else showClassSelect();
};

// Accès debug pour les tests automatisés
window.__game = { player, monsters, Q, npcs, QUESTS, completeQuest, gainXp };

requestAnimationFrame(tick);
