// Party banter. After you poke something, your friends have opinions. Each line plays once, only when its speaker is in
// the party and `needs` (if any) holds. Keys are `${scene}/${hotspotId}`; NPC hotspots are `npc-${id}`.
// Voice: Ochre is dry and practical; Slip is a manic, grieving optimist; both are funnier when they think nobody is listening.

const has = (id) => (g) => g.hasClue(id);

export const BANTER = {
  'pier/wall': [
    { who: 'ochre', mood: 'sly', text: "Forty-one thumbs. Founders' Day always did feel a bit... photocopied." },
    { who: 'ochre', mood: 'worried', text: "I used to put my thumb in the fourth tile when I was small. It fit. I thought that meant I belonged.", needs: (g) => g.deduced('pressed') },
  ],
  'pier/ferry': [
    { who: 'ochre', mood: 'sly', text: "Don't pat her. She bites. It's not a joke, there is a tooth mark in the tiller." },
  ],
  'pier/sleeper': [
    { who: 'ochre', mood: 'worried', text: "Don't stare at it, kid. It's rude. I'm told it's also unwise." },
    { who: 'ochre', mood: 'worried', text: "It's breathing. In. And out. With the tide, or the other way round.", needs: (g) => g.deduced('tonight') },
  ],
  'pier/lighthouse': [
    { who: 'ochre', mood: 'sad', text: "Old Brine kept that lamp lit forty years and never once told me why. I never once asked. That's two of us who should've done better." },
  ],
  'pier/barrel': [
    { who: 'ochre', mood: 'sly', text: "He keeps his emergencies in a barrel. Brine's idea of crisis management is a lid." },
  ],

  'archive/rack': [
    { who: 'slip', mood: 'curious', text: "That blue one hums when you look at it. Is that normal? It hums in my teeth." },
    { who: 'ochre', mood: 'sly', text: "Slip, tablets don't hum." },
    { who: 'slip', mood: 'curious', text: "This one does. I'd know. I spent thirty-one years being hummed at by a jar." },
  ],
  'archive/desk': [
    { who: 'ochre', mood: 'angry', text: "Nine hundred years of receipts. Somebody loved that ledger more than they loved the people in it." },
    { who: 'slip', mood: 'sad', text: "I love receipts. A receipt proves that something happened to somebody. Nobody gave me one." },
  ],
  'archive/panel': [
    { who: 'slip', mood: 'cheer', text: "Eleven years I spent in that jar with nothing to flip but my opinion of lamps. Let me press one. Let me PRESS one." },
  ],
  'archive/vault': [
    { who: 'ochre', mood: 'sly', text: "I've been wrong about doors before. Not often. Never about one that breathes." },
  ],
  'archive/npc-hueso': [
    { who: 'ochre', mood: 'sly', text: "He's the only man I've ever met who sighs in complete sentences." },
    { who: 'slip', mood: 'curious', text: "He smells like a book that's been loved by the wrong people." },
  ],
  'archive/jar': [
    { who: 'ochre', mood: 'sly', text: "Thirty-one years. And you came out with opinions. I came out of a two-day fever with fewer." },
  ],

  'chapel/mural': [
    { who: 'slip', mood: 'sad', text: "The wave looks sad. Waves always look sad when they know where they're going.", needs: has('tide_chart') },
    { who: 'ochre', mood: 'worried', text: "Nine hundred years between breaths. I can't hold mine past a dock." },
  ],
  'chapel/bowl': [
    { who: 'ochre', mood: 'cheer', text: "Mud tea at the bottom of a drowned chapel. Brine would weep." },
  ],
  'chapel/gate': [
    { who: 'ochre', mood: 'worried', text: "Heat on a cold stone. That's the gate telling you it's occupied." },
    { who: 'slip', mood: 'worried', text: "I know that heat. It's the heat of someone trying very hard to be furniture.", needs: (g) => g.deduced('cobb') },
  ],
  'chapel/confessional': [
    { who: 'ochre', mood: 'sly', text: "Whatever you said in there, I'm going to pretend I'm deaf. It's a courtesy. I've been practicing." },
  ],
};
