import React from 'react';
import { Badge } from 'storybook/internal/components';

import type { LogEntry } from '../core/types';

interface FlagsProps {
  entry: LogEntry;
  /** Tags declaring this event name, from the catalog. Undefined = not in the catalog at all. */
  tags: readonly string[] | undefined;
}

/**
 * Four flags, each a documented trap in a "components fire one event, host owns
 * the workflow" API (see the addon README):
 *
 *   not composed  Dispatched from inside a shadow root without `composed: true`,
 *                 so it never left that root — invisible to anything outside it,
 *                 including the host app itself, not just this panel. Only set
 *                 when the origin is actually in a shadow tree: from the light
 *                 DOM (or from document/window/an event bus) `composed` changes
 *                 nothing, and flagging those would be a false alarm.
 *   undocumented  Not declared in the catalog passed via `parameters.eventsInspector.catalog`
 *                 — not part of the supported surface, nothing should depend on it.
 *   shared        More than one tag declares this event name, so a listener bound
 *                 on a shared ancestor can't tell which control fired without also
 *                 reading "Fired by".
 *   retargeted    `event.target` isn't the element that dispatched — a composed
 *                 event crossing a shadow boundary got retargeted to its host.
 */
export const Flags: React.FC<FlagsProps> = ({ entry, tags }) => {
  const undocumented = !tags;
  const shared = (tags?.length ?? 0) > 1;
  if (!undocumented && !shared && !entry.retargeted && !entry.notComposed) return null;

  return (
    <>
      {entry.notComposed && (
        <span title="Dispatched from inside a shadow root without composed: true — invisible outside that root, including to the host app">
          <Badge status="critical">not composed</Badge>
        </span>
      )}
      {undocumented && (
        <span title="Not declared in the catalog passed to this addon">
          <Badge status="critical">undocumented</Badge>
        </span>
      )}
      {shared && (
        <span title={`Also fired by: ${(tags ?? []).filter((tag) => tag !== entry.origin).join(', ')}`}>
          <Badge status="warning">shared</Badge>
        </span>
      )}
      {entry.retargeted && (
        <span title={`event.target reads ${entry.target}`}>
          <Badge status="neutral">retargeted</Badge>
        </span>
      )}
    </>
  );
};
