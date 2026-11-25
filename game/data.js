// Contenu du jeu : zones, monstres, PNJ, objets et quêtes.
// Ajouter une quête = ajouter une entrée dans QUESTS, rien d'autre à toucher.

// Classes jouables. dmg = multiplicateur de dégâts, swing = durée d'un coup (s),
// kind = 'melee' ou 'ranged', crit = chance de coup critique.
export const CLASSES = {
  guerrier: {
    name: 'Guerrier', icon: '🪓', role: 'Corps à corps · Robuste',
    desc: 'Colosse en armure de plaques, armé d\'une hache à deux mains. Encaisse les coups et frappe très fort.',
    hp: 140, hpLvl: 20, dmg: 1.1, kind: 'melee', reach: 3.9, swing: 0.42, crit: 0.12, dodgeCost: 25,
    skill: { name: 'Tourbillon', icon: '🌀', cd: 7, type: 'whirl', mult: 2.4, radius: 6.5, desc: 'Tournoie et frappe tout autour de lui.' },
    stats: { Vie: 5, Dégâts: 4, Portée: 1, Soins: 1 },
  },
  paladin: {
    name: 'Paladin', icon: '🛡️', role: 'Corps à corps · Soins',
    desc: 'Champion de la lumière, masse et bouclier en main. Chacun de ses coups le soigne un peu.',
    hp: 130, hpLvl: 18, dmg: 0.95, kind: 'melee', reach: 3.5, swing: 0.4, crit: 0.1, lifesteal: 0.15, dodgeCost: 25,
    skill: { name: 'Lumière sacrée', icon: '✨', cd: 10, type: 'holy', mult: 1.8, radius: 7, heal: 0.35, desc: 'Explosion de lumière : soigne 35 % et blesse les ennemis proches.' },
    stats: { Vie: 4, Dégâts: 3, Portée: 1, Soins: 5 },
  },
  voleur: {
    name: 'Voleur', icon: '🗡️', role: 'Corps à corps · Critiques',
    desc: 'Assassin agile aux deux dagues. Frappe vite, esquive souvent et porte des coups critiques dévastateurs.',
    hp: 100, hpLvl: 14, dmg: 0.72, kind: 'melee', reach: 3.0, swing: 0.24, crit: 0.32, dodgeCost: 15,
    skill: { name: 'Pas de l\'ombre', icon: '🌑', cd: 6, type: 'shadow', mult: 3.5, desc: 'Se téléporte dans le dos de l\'ennemi et le poignarde.' },
    stats: { Vie: 2, Dégâts: 5, Portée: 1, Soins: 1 },
  },
  chasseur: {
    name: 'Chasseur', icon: '🏹', role: 'Distance · Polyvalent',
    desc: 'Archer des terres sauvages. Tire des flèches à longue portée et garde les monstres à distance.',
    hp: 110, hpLvl: 15, dmg: 0.85, kind: 'ranged', range: 24, proj: 'arrow', swing: 0.42, crit: 0.15, dodgeCost: 20,
    skill: { name: 'Pluie de flèches', icon: '🎯', cd: 8, type: 'rain', mult: 2.3, radius: 6, desc: 'Une volée de flèches s\'abat sur la zone ciblée.' },
    stats: { Vie: 3, Dégâts: 3, Portée: 5, Soins: 1 },
  },
  mage: {
    name: 'Mage', icon: '🔥', role: 'Distance · Dégâts de zone',
    desc: 'Érudit des arcanes. Ses boules de feu explosent sur plusieurs ennemis, mais il est fragile.',
    hp: 85, hpLvl: 12, dmg: 1.0, kind: 'ranged', range: 21, proj: 'fire', splash: 3, swing: 0.55, crit: 0.12, dodgeCost: 25,
    skill: { name: 'Nova de givre', icon: '❄️', cd: 9, type: 'frost', mult: 2.0, radius: 8, desc: 'Gèle les ennemis autour de lui et les ralentit.' },
    stats: { Vie: 1, Dégâts: 5, Portée: 4, Soins: 1 },
  },
};

export const ZONES = {
  village: { name: 'Brumeval', hint: 'Un refuge sûr' },
  plains: { name: 'Prés d\'Or', hint: 'Niveau 1-3' },
  forest: { name: 'Sylve Noire', hint: 'Niveau 3-6' },
  marsh: { name: 'Marais Brumeux', hint: 'Niveau 5-8' },
  volcanic: { name: 'Crêtes de Braise', hint: 'Niveau 7-10' },
};

// attacks : bite (morsure devant), slam (zone autour), charge (ligne), leap (saut sur le joueur)
export const MONSTERS = {
  sanglier: {
    name: 'Sanglier épineux', lvl: 1, hp: 45, speed: 5, size: 1, xp: 25, gold: 3, aggro: 12, leash: 35,
    color: 0x7a5a3a, color2: 0x4a3420, horns: true, fur: true,
    attacks: [{ type: 'bite', range: 1.5, windup: 0.7, dmg: 7 }],
  },
  loup: {
    name: 'Loup de cendre', lvl: 3, hp: 80, speed: 7, size: 1.1, xp: 45, gold: 5, aggro: 16, leash: 40,
    color: 0x5a5a62, color2: 0x2a2a30, eye: 0xff5a2a, tail: true, fur: true,
    attacks: [
      { type: 'bite', range: 1.5, windup: 0.55, dmg: 11 },
      { type: 'leap', radius: 2.2, windup: 0.9, dmg: 14, minRange: 5, maxRange: 11 },
    ],
  },
  crapaud: {
    name: 'Crapaud des brumes', lvl: 5, hp: 140, speed: 4, size: 1.4, xp: 70, gold: 8, aggro: 14, leash: 35,
    color: 0x5a7a4a, color2: 0x3a4a2a, eye: 0xd0ff4a,
    attacks: [
      { type: 'bite', range: 1.8, windup: 0.7, dmg: 16 },
      { type: 'slam', radius: 4.5, windup: 1.1, dmg: 20, maxRange: 5 },
    ],
  },
  salamandre: {
    name: 'Salamandre ardente', lvl: 7, hp: 200, speed: 6, size: 1.3, xp: 100, gold: 12, aggro: 16, leash: 40,
    color: 0xa0401a, color2: 0x3a1a10, eye: 0xffee55, tail: true, spikes: true, glow: 0xff6a20,
    attacks: [
      { type: 'bite', range: 1.8, windup: 0.6, dmg: 20 },
      { type: 'charge', length: 14, width: 2.6, windup: 0.9, dmg: 26, minRange: 4, maxRange: 13 },
    ],
  },
  // --- Colosses (boss)
  ronceroc: {
    name: 'Ronceroc, Colosse de la Sylve', lvl: 5, hp: 900, speed: 5, size: 3, xp: 450, gold: 80, aggro: 22, leash: 60, boss: true,
    color: 0x4a5a2a, color2: 0x2a3418, eye: 0xb0ff4a, horns: true, spikes: true, fur: true,
    attacks: [
      { type: 'bite', range: 2, windup: 0.8, dmg: 20 },
      { type: 'slam', radius: 7, windup: 1.3, dmg: 30, maxRange: 7, recover: 1.4 },
      { type: 'charge', length: 22, width: 4.5, windup: 1.1, dmg: 32, minRange: 6, maxRange: 22 },
    ],
  },
  pyrocorne: {
    name: 'Pyrocorne, Colosse des Braises', lvl: 9, hp: 2000, speed: 6, size: 3.6, xp: 1200, gold: 250, aggro: 24, leash: 70, boss: true,
    color: 0x5a1a10, color2: 0x1a0a08, eye: 0xffcc22, horns: true, spikes: true, tail: true, glow: 0xff5a10,
    attacks: [
      { type: 'bite', range: 2.2, windup: 0.75, dmg: 30 },
      { type: 'slam', radius: 10, windup: 1.6, dmg: 45, maxRange: 9, recover: 1.5 },
      { type: 'charge', length: 26, width: 5, windup: 1.0, dmg: 40, minRange: 6, maxRange: 25 },
      { type: 'leap', radius: 5, windup: 1.2, dmg: 38, minRange: 8, maxRange: 20 },
    ],
  },
};

export const SPAWNS = [
  { type: 'sanglier', zone: 'plains', count: 18 },
  { type: 'loup', zone: 'forest', count: 16 },
  { type: 'crapaud', zone: 'marsh', count: 14 },
  { type: 'salamandre', zone: 'volcanic', count: 14 },
  { type: 'ronceroc', at: [0, -205] },
  { type: 'pyrocorne', at: [0, 215] },
];

export const ITEMS = {
  fleur: { name: 'Fleur de lune', zone: 'forest', count: 26, color: 0xa0c8ff, shape: 'flower' },
  mousse: { name: 'Mousse luisante', zone: 'marsh', count: 22, color: 0x8aff6a, shape: 'moss' },
  ambre: { name: 'Ambre de feu', zone: 'volcanic', count: 22, color: 0xffa020, shape: 'amber' },
};

export const NPCS = {
  maelle: { name: 'Ancienne Maëlle', at: [-4, -6], face: 0.5, color: 0x6a4a8a, hat: 0x3a2a5a, idle: 'Brumeval compte sur toi, chasseur.' },
  brann: { name: 'Forgeron Brann', at: [14, -9], face: -0.8, color: 0x5a3a2a, idle: 'Ma forge ne dort jamais. Reviens avec du travail !' },
  lysa: { name: 'Herboriste Lysa', at: [-14, 8], face: 2.4, color: 0x3a7a4a, hat: 0x2a5a3a, idle: 'Prends soin de toi là-dehors.' },
  tavin: { name: 'Éclaireur Tavin', at: [-2, -112], face: Math.PI, color: 0x4a5a3a, hat: 0x2a3a1a, idle: 'La Sylve est dangereuse. Garde les yeux ouverts.' },
  orla: { name: 'Pisteuse Orla', at: [62, 6], face: -1.6, color: 0x2a5a6a, hat: 0x1a3a4a, idle: 'Le marais cache bien des choses…' },
};

// obj.t : 'kill' | 'collect'. Une quête sans objectif se rend directement au PNJ « turnin ».
export const QUESTS = [
  {
    id: 'q1', giver: 'maelle', turnin: 'maelle', title: 'Les prés menacés',
    text: 'Les sangliers épineux ravagent nos champs. Va dans les Prés d\'Or, à l\'ouest, et chasses-en quatre.',
    done: 'Bien joué ! Tu as l\'étoffe d\'un vrai chasseur.', remind: 'Les sangliers sont à l\'ouest, dans les Prés d\'Or.',
    obj: [{ t: 'kill', id: 'sanglier', n: 4 }], rew: { xp: 120, gold: 25 },
  },
  {
    id: 'q2', giver: 'brann', turnin: 'brann', title: 'Du métal digne de ce nom', req: ['q1'],
    text: 'Ta hache est émoussée. Rapporte-moi la preuve de ta force : six sangliers de plus, et je la reforge.',
    done: 'Voilà, essaie-la maintenant. Elle chante quand elle tranche !',
    obj: [{ t: 'kill', id: 'sanglier', n: 6 }], rew: { xp: 150, weapon: 1 },
  },
  {
    id: 'q3', giver: 'lysa', turnin: 'lysa', title: 'Fleurs de lune', req: ['q1'], minLvl: 2,
    text: 'Les fleurs de lune poussent dans la Sylve Noire, au nord. Rapporte-m\'en cinq pour mes potions. Attention aux loups.',
    done: 'Parfaites ! Tiens, quelques potions pour la route.',
    obj: [{ t: 'collect', id: 'fleur', n: 5 }], rew: { xp: 200, potions: 2, gold: 20 },
  },
  {
    id: 'q4', giver: 'maelle', turnin: 'tavin', title: 'Message pour l\'avant-poste', req: ['q2'],
    text: 'Tavin garde l\'avant-poste nord, à l\'orée de la Sylve. Il a besoin de renfort. Suis le chemin vers le nord.',
    done: 'Enfin du renfort ! Maëlle t\'envoie ? Parfait, j\'ai du travail pour toi.',
    obj: [], rew: { xp: 80 },
  },
  {
    id: 'q5', giver: 'tavin', turnin: 'tavin', title: 'La meute de cendre', req: ['q4'],
    text: 'Les loups de cendre sont devenus fous. Quelque chose les pousse hors de la forêt. Abats-en cinq.',
    done: 'Ils fuyaient… quelque chose de bien plus gros.',
    obj: [{ t: 'kill', id: 'loup', n: 5 }], rew: { xp: 280, gold: 40 },
  },
  {
    id: 'q6', giver: 'tavin', turnin: 'tavin', title: 'Le Colosse de la Sylve', req: ['q5'], minLvl: 4,
    text: 'Ronceroc s\'est réveillé au cœur de la forêt, loin au nord. Observe ses attaques : les zones rouges annoncent ses coups. Esquive au bon moment !',
    done: 'Tu as abattu Ronceroc ?! Brumeval chantera ton nom.', remind: 'Ronceroc est au cœur de la Sylve, plein nord.',
    obj: [{ t: 'kill', id: 'ronceroc', n: 1 }], rew: { xp: 500, gold: 100, weapon: 1 },
  },
  {
    id: 'q7', giver: 'orla', turnin: 'orla', title: 'Brumes toxiques', req: ['q5'], minLvl: 5,
    text: 'Les crapauds des brumes empoisonnent l\'eau du marais, à l\'est. Élimine-en cinq et rapporte quatre mousses luisantes.',
    done: 'L\'eau s\'éclaircit déjà. Merci, chasseur.',
    obj: [{ t: 'kill', id: 'crapaud', n: 5 }, { t: 'collect', id: 'mousse', n: 4 }], rew: { xp: 450, gold: 60, potions: 2 },
  },
  {
    id: 'q8', giver: 'brann', turnin: 'brann', title: 'L\'ambre de feu', req: ['q6'], minLvl: 6,
    text: 'Pour forger une lame capable de blesser un colosse de feu, il me faut de l\'ambre des Crêtes de Braise, au sud. Six morceaux.',
    done: 'Regarde-moi cet éclat… ta hache n\'a plus d\'égale.',
    obj: [{ t: 'collect', id: 'ambre', n: 6 }], rew: { xp: 500, weapon: 1 },
  },
  {
    id: 'q9', giver: 'maelle', turnin: 'maelle', title: 'Les gardiens des braises', req: ['q7', 'q8'], minLvl: 7,
    text: 'Les salamandres ardentes gardent le chemin du Pyrocorne. Ouvre-toi la voie : six salamandres.',
    done: 'Le chemin est libre. Il est temps d\'affronter la bête.',
    obj: [{ t: 'kill', id: 'salamandre', n: 6 }], rew: { xp: 700, gold: 80 },
  },
  {
    id: 'q10', giver: 'maelle', turnin: 'maelle', title: 'L\'Écho des Colosses', req: ['q9'], minLvl: 8, final: true,
    text: 'Pyrocorne, le dernier colosse, veille au sommet des Crêtes de Braise. Abats-le et les Terres Sauvages retrouveront la paix.',
    done: 'C\'est fini… Tu es désormais une légende des Terres Sauvages.',
    obj: [{ t: 'kill', id: 'pyrocorne', n: 1 }], rew: { xp: 2000, gold: 500, weapon: 1 },
  },
];
