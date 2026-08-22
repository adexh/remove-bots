import { useSyncExternalStore } from 'react';
import { getState, subscribe } from '../lib/store.js';

/** Subscribe a component to the external UI store. */
export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}
