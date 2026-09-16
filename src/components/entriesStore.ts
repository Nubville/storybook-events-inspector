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

/**
 * The seq of the newest entry Panel has shown while its tab was actually
 * selected, per the accessibility addon's own suggestion for this exact
 * addon: badge the tab with what's *new*, not the running total, so the
 * number means "you should look" rather than background noise that never
 * goes away. `seq` is monotonic for the life of the preview (see preview.ts)
 * and untouched by Clear or a story switch, so this watermark stays
 * meaningful across both without needing to reset it explicitly.
 */
let lastViewedSeq = -1;

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

/** Called by Panel whenever its tab is the one actually selected, so new arrivals while open never badge. */
export function markAllViewed(): void {
  const latest = entries[0]?.seq;
  if (latest === undefined || latest === lastViewedSeq) return;
  lastViewedSeq = latest;
  emitChange();
}

/** What PanelTitle badges — entries newer than the last time the panel's tab was actually selected. */
export function getUnviewedCount(): number {
  let count = 0;
  // Newest-first: the moment we reach one at or before the watermark, every
  // entry after it is older still, so the rest can't be unviewed either.
  for (const entry of entries) {
    if (entry.seq <= lastViewedSeq) break;
    count++;
  }
  return count;
}

/** Test seam: drop all state and subscribers. */
export function resetForTest(): void {
  entries = [];
  lastViewedSeq = -1;
  listeners.clear();
}
