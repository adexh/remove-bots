/*
 * Bot detection: does this display name belong to a meeting bot?
 *
 * Names only. Nothing here knows how Meet is built, and nothing here touches
 * the DOM, which is what makes it unit testable in Node.
 */

/*
 * Tier "vendor": the display name is a known meeting-bot product. High
 * confidence, so these are pre-selected for removal.
 *
 * Vendor names that are also plausible human names (Gong, Kaia, Rilla...)
 * require a product context word such as "ai" or "notetaker". A missed bot
 * is one extra tick in the popup; a false positive queues a real person for
 * removal, so these patterns stay deliberately narrow.
 *
 * Tier "likely": either a vendor whose bot name collides with plausible human
 * names, or a generic pattern such as "... Notetaker". Still pre-selected,
 * but the popup shows why so the user can untick it.
 */
const VENDORS = [
  ['Otter.ai', /\botter(?:\.ai|pilot)?\b/i],
  ['Fireflies.ai', /\bfireflies(?:\.ai)?\b/i],
  ['Fathom', /\bfathom\b/i],
  ['Read AI', /\bread\s*\.?\s*ai\b/i],
  ['tl;dv', /\b(?:tl[;.,]?dv|tldv)\b/i],
  ['Avoma', /\bavoma\b/i],
  ['Gong', /\bgong(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Chorus.ai', /\bchorus(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Grain', /\bgrain(?:\.co)?\b/i],
  ['Sembly AI', /\bsembly\b/i],
  ['Circleback', /\bcircleback\b/i],
  ['Spinach.io', /\bspinach(?:\.io|\s*ai)?\b/i],
  ['Laxis', /\blaxis\b/i],
  ['MeetGeek', /\bmeetgeek\b/i],
  ['Supernormal', /\bsupernormal\b/i],
  ['Fellow.app', /\bfellow(?:\.app)?\b/i],
  ['Sybill', /\bsybill(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))|\bsybill\.ai\b/i],
  ['Bluedot', /\bbluedot\b/i],
  ['Colibri.ai', /\bcolibri(?:\.ai)?\b/i],
  ['Airgram', /\bairgram\b/i],
  ['Wudpecker', /\bwudpecker\b/i],
  ['Noota', /\bnoota\b/i],
  ['Clari Copilot', /\bclari(?:\.com)?\s*(?:copilot|ai|bot|notetaker|recorder)\b|\bwingman\b/i],
  ['Outreach Kaia', /\boutreach\b|\bkaia(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Salesloft', /\bsalesloft\b/i],
  ['ZoomInfo Copilot', /\bzoominfo\b/i],
  ['Modjo', /\bmodjo\b/i],
  ['Aviso', /\baviso(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Rewatch', /\brewatch\b/i],
  ['Vowel', /\bvowel\b/i],
  ['Scribbl', /\bscribbl\b/i],
  ['Sonero', /\bsonero\b/i],
  ['Marsview', /\bmarsview\b/i],
  ['Backtrack', /\bbacktrack\b/i],
  ['ScreenApp', /\bscreenapp\b/i],
  ['Equal Time', /\bequal\s?time\b/i],
  ['Nyota', /\bnyota(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Bloks', /\bbloks\b/i],
  ['Tanka', /\btanka(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Krisp', /\bkrisp\b/i],
  ['Recall.ai', /\brecall\s*\.?\s*ai\b/i],
  ['Attention', /\battention\s*\.?\s*(?:com|ai|tech)\b/i],
  ['Rilla', /\brilla(?:\s*\.?\s*(?:ai|io|com|app)\b|\s+(?:ai|bot|notetaker|note\s?taker|notes|recorder|assistant|copilot))/i],
  ['Momentum', /\bmomentum\s*\.?\s*io\b/i],
  ['Granola', /\bgranola\b/i],
  ['Hedy', /\bhedy\s*ai\b/i],
  ['Jamie', /\bjamie\s*(?:ai|bot|notetaker)\b/i],
  ['Sunny', /\bsunny\s*ai\b/i],
  ['Fluently', /\bfluently\s*ai\b/i],
  ['Bubbles', /\bbubbles\s*(?:ai|notetaker)\b/i]
];

/* Generic shapes that meeting bots use when they are not branded. */
const HEURISTICS = [
  ['Name contains "notetaker"', /\bnote\s?-?\s?taker\b|\bnotetaking\b/i],
  ['Name contains "bot"', /\bbot\b|\bbots\b/i],
  ['Name mentions recording', /\brecorder\b|\brecording\b|\bis recording\b/i],
  ['Name mentions transcription', /\btranscri(?:pt|be|ber|ption)/i],
  ['Name mentions an AI assistant', /\bai\s+(?:assistant|notes?|note\s?taker|agent|scribe)\b/i],
  ['Name mentions an AI assistant', /\b(?:assistant|scribe|agent)\s+(?:ai|bot)\b/i],
  ['Name mentions meeting notes', /\bmeeting\s+(?:notes?|assistant|recorder|bot|agent|scribe)\b/i],
  ['Name mentions notes', /\bnotes?\s+(?:bot|taker|app|by)\b/i],
  ['Marked as a notetaker in brackets', /[([{](?:\s*)(?:notes?|note\s?taker|recording|ai|bot|transcript)(?:\s*)[)\]}]/i]
];

/*
 * Google's own in-call assistants. They are listed like participants but are
 * not removable through the participant menu, so we surface them with an
 * explanation instead of trying and failing.
 */
const BUILTIN = [
  ['Google Meet notes (Gemini)', /\btake\s+notes\s+with\s+gemini\b|\bmeeting\s+records\b|\bnotes?\s+by\s+gemini\b|\bgemini\b/i]
];

function toRegex(pattern) {
  if (pattern instanceof RegExp) return pattern;
  var text = String(pattern || '').trim();
  if (!text) return null;
  var match = /^\/(.*)\/([a-z]*)$/.exec(text);
  try {
    if (match) return new RegExp(match[1], match[2].indexOf('i') === -1 ? match[2] + 'i' : match[2]);
    /* Plain words are treated as a case-insensitive substring match. */
    return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  } catch (err) {
    return null;
  }
}

function firstMatch(rules, name) {
  for (var i = 0; i < rules.length; i++) {
    if (rules[i][1].test(name)) return rules[i][0];
  }
  return null;
}

/**
 * Decide whether a participant name looks like a meeting bot.
 *
 * @param {string} rawName participant display name
 * @param {{allowlist?: string[], custom?: string[]}} [settings]
 * @returns {{isBot: boolean, tier: string, label: string, builtin: boolean}}
 */
function classify(rawName, settings) {
  var name = String(rawName == null ? '' : rawName).replace(/\s+/g, ' ').trim();
  var opts = settings || {};
  var result = { isBot: false, tier: 'human', label: '', builtin: false };
  if (!name) return result;

  var allowlist = (opts.allowlist || []).map(toRegex).filter(Boolean);
  for (var a = 0; a < allowlist.length; a++) {
    if (allowlist[a].test(name)) {
      result.tier = 'allowlisted';
      result.label = 'On your never-remove list';
      return result;
    }
  }

  var custom = (opts.custom || []).map(toRegex).filter(Boolean);
  for (var c = 0; c < custom.length; c++) {
    if (custom[c].test(name)) {
      return { isBot: true, tier: 'custom', label: 'Matches your own rule', builtin: false };
    }
  }

  var builtin = firstMatch(BUILTIN, name);
  if (builtin) return { isBot: true, tier: 'builtin', label: builtin, builtin: true };

  var vendor = firstMatch(VENDORS, name);
  if (vendor) return { isBot: true, tier: 'vendor', label: vendor, builtin: false };

  var heuristic = firstMatch(HEURISTICS, name);
  if (heuristic) return { isBot: true, tier: 'likely', label: heuristic, builtin: false };

  return result;
}

/**
 * Does this bot name read as belonging to this user?
 *
 * Meet names a joining bot possessively after the account that sent it:
 * Fathom arrives as "Adesh's Fathom Notetaker", never as "Fathom". So a bot
 * is yours when it opens with your own display name in the possessive, tried
 * longest first ("Adesh Tamrakar's ...") down to the first name alone
 * ("Adesh's ..."). Both the straight and the curly apostrophe occur in the
 * wild, and a name already ending in s takes a bare one ("Charles' ...").
 *
 * Names only, like everything in this file: the caller passes the self row's
 * display name, badges and all ("Adesh Tamrakar (You)" is handled).
 */
function ownedBy(botName, selfName) {
  var name = String(botName == null ? '' : botName).replace(/\s+/g, ' ').trim().toLowerCase();
  var self = String(selfName == null ? '' : selfName).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!name || !self) return false;

  self = self.replace(/\s*\((?:you|host)\)/g, '').replace(/\s+/g, ' ').trim();

  var words = self.split(' ');
  for (var take = words.length; take >= 1; take--) {
    var prefix = words.slice(0, take).join(' ');
    var possessives = /s$/.test(prefix)
      ? [prefix + "' ", prefix + '’ ', prefix + "'s ", prefix + '’s ']
      : [prefix + "'s ", prefix + '’s '];
    for (var p = 0; p < possessives.length; p++) {
      if (name.indexOf(possessives[p]) === 0) return true;
    }
  }
  return false;
}

export const DEFAULTS = { custom: [], allowlist: [], showHumans: false };

/** Every vendor the built-in list knows, alphabetically, for the options page. */
export function vendorNames() {
  return VENDORS.map(function (vendor) { return vendor[0]; }).sort(function (a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}

export { VENDORS, HEURISTICS, BUILTIN, toRegex, classify, ownedBy };
