// Scenes: what is painted, what you can poke, and what happens when you do.
// Scripts are plain async functions that `await` dialogue, choices and battles on the Game.

import { LAYOUT, paintPier, paintArchive, paintChapel, paintKiln, CHAPEL_LAYOUT } from '../engine/stage.js';
import { Sequence, SIGN_ORDER } from './puzzles.js';

const rect = (r) => ({ rect: r });

// Brine, once you have read the ledger: the conversation he has been dreading. Every branch leads to the log, none to a lecture.
async function brineFather(g) {
  g.setFlag('brine_father');
  await g.say('marl', "Brine. I found a ledger in the archive. Batch One. Batch Two. 'Pressed and fired.'", 'worried');
  await g.say('brine', '...Ah.', 'sad');
  await g.say('narr', 'Keeper Brine sits down on an upturned crate the way a lighthouse would sit down, if it could, and had been waiting to.');
  await g.say('brine', "I did wonder how long it would take somebody to find it. I hoped it would be after I was dead. I'm told that is the cowardly kind of hope.", 'sad');
  const c = await g.ask('What do you say to Brine?', ['Ask about his father', 'Ask what the Guild wants', "Tell him it isn't his fault"]);
  if (c === 0) {
    await g.say('marl', "The Thumb was your father's. Where did he get it?", 'curious');
    await g.say('brine', "From the Kilnhouse. He was a stoker there for forty years. The Guild keeps the fires under the harbor, and somebody has to carry the coal, and clay doesn't ask why it's warm. He came home one night with that key in his coat, shaking, and never said another word about it.", 'sad');
    await g.say('brine', "He kept a log. It's in the lamp room. I can't read the last page again, so I never took it down. Take it. Read it for me.", 'sad');
  } else if (c === 1) {
    await g.say('marl', 'What does the Guild want?', 'curious');
    await g.say('brine', "Nothing. That is the horror of it, Marl. They want nothing, very carefully, for nine hundred years. A quiet harbor. A tide that stays where it's put. If they want anything it is for nobody to ask.", 'worried');
    await g.say('brine', "...My father's log is in the lamp room. If you're going to ask, ask properly.", 'sly');
  } else {
    await g.say('marl', "Whatever it is, it isn't your fault. You were a boy.", 'sad');
    await g.say('brine', '...', 'sad');
    await g.say('brine', "That was kind. It was also not what I asked for, and it is exactly what I needed. Sit. It's mud tea, and it's better than it sounds.", 'cheer');
    g.healParty();
    await g.say('brine', "My father's log is in the lamp room, when you're ready. It doesn't say it was anybody's fault either. It just says what happened.", 'sad');
  }
  g.setFlag('log_offered');
}

// ====================================================================== PIER
const pier = {
  id: 'pier',
  name: 'Mudhaven Pier',
  music: 'sea',
  theme: 'pier',
  walk: LAYOUT.pier.walk,
  scale: [0.8, 1.08],
  start: { x: 480, y: 478 },

  paint(ctx, g, fr) {
    paintPier(ctx, fr, { hatchOpen: g.flag('hatch_open'), eyeOpen: g.flag('boss_beaten') ? 1 : g.deduced('tonight') ? 0.28 : 0 });
  },

  // things in the room itself: people walk behind them and in front of them
  props: () => [
    { prop: 'crates', x: 112, y: 506 },
    { prop: 'post', x: 262, y: 474 },
    { prop: 'post', x: 610, y: 438 },
  ],

  async enter(g) {
    if (g.flag('intro_done')) {
      if (g.flag('archive_seen') && !g.flag('pier_return')) {
        g.setFlag('pier_return');
        await g.say('narr', 'The pier again. Same planks, same sea, same smell of tar and unfinished sentences. The only difference was out in the shallows, where the pale shape had moved an inch toward the lighthouse. Or the lighthouse had moved an inch toward it. In this town you learn not to ask which.');
      }
      return;
    }
    g.setFlag('intro_done');
    await g.wait(0.5);
    await g.say('narr', 'Mudhaven. The hour the sea forgets itself.');
    await g.say('marl', "Low tide. But the water has never gone out this far. Not in any story I was told.", 'worried');
    await g.say('narr', 'Out past the lighthouse, something pale lifts from the shallows, like the lid of a closed eye.');
    await g.say('marl', "...It's a rock. Don't be a fool, Marl. It's a rock.", 'worried');
    g.toast('Tap the ground to walk. Tap things to look. Sparkles mean "look here".');
  },

  npcs(g) {
    const out = [
      {
        id: 'brine', kind: 'brine', x: LAYOUT.pier.keeper[0], y: LAYOUT.pier.keeper[1], face: -1, name: 'Keeper Brine',
        async use(g2) {
          if (!g2.flag('met_brine')) {
            g2.setFlag('met_brine');
            await g2.say('brine', "Marl. Come to look at the sea, have you? Everyone has. It's the first time it's ever left them anything to look at.", 'sad');
            await g2.say('marl', "Brine... what's out there? On the far side of the lighthouse?", 'curious');
            await g2.say('brine', "A guest who's been here longer than the harbor. The Guild says it's a sandbar. The Kilnwrights say a great many things, for people who never show their real hands.", 'sly');
            await g2.say('brine', "My father kept this for the day the tide fell past the lighthouse. I never thought I'd be the one to hand it over.", 'sad');
            g2.give('brassthumb');
            await g2.say('narr', 'The Brass Thumb. It is shaped exactly like a thumb: a left one, with a whorl you could lose a finger in.');
            await g2.say('brine', "It fits the hatch under the pier. Don't go alone. Ochre knows the stairs better than anyone alive, and she owes me a favour. And a kettle.", 'sly');
            g2.setFlag('has_thumb');
            return;
          }
          if (!g2.flag('ochre_joined')) {
            await g2.say('brine', "Ochre's at the ferry. Don't let her tell you it's too dark down there. It is. That has never been a reason.", 'sly');
            return;
          }
          if (g2.hasClue('ledger') && !g2.flag('brine_father')) {
            await brineFather(g2);
            return;
          }
          if (g2.partyHurt()) {
            await g2.say('brine', "Sit. Drink. It's mud tea, and it's better than it sounds.", 'cheer');
            g2.healParty();
            await g2.say('narr', 'Everyone feels pleasantly re-pressed.');
          } else if (g2.flag('boss_beaten')) {
            await g2.say('brine', "I heard it. The whole harbor heard it. ...Thank you for not letting me be right.", 'sad');
          } else if (g2.deduced('cobb')) {
            await g2.say('brine', "Cobb. You said his name just now, didn't you? Down there? My father used to say it in his sleep. Like a sum he couldn't make come out.", 'sad');
            await g2.say('brine', "Whatever you find at the bottom of the stairs, Marl, it was a person first. I'd like that on the record. Somebody ought to keep one.", 'sad');
          } else if (g2.deduced('tonight')) {
            await g2.say('brine', "Tonight. Of course it's tonight. Everything important in this harbor happens on the one night I have no tea ready.", 'worried');
          } else {
            await g2.say('brine', "The Guild keeps the tide still. The tide wants to move. Those can't both be happy, Marl.", 'worried');
          }
        },
      },
    ];
    if (!g.flag('ochre_joined')) {
      out.push({
        id: 'ochre', kind: 'ochre', x: LAYOUT.pier.ochre[0], y: LAYOUT.pier.ochre[1], face: 1, name: 'Captain Ochre',
        async use(g2) {
          if (!g2.flag('has_thumb')) {
            await g2.say('ochre', "Marl. You see it too, then. The sea's gone all the way out to the Hollow.", 'worried');
            await g2.say('marl', 'The what?', 'curious');
            await g2.say('ochre', "Old ferry word. Where the tide goes to breathe. Go and see Brine; he's been muttering about a key all morning.", 'sly');
            return;
          }
          await g2.say('ochre', "You've got Brine's old Thumb. Then it's true. All of it.", 'awe');
          await g2.say('marl', "Will you come down with me?", 'worried');
          await g2.say('ochre', "Kid, I'm the only one who's ever pushed a boat across this harbor in the dark. Of course I'm coming. Don't argue.", 'sly');
          g2.joinParty('ochre');
          g2.setFlag('ochre_joined');
        },
      });
    }
    return out;
  },

  hotspots() {
    const P = LAYOUT.pier;
    return [
      {
        id: 'wall', name: "Founders' Wall", ...rect(P.wall), stand: [412, 440],
        async use(g) {
          if (!g.hasClue('same_thumb')) {
            await g.say('narr', "The Founders' Wall: forty-one tiles, one for every founder of Mudhaven. Each carries a thumbprint pressed into the clay before it was fired.");
            await g.say('marl', "Same whorl. Same little split in the ridge. Forty-one tiles... forty-one identical thumbs.", 'awe');
            await g.say('marl', 'Either the Founders shared a thumb, or somebody pressed them all.', 'worried');
            g.addClue('same_thumb');
          } else {
            await g.say('marl', 'Forty-one tiles. One thumb. I keep counting, and it keeps being one.', 'worried');
          }
        },
      },
      {
        id: 'ferry', name: "The Pilgrim's Wake", ...rect(P.ferry), stand: [215, 446],
        async use(g) {
          if (g.flag('ochre_joined') && !g.flag('ferry_talk')) {
            g.setFlag('ferry_talk');
            await g.say('narr', "Ochre runs her palm along the Wake's rail the way you would along the neck of an old horse.");
            await g.say('ochre', "She hasn't carried anyone since the winter before last. I keep her scrubbed. I tell people it's for the inspection.", 'sad');
            const c = await g.ask('What do you say to Ochre?', ['Ask about the winter before last', 'Offer to help scrub her', 'Say nothing, and stand next to her']);
            if (c === 0) {
              await g.say('marl', 'What happened the winter before last?', 'curious');
              await g.say('ochre', "My deckhand. Rust. He went in for a shift at the Kilnhouse. Good money, four days of stoking. Came back warm and quiet, and he's been sitting in a chair by the window ever since. He still smiles. It's the same smile every time. I've started counting.", 'sad');
              await g.say('ochre', "That's why I'm coming down with you. Not for the harbor. For the chair.", 'angry');
              g.setFlag('ochre_rust');
              g.raiseBond('ochre', 2);
            } else if (c === 1) {
              await g.say('marl', "Hand me a brush. I'll do the starboard side.", 'cheer');
              await g.say('ochre', "...You scrub like a man who's never done it. Keep going. It isn't the scrubbing I want.", 'sly');
              g.raiseBond('ochre', 1);
            } else {
              await g.say('narr', 'Neither of them says anything for a while. The harbor, which is very good at this, makes the sound of water not minding.');
              await g.say('ochre', '...Thanks, kid.', 'sad');
              g.raiseBond('ochre', 1);
            }
            return;
          }
          await g.say('marl', "The Pilgrim's Wake. Captain Ochre's ferry. She hasn't taken her out in a week; says the harbor's been 'humming'.", 'curious');
        },
      },
      {
        id: 'sleeper', name: 'Pale Shape', rect: [200, 262, 270, 56], stand: [330, 436],
        async use(g) {
          if (g.deduced('tonight')) {
            await g.say('marl', "It isn't a rock. It's the lid of something that has been counting down since before I was pressed. And I think the count is nearly over.", 'worried');
            return;
          }
          await g.say('marl', 'A long pale hump in the shallows. Two bumps side by side, a ridge between them... like a face lying on its back.', 'awe');
          await g.say('marl', "Don't be silly. Rocks have bumps. That's what rocks do.", 'worried');
        },
      },
      {
        id: 'lighthouse', name: 'Lighthouse', rect: [738, 150, 130, 205], stand: [760, 430],
        async use(g) {
          if (g.flag('met_brine') && !g.hasClue('keepers_log')) {
            await g.say('narr', 'The lamp-room door is on the latch. Inside: oil, brass, a cold kettle, and a log lying open on the sill as if someone had set it down for the next reader.');
            await g.say('marl', "'Walked out of the Kilnhouse tonight with the Thumb in my coat. Cobb stayed. Cobb always stays. Somebody has to keep it warm.'", 'worried');
            await g.say('narr', "In the margin, in a younger hand: He wasn't brave. He was tired.");
            g.addClue('keepers_log');
            await g.say('narr', 'Under the log, wrapped in oilcloth, sit two flasks of brine. The old man kept a few things on hand in case something needed putting out.');
            g.give('brineflask', 2);
            return;
          }
          await g.say('marl', "Brine's lamp is lit, as always. But the rock it stands on has never been dry before.", 'worried');
        },
      },
      {
        id: 'barrel', name: "Brine's Barrel", ...rect(P.barrel), stand: [858, 500],
        async use(g) {
          if (g.flag('barrel_taken')) {
            await g.say('marl', 'Empty, but for a note: "Stop poking my barrel. —B"', 'sly');
            return;
          }
          g.setFlag('barrel_taken');
          await g.say('narr', "Inside Brine's emergency barrel: two tubs of Wet Clay and a small orb of Wedge glaze, wrapped in a note. \"For when you need to be stubborn. —B\"");
          g.give('wetclay', 2);
          g.giveGlaze('wedge', 'marl');
        },
      },
      {
        id: 'hatch', name: 'Sunken Stair', rect: [494, 450, 108, 56], stand: [548, 512],
        async use(g) {
          if (!g.hasItem('brassthumb')) {
            await g.say('marl', "A hatch in the planks, with a ring and a thumb-shaped hole. I don't have anything that fits. Yet.", 'curious');
            return;
          }
          if (!g.flag('ochre_joined')) {
            await g.say('marl', "I have the key. But I'm not going down alone. Ochre's by the ferry.", 'worried');
            return;
          }
          if (!g.flag('hatch_open')) {
            await g.say('narr', 'Marl presses the Brass Thumb into the ring. It fits like it was waiting.');
            g.sfx('door');
            g.setFlag('hatch_open');
            await g.wait(1.1);
            await g.say('narr', 'Under the planks, something old sighs. Then something climbs out of the dark. Two somethings. Hollow, dripping, and extremely rude.');
          }
          if (!g.flag('husks_beaten')) {
            const r = await g.battle('pier_husks');
            if (r !== 'win') return;
            g.setFlag('husks_beaten');
            await g.say('ochre', 'Husks. The sea sheds them like old skin. That is what is in our harbor tonight.', 'angry');
            await g.say('marl', "Then let's see what they were hiding.", 'angry');
          }
          await g.go('archive', 70, 470);
        },
      },
    ];
  },
};

// ====================================================================== ARCHIVE
// Hueso opens up in three stages: the form, the thumb, the file. Each one is a choice, and each can be refused and retried.
async function huesoForms(g) {
  await g.say('calaca', 'You have read the ledger. I can tell by the way you no longer stand like a man with a future.', 'sly');
  await g.say('calaca', 'Section 4 of the Archive Act states that anyone who has read the ledger must complete Form 41-B, Acknowledgment of Receipt of Knowledge. I do not make the rules. I merely outlived the person who did.', 'curious');
  const c = await g.ask('Form 41-B', ['Fill it in honestly', 'Ask what the form is for', "Say you're in a hurry"]);
  if (c === 0) {
    await g.say('narr', 'Marl takes the pen. It is warm, which is the first thing wrong with it. Name. Occupation. Reason for visit.');
    await g.say('marl', "'Reason for visit: I think the harbor has been lying to me. And I think I'm in the lie.'", 'worried');
    await g.say('calaca', 'That is the first honest answer I have received since the Founding. I would stamp it twice, but there is a regulation.', 'sad');
    await g.say('narr', 'The skeleton stamps the form APPROVED, hesitates, and stamps a second, smaller APPROVED beside it, quietly, as if hoping the regulation will not notice.');
    g.setFlag('forms_filed');
    g.setFlag('hueso_trust');
    await g.say('calaca', 'Expedited processing. It is the only perk the position has. Take it. It is a very small orb, but it hurries things along.', 'sly');
    g.giveGlaze('quicken', 'slip');
    g.give('coldslip', 2);
  } else if (c === 1) {
    await g.say('marl', 'What is it for, exactly?', 'curious');
    await g.say('calaca', 'For? Nobody has asked what a form is for in nine hundred years. ...It is for proving that someone knew. So that afterwards nobody can say nobody knew. In this town it is the closest thing we have to a conscience.', 'sad');
    await g.say('calaca', 'Come back when you wish to fill it in. It will be here. It is always here. That is rather the point of me.', 'sly');
  } else {
    await g.say('marl', "I haven't got time for forms. There's a tide going out.", 'angry');
    await g.say('calaca', 'There is always a tide going out. That is how you can tell it is a harbor.', 'sly');
    await g.say('calaca', 'The form will wait. I have, you will find, enormous reserves of waiting.', 'sad');
  }
}

async function huesoThumb(g) {
  await g.say('calaca', "Marl. May I see your thumb? It is on the form, under 'Distinguishing Marks'. I have been trying not to look at it since you came in.", 'curious');
  const c = await g.ask('Show him your thumb?', ['Show him your thumb', 'Keep your hands in your pockets']);
  if (c === 0) {
    await g.say('narr', 'Marl holds out his left thumb. The skeleton does not touch it. He leans down with the care of a man reading a very small, very old letter.');
    await g.say('calaca', 'Whorl. A split in the third ridge. Identical, to the ridge, to forty-one tiles on a harbor wall. ...Of course it is.', 'sad');
    await g.say('marl', 'Say it. You know something.', 'angry');
    await g.say('calaca', 'I know everything; it is the only thing I am for. ...I have never shown anyone this.', 'worried');
    await g.say('narr', 'From the back of a drawer he does not open in front of visitors, the Archivist takes a single thin folder, and sets it on the desk the way you set down something that might go off.');
    g.addClue('hueso_file');
    await g.say('calaca', 'File Zero. Read it when you are ready. Not here. Here I have to be professional.', 'sad');
  } else {
    await g.say('marl', 'Is it important?', 'worried');
    await g.say('calaca', 'Everything is, eventually. Another day, then. I have the patience of the dead; it is the only inheritance.', 'sly');
  }
}

async function guildAmbush(g) {
  await g.say('narr', 'A door swings in the dark. Warm air. The smell of a bakery on fire.');
  await g.say('kilnwright', 'Unsanctioned retrieval. The Archive thanks you for your cooperation.', 'angry');
  await g.say('kilnwright', 'It will now un-thank you.', 'angry');
  const r = await g.battle('archive_guild');
  if (r !== 'win') return;
  g.setFlag('guild_beaten');
  await g.say('slip', 'Ha! Did you SEE it? ...I mean, did you see how I watched?', 'cheer');
  await g.say('ochre', "The Guild's already here. They knew we'd come. Keep your eyes open.", 'worried');
}

const archive = {
  id: 'archive',
  name: 'The Lamplit Archive',
  music: 'archive',
  theme: 'archive',
  walk: LAYOUT.archive.walk,
  scale: [0.84, 1.08],
  start: { x: 480, y: 470 },
  danger: (g) => (g.flag('guild_beaten') && !g.flag('vault_open') ? { enc: ['archive_wander', 'archive_clerks'], rate: 0.32 } : null),

  paint(ctx, g, fr) {
    paintArchive(ctx, fr, { lamps: g.state.lamps, vaultOpen: g.flag('vault_open'), jarBroken: g.flag('jar_broken') });
  },

  props: () => [
    { prop: 'cart', x: 640, y: 490 },
    { prop: 'stool', x: 410, y: 502 },
  ],

  async enter(g) {
    if (!g.flag('archive_seen')) {
      g.setFlag('archive_seen');
      await g.say('narr', 'The Lamplit Archive. Nine hundred years of wet paper, somehow dry.');
      await g.say('ochre', "Nobody's lit these lamps in living memory. Somebody has, tonight.", 'curious');
      await g.say('marl', "Or they've never been out.", 'worried');
    }
    if (g.flag('jar_broken') && !g.flag('guild_beaten')) await guildAmbush(g);
  },

  npcs() {
    return [
      {
        id: 'hueso', kind: 'calaca', x: 252, y: 446, face: 1, name: 'Archivist Hueso',
        async use(g) {
          if (!g.flag('met_hueso')) {
            g.setFlag('met_hueso');
            await g.say('narr', 'Behind the desk stands a skeleton in a pinstriped suit, filing nothing with great concentration.');
            await g.say('calaca', "Shh. ...Oh. A visitor. Nobody has asked to see anything in nine hundred years. I had the forms reprinted twice.", 'curious');
            await g.say('marl', 'You work here?', 'curious');
            await g.say('calaca', 'Work. Reside. Expire. The distinctions are administrative.', 'sly');
            await g.say('calaca', "Touch nothing you can't put back exactly as it was. I will know. I always know. It is the only thing I am for.", 'angry');
            return;
          }
          if (g.hasClue('ledger') && !g.flag('forms_filed')) {
            await huesoForms(g);
            return;
          }
          if (g.flag('forms_filed') && g.hasClue('same_thumb') && !g.hasClue('hueso_file')) {
            await huesoThumb(g);
            return;
          }
          if (g.deduced('unfired')) {
            await g.say('calaca', "You have worked it out. I could tell. You are looking at me the way people look at a door they have just found the key to. I would ask you to be gentle with it. It is the only door I have.", 'sad');
            return;
          }
          if (g.hasClue('hueso_file')) {
            await g.say('calaca', "You read File Zero. Good. I would rather it were in someone's pocket than in my drawer. A drawer is only a very patient way of forgetting.", 'sly');
            return;
          }
          if (!g.hasClue('ledger')) {
            await g.say('calaca', "The ledger on the desk is the only honest book in Mudhaven. I recommend it. I also recommend not telling the Guild you read it.", 'sly');
          } else if (!g.flag('lamps_lit')) {
            await g.say('calaca', "The lamps are shy. Press one and its neighbours flinch. Everything in this town is connected; ask anyone who's been pressed.", 'sly');
          } else if (!g.flag('vault_open')) {
            await g.say('calaca', "The door wants a thumb. I'd offer mine, but I've been a skeleton so long I've lost the whorl.", 'sad');
          } else {
            await g.say('calaca', 'Mind the stairs down. They go further than the paperwork admits.', 'worried');
          }
        },
      },
    ];
  },

  hotspots() {
    const A = LAYOUT.archive;
    return [
      {
        id: 'stairs', name: 'Stairs up', ...rect(A.stairs), stand: [86, 478],
        async use(g) {
          await g.go('pier', 548, 500);
        },
      },
      {
        id: 'panel', name: 'Lamp Lock', ...rect(A.panel), stand: [335, 440],
        async use(g) {
          if (g.flag('lamps_lit')) {
            await g.say('marl', 'Every lamp is lit. The vault is waiting for a thumb.', 'awe');
            return;
          }
          if (!g.flag('panel_seen')) {
            g.setFlag('panel_seen');
            await g.say('marl', "Nine lamps. Press one and its neighbours flip too. Somebody wanted this to take patience.", 'curious');
          }
          const ok = await g.openLampPuzzle();
          if (ok) {
            g.setFlag('lamps_lit');
            g.sfx('solve');
            await g.say('narr', 'Every lamp burns. Behind the great door, something takes a long, slow breath.');
          }
        },
      },
      {
        id: 'vault', name: 'Vault Door', ...rect(A.vault), stand: [555, 440],
        async use(g) {
          if (g.flag('vault_open')) {
            await g.go('chapel', 92, 488);
            return;
          }
          if (!g.flag('lamps_lit')) {
            await g.say('marl', 'A door the size of a barn, with a thumb-shaped hollow at its heart. The lamps beside it are half dark, and it does not seem to be in a mood.', 'curious');
            return;
          }
          if (!g.flag('slip_joined')) {
            await g.say('narr', 'Behind them, in the corner, the sealed jar goes tick. Tick. Tick-tick. Somebody inside is knocking the way you knock when you have been knocking for a very long time.');
            await g.say('ochre', "I'm not opening that door with a Guild jar knocking at my back. Whatever's in there wants out, and I don't leave things in jars.", 'worried');
            return;
          }
          await g.say('narr', 'Marl presses the Brass Thumb into the hollow. The whole door shivers, as if it recognised the print.');
          g.sfx('door');
          g.setFlag('vault_open');
          await g.wait(1.2);
          await g.say('ochre', "That isn't a vault. It's a stairwell. And it's wet at the bottom.", 'worried');
          await g.say('slip', 'Wet is my favourite!', 'cheer');
        },
      },
      {
        id: 'rack', name: 'Tablet Rack', ...rect(A.rack), stand: [800, 440],
        async use(g) {
          if (!g.hasClue('four_signs')) {
            await g.say('narr', 'The tablets are in a dozen languages, but they say the same thing. One glows faintly blue.');
            await g.say('marl', "'The fisher-king under his lake... the lit city beneath the southern sea... the sunken stair where the old ones turned to clay...'", 'awe');
            await g.say('marl', 'Every drowned city has the same four signs. In the same order: the Mouth that sings it up, the Hand that shapes it, the Eye that watches it, the Tide that takes it back.', 'awe');
            g.addClue('four_signs');
          } else {
            await g.say('marl', 'Mouth. Hand. Eye. Tide. If I say it enough times it might start to sound like a lullaby.', 'worried');
          }
        },
      },
      {
        id: 'desk', name: "Archivist's Desk", ...rect(A.desk), stand: [150, 440],
        async use(g) {
          if (!g.hasClue('ledger')) {
            await g.say('narr', 'A ledger, still open. The ink is warm.');
            await g.say('marl', "'Batch One: forty-one founders, pressed and fired. Batch Two to be pressed when the tide falls.'", 'worried');
            await g.say('ochre', 'Pressed. Fired. Like pots. And someone has kept the accounts for nine hundred years.', 'angry');
            g.addClue('ledger');
            await g.say('narr', 'Tucked in the spine: a small purple orb of Slump glaze.');
            g.giveGlaze('slump', 'ochre');
          } else {
            await g.say('marl', "'Batch Two.' I have a bad feeling about what Batch Two is.", 'worried');
          }
        },
      },
      {
        id: 'jar', name: g_jarName, ...rect(A.jar), stand: [800, 484],
        visible: (g) => true,
        async use(g) {
          if (g.flag('jar_broken')) {
            await g.say('slip', "That's my old house. I don't miss it. ...A little.", 'sad');
            return;
          }
          await g.say('marl', 'A big jar with a Guild seal. Something inside is blinking back at me.', 'curious');
          const c = await g.ask('Break the seal?', ['Break it', 'Leave it']);
          if (c !== 0) {
            await g.say('marl', "Not today. Whatever you are, you've waited this long.", 'worried');
            return;
          }
          g.sfx('squelch');
          g.raiseBond('slip', 1);
          g.setFlag('jar_broken');
          await g.wait(0.6);
          await g.say('slip', 'SPLORP! Oh! Oh, air! Thirty-one years in a pickle jar. Do you know what is wrong with that?', 'cheer');
          await g.say('marl', '...The pickle?', 'curious');
          await g.say('slip', "The PICKLE is gone, I ate it in year two. No, the problem is the Guild jars every Slip they catch. We remember the tide, you see. They don't like remembering.", 'angry');
          await g.say('ochre', "You sound like you have opinions about where we're going.", 'sly');
          await g.say('slip', "I have opinions about everything. Especially DOWN. Take me with you. I'll be good. I'll be wet but good.", 'cheer');
          g.joinParty('slip');
          g.giveGlaze('brine', 'slip');
          g.setFlag('slip_joined');
          await guildAmbush(g);
        },
      },
    ];
  },
};
function g_jarName(g) {
  return g.flag('jar_broken') ? 'Broken Jar' : 'Sealed Jar';
}

// ====================================================================== CHAPEL
async function eelAmbush(g) {
  await g.say('narr', 'The water inside the walls shivers. A shape unfolds from the arch, long and thin and swimming through the air as if the chapel were still flooded.');
  await g.say('slip', "Oh good. Eels. They're the ones who put me in the jar. ...I mean, they were in the room. Don't tell anyone.", 'worried');
  const r = await g.battle('chapel_eels');
  if (r !== 'win') return;
  g.setFlag('eels_beaten');
  await g.say('ochre', "Whatever's behind that gate doesn't want company. The glyphs are still waiting.", 'worried');
}

async function pressSign(g, kind) {
  if (g.flag('gate_open')) {
    await g.say('marl', "They're already glowing. Let sleeping gods lie.", 'worried');
    return;
  }
  if (g.flag('eels_pending') && !g.flag('eels_beaten')) {
    await eelAmbush(g);
    if (!g.flag('eels_beaten')) return;
  }
  const seq = new Sequence(SIGN_ORDER);
  seq.pos = g.state.signPos || 0;
  const r = seq.input(kind);
  g.state.signPos = seq.pos;
  if (r === 'wrong') {
    g.sfx('wrong');
    g.state.signFails = (g.state.signFails || 0) + 1;
    g.toast('The glyphs dim. Something tutted.');
    if (g.state.signFails === 2) {
      if (g.hasClue('four_signs')) await g.say('slip', 'Mouth... Hand... Eye... Tide. Wasn\'t that the order on the tablet upstairs?', 'curious');
      else await g.say('slip', "Maybe somebody wrote the order down somewhere? Tablets? Rackety things? Up in the archive?", 'curious');
    }
    return;
  }
  g.sfx('glyph');
  if (r === 'ok' && seq.pos === 1 && !g.flag('eels_pending')) {
    g.setFlag('eels_pending');
    await g.wait(0.5);
    await eelAmbush(g);
    return;
  }
  if (r === 'done') {
    g.setFlag('gate_open');
    g.sfx('solve');
    await g.wait(0.6);
    g.sfx('door');
    await g.say('narr', 'All four glyphs burn gold. Across the chapel, the sealed gate groans and slides aside. Heat rolls out, and light the colour of a furnace.');
    await g.say('slip', 'Ooh! Something fell out of the altar. A Deluge glaze! The Guild buried it with the altar... right next to the thing they were scared of!', 'awe');
    g.giveGlaze('deluge', 'slip');
    await g.say('ochre', "Once more through the gate, then. Whatever's cooking in there, it's been cooking since before the harbor.", 'sly');
  }
}

const chapel = {
  id: 'chapel',
  name: 'The Drowned Chapel',
  music: 'chapel',
  theme: 'chapel',
  walk: LAYOUT.chapel.walk,
  scale: [0.86, 1.1],
  start: { x: 140, y: 484 },
  wet: true, // the floor holds reflections
  danger: (g) => (g.flag('eels_beaten') && !g.flag('boss_beaten') ? { enc: ['chapel_wander', 'chapel_vigil'], rate: 0.3 } : null),

  paint(ctx, g, fr) {
    paintChapel(ctx, fr, {
      pressed: SIGN_ORDER.slice(0, g.state.signPos || 0),
      solved: g.flag('gate_open'),
      gateOpen: g.flag('gate_open'),
      bowlTaken: g.flag('bowl_taken'),
    });
  },

  props: () => [
    { prop: 'confessional', x: 640, y: 452 },
    { prop: 'pew', x: 300, y: 508 },
  ],

  async enter(g) {
    if (g.flag('chapel_seen')) return;
    g.setFlag('chapel_seen');
    await g.say('narr', "The Drowned Chapel. The sea isn't gone from here; it's only being polite.");
    await g.say('narr', "Nobody down here is dead, exactly. Dead implies someone filed the paperwork.");
    await g.say('slip', 'Oh, I know this place. The water remembers it. It is much more embarrassing dry.', 'sad');
    await g.say('marl', 'Four signs on the wall. A mural. A gate that looks like a stove.', 'curious');
    await g.say('ochre', "And a bowl that looks like it's been waiting for someone to be generous.", 'sly');
  },

  npcs() {
    return [];
  },

  hotspots() {
    const C = LAYOUT.chapel;
    const out = [
      {
        id: 'back', name: 'Up to the Archive', rect: [0, 436, 80, 104], stand: [100, 490],
        async use(g) {
          await g.go('archive', 555, 446);
        },
      },
      {
        id: 'mural', name: 'Mural', ...rect(C.mural), stand: [120, 450],
        async use(g) {
          if (!g.hasClue('tide_chart')) {
            await g.say('narr', 'A mural of a sun, a long falling wave, and a face with closed eyes beneath it. Eight columns of tiny numbers run along the edge.');
            await g.say('marl', 'It is a tide chart. The sea leaves the harbor every nine hundred years, to let something cool.', 'awe');
            await g.say('ochre', 'The last mark is today.', 'sad');
            g.addClue('tide_chart');
          } else {
            await g.say('marl', "A sun. A wave. A sleeper. I've started to hear it as a song.", 'curious');
          }
        },
      },
      {
        id: 'gate', name: 'Kiln Gate', ...rect(C.gate), stand: [850, 460],
        async use(g) {
          if (!g.flag('gate_open')) {
            await g.say('marl', 'A seal in the shape of a little kiln. It will not budge, and it is faintly warm. The four glyphs on the wall must be the key.', 'curious');
            return;
          }
          await g.go('kiln', 130, 484);
        },
      },
      {
        id: 'confessional', name: 'Confessional', ...rect(C.confessional), stand: [640, 500],
        async use(g) {
          if (g.flag('confessed')) {
            await g.say('marl', 'The booth is quiet now. Whatever I left in it, it kept.', 'sad');
            return;
          }
          g.setFlag('confessed');
          await g.say('narr', 'A confessional, carved from one piece of driftwood and long ago hollowed by something that was not a priest. The grille is warm. Somebody has been breathing through it.');
          await g.say('narr', 'Marl kneels. The grille waits, politely, the way the whole harbor waits.');
          const c = await g.ask('What does Marl confess?', ['"I am afraid of being unmade."', '"I am afraid of being used."', '"I am afraid I was only ever made."']);
          g.state.fear = ['unmade', 'used', 'made'][c];
          if (c === 0) await g.say('narr', 'The grille is silent. Then, from very far below, something enormous and slow turns its face toward the wall.');
          else if (c === 1) await g.say('narr', 'Something behind the grille makes a small sound, almost sympathetic, like a man clearing his throat to say "me too" and not quite managing it.');
          else await g.say('narr', 'Behind the grille, a long, slow exhale. The kind you give a child who has just found out what the stars are.');
          await g.say('narr', 'Something small drops through the grille and rolls across the floor: an orb of Crackle glaze, hairlined like a very old plate. A previous confessor\'s, perhaps. It does not seem to have helped them either.');
          g.giveGlaze('crackle', 'marl');
          if (g.inParty('slip')) {
            await g.say('slip', 'Hm. Hm-hm. Hm... Marl, did you hear that? That was not the grille. That was the tide.', 'curious');
            await g.say('slip', "Four phrases. Going out. Always in the same order, and never finishing. I've been humming it for thirty-one years. I thought it was just something wrong with me.", 'sad');
            await g.say('marl', "Slip. That's... that's the ferry lullaby.", 'awe');
            g.addClue('slip_memory');
            g.raiseBond('slip', 1);
          }
        },
      },
      {
        id: 'bowl', name: 'Offering Bowl', ...rect(C.bowl), stand: [437, 500],
        async use(g) {
          if (!g.flag('bowl_taken')) {
            g.setFlag('bowl_taken');
            await g.say('narr', "In the bowl: two lumps of Wet Clay, a draught of Slip and a stoppered flask of brine. Offerings from a time when the Guild still pretended to be a church.");
            g.give('wetclay', 2);
            g.give('slipdraught', 1);
            g.give('brineflask', 1);
            return;
          }
          await g.say('narr', 'The bowl is full of cool brackish water. You sit a moment. It tastes like the sea remembering a lullaby.');
          g.healParty();
        },
      },
    ];
    CHAPEL_LAYOUT.forEach((kind, i) => {
      out.push({
        id: 'tile-' + kind, name: `Sign of the ${kind[0].toUpperCase() + kind.slice(1)}`,
        rect: [C.tiles[i], C.tileY, C.tileW, C.tileH], stand: [C.tiles[i] + C.tileW / 2, 456],
        async use(g) {
          await pressSign(g, kind);
        },
      });
    });
    return out;
  },
};

// ====================================================================== KILN
// If you have worked out who the Warden was, you may say his name. It changes the fight, and what comes after.
async function speakHisName(g) {
  await g.say('narr', 'The bricks glare. The heat leans toward them like a crowd. And Marl, who has read a card in a drawer, takes one step forward.');
  await g.say('marl', 'Cobb.', 'sad');
  await g.say('narr', 'The word lands in the heat like a stone in a kettle. Every brick stops moving.');
  await g.say('warden', 'Nobody has said that. Not since... Who put that word in your mouth, little thumb?', 'sad');
  await g.say('marl', "A card in a drawer. 'Retained, as kiln. Reason: he volunteered.' You said yes for one night, didn't you.", 'sad');
  await g.say('warden', 'I said yes so well. I was so good at it. They never came to relieve me, and I never learned the word for asking.', 'sad');
  await g.say('slip', "Marl... he can't stop. It isn't that he won't. He CAN'T.", 'worried');
  await g.say('warden', 'I cannot let the lid go. I can only be slower. Help me be slower, little thumb. Please. And be quick about it.', 'sad');
}

// Beaten at least once? Someone says the useful thing out loud, once, and leaves a few flasks of brine on the anvil.
async function coach(g) {
  const lost = (g.state.losses?.kiln_warden || 0) + (g.state.losses?.kiln_warden_named || 0);
  if (!lost || g.flag('kiln_coached')) return;
  g.setFlag('kiln_coached');
  await g.say('ochre', "Before it breathes out, it breathes in. Did you see? The fire goes quiet and BANKED, and the next turn it's coming for all of us. Water in that gap and the breath goes out like a candle.", 'worried');
  if (g.inParty('slip')) await g.say('slip', "Water is what I'm FOR. It's the only thing I'm for. Aim me at the banking bit and don't let me waste it on sulking.", 'cheer');
  if ((g.state.inv.brineflask || 0) < 2) {
    await g.say('narr', 'On the anvil, as if left for exactly this, sit two flasks of brine. Nobody wants to say who by.');
    g.give('brineflask', 2 - (g.state.inv.brineflask || 0));
  }
}

// The last door. Reached from the fight, and reached again by Continue, so a closed save never strands you here.
async function finale(g, resumed = false) {
  if (resumed) {
    await g.say('narr', 'The kiln is quiet now. The great door stands open, and behind it the pale lid waits, not impatiently, for somebody to decide.');
  }
  // the options depend on what you know and who you have made friends with
  const options = ['Let it sleep', 'Wake it', 'Press my thumb to the lock'];
  const keys = ['sleep', 'wake', 'thumb'];
  if (g.deduced('unfired') && g.flag('hueso_trust')) {
    options.push('Send for the Archivist');
    keys.push('retained');
  }
  options.push('Not yet');
  keys.push('later');
  const pick = keys[await g.ask('What does Marl do?', options)];
  if (pick === 'later') {
    await g.say('ochre', "Take a breath, kid. It's waited nine hundred years. It can wait while you check you've left nothing unsaid.", 'sly');
    await g.go('chapel', 850, 470);
    return;
  }

  const sleepText = g.deduced('lullaby')
    ? "Marl lays a hand on the great cool lid and hums the ferry song, all four beats, and for the first time in nine hundred years the last line resolves. The eye closes. The tide comes home, gently, over everything. Mudhaven never learns what it stood on. But three people and one pickled thing do, and every low tide after, they sit on the pier and keep very quiet."
    : "Marl lays a hand on the great cool lid and hums a ferry song, the one you hum to a child who cannot sleep. The eye closes. The tide comes home, gently, over everything. Mudhaven never learns what it stood on. But three people and one pickled thing do, and every low tide after, they sit on the pier and keep very quiet.";
  const endings = {
    sleep: { key: 'The Long Sleep', title: 'THE LONG SLEEP', text: sleepText },
    wake: {
      key: 'The Waking', title: 'THE WAKING',
      text: 'The eye opens all the way. It is not angry; it is only very, very large. The sea stands up to look at you. Every pressed thing in Mudhaven feels its thumbprint warm at once. "Well," says Ochre, "that\'s one way to end a shift." Somewhere under the harbor, a god says its first word in nine hundred years, and the word is: "Oh."',
    },
    thumb: {
      key: 'The Forty-Second Thumb', title: 'THE FORTY-SECOND THUMB',
      text: "Marl's thumb fits the lock from the inside. It always did. The door doesn't open; it takes him gently, the way a hand takes a pot from the wheel. At dawn Ochre finds a ferry ticket on the boards, and a new thumbprint in the Founders' Wall: the forty-second. The tide is back by morning. The harbor is quiet. Somebody is keeping it that way.",
    },
    retained: {
      key: 'The Retained', title: 'THE RETAINED',
      text: 'He arrives at a stately pace, in his pinstripe suit, with forms. "I have been waiting nine hundred years for someone to ask," says Hueso, "and I find I do not mind that it was on a deadline." He presses his blank thumb to the lock, the one thumb in Mudhaven the Press has never fired, and the door takes it the way a hand takes a pot it has been waiting for. It does not close behind him. It simply stops being a door. The tide comes home. Marl keeps the Archive\'s stamp. APPROVED, it says, and under it, smaller: Retained. Reason: he asked.',
    },
  };
  if (pick === 'retained') {
    await g.say('narr', 'Marl sends Slip up the stairs with a message: three words, and a thumbprint that does not match.');
    await g.fadeTo(0.55, 0.6);
    await g.say('calaca', 'I came as fast as the regulations would allow, which is to say: at a walk.', 'sly');
    await g.say('calaca', 'You will have noticed that the Press needs a thumb it can hold, and that every thumb in this town was fired hard enough to be held. Except one. It is a small, ridiculous distinction. I have waited a very long time to be useful.', 'sad');
    await g.say('marl', "Hueso... you don't have to.", 'sad');
    await g.say('calaca', 'I know. That is what makes it a form and not a sentence. Retained, as record-keeper. Reason: he asked.', 'sly');
    await g.fadeTo(0, 0.4);
  }
  const e = endings[pick];
  const ep = epilogue(g);
  await g.showEnding(ep.length ? { ...e, text: `${e.text} ${ep.join(' ')}` } : e);
}

const kiln = {
  id: 'kiln',
  name: 'The Kiln Gate',
  music: 'kiln',
  theme: 'kiln',
  walk: LAYOUT.kiln.walk,
  scale: [0.9, 1.12],
  start: { x: 130, y: 484 },

  paint(ctx, g, fr) {
    paintKiln(ctx, fr, { open: g.flag('kiln_open'), eye: g.state.eyeT || 0 });
  },

  props: () => [
    { prop: 'anvil', x: 205, y: 488 },
    { prop: 'coalcart', x: 790, y: 494 },
  ],

  async enter(g) {
    // The Warden is down and the door is open: whether you have just won, or are coming back from a saved game or from the
    // chapel, the only thing left in this room is the choice.
    if (g.flag('boss_beaten')) {
      await finale(g, true);
      return;
    }
    let enc = 'kiln_warden';
    if (!g.flag('warden_met')) {
      g.setFlag('warden_met');
      await g.say('narr', 'The Kiln Gate. The air tastes like a bakery on fire.');
      await g.say('marl', "That door's the size of a house. Where's the lock?", 'worried');
      await g.say('slip', "Marl... the lock is shaped like a thumb. Your thumb. Specifically. I can feel it from here.", 'worried');
      await g.say('narr', 'The door breathes out. The bricks around it open their eyes.');
      await g.say('warden', 'Little thumb. You were pressed to be quiet, and warm, and obedient.', 'angry');
      await g.say('warden', 'The Guild held the tide still for nine hundred years. Tonight someone pulled the stopper.', 'angry');
      await g.say('marl', "You're the Warden.", 'angry');
      await g.say('warden', 'I am the cooling. I am the lid. I am the reason you have a harbor at all.', 'angry');
      await g.say('ochre', "Funny word for 'jailer'.", 'sly');
    } else {
      await g.say('warden', 'Back again, little thumb? I am so warm. Come and be warm.', 'angry');
      await coach(g);
    }
    // Every way of meeting him ends in the same three options at most; stepping back is always one of them, so a party that
    // is out of its depth can walk away, fight wanderers in the chapel for experience and come back.
    const named = g.deduced('cobb');
    const options = named ? ['Say his name', 'Fight it', 'Step back'] : ['Stand and fight', 'Step back'];
    const c = await g.ask(named ? 'The Warden was a man called Cobb. What does Marl say?' : 'The Warden banks its fire and waits.', options);
    if (c === options.length - 1) {
      await g.say('ochre', "Not like this. Back up the stairs, kid; there's nothing in there that gets less hot by us being half-cooked.", 'worried');
      await g.say('warden', 'I will be here. I am always here. It is the one thing I am good at.', 'sad');
      await g.go('chapel', 850, 470);
      return;
    }
    if (named && c === 0) {
      await speakHisName(g);
      g.setFlag('warden_named');
      enc = 'kiln_warden_named';
    } else {
      await g.say('warden', 'BACK INTO THE PRESS.', 'angry');
    }
    const r = await g.battle(enc);
    if (r !== 'win') return;
    if (g.lastBattle?.spared) g.setFlag('warden_spared');
    await endingScene(g);
  },

  npcs() {
    return [];
  },

  hotspots() {
    return [
      {
        id: 'back', name: 'Back to the Chapel', rect: [0, 436, 90, 104], stand: [130, 490],
        async use(g) {
          await g.go('chapel', 850, 470);
        },
      },
    ];
  },
};

// What the world does afterwards, according to what you did and who came to trust you. A few sentences, never more than four.
export function epilogue(g) {
  const out = [];
  if (g.flag('warden_spared')) out.push("At dawn Cobb sits on the end of the pier in the first cold he has felt in nine hundred years. He does not say anything. Brine brings him tea, and does not say anything either.");
  if (g.flag('ochre_rust') && g.bond('ochre') >= 2) out.push("Ochre takes the Wake out on the next low tide with Rust at the tiller, warm and smiling, and humming something that does not quite resolve. She counts the smile. It is a different one.");
  else if (g.bond('ochre') >= 1) out.push('Ochre keeps the Wake scrubbed, in case anyone wants a ride.');
  if (g.bond('slip') >= 2) out.push("Slip keeps an empty pickle jar on the Founders' Wall as a monument, and charges visitors to look at it.");
  else if (g.bond('slip') >= 1) out.push('Slip takes up residence in the harbor and is, for the first time in thirty-one years, damp on purpose.');
  if (g.state.fear === 'unmade') out.push('Marl sleeps badly for a month, and then well.');
  else if (g.state.fear === 'used') out.push('Marl never again signs a form without reading the back of it.');
  else if (g.state.fear === 'made') out.push("Marl finds, to his surprise, that being made does not stop him making something of it.");
  return out.slice(0, 4);
}

async function endingScene(g) {
  g.setFlag('boss_beaten');
  if (g.flag('warden_spared')) {
    await g.say('narr', 'The Warden stops. Not broken; stopped, the way a man stops when somebody finally says he may. The fire in his mouth sinks to a pilot light, to an ember, to the memory of an ember, and a very old voice says: Oh. That is what quiet is.');
    await g.say('warden', 'Thank you, little thumb. Go on. Be quick. I will keep the door warm a little longer; it is a thing I know how to do.', 'sad');
  } else {
    await g.say('narr', 'The Warden cracks along its oldest thumbprint. Smoke pours from every seam, and then the whole kiln sighs, like someone who has held their breath for nine hundred years.');
    await g.say('warden', 'The Press... must never wake. Pressed things do not wake. They are only... warm.', 'sad');
  }
  g.setFlag('kiln_open');
  g.sfx('door');
  g.tween('eyeT', 1, 4);
  g.addClue('the_truth');
  await g.wait(2.2);
  await g.say('narr', 'Behind the door, enormous and pale, a closed eye. The lid trembles, like a sleeper about to remember who they are.');
  await g.say('slip', "There was never a Founder. There's a god asleep under the harbor, and we're the clay it shed while it dreamed.", 'awe');
  await g.say('ochre', "The sea is its dream. Low tide is its breath. And the Guild has been holding its nose shut for nine hundred years.", 'sad');
  await g.say('marl', "...And this lock is shaped like my thumb. Because I'm the thumb it was made to fit.", 'awe');

  await finale(g);
}

export const SCENES = { pier, archive, chapel, kiln };
