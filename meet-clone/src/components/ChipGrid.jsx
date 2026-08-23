/*
 * The right-hand chip cluster in the call bar: a notification badge and the
 * participant-count chip that opens the People panel.
 *
 * Contract points 3 and 7 (src/contract.md) live here. The extension finds the
 * People chip by accessible name, walks up to the nearest [role="region"], and
 * only trusts it if the computed display is grid, because it appends its own
 * button as an extra cell in that grid. So three things must stay true:
 *
 *   1. The region keeps role="region" and a grid display.
 *   2. Our own cells claim explicit grid columns on row 1, so an appended
 *      child with no placement of its own lands in a fresh implicit trailing
 *      track instead of stacking on top of a chip.
 *   3. The decoy badge stays earlier in DOM order than the People chip, and
 *      clicking it opens nothing. It reproduces the "External participants
 *      joined" trap that lib/meet.js excludes via LABELS.notPeople.
 */

const chipBase =
  'flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-full ' +
  'bg-surface-high px-3 text-on-surface hover:bg-[#3c4043]';

export function ChipGrid({ count, expanded, onTogglePeople }) {
  /* role="button" divs do not react to Enter or Space by themselves, and the
   * extension's keyboard fallback sends real key events at this chip. */
  const keyToggle = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTogglePeople();
    }
  };

  return (
    <div
      role="region"
      aria-label="Call feature notifications and actions"
      className="absolute right-6 top-1/2 inline-grid -translate-y-1/2 auto-cols-max grid-flow-col items-center gap-2"
    >
      {/* Decoy: built like the People chip, down to aria-haspopup, exactly as
          Meet builds its notification badge. It must stay a no-op. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="External participants joined"
        aria-haspopup="dialog"
        className={`${chipBase} col-start-1 row-start-1 text-on-muted`}
      >
        <i className="material-icon text-[18px]">domain_disabled</i>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="People"
        aria-haspopup="dialog"
        aria-expanded={expanded ? 'true' : 'false'}
        onClick={onTogglePeople}
        onKeyDown={keyToggle}
        className={`${chipBase} col-start-2 row-start-1`}
      >
        <i className="material-icon text-[18px]">group</i>
        <span className="min-w-5 rounded-full bg-white/10 px-1.5 py-0.5 text-center text-xs font-medium">
          {count}
        </span>
      </div>
    </div>
  );
}
