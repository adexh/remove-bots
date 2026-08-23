/*
 * Bottom call controls. The centre cluster is decoration, but the right-hand
 * group is contract item 7: "Chat with everyone", "Meeting tools" and, in
 * host mode only, "Host controls" must exist with exactly those accessible
 * names and must do nothing when clicked, so the extension can prove it never
 * touches them. They deliberately have no onClick at all.
 */

function IconButton({ label, glyph, haspopup, className }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup={haspopup}
      className={'flex items-center justify-center rounded-full transition-colors ' + className}
    >
      <span className="material-icon text-2xl" aria-hidden="true">
        {glyph}
      </span>
    </button>
  );
}

/* Meet's resting dark-toolbar circle, its red "muted" state, and the plain
   panel toggles at the bar's right edge. */
const PLAIN = 'h-12 w-12 bg-surface-high text-on-surface hover:bg-[#3c4043]';
const MUTED = 'h-12 w-12 bg-danger text-white hover:bg-[#e46962]';
const PANEL = 'h-12 w-12 text-on-surface hover:bg-surface-high';

export function Toolbar({ guest }) {
  return (
    <>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
        <IconButton label="Turn on microphone" glyph="mic_off" className={MUTED} />
        <IconButton label="Turn on camera" glyph="videocam_off" className={MUTED} />
        <IconButton label="Present now" glyph="present_to_all" className={PLAIN} />
        <IconButton label="Send a reaction" glyph="mood" className={PLAIN} />
        <IconButton label="Turn on captions" glyph="closed_caption" className={PLAIN} />
        <IconButton label="Raise hand" glyph="back_hand" className={PLAIN} />
        <IconButton label="More options" glyph="more_vert" className={PLAIN} />
        <IconButton
          label="Leave call"
          glyph="call_end"
          className="h-12 w-16 bg-danger text-white hover:bg-[#e46962]"
        />
      </div>
      {/* ml-auto keeps this group hugging the bar's right edge; the ChipGrid
          sits above it, in the header strip at the top of the screen. */}
      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Chat with everyone" glyph="chat" haspopup="dialog" className={PANEL} />
        <IconButton label="Meeting tools" glyph="apps" className={PANEL} />
        {guest ? null : <IconButton label="Host controls" glyph="lock_person" className={PANEL} />}
      </div>
    </>
  );
}
