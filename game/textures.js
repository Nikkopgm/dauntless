// Textures procédurales (dessinées au chargement, aucun fichier image à télécharger).
// Elles sont en niveaux de gris : la couleur finale vient de la teinte du matériau,
// ce qui permet de réutiliser une même texture pour des objets de couleurs différentes.
import * as THREE from './lib/three.module.min.js';

const R = Math.random;
const gray = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
const rv = (a, b) => a + R() * (b - a);

function canvasTex(size, draw, { repeat = 1, alpha = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = alpha ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Dessine une forme en la recopiant de l'autre côté si elle déborde : texture sans couture.
function wrapped(ctx, s, x, y, r, fn) {
  const xs = [x], ys = [y];
  if (x < r) xs.push(x + s); if (x > s - r) xs.push(x - s);
  if (y < r) ys.push(y + s); if (y > s - r) ys.push(y - s);
  for (const px of xs) for (const py of ys) { ctx.save(); ctx.translate(px, py); fn(ctx); ctx.restore(); }
}
function blotches(ctx, s, n, r0, r1, v0, v1, a) {
  for (let i = 0; i < n; i++) {
    const r = rv(r0, r1);
    ctx.fillStyle = gray(rv(v0, v1), a);
    wrapped(ctx, s, R() * s, R() * s, r, (c) => { c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); });
  }
}
function strokes(ctx, s, n, l0, l1, ang, spread, v0, v1, a, w = 1) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const l = rv(l0, l1), an = ang + (R() - 0.5) * spread;
    ctx.strokeStyle = gray(rv(v0, v1), a); ctx.lineWidth = w * rv(0.7, 1.4);
    wrapped(ctx, s, R() * s, R() * s, l, (c) => { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * l, Math.sin(an) * l); c.stroke(); });
  }
}

const ground = () => canvasTex(256, (c, s) => {
  c.fillStyle = gray(205); c.fillRect(0, 0, s, s);
  blotches(c, s, 70, 10, 40, 165, 240, 0.25);
  strokes(c, s, 2200, 3, 9, -Math.PI / 2, 0.9, 140, 255, 0.55, 1.2);
  blotches(c, s, 90, 1, 2.5, 90, 130, 0.5);
}, { repeat: 160 });

const planks = () => canvasTex(256, (c, s) => {
  const h = 32;
  for (let y = 0; y < s; y += h) {
    const v = rv(150, 205);
    c.fillStyle = gray(v); c.fillRect(0, y, s, h);
    for (let k = 0; k < 10; k++) {
      c.strokeStyle = gray(v - rv(30, 60), 0.35); c.lineWidth = 1;
      const yy = y + rv(3, h - 3), ph = R() * 6, amp = rv(0.5, 2);
      c.beginPath();
      for (let x = 0; x <= s; x += 8) c.lineTo(x, yy + Math.sin(x / 30 + ph) * amp);
      c.stroke();
    }
    c.fillStyle = gray(55); c.fillRect(0, y, s, 2);
    const jx = R() * s;
    c.fillRect(jx, y, 2, h);
    c.fillStyle = gray(70); c.fillRect(jx - 7, y + 8, 3, 3); c.fillRect(jx + 6, y + 8, 3, 3);
  }
});

const tiles = () => canvasTex(256, (c, s) => {
  c.fillStyle = gray(70); c.fillRect(0, 0, s, s);
  const w = 32, h = 32;
  for (let y = -h; y < s + h; y += h * 0.75) {
    const off = (Math.round(y / (h * 0.75)) % 2) * w / 2;
    for (let x = -w; x < s + w; x += w) {
      c.fillStyle = gray(rv(150, 215));
      c.beginPath();
      c.moveTo(x + off, y); c.lineTo(x + off + w, y); c.lineTo(x + off + w, y + h * 0.6);
      c.arc(x + off + w / 2, y + h * 0.6, w / 2, 0, Math.PI);
      c.closePath(); c.fill();
      c.strokeStyle = gray(60, 0.6); c.lineWidth = 1.5; c.stroke();
    }
  }
});

const stone = () => canvasTex(256, (c, s) => {
  c.fillStyle = gray(95); c.fillRect(0, 0, s, s);
  for (let i = 0; i < 75; i++) {
    const rx = rv(12, 24), ry = rv(9, 18), v = rv(140, 215), rot = R() * 3;
    wrapped(c, s, R() * s, R() * s, rx, (cc) => {
      cc.rotate(rot); cc.beginPath(); cc.ellipse(0, 0, rx, ry, 0, 0, 7);
      cc.fillStyle = gray(v); cc.fill(); cc.strokeStyle = gray(60, 0.7); cc.lineWidth = 2; cc.stroke();
    });
  }
  blotches(c, s, 200, 1, 4, 90, 255, 0.2);
});

const bark = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(165); c.fillRect(0, 0, s, s);
  for (let i = 0; i < 45; i++) {
    const x0 = R() * s, ph = R() * 6;
    c.strokeStyle = gray(rv(60, 120), 0.75); c.lineWidth = rv(1, 3);
    c.beginPath();
    for (let y = 0; y <= s; y += 6) c.lineTo(x0 + Math.sin(y / 14 + ph) * 2.5, y);
    c.stroke();
  }
});

const leaves = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(150); c.fillRect(0, 0, s, s);
  for (let i = 0; i < 380; i++) {
    const r = rv(3, 8), rot = R() * 3, v = rv(110, 245);
    wrapped(c, s, R() * s, R() * s, r, (cc) => { cc.rotate(rot); cc.beginPath(); cc.ellipse(0, 0, r, r * 0.5, 0, 0, 7); cc.fillStyle = gray(v, 0.85); cc.fill(); });
  }
});

const scales = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(120); c.fillRect(0, 0, s, s);
  const r = 8;
  for (let y = -r; y < s + r; y += r) {
    const off = (Math.round(y / r) % 2) * r;
    for (let x = -2 * r; x < s + 2 * r; x += 2 * r) {
      const gr = c.createRadialGradient(x + off, y, 1, x + off, y, r * 1.2);
      gr.addColorStop(0, gray(235)); gr.addColorStop(1, gray(150));
      c.fillStyle = gr;
      c.beginPath(); c.arc(x + off, y, r, 0, Math.PI); c.fill();
      c.strokeStyle = gray(70, 0.6); c.lineWidth = 1; c.stroke();
    }
  }
});

const fur = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(170); c.fillRect(0, 0, s, s);
  strokes(c, s, 1800, 4, 10, Math.PI / 2, 0.5, 100, 245, 0.6, 1);
});

const cloth = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(210); c.fillRect(0, 0, s, s);
  c.fillStyle = gray(160, 0.35);
  for (let i = 0; i < s; i += 3) { c.fillRect(0, i, s, 1); c.fillRect(i, 0, 1, s); }
  blotches(c, s, 40, 6, 20, 170, 240, 0.15);
});

const metal = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(200); c.fillRect(0, 0, s, s);
  strokes(c, s, 420, 15, 70, 0, 0.05, 165, 250, 0.35, 1);
  strokes(c, s, 25, 3, 12, 0, 6, 90, 120, 0.5, 1);
});

const leather = () => canvasTex(128, (c, s) => {
  c.fillStyle = gray(175); c.fillRect(0, 0, s, s);
  blotches(c, s, 140, 3, 14, 125, 215, 0.35);
  blotches(c, s, 300, 0.6, 1.4, 90, 120, 0.5);
  c.strokeStyle = gray(90, 0.7); c.setLineDash([4, 3]); c.lineWidth = 1.2;
  c.strokeRect(6, 6, s - 12, s - 12);
});

// Touffe d'herbe : masque de transparence (blanc = visible), utilisé comme alphaMap.
// Un masque opaque évite les bords noirs qui apparaissent au loin avec une texture transparente.
const grassTuft = () => canvasTex(128, (c, s) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) {
    const x = rv(10, s - 10), top = rv(8, 60), w = rv(5, 10), bend = rv(-18, 18);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(x - w / 2, s); c.quadraticCurveTo(x, (s + top) / 2, x + bend, top); c.lineTo(x + w / 2, s); c.closePath(); c.fill();
  }
}, { alpha: true });

export const TEX = {
  ground: ground(), planks: planks(), tiles: tiles(), stone: stone(), bark: bark(), leaves: leaves(),
  scales: scales(), fur: fur(), cloth: cloth(), metal: metal(), leather: leather(), grass: grassTuft(),
};

// Copie d'une texture avec une autre répétition
export function rep(tex, x, y = x) {
  const t = tex.clone();
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}
