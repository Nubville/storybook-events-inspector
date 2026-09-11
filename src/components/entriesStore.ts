/**
 * The panel's log, held in the manager process.
 *
 * This used to be `useAddonState`, which is `useSharedState` — it syncs across
 * the manager/preview channel on every write. That made every captured event
 * re-serialize the *entire* log and postMessage it into the preview iframe,
 * so cost grew with the square of the number of events: measured at 174 KB of
 * channel traffic for 30 events carrying ~6 KB of actual payload, and worse as
 * the log fills toward `maxEvents`.
 *
 * None of that traffic did anything. The only reason the state was ever shared
 * was that `PanelTitle` — mounted separately, in the tab bar — needs the count
 * for its live badge. Both components live in the same manager bundle, so a
 * module-level store read through `useSyncExternalStore` gives them the same
 * single source of truth with no channel involvement at all. The original
 * reason for sharing (Clear and the tab count drifting apart when one mirrored
 * the other) still holds: there is exactly one array, so there is still
 * nothing to race.
 */
import type { LogEntry } from '../core/types';

let entries: readonly LogEntry[] = [];
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Must return a referentially stable value between changes — `useSyncExternalStore`
 * re-renders on every differing snapshot, so returning a fresh array here
 * would loop forever. `entries` is only ever *replaced*, never mutated.
 */
export function getEntries(): readonly LogEntry[] {
  return entries;
}

export function addEntry(entry: LogEntry, maxEvents: number): void {
  entries = [entry, ...entries].slice(0, Math.max(1, maxEvents));
  emitChange();
}

export function clearEntries(): void {
  // No-op when already empty, so a story switch on an empty log doesn't
  // publish a pointless re-render to every subscriber.
  if (entries.length === 0) return;
  entries = [];
  emitChange();
}

/** Test seam: drop all state and subscribers. */
export function resetForTest(): void {
  entries = [];
  listeners.clear();
}
