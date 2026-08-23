/*
 * The removal confirmation, portalled to document.body with NO role="dialog",
 * deliberately (contract point 6): the live Meet build portals this step as a
 * roleless overlay, and the extension finds the "Remove" button by scanning
 * overlay text for the smallest match. Adding the role would let a naive
 * selector work here and then fail on real Meet.
 */
import { useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';

export function ConfirmDialog({ person, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[440px] max-w-[90vw] rounded-2xl bg-surface-high p-6 text-on-surface shadow-2xl shadow-black/60">
        <h2 className="text-lg font-normal">
          Remove {person.name} from the call?
        </h2>
        <p className="mt-3 text-sm text-on-muted">
          They will not be able to rejoin unless someone lets them back in.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => flushSync(onCancel)}
            className="h-9 rounded-full px-4 text-sm font-medium text-accent hover:bg-white/5"
          >
            Cancel
          </button>
          {/* flushSync for the same reason as RowMenu: the extension reads
              the DOM between events, so the commit cannot wait for one. */}
          <button
            type="button"
            onClick={() => flushSync(onConfirm)}
            className="h-9 rounded-full px-4 text-sm font-medium text-accent hover:bg-white/5"
          >
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
