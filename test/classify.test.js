/* Run with: node test/classify.test.js */
import assert from 'node:assert';
import * as BOTS from '../lib/bots.js';

let pass = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    pass++;
  } catch (err) {
    failures.push(label + ': ' + err.message);
  }
}

const BOT_NAMES = [
  'Otter.ai',
  'OtterPilot',
  'Fireflies.ai Notetaker',
  'Fathom Notetaker',
  'Read.ai Notetaker',
  'tl;dv',
  'Avoma Assistant',
  'Gong.io',
  'Spinach.io',
  'Sembly AI',
  'Circleback Notetaker',
  'MeetGeek.ai',
  'Notetaker',
  'Meeting Recorder',
  'AI Notetaker',
  'Zoom Bot',
  'Acme Meeting Notes',
  'Transcription Service',
  'Sarah (Notes)',
  'Supernormal Notetaker',
  'Clari Copilot',
  'Outreach Kaia',
  'Gong.io Notetaker',
  'Kaia AI',
  'Rilla Recorder',
  'Tanka AI',
  'Aviso AI',
  'Chorus.ai'
];

const HUMAN_NAMES = [
  'Adesh Tamrakar',
  'Ada Lovelace',
  'Grace Hopper',
  'Robert Bottomley',
  'Bo Tran',
  'Nota Bene',
  'Ainsley Reid',
  'Aisha Khan',
  'Bob Read',
  'Botond Nagy',
  'Airam Gonzalez',
  'Sonny Patel',
  'Jamie Chen',
  'Rita Aviso Jr',
  'Gong Li',
  'Kaia Nordstrom',
  'Rilla Okafor',
  'Tanka Prasad Sharma',
  'Clari Mendez',
  'Nyota Mwangi',
  'Sybill Trelawney',
  'Read Ainsworth'
];

BOT_NAMES.forEach(function (name) {
  check('bot: ' + name, function () {
    const verdict = BOTS.classify(name);
    assert.strictEqual(verdict.isBot, true, 'expected bot, got tier ' + verdict.tier);
  });
});

HUMAN_NAMES.forEach(function (name) {
  check('human: ' + name, function () {
    const verdict = BOTS.classify(name);
    assert.strictEqual(verdict.isBot, false, 'expected human, matched "' + verdict.label + '"');
  });
});

check('allowlist beats vendor match', function () {
  const verdict = BOTS.classify('Roberto Grain', { allowlist: ['Roberto Grain'] });
  assert.strictEqual(verdict.isBot, false);
  assert.strictEqual(verdict.tier, 'allowlisted');
});

check('custom plain-text rule matches', function () {
  const verdict = BOTS.classify('Acme Scribe 3000', { custom: ['acme scribe'] });
  assert.strictEqual(verdict.isBot, true);
  assert.strictEqual(verdict.tier, 'custom');
});

check('custom regex rule matches', function () {
  const verdict = BOTS.classify('Recorder 42', { custom: ['/^recorder \\d+$/'] });
  assert.strictEqual(verdict.isBot, true);
});

check('malformed custom rule is ignored, not thrown', function () {
  const verdict = BOTS.classify('Ada Lovelace', { custom: ['/([unclosed/'] });
  assert.strictEqual(verdict.isBot, false);
});

check("Gemini notetaker is flagged as built in", function () {
  const verdict = BOTS.classify('Take notes with Gemini');
  assert.strictEqual(verdict.builtin, true);
});

check('empty name is not a bot', function () {
  assert.strictEqual(BOTS.classify('').isBot, false);
  assert.strictEqual(BOTS.classify(null).isBot, false);
});

console.log(pass + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  failures.forEach(function (line) { console.log('  FAIL ' + line); });
  process.exit(1);
}
