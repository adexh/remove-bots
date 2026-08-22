/* Paste into DevTools console on the live Meet tab. Read only: it opens the
 * People panel and one row menu, dumps what it finds, then presses Escape.
 * It never clicks a remove or confirm button. */
(async () => {
  window.__RB_PROBE = null;
  const T = n => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
  const vis = n => { if (!n) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const attrs = n => ['role', 'jsaction', 'tabindex', 'aria-label', 'aria-haspopup', 'jsname']
    .map(a => n.hasAttribute(a) ? a + '=' + JSON.stringify((n.getAttribute(a) || '').slice(0, 40)) : null)
    .filter(Boolean).join(' ');
  const desc = n => n.tagName.toLowerCase() +
    (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '') +
    (attrs(n) ? ' [' + attrs(n) + ']' : '');
  const R = [];
  const log = (...a) => { const s = a.join(' '); R.push(s); console.log(s); };

  log('=== 1. BEFORE opening the People panel ===');
  log('path:', location.pathname);
  const allBefore = [...document.querySelectorAll('[data-participant-id]')];
  log('[data-participant-id]:', allBefore.length,
      '| role=listitem:', document.querySelectorAll('[role="listitem"][data-participant-id]').length,
      '| role=list:', document.querySelectorAll('[role="list"]').length);
  allBefore.slice(0, 4).forEach(n => log('  tile:', desc(n), '| text:', JSON.stringify(T(n).slice(0, 60)),
      '| hasVideo:', !!n.querySelector('video'), '| buttons:', n.querySelectorAll('button').length));

  log('=== 2. People button lookup (extension logic) ===');
  const PEOPLE = /\bpeople\b|\bparticipants?\b|\beveryone\b/i;
  const strategies = [
    ['aria-label*=people', () => document.querySelector('button[aria-label*="people" i]')],
    ['aria-label*=participant', () => document.querySelector('button[aria-label*="participant" i]')],
    ['aria-label*=everyone', () => document.querySelector('button[aria-label*="everyone" i]')],
    ['aria-label regex scan', () => [...document.querySelectorAll('button[aria-label],[role="button"][aria-label]')]
        .find(b => PEOPLE.test(b.getAttribute('aria-label') || '') && vis(b))],
    ['icon glyph text', () => [...document.querySelectorAll('button')]
        .find(b => /^(people|group|people_outline)$/.test(T(b)) && vis(b))]
  ];
  let peopleBtn = null;
  for (const [name, fn] of strategies) {
    let hit = null; try { hit = fn(); } catch (e) { }
    log(' ', name, '->', hit ? desc(hit) + ' visible=' + vis(hit) : 'null');
    if (hit && vis(hit) && !peopleBtn) peopleBtn = hit;
  }

  if (peopleBtn && !document.querySelector('[role="listitem"][data-participant-id]')) {
    log('clicking:', desc(peopleBtn));
    peopleBtn.click();
    await sleep(1500);
  }

  log('=== 3. AFTER opening ===');
  const items = [...document.querySelectorAll('[role="listitem"][data-participant-id]')];
  log('role=listitem:', items.length, '| all [data-participant-id]:', document.querySelectorAll('[data-participant-id]').length);
  items.forEach((n, i) => {
    const btns = [...n.querySelectorAll('button,[role="button"]')];
    log(' row' + i, JSON.stringify((n.getAttribute('aria-label') || '').slice(0, 50)),
        '| leafText:', JSON.stringify(T(n).slice(0, 70)),
        '| id:', (n.getAttribute('data-participant-id') || '').slice(-12));
    btns.forEach(b => log('      btn:', desc(b), '| text:', JSON.stringify(T(b).slice(0, 20)), '| visible:', vis(b)));
  });

  log('=== 4. Row menu structure ===');
  const target = items.find(n => /fathom|otter|notetaker|fireflies|bot|notes/i.test(
      (n.getAttribute('aria-label') || '') + ' ' + T(n)));
  if (!target) { log('no bot-looking row found, skipping menu dump'); }
  else {
    log('target row:', JSON.stringify(target.getAttribute('aria-label')));
    const bodyBefore = new Set([...document.body.children]);
    ['pointerover', 'mouseover', 'mouseenter', 'mousemove'].forEach(t =>
      target.dispatchEvent(new MouseEvent(t, { bubbles: true, view: window })));
    await sleep(300);
    const btns = [...target.querySelectorAll('button,[role="button"]')];
    const more = [...btns].reverse().find(b => /more_vert|more_horiz/.test(T(b)))
      || btns.find(b => b.hasAttribute('aria-haspopup'))
      || [...btns].reverse().find(b => /more|option/i.test(b.getAttribute('aria-label') || ''));
    log('more button:', more ? desc(more) : 'NOT FOUND', '| of', btns.length, 'buttons');
    if (more) {
      more.click();
      await sleep(900);
      const added = [...document.body.children].filter(n => !bodyBefore.has(n));
      log('new direct children of <body>:', added.length);
      added.forEach(n => log('  overlay:', desc(n), '| visible:', vis(n)));
      const scope = added.length ? added : [...document.body.children];
      const hits = [];
      scope.forEach(root => [...root.querySelectorAll('*')].forEach(n => {
        const t = T(n);
        if (t && t.length < 60 && n.children.length <= 2 && vis(n)) hits.push([t, n]);
      }));
      log('menu entries (leaf-ish, visible):');
      [...new Map(hits.map(([t, n]) => [t, n]))].slice(0, 14)
        .forEach(([t, n]) => log('   ', JSON.stringify(t), '->', desc(n)));
      const removeHit = hits.find(([t]) => /\bremove\b/i.test(t));
      if (removeHit) {
        log('REMOVE entry text:', JSON.stringify(removeHit[0]));
        let n = removeHit[1];
        for (let i = 0; i < 6 && n && n !== document.body; i++, n = n.parentElement) {
          log('   ancestor' + i + ':', desc(n));
        }
      } else log('NO element matching /remove/i found in the overlay');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      log('(escape sent, nothing was removed)');
    }
  }
  log('=== END ===');
  /* Stash the report on window so it can be read from outside the page too,
   * e.g. over AppleScript, which cannot await the promise this returns. */
  window.__RB_PROBE = R.join('\n');
  if (typeof copy === 'function') copy(window.__RB_PROBE);
  console.log('%cReport ready. In DevTools it is on your clipboard; also at window.__RB_PROBE',
    'color:#188038;font-weight:bold');
  return window.__RB_PROBE;
})();
