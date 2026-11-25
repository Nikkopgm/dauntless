// Modèles 3D des classes jouables, assemblés à partir de formes simples texturées.
import * as THREE from './lib/three.module.min.js';
import { TEX } from './textures.js';

const std = (color, map, o = {}) => new THREE.MeshStandardMaterial({
  color, map: map || null, roughness: o.r ?? 0.85, metalness: o.m ?? 0,
  emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
});
const plate = (c) => std(c, TEX.metal, { m: 0.75, r: 0.35 });
const cloth = (c) => std(c, TEX.cloth);
const leather = (c) => std(c, TEX.leather, { r: 0.7 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const halfSphere = (r) => new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);

const PAL = {
  guerrier: { torso: plate(0x9aa3ad), arms: plate(0x8a939d), legs: leather(0x5a4030), boots: plate(0x6a7078), belt: leather(0x3a2414), gloves: plate(0x7a838d), accent: cloth(0x9a2020) },
  paladin: { torso: plate(0xe8d9a8), arms: plate(0xd8c890), legs: plate(0xc8b880), boots: plate(0xb8a870), belt: leather(0x5a3a1a), gloves: plate(0xd8c890), accent: cloth(0x2a4aa0) },
  voleur: { torso: leather(0x34303a), arms: leather(0x2a2730), legs: leather(0x24222a), boots: leather(0x1a181e), belt: leather(0x5a2a2a), gloves: leather(0x1a181e), accent: cloth(0x5a1a2a) },
  chasseur: { torso: leather(0x6a5a34), arms: leather(0x5a4a2c), legs: leather(0x4a3a24), boots: leather(0x3a2a1a), belt: leather(0x2a1a0e), gloves: leather(0x3a2a1a), accent: cloth(0x3a6a2a) },
  mage: { torso: cloth(0x4a2a8a), arms: cloth(0x4a2a8a), legs: cloth(0x3a2070), boots: leather(0x2a1a3a), belt: cloth(0xd0a030), gloves: null, accent: cloth(0xd0a030) },
};

export function makeHero(cls) {
  const P = PAL[cls] || PAL.guerrier;
  const g = new THREE.Group();
  const skin = std(0xe2b48a, null, { r: 0.9 });
  const weaponMats = [];

  // --- Jambes
  const legGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.8, 8); legGeo.translate(0, -0.4, 0);
  const bootGeo = new THREE.BoxGeometry(0.26, 0.26, 0.4);
  const legL = new THREE.Group(); legL.position.set(-0.19, 0.88, 0);
  const legR = new THREE.Group(); legR.position.set(0.19, 0.88, 0);
  for (const L of [legL, legR]) { L.add(mesh(legGeo, P.legs), mesh(bootGeo, P.boots, 0, -0.76, 0.05)); }

  // --- Tronc & tête
  const torso = mesh(new THREE.CylinderGeometry(0.42, 0.33, 0.85, 12), P.torso, 0, 1.32, 0);
  const belt = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.13, 12), P.belt, 0, 0.93, 0);
  const buckle = mesh(new THREE.BoxGeometry(0.14, 0.12, 0.05), plate(0xd0a030), 0, 0.93, 0.36);
  const neck = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.15, 8), skin, 0, 1.78, 0);
  const head = mesh(new THREE.SphereGeometry(0.27, 16, 12), skin, 0, 2.0, 0);
  const eyeM = std(0x1a1410);
  const eyeL = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), eyeM, -0.09, 2.03, 0.255);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.09;
  g.add(legL, legR, torso, belt, buckle, neck, head, eyeL, eyeR);

  // --- Bras (pivot à l'épaule, main en bas, « hold » = point d'accroche de l'arme)
  function makeArm(side) {
    const a = new THREE.Group(); a.position.set(side * 0.5, 1.64, 0);
    a.add(mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.75, 8).translate(0, -0.37, 0), P.arms));
    a.add(mesh(new THREE.SphereGeometry(0.11, 8, 8), P.gloves || skin, 0, -0.78, 0));
    const hold = new THREE.Group(); hold.position.y = -0.8; a.add(hold);
    a.userData.hold = hold;
    return a;
  }
  const arm = makeArm(1), arm2 = makeArm(-1);
  g.add(arm, arm2);
  const hold = arm.userData.hold, hold2 = arm2.userData.hold;

  const cape = (mat, len = 1.3) => {
    const c = mesh(new THREE.BoxGeometry(0.8, len, 0.05).translate(0, -len / 2, 0), mat, 0, 1.75, -0.36);
    c.rotation.x = 0.12; g.add(c); return c;
  };
  const tabard = (mat) => g.add(mesh(new THREE.BoxGeometry(0.42, 0.75, 0.04), mat, 0, 0.72, 0.33));
  const pauldrons = (mat, r = 0.27, spikes = false) => {
    for (const s of [-1, 1]) {
      const p = mesh(halfSphere(r), mat, s * 0.52, 1.66, 0); p.scale.set(1.1, 0.9, 1.1); g.add(p);
      if (spikes) { const sp = mesh(new THREE.ConeGeometry(0.06, 0.28, 6), plate(0xd8d8d8), s * 0.6, 1.95, 0); sp.rotation.z = -s * 0.5; g.add(sp); }
    }
  };

  if (cls === 'guerrier') {
    pauldrons(plate(0x7a838d), 0.3, true);
    tabard(P.accent); cape(P.accent, 1.2);
    const helm = mesh(halfSphere(0.31), plate(0x8a939d), 0, 2.02, 0); g.add(helm);
    const nose = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), plate(0x8a939d), 0, 1.98, 0.29); g.add(nose);
    for (const s of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.07, 0.45, 8), std(0xe8dcc0, null, { r: 0.5 }), s * 0.32, 2.25, 0);
      horn.rotation.z = -s * 0.9; g.add(horn);
    }
    // Hache à deux mains
    const hm = plate(0xc8d0d8); weaponMats.push(hm);
    const axe = new THREE.Group();
    axe.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8).rotateX(Math.PI / 2).translate(0, 0, 0.6), std(0x4a2e18, TEX.bark)));
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0.12); bladeShape.quadraticCurveTo(0.55, 0.45, 0.62, 0); bladeShape.quadraticCurveTo(0.55, -0.45, 0, -0.12); bladeShape.closePath();
    const bg = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03);
    for (const s of [-1, 1]) { const b = mesh(bg, hm, 0, 0, 1.35); b.rotation.set(0, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2); axe.add(b); }
    axe.rotation.x = -0.5;
    hold.add(axe);
  } else if (cls === 'paladin') {
    pauldrons(plate(0xd8b850), 0.32);
    tabard(P.accent); cape(cloth(0xf0f0f0), 1.3);
    const cross = mesh(new THREE.BoxGeometry(0.08, 0.4, 0.02), plate(0xe8c040), 0, 0.78, 0.36); g.add(cross);
    const cross2 = mesh(new THREE.BoxGeometry(0.26, 0.08, 0.02), plate(0xe8c040), 0, 0.85, 0.36); g.add(cross2);
    const helm = mesh(new THREE.SphereGeometry(0.31, 14, 10), plate(0xe8d9a8), 0, 2.02, 0); g.add(helm);
    const visor = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), std(0x101010), 0, 2.02, 0.29); g.add(visor);
    const crest = mesh(new THREE.BoxGeometry(0.06, 0.25, 0.5), cloth(0x2a4aa0), 0, 2.36, -0.02); g.add(crest);
    // Masse
    const mm = plate(0xe8c860); weaponMats.push(mm);
    const mace = new THREE.Group();
    mace.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, 0.35), leather(0x4a2e18)));
    mace.add(mesh(new THREE.DodecahedronGeometry(0.2, 0), mm, 0, 0, 0.9));
    mace.rotation.x = -0.5;
    hold.add(mace);
    // Bouclier
    const shield = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 20).rotateX(Math.PI / 2), plate(0x2a4aa0), -0.12, 0.25, 0.12);
    shield.rotation.y = -0.4;
    const boss = mesh(new THREE.SphereGeometry(0.12, 10, 8), plate(0xe8c040), 0, 0, 0.06); shield.add(boss);
    const rim = mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), plate(0xe8c040)); shield.add(rim);
    hold2.add(shield);
  } else if (cls === 'voleur') {
    cape(P.accent, 0.9);
    const hood = mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), leather(0x2a2730), 0, 2.03, -0.02); g.add(hood);
    const hoodTip = mesh(new THREE.ConeGeometry(0.2, 0.4, 8), leather(0x2a2730), 0, 2.15, -0.28); hoodTip.rotation.x = -1.2; g.add(hoodTip);
    const mask = mesh(new THREE.BoxGeometry(0.42, 0.16, 0.2), cloth(0x5a1a2a), 0, 1.9, 0.15); g.add(mask);
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.14, 0.16, 0.1), leather(0x4a2a1a), s * 0.25, 0.85, 0.3));
    const dm = plate(0xd8dde2); weaponMats.push(dm);
    const dagger = () => {
      const d = new THREE.Group();
      d.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.25).translate(0, 0, 0.05), leather(0x2a1a0e)));
      d.add(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), plate(0xb08020), 0, 0, 0.18));
      d.add(mesh(new THREE.ConeGeometry(0.06, 0.6, 4).rotateX(Math.PI / 2).translate(0, 0, 0.5), dm));
      d.rotation.x = -0.3;
      return d;
    };
    hold.add(dagger()); hold2.add(dagger());
  } else if (cls === 'chasseur') {
    cape(P.accent, 1.35);
    const hood = mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), cloth(0x3a6a2a), 0, 2.03, -0.02); g.add(hood);
    const hair = mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), std(0x6a3a1a), 0, 2.2, 0.22); g.add(hair);
    // Carquois
    const quiver = mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.75, 10), leather(0x5a3a1a), 0.15, 1.45, -0.42);
    quiver.rotation.z = -0.4; g.add(quiver);
    for (let i = 0; i < 4; i++) {
      const f = mesh(new THREE.ConeGeometry(0.04, 0.16, 4), cloth(0xd03a2a), 0.29 + i * 0.03, 1.86 + i * 0.02, -0.42 + (i % 2) * 0.04);
      f.rotation.z = -0.4; g.add(f);
    }
    // Arc (main gauche)
    const wm = std(0x6a4020, TEX.bark, { r: 0.6 }); weaponMats.push(wm);
    const bow = new THREE.Group();
    const arc = mesh(new THREE.TorusGeometry(0.7, 0.035, 6, 20, Math.PI * 0.9), wm); arc.rotation.z = Math.PI / 2 - Math.PI * 0.45;
    bow.add(arc);
    const ends = 0.7 * Math.sin(Math.PI * 0.45);
    bow.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, ends * 2, 4), std(0xe8e0d0), -0.7 * Math.cos(Math.PI * 0.45), 0, 0));
    bow.rotation.set(0, Math.PI / 2, 0);
    bow.position.set(0, 0, 0.1);
    hold2.add(bow);
  } else if (cls === 'mage') {
    // Robe longue à la place des jambes visibles
    const robe = mesh(new THREE.CylinderGeometry(0.36, 0.62, 1.05, 14), P.torso, 0, 0.5, 0); g.add(robe);
    const trim = mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.08, 14), P.accent, 0, 0.0, 0); g.add(trim);
    const sash = mesh(new THREE.BoxGeometry(0.16, 0.9, 0.04), P.accent, 0, 0.95, 0.36); g.add(sash);
    for (const s of [-1, 1]) { const sl = mesh(new THREE.ConeGeometry(0.2, 0.4, 8), P.arms, s * 0.5, 0.98, 0); g.add(sl); }
    const beard = mesh(new THREE.ConeGeometry(0.17, 0.45, 8), std(0xe8e8e8), 0, 1.72, 0.2); beard.rotation.x = Math.PI; g.add(beard);
    const brim = mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 20), cloth(0x3a2070), 0, 2.2, 0); g.add(brim);
    const hat = mesh(new THREE.ConeGeometry(0.3, 0.85, 14), cloth(0x3a2070), 0, 2.62, -0.05); hat.rotation.x = -0.18; g.add(hat);
    const band = mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.08, 14), P.accent, 0, 2.27, 0); g.add(band);
    // Bâton avec orbe lumineuse
    const staff = new THREE.Group();
    staff.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 8).translate(0, 0.25, 0), std(0x5a3a20, TEX.bark)));
    const orbM = std(0xff9a40, null, { e: 0xff7a20, ei: 2 }); weaponMats.push(orbM);
    staff.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), orbM, 0, 1.32, 0));
    for (let i = 0; i < 3; i++) {
      const prong = mesh(new THREE.ConeGeometry(0.03, 0.3, 4), plate(0xd0a030), Math.cos(i * 2.1) * 0.12, 1.25, Math.sin(i * 2.1) * 0.12);
      prong.rotation.set(Math.sin(i * 2.1) * 0.5, 0, -Math.cos(i * 2.1) * 0.5); staff.add(prong);
    }
    staff.position.z = 0.1;
    hold.add(staff);
  }

  // Les bras bougent depuis l'épaule, les épaulières restent sur le torse : c'est voulu pour un style « figurine ».
  return { g, arm, arm2, legL, legR, weaponMats };
}
