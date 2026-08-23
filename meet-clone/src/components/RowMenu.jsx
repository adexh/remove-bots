/*
 * The per-row overflow menu, portalled to document.body exactly as Meet
 * portals its own (contract point 5): the extension's overlayRoots() walks
 * direct children of <body> and skips <main>, so rendering this inside the
 * panel would hide it from the extension entirely.
 */
import { useEffect, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';

const ENTRIES = [
  ['keep', 'Pin to the screen'],
  ['link', 'Ask to pair your tiles'],
  ['videocam_off', "Don't watch"],
];

export function RowMenu({ person, guest, anchor, onClose, onRemove }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const onDown = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      /* Clicks on the anchor button are left to its own toggle handler, or a
       * second click on "More actions" would close and instantly reopen. */
      if (anchor.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [anchor, onClose]);

  const box = anchor.getBoundingClientRect();
  const style = {
    top: Math.min(box.bottom + 4, window.innerHeight - 220),
    right: Math.max(window.innerWidth - box.right, 8),
  };

  const entries = ENTRIES.slice();
  /* Meet simply omits the entry for someone who cannot be removed, and for
   * viewers who are not the host; the extension relies on its absence. */
  if (!guest && !person.noRemove) {
    entries.push(['remove_circle_outline', 'Remove from the call']);
  }

  /*
   * flushSync, deliberately: the extension clicks this entry and then reads
   * the DOM on a timer, with no further user events. Updates scheduled from
   * events delegated through this portal are not flushed until the next
   * event arrives, so without the forced commit the menu appears to ignore
   * the click for as long as the extension is willing to wait.
   */
  const activate = (label) => {
    flushSync(() => {
      onClose();
      if (label === 'Remove from the call') onRemove(person);
    });
  };

  return createPortal(
    <div ref={menuRef} className="fixed z-50" style={style}>
      <ul
        role="menu"
        aria-label="More actions"
        tabIndex={-1}
        className="w-64 rounded-lg bg-surface-high py-2 text-on-surface shadow-xl shadow-black/40"
      >
        {entries.map(([glyph, label]) => (
          <li
            key={label}
            role="menuitem"
            tabIndex={-1}
            aria-label={label}
            onClick={() => activate(label)}
            className="flex h-12 cursor-pointer items-center gap-4 px-4 text-sm hover:bg-white/5"
          >
            {/* Glyph and label stay separate leaves (contract point 5). */}
            <i className="material-icon text-xl text-on-muted">{glyph}</i>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}
