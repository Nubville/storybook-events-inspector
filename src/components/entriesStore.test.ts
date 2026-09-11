import { afterEach, describe as suite, expect, it, vi } from 'vitest';

import type { LogEntry } from '../core/types';
import { addEntry, clearEntries, getEntries, resetForTest, subscribe } from './entriesStore';

afterEach(resetForTest);

let seq = 0;
const entry = (name = 'demo-change'): LogEntry => ({
  seq: seq++,
  time: '00:00:00',
  name,
  origin: 'demo-button',
  target: 'demo-button',
  retargeted: false,
  notComposed: false,
  detail: undefined,
});

suite('entriesStore', () => {
  it('keeps newest first, the order the panel renders', () => {
    addEntry(entry('first'), 100);
    addEntry(entry('second'), 100);

    expect(getEntries().map((e) => e.name)).toEqual(['second', 'first']);
  });

  it('drops the oldest past maxEvents', () => {
    for (let i = 0; i < 5; i++) addEntry(entry(`event-${i}`), 3);

    expect(getEntries().map((e) => e.name)).toEqual(['event-4', 'event-3', 'event-2']);
  });

  it('keeps at least one entry even if maxEvents is nonsense', () => {
    addEntry(entry('kept'), 0);
    expect(getEntries()).toHaveLength(1);
  });

  it('notifies subscribers on write and on clear', () => {
    const listener = vi.fn();
    subscribe(listener);

    addEntry(entry(), 100);
    expect(listener).toHaveBeenCalledTimes(1);

    clearEntries();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const stop = subscribe(listener);
    stop();

    addEntry(entry(), 100);
    expect(listener).not.toHaveBeenCalled();
  });

  it('serves every subscriber the same array — Panel and PanelTitle cannot drift', () => {
    // The property the old shared-state comment was protecting: one value, so
    // the tab count can't go stale relative to the log after Clear.
    const seenByPanel: unknown[] = [];
    const seenByTitle: unknown[] = [];
    subscribe(() => seenByPanel.push(getEntries()));
    subscribe(() => seenByTitle.push(getEntries()));

    addEntry(entry(), 100);
    clearEntries();

    expect(seenByPanel).toEqual(seenByTitle);
    expect(getEntries()).toHaveLength(0);
  });

  it('returns a stable reference between changes, so useSyncExternalStore cannot loop', () => {
    addEntry(entry(), 100);
    expect(getEntries()).toBe(getEntries());
  });

  it('does not notify when clearing an already-empty log', () => {
    const listener = vi.fn();
    subscribe(listener);

    clearEntries();
    expect(listener).not.toHaveBeenCalled();
  });
});
