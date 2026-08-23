/*
 * The cast, identical to test/harness-stub.js so every fixture tells the same
 * story: one human host (you), two vendor notetakers with different removal
 * flows, one human guest, one human-named bot that cannot be removed.
 */
const SPACE = 'spaces/KEi-HMinAxkB/devices/';

const VENDORS = [
  "Adesh's Otter.ai Notetaker", 'Fireflies.ai Notetaker', 'Fathom Notetaker',
  'Read AI Notetaker', 'tl;dv recorder', 'Avoma Assistant', 'Gong.io Notetaker',
  'Spinach.io', 'Sembly AI', 'Circleback Notetaker', 'MeetGeek.ai',
  'Supernormal Notetaker', 'Fellow.app', 'Sybill AI', 'Bluedot recorder',
  'Colibri.ai', 'Airgram', 'Noota', 'Grain', 'Laxis', 'Wudpecker',
  'Scribbl', 'Rewatch', 'Vowel', 'Clari Copilot',
];

/* Extra human guests, so bots can hide in a crowd that must survive removal. */
const HUMANS = [
  'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Margaret Hamilton',
  'Radia Perlman', 'Annie Easley', 'Claude Shannon', 'Dorothy Vaughan',
  'Barbara Liskov', 'Edsger Dijkstra', 'Hedy Lamarr', 'Mary Jackson',
];

export function readScenario() {
  const params = new URLSearchParams(location.search);
  const flag = (name) => {
    const value = params.get(name);
    return value !== null && value !== '0' && value !== 'false';
  };
  return {
    guest: flag('guest'),
    bare: flag('bare'),
    bots: Number(params.get('bots')) || 0,
    users: Number(params.get('users')) || 0,
  };
}

/*
 * Sync a scenario back to the URL without reloading, keeping only non-default
 * values so a plain call still has a plain address to copy around.
 */
export function writeScenario(scenario) {
  const params = new URLSearchParams();
  if (scenario.guest) params.set('guest', '1');
  if (scenario.bare) params.set('bare', '1');
  if (scenario.bots > 0) params.set('bots', String(scenario.bots));
  if (scenario.users > 0) params.set('users', String(scenario.users));
  const query = params.toString();
  history.replaceState(null, '', query ? `${location.pathname}?${query}` : location.pathname);
}

/**
 * @returns {Array<{id, key, name, self, host, visitor, tile, video,
 *   confirm: 'overlay'|'none', noRemove}>}
 */
export function buildCast({ guest, bots, users }) {
  const people = [
    { key: '113', name: 'Adesh Tamrakar', self: true, host: !guest, tile: true, video: true, hue: 15 },
    { key: '114', name: "Adesh's Fathom Notetaker", visitor: true, tile: true, confirm: 'overlay', hue: 205 },
    { key: '115', name: "Adesh's Otter.ai Notetaker", visitor: true, confirm: 'none', hue: 260 },
    { key: '116', name: 'Ada Lovelace', host: guest, tile: true, hue: 155 },
    { key: '117', name: 'Sarah (Notes)', visitor: true, noRemove: true, hue: 330 },
  ];
  for (let n = 0; n < bots; n++) {
    people.push({
      key: String(200 + n),
      name: VENDORS[n % VENDORS.length] + ' ' + (Math.floor(n / VENDORS.length) + 1),
      visitor: true,
      hue: (n * 47) % 360,
    });
  }
  /* Humans keep their bare names until the list wraps, then number like bots. */
  for (let n = 0; n < users; n++) {
    const round = Math.floor(n / HUMANS.length);
    people.push({
      key: String(400 + n),
      name: HUMANS[n % HUMANS.length] + (round ? ' ' + (round + 1) : ''),
      hue: (n * 61 + 90) % 360,
    });
  }
  return people.map((p) => ({ ...p, id: SPACE + p.key }));
}

export function initials(name) {
  return (name.replace(/^Adesh's /, '').charAt(0) || '?').toUpperCase();
}
