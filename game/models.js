// Personnages 3D animés (pack « KayKit Adventurers » de Kay Lousberg, licence CC0).
// Chaque classe utilise un modèle, n'affiche que ses armes et associe ses animations.
import * as THREE from './lib/three.module.min.js';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';

const WEAPONS = new Set(['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword',
  '1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff',
  'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']);

export const MODEL_CFG = {
  guerrier: {
    file: 'Barbarian', show: ['2H_Axe'], idle: '2H_Melee_Idle', run: 'Running_A',
    atk: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop'], skill: '2H_Melee_Attack_Spin',
  },
  paladin: {
    file: 'Knight', show: ['1H_Sword', 'Badge_Shield'], idle: 'Idle', run: 'Running_A',
    atk: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'], skill: 'Spellcast_Raise',
  },
  voleur: {
    file: 'Rogue', show: ['Knife', 'Knife_Offhand'], idle: 'Idle', run: 'Running_A',
    atk: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Stab'], skill: 'Dualwield_Melee_Attack_Stab',
  },
  chasseur: {
    file: 'Rogue_Hooded', show: ['2H_Crossbow'], idle: 'Idle', run: 'Running_A',
    atk: ['2H_Ranged_Shoot'], skill: 'Spellcast_Raise',
  },
  mage: {
    file: 'Mage', show: ['2H_Staff'], idle: 'Idle', run: 'Running_A',
    atk: ['Spellcast_Shoot'], skill: 'Spellcast_Raise',
  },
};

const loader = new GLTFLoader();
const cache = {};
const HEIGHT = 2.9; // taille du héros en unités du monde

export async function loadHero(cls) {
  const c = MODEL_CFG[cls];
  cache[c.file] ||= loader.loadAsync(`models/${c.file}.glb`);
  const gltf = await cache[c.file];
  const model = gltf.scene;
  model.scale.setScalar(1);
  model.position.set(0, 0, 0);
  const weaponMats = [];
  model.traverse((o) => {
    if (WEAPONS.has(o.name)) o.visible = c.show.includes(o.name);
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.material.map) o.material.map.anisotropy = 4;
    }
  });
  // Matériau à part pour les armes affichées : elles brillent quand l'arme est améliorée
  for (const name of c.show) {
    const w = model.getObjectByName(name);
    if (!w) continue;
    const mat = (w.isMesh ? w.material : w.children.find((x) => x.isMesh)?.material)?.clone();
    if (!mat) continue;
    w.traverse((o) => { if (o.isMesh) o.material = mat; });
    weaponMats.push(mat);
  }
  // Mise à l'échelle sur la hauteur voulue
  if (!model.userData.h) {
    const box = new THREE.Box3().setFromObject(model);
    model.userData.h = box.max.y - box.min.y || 1;
  }
  model.scale.setScalar(HEIGHT / model.userData.h);

  const g = new THREE.Group();
  g.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
  let cur = null, curName = '';

  function play(name, { once = false, dur = 0, fade = 0.12 } = {}) {
    if (!once && curName === name) return;
    const clip = clips[name];
    if (!clip) return;
    const a = mixer.clipAction(clip);
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.timeScale = dur ? clip.duration / dur : 1;
    a.setEffectiveWeight(1);
    a.fadeIn(fade).play();
    if (cur && cur !== a) cur.fadeOut(fade);
    cur = a; curName = name;
  }
  play(c.idle);
  return { g, mixer, play, cfg: c, weaponMats, anim: true };
}
