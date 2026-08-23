/*
 * Tester-only controls, a slim strip above the fake call UI for reshaping the
 * scenario live: who is host, how many extra humans, how many bots. It is
 * chrome for the person driving the fixture, not part of the Meet clone, and
 * it styles itself apart (near-black strip, amber label) so nobody mistakes
 * it for the call.
 *
 * Because the extension under test scans the whole page, this bar must never
 * look interesting to it (src/contract.md): no role="region" or role="button",
 * no aria-haspopup, and no accessible name containing "People". Native
 * <label> / <input> elements only, which the extension ignores.
 */

const FIELD =
  'h-6 w-14 rounded border border-white/15 bg-surface-high px-2 text-xs ' +
  'text-on-surface outline-none focus:border-white/40';

/* Number inputs report '' while being edited; coerce, squash NaN to 0, and
   keep the cast small enough that the tile grid stays legible. */
function clampCount(raw) {
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : Math.min(99, Math.max(0, Math.trunc(n)));
}

export function TesterBar({ scenario, onUpdate }) {
  return (
    <div
      data-testid="tester-bar"
      className="flex h-10 w-full flex-none items-center gap-5 border-b border-amber-400/30 bg-[#0b0c0e] px-4 text-xs text-on-muted"
    >
      <span className="select-none font-medium uppercase tracking-widest text-amber-400/80">
        Tester controls
      </span>

      {/* Checked means you hold the Remove menu; unchecked hands the host
          role to someone else, which is scenario.guest = true. */}
      <label className="flex cursor-pointer select-none items-center gap-2">
        <input
          type="checkbox"
          checked={!scenario.guest}
          onChange={(event) => onUpdate({ guest: !event.target.checked })}
          className="h-3.5 w-3.5 accent-amber-400"
        />
        You are host
      </label>

      <label className="flex select-none items-center gap-2">
        Users
        <input
          type="number"
          min={0}
          max={99}
          value={scenario.users}
          onChange={(event) => onUpdate({ users: clampCount(event.target.value) })}
          className={FIELD}
        />
      </label>

      <label className="flex select-none items-center gap-2">
        Bots
        <input
          type="number"
          min={0}
          max={99}
          value={scenario.bots}
          onChange={(event) => onUpdate({ bots: clampCount(event.target.value) })}
          className={FIELD}
        />
      </label>
    </div>
  );
}
