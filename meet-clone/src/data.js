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
  };
}

/**
 * @returns {Array<{id, key, name, self, host, visitor, tile, video,
 *   confirm: 'overlay'|'none', noRemove}>}
 */
export function buildCast({ guest, bots }) {
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
  return people.map((p) => ({ ...p, id: SPACE + p.key }));
}

export function initials(name) {
  return (name.replace(/^Adesh's /, '').charAt(0) || '?').toUpperCase();
}
