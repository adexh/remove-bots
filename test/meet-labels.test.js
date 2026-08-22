/*
 * The label and selector tables in lib/meet.js, checked against the
 * exact strings captured from a live Meet call.
 *
 * Run with: node test/meet-labels.test.js
 */
import assert from 'node:assert';
import * as MEET from '../lib/meet.js';

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

const L = MEET.LABELS;

check('finds the removal entry in both wordings', function () {
  assert.ok(L.remove.test('Remove from the call'), 'current build');
  assert.ok(L.remove.test('Remove from meeting'), 'older build');
  assert.ok(L.remove.test('remove_circle_outline Remove from the call'), 'with the icon word');
});

check('ignores the other menu entries', function () {
  ['keep Pin to the screen', 'link Ask to pair your tiles', "videocam_off Don't watch",
    'Send a message', 'Report abuse', 'For everyone'].forEach(function (entry) {
    assert.ok(!L.remove.test(entry), 'matched ' + JSON.stringify(entry));
  });
});

check('cancel wording never reads as the confirm button', function () {
  assert.ok(L.cancel.test('Cancel'));
  assert.ok(L.cancel.test('Keep in call'));
  assert.ok(!L.cancel.test('Remove'));
});

check('recognises the People control by its accessible name', function () {
  assert.ok(L.people.test('People'));
  assert.ok(L.people.test('Show everyone'));
  assert.ok(L.people.test('Participants'));
});

check('excludes the toolbar buttons that sit next to it', function () {
  /* "Chat with everyone" matches `people`, so `notPeople` has to veto it. */
  assert.ok(L.people.test('Chat with everyone'), 'precondition: it does look like a match');
  assert.ok(L.notPeople.test('Chat with everyone'), 'and is vetoed');
  assert.ok(!L.notPeople.test('People'), 'without vetoing the real one');
  assert.ok(!L.notPeople.test('Participants'), 'or the older wording');
  ['Meeting tools', 'Host controls'].forEach(function (label) {
    assert.ok(!L.people.test(label), label + ' should not look like People');
  });
});

check('excludes the notification badges built like the chip', function () {
  /* Same jsname, same aria-haspopup, earlier in the DOM: only the wording
   * separates the header badges from the participant chip. */
  ['External participants joined', 'Participants joined', 'Participants left'].forEach(
    function (label) {
      assert.ok(L.people.test(label), 'precondition: ' + label + ' does look like a match');
      assert.ok(L.notPeople.test(label), label + ' should be vetoed');
    });
});

check('overflow button is found by its icon-font glyph', function () {
  assert.ok(L.overflowGlyph.test('more_vert'));
  assert.ok(!L.overflowGlyph.test('push_pin'));
  assert.ok(!L.overflowGlyph.test('mic_off'));
});

check('badge and glyph words are rejected as names', function () {
  ['(You)', 'Meeting host', 'Visitor', 'domain_disabled', 'devices', 'more_vert',
    'More actions', 'Remove from the call', "You can't unmute someone else"]
    .forEach(function (noise) {
      assert.ok(L.nameNoise.test(noise), JSON.stringify(noise) + ' should be noise');
    });
});

check('real names survive the noise filter', function () {
  ["Adesh's Fathom Notetaker", 'Adesh Tamrakar', 'Ada Lovelace', 'Sarah (Notes)',
    'Peter Link', 'Grace Keeper'].forEach(function (name) {
    assert.ok(!L.nameNoise.test(name), JSON.stringify(name) + ' should survive');
  });
});

check('visitor token matches a whole leaf label only', function () {
  assert.ok(L.visitorToken.test('Visitor'));
  assert.ok(L.visitorToken.test('domain_disabled'));
  /* Concatenated textContent must NOT match: that is why leaves are tested. */
  assert.ok(!L.visitorToken.test("Adesh's Fathom Notetakerdomain_disabledVisitordevices"));
  assert.ok(!L.visitorToken.test('Visitacion Reyes'));
});

check('host and co-host badges are recognised', function () {
  ['Meeting host', 'Host', 'Co-host', 'Cohost', 'You (host)'].forEach(function (badge) {
    assert.ok(L.hostBadge.test(badge), JSON.stringify(badge) + ' should read as a host badge');
  });
});

check('host badge matches a whole leaf label only', function () {
  /* Otherwise a name, or a sentence about the host, promotes a guest to host
   * and the warning never shows. */
  ['Ghost', 'Hostetler', 'Ada Lovelace', 'The host ended the call',
    "Adesh's Fathom Notetaker"].forEach(function (line) {
    assert.ok(!L.hostBadge.test(line), JSON.stringify(line) + ' should not read as a host badge');
  });
});

check('the Host controls button is told apart from its neighbours', function () {
  assert.ok(L.hostControls.test('Host controls'));
  assert.ok(L.hostControls.test('Host management'));
  ['Meeting tools', 'Chat with everyone', 'People', 'Participants', 'Host'].forEach(
    function (label) {
      assert.ok(!L.hostControls.test(label),
        label + ' should not read as the host controls button');
    });
});

check('own row is identified by its chip', function () {
  assert.ok(L.selfChip.test('(You)'));
  assert.ok(L.selfChip.test('You'));
  assert.ok(!L.selfChip.test('Young Kim'));
});

check('name is recovered from a control label', function () {
  assert.strictEqual(L.nameFromControl.exec('More options for Ada Lovelace')[1], 'Ada Lovelace');
  assert.strictEqual(L.nameFromControl.exec('Pin Adesh Tamrakar'), null);
});

check('meeting path is recognised', function () {
  assert.ok(L.meetingCodePath.test('/zvh-sowq-ews'));
  assert.ok(!L.meetingCodePath.test('/landing'));
});

check('selector table covers the roster without matching tiles', function () {
  assert.ok(MEET.SELECTORS.rosterRow.includes('[role="listitem"]'),
    'roster selector must require role=listitem, or it picks up video tiles');
  assert.strictEqual(MEET.SELECTORS.rosterRow.includes('[role="listitem"]'), true);
});

console.log(pass + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  failures.forEach(function (line) { console.log('  FAIL ' + line); });
  process.exit(1);
}
