import kvdb from '@/kvdb';
import { storageKey } from '@/storageNamespace';

/**
 * When a Disney sign-in expired under a running engine.
 *
 * The sign-in screen replaces the whole app, so Autopilot and any search stop
 * with it, and after signing in again Autopilot is simply off -- with nothing
 * to say it had been running, or when it stopped. `App` records the moment;
 * Today says so until Autopilot is turned on again.
 */
export const SIGN_IN_STOP_KEY = storageKey('ui.signInStop');

/** A record older than this is from another session, not this one. */
const STALE_MS = 12 * 60 * 60 * 1000;

export function recordSignInStop(at = Date.now()) {
  kvdb.set<number>(SIGN_IN_STOP_KEY, at);
}

export function signInStopAt(now = Date.now()): number | undefined {
  const at = kvdb.get<number>(SIGN_IN_STOP_KEY);
  if (typeof at !== 'number') return undefined;
  if (now - at > STALE_MS) {
    clearSignInStop();
    return undefined;
  }
  return at;
}

export function clearSignInStop() {
  kvdb.delete(SIGN_IN_STOP_KEY);
}
