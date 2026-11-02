// Optional Mudhaven activities. These live outside the critical path and use ordinary save flags,
// so they survive reloads without changing the main story's progression.
const hot = (id, name, rect, stand, use) => ({ id, name, rect, stand, use });
const done = (g, key) => g.flag('extra_' + key);
const finish = (g, key) => { g.setFlag('extra_' + key); g.save(); };

async function lighthouse(g) {
  await g.say('marl', "The lamp has a shutter with four little brass teeth. Someone has scratched a sequence into the rail.");
  const rounds = [
    { q: 'The first signal begins with which light?', a: 0, opts: ['One long flash', 'Two short flashes', 'Three short flashes'] },
    { q: 'What answers the first signal?', a: 2, opts: ['One short flash', 'A long flash', 'Three short flashes'] },
    { q: 'And how does the keeper close the message?', a: 1, opts: ['Three long flashes', 'Two long flashes', 'One short flash'] },
  ];
  let score = 0;
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i], pick = await g.ask(r.q, r.opts);
    if (pick === r.a) { score++; await g.say('brine', ['Aye. The old harbor call.', 'That is the answer. The sea used to know it by heart.', 'Correct. A message sent home.'][i]); }
    else await g.say('brine', ['One long flash. A warning, not a greeting.', 'Three short. It means the channel is clear.', 'Two long. The old sign for safe passage.'][i]);
  }
  if (score === 3 && !done(g, 'lighthouse_prize')) {
    finish(g, 'lighthouse_prize'); g.give('wetclay', 1);
    await g.say('brine', "Perfect. You remembered a language nobody thought to teach you. Keep this. It belonged to the lamp room.");
  } else await g.say('brine', score === 3 ? "Perfect again. The lamp remembers you." : score + " of three. The light will wait. It has practice.");
  if (!done(g, 'lighthouse_story')) {
    finish(g, 'lighthouse_story');
    await g.say('narr', "Behind the shutter is a narrow strip of paper: To whoever is still watching, the far shore is not empty. It is waiting.");
    g.raiseBond('brine', 1);
  }
}

async function workshop(g) {
  await g.say('kilnwright', "A little figure, three lumps and a thumbprint. The trick is not to make it beautiful. The trick is to make it recognisable.");
  const prompts = [
    { q: 'The body is too narrow. What do you add?', o: ['A little clay at each side', 'A taller head', 'A second pair of feet'], a: 0 },
    { q: 'The glaze is cracking. What will help?', o: ['More fire', 'A slower, even coat', 'A sharp tool'], a: 1 },
    { q: 'What makes the figure unmistakably a keeper?', o: ['A crown', 'A long coat and lamp', 'Wings'], a: 1 },
  ];
  let score = 0;
  for (const p of prompts) { const n = await g.ask(p.q, p.o); if (n === p.a) score++; }
  await g.say('marl', score === 3 ? "There. A little keeper, holding a little light." : "It is lopsided. But it looks as if it has somewhere to be.");
  if (score === 3 && !done(g, 'workshop_prize')) { finish(g, 'workshop_prize'); g.give('wetclay', 2); await g.say('kilnwright', "Good hands. Take the spare clay. It should be made into something, not left to dry."); }
  else await g.say('kilnwright', "You may try again. Clay is patient with its mistakes.");
  if (!done(g, 'workshop')) finish(g, 'workshop');
}

async function bottles(g) {
  const pieces = [
    "The ferry left before dawn, though there was no tide.",
    "I kept the porch light burning because you said you would come back.",
    "When the water returned, it brought the boat home empty.",
  ];
  await g.say('marl', "Three scraps in one bottle. A letter with its sentences scattered by the sea.");
  const order = await g.ask('Which sentence belongs first?', ['The ferry left before dawn', 'I kept the porch light burning', 'When the water returned']);
  const second = await g.ask('What comes after the ferry leaves?', ['The water returned', 'The porch light stayed on', 'The letter ends']);
  const correct = order === 0 && second === 1;
  await g.say('narr', correct ? pieces.join(' ') : "The scraps do not quite settle. Still, the handwriting is the same on all three.");
  if (correct && !done(g, 'bottles_prize')) { finish(g, 'bottles_prize'); g.give('wetclay', 1); await g.say('marl', "Someone waited a long time. I hope they knew the light was seen."); }
  else await g.say('slip', "Letters are funny. Even broken, they keep trying to reach somebody.");
  if (!done(g, 'bottles')) finish(g, 'bottles');
}

async function naturalist(g) {
  const creatures = [
    { id: 'naturalist_minnow', name: 'silver minnow', clue: 'A bright flicker that turns with the current.', answer: 1 },
    { id: 'naturalist_crab', name: 'mud crab', clue: 'A patient scuttler that hides beneath stones.', answer: 0 },
    { id: 'naturalist_moonfin', name: 'moonfin', clue: 'A pale fish that follows the moon rather than the bait.', answer: 2 },
  ];
  for (const c of creatures) {
    if (g.flag(c.id)) continue;
    await g.say('marl', c.clue);
    const pick = await g.ask('Which creature does the field guide describe?', ['Mud crab', 'Silver minnow', 'Moonfin']);
    if (pick === c.answer) { g.setFlag(c.id); await g.say('slip', "That's one for the little book. It is nice to be noticed without being caught."); }
    else await g.say('slip', "Not quite. Watch the water a little longer.");
    g.save();
  }
  if (creatures.every(c => g.flag(c.id)) && !done(g, 'naturalist_prize')) {
    finish(g, 'naturalist_prize'); g.give('wetclay', 2);
    await g.say('brine', "A proper record of the shallows. Most people only write down what they take. You wrote down what lives here.");
  } else await g.say('marl', "The field guide has " + creatures.filter(c => g.flag(c.id)).length + " of three creatures recorded.");
}

async function house(g) {
  const memories = [
    ['A chipped blue cup', 'A child used to leave it by the window for someone coming home late.'],
    ['A coat with salt in its seams', 'The wearer always stood on the step until the ferry lights disappeared.'],
    ['A small wooden bird', 'It was carved for a birthday that never came.'],
  ];
  let found = 0;
  for (let i = 0; i < memories.length; i++) {
    const c = await g.ask(memories[i][0] + '. What do you do?', ['Turn it over gently', 'Put it back', 'Take it with you']);
    if (c === 0 || c === 1) { found++; await g.say('narr', memories[i][1]); }
  }
  if (found >= 2 && !done(g, 'house')) {
    finish(g, 'house'); await g.say('marl', "The house was not haunted. It was keeping a place for somebody.");
    g.raiseBond('ochre', 1);
  } else if (done(g, 'house')) await g.say('marl', "The house is quiet now. It has told me what it needed to tell.");
  else await g.say('marl', "I should come back when I can give this place a little more time.");
}

async function underPier(g) {
  await g.say('narr', "Something moves beneath the lowest plank. Not a husk. Not an eel. Something small enough to hide, and frightened enough to stay hidden.");
  const c = await g.ask('How do you approach?', ['Leave a little food and step away', 'Reach into the dark', 'Call for Brine']);
  if (c === 0 && !done(g, 'under_pier')) {
    await g.say('marl', "The little shape takes the food after you turn your back. Its shell is pale as the inside of a pearl.");
    await g.say('brine', "A harborling. They used to nest under the old piers. I thought the Guild had driven them all away.");
    finish(g, 'under_pier'); g.raiseBond('brine', 1);
  } else if (done(g, 'under_pier')) await g.say('marl', "The harborling watches from its shelter. It knows you now, and that is enough.");
  else if (c === 1) await g.say('narr', "It vanishes with a small, indignant splash. Some trust cannot be hurried.");
  else { await g.say('brine', "Quietly, then. If it is still here, it has learned to be careful."); }
}

async function clockmaker(g) {
  const parts = [
    { q: 'The stopped clock has lost its hands. What should turn first?', o: ['The escapement', 'The bell', 'The face'], a: 0 },
    { q: 'The minute wheel catches. What do you check?', o: ['The spring tension', 'The paint', 'The case hinges'], a: 0 },
    { q: 'The clock begins to move. What do you set it to?', o: ['The hour it stopped', 'The hour you wish for', 'Midnight'], a: 2 },
  ];
  let n = 0;
  for (const p of parts) if (await g.ask(p.q, p.o) === p.a) n++;
  if (n >= 2 && !done(g, 'clockmaker')) {
    finish(g, 'clockmaker'); g.give('wetclay', 1);
    await g.say('narr', "The clock gives one careful tick. A drawer opens. Inside is a note: Time was never the thing I wanted back. Only the chance to say goodbye.");
  } else if (done(g, 'clockmaker')) await g.say('marl', "The clock keeps its small, steady time. The note is safe in the journal.");
  else await g.say('marl', "The gears settle again. Better to leave them undamaged and try another day.");
}

async function garden(g) {
  const items = [
    { item: 'a red mitten', person: 'Ochre', response: "I thought the sea had taken that. It belonged to my deckhand. He wore it on the crossing home." },
    { item: 'a brass button', person: 'Brine', response: "My father's coat. I kept the other button in a drawer for forty years." },
    { item: 'a paper star', person: 'Slip', response: "I made that! Or I knew someone who did. It feels like both." },
  ];
  for (const x of items) {
    const key = 'garden_' + x.person.toLowerCase();
    if (g.flag(key)) continue;
    const c = await g.ask('You find ' + x.item + '. Return it to ' + x.person + '?', ['Return it', 'Leave it in the garden']);
    if (c === 0) { g.setFlag(key); await g.say(x.person.toLowerCase(), x.response); }
  }
  if (items.every(x => g.flag('garden_' + x.person.toLowerCase())) && !done(g, 'garden_prize')) {
    finish(g, 'garden_prize'); g.give('wetclay', 2);
    await g.say('marl', "The garden is empty now. It looks less like a place where things are lost, and more like somewhere they were kept safe.");
  }
}

async function midnight(g) {
  if (!g.flag('boss_beaten')) {
    await g.say('marl', "The ferry bell is quiet. Whatever this crossing is, it is not ready to be made.");
    return;
  }
  const c = await g.ask('A ferry waits beyond the ordinary channel. Who should cross first?', ['The one who has waited longest', 'The one who is most afraid', 'Marl']);
  if (c === 0 && !done(g, 'midnight')) {
    finish(g, 'midnight'); g.raiseBond('ochre', 1);
    await g.say('narr', "The passengers are not ghosts. They are the things Mudhaven never finished saying. One by one, they step ashore, lighter than when they came aboard.");
    await g.say('ochre', "I thought the harbor would feel emptier. It feels as if somebody opened a window.");
  } else if (done(g, 'midnight')) await g.say('ochre', "The channel is quiet now. I think they all found the shore they needed.");
  else await g.say('slip', "Not yet. The bell knows the difference between a crossing and an escape.");
}

const JOURNAL = [
  ['Tidepool Shell Game','tidepool_prize'],['Archive Index Cards','index_cards_prize'],["Slip's Skipping Stones",'stone_skip_prize'],['Brine’s Fishing Collection','fishing_collection_prize'],
  ["Lighthouse Keeper’s Signals",'lighthouse_story'],["Kilnwright’s Workshop",'workshop'],['Messages in Bottles','bottles'],['Tidepool Naturalist','naturalist_prize'],
  ['The House That Remembers','house'],['Something Under the Pier','under_pier'],["The Clockmaker’s Last Hour",'clockmaker'],['The Garden of Lost Things','garden_prize'],['The Midnight Crossing','midnight'],
];
async function journal(g) {
  const lines = JOURNAL.map(([name,key]) => (done(g,key) || g.flag(key) ? '✓ ' : '○ ') + name);
  const count = lines.filter(x => x.startsWith('✓')).length;
  await g.say('marl', "Mudhaven keeps a record, whether anyone asks it to or not.");
  await g.say('narr', count + ' of ' + JOURNAL.length + ' optional discoveries recorded. Nothing here is required to finish the story.');
  for (let i = 0; i < lines.length; i += 4) await g.say('marl', lines.slice(i,i+4).join('   •   '));
}

export function optionalHotspots(g) {
  const list = [];
  if (g.state.scene === 'pier') {
    list.push(hot('extra-lighthouse', 'Keeper’s Signal Shutter', [660, 360, 62, 42], [690, 438], lighthouse));
    list.push(hot('extra-under-pier', 'Something Under the Pier', [520, 390, 64, 36], [550, 438], underPier));
    list.push(hot('extra-midnight', 'The Midnight Crossing', [74, 390, 60, 34], [130, 438], midnight));
  }
  if (g.state.scene === 'archive') {
    list.push(hot('extra-clockmaker', 'Clockmaker’s Stopped Clock', [680, 360, 72, 42], [720, 438], clockmaker));
    list.push(hot('extra-journal', 'Mudhaven Completion Journal', [885, 370, 52, 52], [850, 438], journal));
  }
  if (g.state.scene === 'chapel') {
    list.push(hot('extra-bottles', 'Messages in Bottles', [690, 380, 64, 42], [720, 452], bottles));
    list.push(hot('extra-naturalist', 'Tidepool Naturalist', [110, 390, 64, 42], [150, 452], naturalist));
    list.push(hot('extra-house', 'The House That Remembers', [210, 390, 64, 42], [250, 452], house));
    list.push(hot('extra-garden', 'Garden of Lost Things', [830, 390, 60, 42], [800, 452], garden));
  }
  if (g.state.scene === 'kiln') {
    list.push(hot('extra-workshop', 'Kilnwright’s Workshop', [680, 390, 64, 42], [720, 466], workshop));
  }
  return list.filter(h => !g.flag('extra_' + h.id.replace('extra-','')) || ['extra-lighthouse','extra-workshop','extra-bottles','extra-naturalist','extra-house','extra-under-pier','extra-clockmaker','extra-garden','extra-midnight','extra-journal'].includes(h.id));
}
