/*
 * The video tile area. Contract item 1: every tile carries
 * data-participant-id, sits outside any [role="listitem"], and exists while
 * the People panel is closed. That attribute-without-listitem combination is
 * the only way the extension tells a tile from a roster row, so nothing in
 * here may gain role="listitem".
 */
import { initials } from '../data.js';

function Tile({ person }) {
  return (
    <div
      data-participant-id={person.id}
      className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl"
      style={{ backgroundColor: `hsl(${person.hue} 25% 16%)` }}
    >
      {person.video ? (
        /* There is no stream to attach in the clone; a bare video element
           keeps the camera-on tile structurally honest and lets the tinted
           background show through. */
        <video className="h-full w-full object-cover" autoPlay muted playsInline />
      ) : (
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-medium text-white"
          style={{ backgroundColor: `hsl(${person.hue} 30% 55%)` }}
        >
          {initials(person.name)}
        </div>
      )}
      {/* The extension reads tile text as a fallback name source, so the name
          appears exactly once and every icon stays in its own glyph span. */}
      <span className="absolute bottom-3 left-4 text-sm font-medium text-white">
        {person.self ? 'You' : person.name}
      </span>
      {person.visitor ? (
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-high/80">
          <span className="material-icon text-[18px] text-on-muted" aria-hidden="true">
            mic_off
          </span>
        </span>
      ) : null}
    </div>
  );
}

export function TileGrid({ people }) {
  return (
    <div className="grid min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
      {people
        .filter((person) => person.tile)
        .map((person) => (
          <Tile key={person.key} person={person} />
        ))}
    </div>
  );
}
