// Static game data: party, glazes (our take on materia), items, monsters and encounters.
// Pure data + a few helpers, no DOM, so battle logic can be tested in Node.

export const CHARACTERS = {
  marl: {
    id: 'marl', name: 'Marl', role: 'Ferry apprentice',
    base: { hp: 72, mp: 14, atk: 14, def: 6, mag: 6, spd: 12 },
    growth: { hp: 11, mp: 3, atk: 2.2, def: 1.3, mag: 1.2, spd: 0.6 },
    limit: 'crush', color: '#e8c24a',
  },
  ochre: {
    id: 'ochre', name: 'Ochre', role: 'Ferry captain',
    base: { hp: 88, mp: 18, atk: 11, def: 9, mag: 10, spd: 9 },
    growth: { hp: 13, mp: 3.5, atk: 1.8, def: 1.6, mag: 1.7, spd: 0.5 },
    limit: 'lull', color: '#d0652e',
  },
  slip: {
    id: 'slip', name: 'Slip', role: 'Pickled tide-spirit',
    base: { hp: 56, mp: 30, atk: 7, def: 4, mag: 14, spd: 14 },
    growth: { hp: 8, mp: 5, atk: 1, def: 1, mag: 2.0, spd: 0.7 },
    limit: 'slipstream', color: '#8dd3c0',
  },
};

export const LIMITS = {
  crush: { id: 'crush', name: 'Thumbprint Crush', desc: 'One enormous blow that ignores armor.', kind: 'phys', power: 4.2, target: 'foe', ignoreDef: true },
  lull: { id: 'lull', name: "Tidemother's Lull", desc: 'Heals everyone and shakes off slowness.', kind: 'heal', power: 0, healPct: 0.6, target: 'allAllies', cleanse: true },
  slipstream: { id: 'slipstream', name: 'Slipstream', desc: 'A wet rush that hits every enemy.', kind: 'magic', power: 2.2, target: 'allFoes', elem: null },
};

// Glazes slot into characters. Each one teaches a single skill, and every glaze grows with use (see GLAZE_PERKS).
export const GLAZES = {
  ember: { id: 'ember', name: 'Ember', color: '#e8742f', desc: 'Fire damage. Fired clay turns brittle: the next blow shatters it.', skill: { id: 'ember', name: 'Ember', kind: 'magic', power: 1.5, elem: 'fire', mp: 4, target: 'foe' } },
  brine: { id: 'brine', name: 'Brine', color: '#3aa0c9', desc: 'Water damage. Soaks the target (slower, and a fire hit turns it to steam).', skill: { id: 'brine', name: 'Brine', kind: 'magic', power: 1.5, elem: 'water', mp: 4, target: 'foe' } },
  mend: { id: 'mend', name: 'Mend', color: '#7fcf6a', desc: 'Smooths cracks. Restores HP to one friend.', skill: { id: 'mend', name: 'Mend', kind: 'heal', power: 1.8, mp: 5, target: 'ally' } },
  wedge: { id: 'wedge', name: 'Wedge', color: '#b9a05a', desc: 'Braces a friend: damage halved until their next move.', skill: { id: 'wedge', name: 'Wedge', kind: 'guard', mp: 3, target: 'ally' } },
  slump: { id: 'slump', name: 'Slump', color: '#8a6fc7', desc: 'Slows an enemy like cooling clay.', skill: { id: 'slump', name: 'Slump', kind: 'slow', mp: 4, target: 'foe' } },
  deluge: { id: 'deluge', name: 'Deluge', color: '#2a6fd0', desc: 'Water damage to every enemy. Douses anything stoking a fire.', skill: { id: 'deluge', name: 'Deluge', kind: 'magic', power: 1.0, elem: 'water', mp: 9, target: 'allFoes' } },
  crackle: { id: 'crackle', name: 'Crackle', color: '#d9b36a', desc: 'Crazes an enemy\'s glaze. Brittle things take extra from the next physical blow.', skill: { id: 'crackle', name: 'Crackle', kind: 'crack', mp: 3, target: 'foe' } },
  quicken: { id: 'quicken', name: 'Quicken', color: '#f0d24a', desc: 'Expedited processing: a friend\'s gauge jumps and fills faster for a while.', skill: { id: 'quicken', name: 'Quicken', kind: 'haste', mp: 5, target: 'ally' } },
};

// Glaze mastery: AP is earned from victories by every glaze that is slotted, and it belongs to the orb, not the wearer.
export const GLAZE_LEVELS = [0, 50, 150];
export const glazeLevel = (ap = 0) => (ap >= GLAZE_LEVELS[2] ? 3 : ap >= GLAZE_LEVELS[1] ? 2 : 1);
export const apFor = (xp) => Math.round(xp * 0.55);
// What each level adds. `power` multiplies, `mp` adds, everything else replaces.
export const GLAZE_PERKS = {
  ember: [null, { power: 1.2 }, { power: 1.4, scorch: 9 }],
  brine: [null, { power: 1.2 }, { power: 1.4, drain: 25 }],
  mend: [null, { power: 1.2 }, { power: 1.4, cleanse: true }],
  wedge: [null, { limit: 15 }, { limit: 15, target: 'allAllies', mp: 3 }],
  slump: [null, { dur: 22 }, { dur: 22, target: 'allFoes', mp: 3 }],
  deluge: [null, { power: 1.25 }, { power: 1.5, drain: 20 }],
  crackle: [null, { dur: 20 }, { dur: 20, target: 'allFoes', mp: 3 }],
  quicken: [null, { dur: 18 }, { dur: 18, target: 'allAllies', mp: 4 }],
};
export const GLAZE_NOTES = {
  ember: ['', 'Lv 2: +20% power', 'Lv 3: +40% power, leaves the target scorched'],
  brine: ['', 'Lv 2: +20% power', 'Lv 3: +40% power, knocks 25 off their gauge'],
  mend: ['', 'Lv 2: +20% healing', 'Lv 3: +40% healing, soothes burns and silence'],
  wedge: ['', 'Lv 2: also feeds the Fracture gauge', 'Lv 3: braces the whole party'],
  slump: ['', 'Lv 2: lasts half again as long', 'Lv 3: slows every enemy'],
  deluge: ['', 'Lv 2: +25% power', 'Lv 3: +50% power, knocks 20 off every gauge'],
  crackle: ['', 'Lv 2: cracks last longer', 'Lv 3: crazes every enemy'],
  quicken: ['', 'Lv 2: lasts longer', 'Lv 3: quickens the whole party'],
};
export function levelSkill(base, lv) {
  const out = { ...base, lv };
  for (let i = 1; i < lv; i++) {
    const p = GLAZE_PERKS[base.id]?.[i];
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) out[k] = k === 'power' ? (base.power ?? 1) * v : k === 'mp' ? (out.mp || 0) + v : v;
  }
  return out;
}
// Adds AP to every distinct glaze in `ids`; returns the glazes that gained a level.
export function grantAp(store, ids, amount) {
  const ups = [];
  for (const id of new Set(ids.filter(Boolean))) {
    const before = glazeLevel(store[id]);
    store[id] = (store[id] || 0) + amount;
    const after = glazeLevel(store[id]);
    if (after > before) ups.push({ glaze: id, level: after });
  }
  return ups;
}

// Clay conditions. Values are how long they last, in battle seconds.
export const FX = {
  soaked: { label: 'Soaked', color: '#4aa8e0', note: 'Slower. Fire on it makes steam.' },
  brittle: { label: 'Brittle', color: '#d9b36a', note: 'The next physical hit shatters it for extra.' },
  hushed: { label: 'Hushed', color: '#b07ad6', note: 'Cannot use glazes.' },
  scorched: { label: 'Scorched', color: '#ff7a3a', note: 'Burns for a few seconds. Water puts it out.' },
  haste: { label: 'Quick', color: '#f0d24a', note: 'Gauge fills faster.' },
};

export const ITEMS = {
  wetclay: { id: 'wetclay', name: 'Wet Clay', desc: 'Heals 45 HP.', kind: 'heal', amount: 45, target: 'ally' },
  slipdraught: { id: 'slipdraught', name: 'Slip Draught', desc: 'Restores 18 MP.', kind: 'mp', amount: 18, target: 'ally' },
  coldslip: { id: 'coldslip', name: 'Cold Slip', desc: 'Heals 20 HP and soothes burns, silence and sluggishness.', kind: 'cleanse', amount: 20, target: 'ally' },
  brineflask: { id: 'brineflask', name: 'Brine Flask', desc: 'Thrown at a foe: 34 water damage. Soaks it and douses any fire it is stoking.', kind: 'throw', amount: 34, elem: 'water', target: 'foe' },
  brassthumb: { id: 'brassthumb', name: 'Brass Thumb', desc: "Keeper Brine's father's key. It is shaped exactly like a thumb.", key: true },
};

// Moves shared by monsters (target 'foe' means "one of the enemy's enemies", i.e. a party member).
// `inflict` puts a clay condition (see FX) on whoever it lands on.
export const MOVES = {
  attack: { id: 'attack', name: 'Attack', kind: 'phys', power: 1, target: 'foe' },
  cinder: { id: 'cinder', name: 'Cinder Toss', kind: 'magic', power: 1.2, elem: 'fire', target: 'foe', inflict: { fx: 'scorched', dur: 9, chance: 0.4 } },
  bite: { id: 'bite', name: 'Brackish Bite', kind: 'phys', power: 0.7, hits: 2, target: 'foe' },
  slick: { id: 'slick', name: 'Slick', kind: 'status', target: 'foe', inflict: { fx: 'soaked', dur: 14, chance: 1 } },
  bellow: { id: 'bellow', name: 'Soot Bellow', kind: 'magic', power: 0.7, elem: 'fire', target: 'allFoes', inflict: { fx: 'scorched', dur: 9, chance: 0.5 } },
  lock: { id: 'lock', name: 'Kiln-Lock', kind: 'slow', target: 'foe' },
  press: { id: 'press', name: 'Searing Press', kind: 'phys', power: 1.9, target: 'foe' },
  inferno: { id: 'inferno', name: 'Inferno Press', kind: 'magic', power: 1.0, elem: 'fire', target: 'allFoes', inflict: { fx: 'scorched', dur: 9, chance: 0.5 } },
  // the Warden's tell: one turn banking the fire, the next turn it comes out. Water on it in between puts the fire out.
  stoke: { id: 'stoke', name: 'Stoking the Fire', kind: 'charge', target: 'self' },
  blaze: { id: 'blaze', name: 'BLAZE', kind: 'magic', power: 2.5, elem: 'fire', target: 'allFoes', charged: true, inflict: { fx: 'scorched', dur: 9, chance: 0.8 } },
  wick: { id: 'wick', name: 'Wick-Mend', kind: 'heal', power: 1.25, target: 'ally', ai: 'healer' },
  stamp: { id: 'stamp', name: 'Stamp: DENIED', kind: 'phys', power: 0.6, target: 'foe', ai: 'hush', inflict: { fx: 'hushed', dur: 12, chance: 1 } },
  audit: { id: 'audit', name: 'Audit', kind: 'drain', amount: 12, target: 'foe', ai: 'drain' },
};

export const ENEMIES = {
  husk: {
    id: 'husk', name: 'Tide Husk', hp: 80, atk: 24, def: 3, mag: 0, spd: 8, xp: 28, weak: ['fire'], resist: [],
    moves: [['attack', 1]], blurb: 'A hollow shell the sea keeps wearing.',
    lore: 'What the sea sheds when it has finished with a person. Dry it and it crumbles. Hit it twice while it is brittle and it stops being a problem.',
  },
  kilnwright: {
    id: 'kilnwright', name: 'Kilnwright', hp: 140, atk: 26, def: 5, mag: 24, spd: 10, xp: 46, weak: ['water'], resist: ['fire'],
    moves: [['attack', 3], ['cinder', 2]], blurb: 'A Guild press-hand. Warm to the touch.',
    lore: 'Guild staff are pressed, like everyone, and given a job in place of a name. They are not cruel. They are on shift. Water makes them sulk.',
  },
  eel: {
    id: 'eel', name: 'Hollow Eel', hp: 100, atk: 26, def: 4, mag: 0, spd: 15, xp: 36, weak: ['fire'], resist: [],
    moves: [['attack', 1], ['bite', 2], ['slick', 1]], blurb: 'Swims through air as if the chapel were still flooded.',
    lore: 'Remembers being a flood. Its slick leaves you soaked and sluggish, which is cruel, because it is also fast.',
  },
  moth: {
    id: 'moth', name: 'Vigil Moth', hp: 64, atk: 17, def: 2, mag: 24, spd: 17, xp: 30, weak: ['fire'], resist: ['water'],
    moves: [['attack', 2], ['wick', 3]], blurb: 'Keeps the Guild\'s candles lit, and the Guild\'s people mended.',
    lore: 'Lives on lamp-wick and rumours. It will happily mend everything in the room for as long as you let it. Do not let it.',
  },
  auditor: {
    id: 'auditor', name: 'Auditor', hp: 118, atk: 20, def: 7, mag: 20, spd: 11, xp: 48, weak: ['fire'], resist: [],
    moves: [['attack', 2], ['stamp', 3], ['audit', 2]], blurb: 'Stamped from the same dull clay as the paperwork.',
    lore: 'Appears when something unauthorised is happening. Stamps your glazes DENIED until it is stopped. It is paper-thin where it matters. Burn it.',
  },
  warden: {
    id: 'warden', name: 'The Warden', hp: 1000, atk: 30, def: 8, mag: 30, spd: 11, xp: 300, weak: ['water'], resist: ['fire'],
    pattern: ['attack', 'bellow', 'lock', 'stoke', 'press'],
    enrage: { hp: 0.5, pattern: ['attack', 'stoke', 'press', 'bellow'], speed: 1.3 },
    boss: true, blurb: 'The kiln that keeps the Press cool.',
    lore: 'Every nine hundred years it banks its fire for one long breath. Water, thrown while it stokes, puts that breath out.',
  },
};

// `mods` bend a foe for a particular fight; `yieldAt` ends the battle without a kill once the foe drops below that fraction.
export const ENCOUNTERS = {
  pier_husks: { theme: 'pier', foes: ['husk', 'husk'] },
  archive_guild: { theme: 'archive', foes: ['kilnwright', 'husk'] },
  archive_wander: { theme: 'archive', foes: ['husk', 'husk'] },
  archive_clerks: { theme: 'archive', foes: ['auditor', 'moth'] },
  chapel_eels: { theme: 'chapel', foes: ['eel', 'eel', 'husk'] },
  chapel_wander: { theme: 'chapel', foes: ['eel', 'husk'] },
  chapel_vigil: { theme: 'chapel', foes: ['eel', 'moth', 'moth'] },
  kiln_warden: { theme: 'kiln', foes: ['warden'], boss: true },
  // the Warden, spoken to by name: it will not stoke a fire at its own name, and it can be talked down
  kiln_warden_named: {
    theme: 'kiln', foes: ['warden'], boss: true, yieldAt: 0.3,
    mods: [{ hp: 0.75, pattern: ['attack', 'bellow', 'lock', 'attack'], enrage: false }],
  },
};

export function statsAt(id, level) {
  const c = CHARACTERS[id];
  const k = level - 1;
  const out = {};
  for (const key of Object.keys(c.base)) out[key] = Math.round(c.base[key] + c.growth[key] * k);
  return out;
}

export const xpToNext = (level) => 40 + level * 30;

// Adds xp to a persistent party member record; returns level-up notes.
export function grantXp(member, xp) {
  const ups = [];
  member.xp = (member.xp || 0) + xp;
  while (member.xp >= xpToNext(member.level) && member.level < 20) {
    member.xp -= xpToNext(member.level);
    const before = statsAt(member.id, member.level);
    member.level += 1;
    const after = statsAt(member.id, member.level);
    // a level-up also tops off what you gained
    member.hp = Math.min(after.hp, (member.hp || 0) + (after.hp - before.hp));
    member.mp = Math.min(after.mp, (member.mp || 0) + (after.mp - before.mp));
    ups.push({ id: member.id, level: member.level, gains: { hp: after.hp - before.hp, mp: after.mp - before.mp, atk: after.atk - before.atk, mag: after.mag - before.mag } });
  }
  return ups;
}

export function newMember(id, level, glazes = []) {
  const s = statsAt(id, level);
  return { id, level, xp: 0, hp: s.hp, mp: s.mp, limit: 0, glazes: [glazes[0] || null, glazes[1] || null] };
}

// The story's conspiracy board. gx/gy are cells on a 3x3 corkboard; x/y are the same spots in 960x540 space for the
// landscape board. Notes are found by looking; DEDUCTIONS are made by connecting two of them yourself.
const BX = [176, 382, 589];
const BY = [120, 235, 350];
const clue = (id, gx, gy, title, text) => ({ id, gx, gy, x: BX[gx], y: BY[gy], title, text });
export const CLUES = {
  same_thumb: clue('same_thumb', 0, 0, 'The Same Thumb', "Forty-one Founders on Mudhaven's harbor wall, and every thumbprint is the same print: same whorl, same split in the ridge. Either the Founders shared a thumb, or somebody pressed them all."),
  four_signs: clue('four_signs', 1, 0, 'Four Signs', 'Every drowned-city story, from the fisher-king under his lake to the lit town beneath the southern sea, names the same four signs. Read in order: the Mouth that sings it up, the Hand that shapes it, the Eye that watches it, the Tide that takes it back.'),
  ledger: clue('ledger', 2, 0, 'The Pressing Ledger', '"Batch 1: 41 founders, pressed and fired. Batch 2 to be pressed when the tide falls." Pressed. Fired. Like pots. And somebody has kept the accounts for nine hundred years.'),
  keepers_log: clue('keepers_log', 0, 1, "The Keeper's Log", 'Old Brine\'s lamp-room log: page after page of tide tables, and then, in a shakier hand, "Walked out of the Kilnhouse tonight with the Thumb in my coat. Cobb stayed. Cobb always stays. Somebody has to keep it warm." In the margin his son has written: He wasn\'t brave. He was tired.'),
  tide_chart: clue('tide_chart', 1, 1, 'The 900-Year Tide', 'The chapel mural: a sun, a long falling wave, and under it a face with closed eyes. The sea does not leave for nothing. It goes to the Hollow every nine hundred years, to let something cool. Today is the day.'),
  hueso_file: clue('hueso_file', 2, 1, 'File Zero: The Unpressed', 'Hueso\'s own folder, kept at the back of a drawer he does not open in front of visitors. BATCH ZERO: one citizen, shaped before the Press existed and never fired. No thumbprint. Status: Retained, as record-keeper. Reason for retention: "he asked." Clipped beneath it, in the same neat hand: COBB, first Stoker. Retained, as kiln. Reason: "he volunteered."'),
  slip_memory: clue('slip_memory', 0, 2, 'What Slip Remembers', 'Slips are the sea\'s memory, which is why the Guild jars them. Slip remembers a tune the tide hums on its way out: four phrases, always in the same order, never quite resolving. It is not a tune you would know. Except that you do. It is the ferry lullaby.'),
  the_truth: clue('the_truth', 1, 2, 'What the Warden Kept', 'There was never a Founder. There is a god asleep in the harbor, and we are the clay it shed in its sleep. The Guild fires us to keep us quiet. The sea is its dream; the low tide is its breath.'),
};

// Two notes that belong together. Connecting them (in the journal) writes down what they mean, and sets the flag `d_<id>`,
// which the scenes read: some doors only open for someone who has worked a thing out.
export const DEDUCTIONS = {
  pressed: { id: 'pressed', needs: ['same_thumb', 'ledger'], title: 'Nobody Founded Anything', text: 'Forty-one identical thumbs, and a ledger that counts them like crockery. The Founders of Mudhaven were pressed, fired and stood against a wall. Nobody founded a town. Somebody manufactured one, and has been keeping the receipts.' },
  tonight: { id: 'tonight', needs: ['tide_chart', 'ledger'], title: 'Batch Two Is Tonight', text: '"To be pressed when the tide falls." The tide has fallen. Today is the day on the mural, and the day in the ledger, and they are the same day. Whatever Batch Two is, it is being pressed now. Somewhere warm.' },
  cobb: { id: 'cobb', needs: ['keepers_log', 'hueso_file'], title: 'Cobb Stayed', text: 'Brine\'s father walked out of the Kilnhouse; Cobb stayed. Hueso\'s card says Cobb was retained "as kiln". The Warden is not a machine somebody built. It is a man who volunteered to be warm, nine hundred years ago, and nobody ever came to relieve him.' },
  unfired: { id: 'unfired', needs: ['hueso_file', 'same_thumb'], title: 'The Unfired Thumb', text: 'Every thumb on the Wall was pressed and fired hard, so every thumb fits the Press. Hueso\'s was never fired. He is the one citizen of Mudhaven the Press cannot use, and the only one it cannot refuse to hold.' },
  lullaby: { id: 'lullaby', needs: ['four_signs', 'slip_memory'], title: 'The Four Beats', text: 'Mouth, Hand, Eye, Tide: four signs on a wall, four phrases the sea hums going out, four beats in a ferry lullaby. It was never a lock. It is a song, and the glyphs are the order you sing it in.' },
};
export const dedFor = (a, b) => Object.values(DEDUCTIONS).find((d) => d.needs.includes(a) && d.needs.includes(b) && a !== b) || null;
