/* Options page: edit the custom rule lists stored in chrome.storage.sync. */
import { DEFAULTS, vendorNames } from '../../lib/bots.js';

const custom = document.getElementById('custom');
const allowlist = document.getElementById('allowlist');
const showHumans = document.getElementById('showHumans');
const saved = document.getElementById('saved');

/** One rule per line, blanks dropped. */
function toLines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  const settings = stored || DEFAULTS;
  custom.value = (settings.custom || []).join('\n');
  allowlist.value = (settings.allowlist || []).join('\n');
  showHumans.checked = !!settings.showHumans;
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set(
    {
      custom: toLines(custom.value),
      allowlist: toLines(allowlist.value),
      showHumans: showHumans.checked,
    },
    () => {
      saved.classList.add('show');
      setTimeout(() => saved.classList.remove('show'), 1600);
    },
  );
});

const list = document.getElementById('vendors');
vendorNames().forEach((name) => {
  const line = document.createElement('div');
  line.textContent = name;
  list.appendChild(line);
});
