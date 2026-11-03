// "What now?": a gentle nudge toward the next step of the main road, and a list of loose threads (things you have walked
// past). Pure functions of the game state, so tests can check there is never a dead end in the advice.
//
// The nudge never solves anything for you: it says who or where, not how. Loose threads are deliberately vague about what is
// in them, and only mention rooms you have already been in.

export function nextHint(g) {
  const f = (k) => g.flag(k);
  if (!f('met_brine')) return { where: 'Mudhaven Pier', text: 'Keeper Brine is out by the lighthouse end of the pier. He has been waiting for someone to ask him about the sea.' };
  if (!f('ochre_joined')) return { where: 'Mudhaven Pier', text: 'Captain Ochre is by her ferry. She will want to know what Brine gave you.' };
  if (!f('husks_beaten')) return { where: 'Mudhaven Pier', text: 'There is a hatch in the planks with a thumb-shaped hole in it. You are carrying the only thing that fits.' };
  if (!f('lamps_lit')) return { where: 'The Lamplit Archive', text: 'The Lamp Lock beside the great door is a puzzle of nine lamps. A press flips the lamp and its neighbours. The Hint button inside the puzzle will point at one lamp to press.' };
  if (!f('slip_joined')) return { where: 'The Lamplit Archive', text: 'Something in the sealed jar has been knocking. It sounds like it has opinions.' };
  if (!f('vault_open')) return { where: 'The Lamplit Archive', text: 'The great door is waiting for the Brass Thumb now that the lamps are lit.' };
  if (!f('gate_open')) {
    if (!g.hasClue('four_signs')) return { where: 'The Lamplit Archive', text: 'The chapel gate is sealed by four glyphs that must be pressed in a certain order. Somewhere in the Archive, a rack of tablets keeps the order.' };
    return { where: 'The Drowned Chapel', text: 'Press the four glyphs on the chapel wall in the order your Four Signs note gives. A wrong press only dims them; nothing is lost.' };
  }
  if (!f('boss_beaten')) {
    const lost = (g.state.losses?.kiln_warden || 0) + (g.state.losses?.kiln_warden_named || 0);
    return { where: 'The Kiln Gate', text: lost ? 'Before the Warden breathes out, it banks its fire for a turn. Water in that gap puts the breath out. Heal up at the chapel bowl if you need to.' : 'The gate in the chapel wall stands open. Heal at the bowl first, and bring everyone.' };
  }
  return { where: 'The Kiln Gate', text: 'The door stands open, and the choice is the last thing in the chapter. You can still step back and finish whatever you left unsaid.' };
}

// Things you have seen the edges of but not looked into. Each entry names a place you have already been.
export function looseThreads(g) {
  const out = [];
  const add = (where, text) => out.push({ where, text });
  const has = (id) => g.hasClue(id);
  const f = (k) => g.flag(k);
  // the pier is always visited
  if (!has('same_thumb')) add('Pier', "The wall of Founders' tiles looks like it has something to say.");
  if (f('met_brine') && !has('keepers_log')) add('Pier', 'The lighthouse door was on the latch.');
  if (!f('barrel_taken')) add('Pier', "Brine's emergency barrel has not been opened.");
  if (f('ochre_joined') && !f('ferry_talk')) add('Pier', "Ochre hasn't said much about her ferry.");
  if (has('ledger') && f('ochre_joined') && !f('brine_father')) add('Pier', 'Brine would want to hear what the ledger says.');
  if (f('archive_seen')) {
    if (!has('ledger')) add('Archive', 'The ledger on the Archivist\'s desk is open.');
    if (!has('four_signs')) add('Archive', 'One tablet in the rack glows faintly.');
    if (!f('met_hueso')) add('Archive', 'The skeleton behind the desk would like a word.');
    else if (has('ledger') && !f('forms_filed')) add('Archive', 'Hueso has a form for anyone who has read the ledger.');
    else if (f('forms_filed') && has('same_thumb') && !has('hueso_file')) add('Archive', 'Hueso asked to see your thumb.');
  }
  if (f('chapel_seen')) {
    if (!has('tide_chart')) add('Chapel', 'The mural has a column of tiny numbers along its edge.');
    if (!f('confessed')) add('Chapel', 'The confessional grille is warm.');
    if (!f('bowl_taken')) add('Chapel', 'The offering bowl is not empty.');
  }
  if (g.pendingCount() > 0) add('Journal', 'Some of the notes on your board belong together.');
  return out;
}
