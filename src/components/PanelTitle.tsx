import React from 'react';
import { useAddonState, useParameter } from 'storybook/manager-api';

import { ADDON_ID, PARAM_KEY } from '../constants';
import type { LogEntry } from '../core/types';
import type { EventsInspectorParameters } from '../types';

/**
 * The tab's own title, not a toolbar item — a toolbar is for global,
 * view-affecting toggles (background, viewport, zoom); this is a log, the
 * same shape as Actions/Interactions, so it belongs where those live. What
 * IS worth surfacing outside the panel body is a live count, so "did
 * anything fire" is visible without switching tabs.
 *
 * Reads the exact same addon-state slot Panel.tsx stores its entries in
 * (rather than a separately-mirrored count) — one shared value, so Clear and
 * this title can't drift out of sync with each other.
 */
export const PanelTitle: React.FC = () => {
  const [entries] = useAddonState<LogEntry[]>(ADDON_ID, []);
  const label = useParameter<EventsInspectorParameters>(PARAM_KEY, {}).label ?? 'Events inspector';
  return <span>{entries.length > 0 ? `${label} ${entries.length}` : label}</span>;
};
