/*
 * The clock-and-meeting-name cluster that Meet paints in the corner of the
 * control bar. Purely visual; the extension never reads it.
 */
import { useEffect, useState } from 'react';

function hhmm() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return pad(now.getHours()) + ':' + pad(now.getMinutes());
}

export function TopBar() {
  const [time, setTime] = useState(hhmm);

  useEffect(() => {
    /* Each tick is aligned to the next wall-clock minute, so the display
       changes exactly when a real clock would rather than up to a minute
       late. The small pad absorbs timer jitter around the boundary. */
    let timer;
    const schedule = () => {
      const now = new Date();
      const untilNextMinute =
        60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timer = setTimeout(() => {
        setTime(hhmm());
        schedule();
      }, untilNextMinute + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-y-0 left-6 flex items-center gap-3 text-[15px] font-medium text-white">
      <span>{time}</span>
      <span className="h-4 w-px bg-on-muted/60" aria-hidden="true" />
      <span>Test Meet</span>
    </div>
  );
}
