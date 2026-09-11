import React, { useSyncExternalStore } from 'react';
import { useParameter } from 'storybook/manager-api';

import { PARAM_KEY } from '../constants';
import type { EventsInspectorParameters } from '../types';
import { getEntries, subscribe } from './entriesStore';

/**
 * The tab's own title, not a toolbar item — a toolbar is for global,
 * view-affecting toggles (background, viewport, zoom); this is a log, the
 * same shape as Actions/Interactions, so it belongs where those live. What
 * IS worth surfacing outside the panel body is a live count, so "did
 * anything fire" is visible without switching tabs.
 *
 * Reads the exact same module-level store Panel.tsx writes its entries to
 * (rather than a separately-mirrored count) — one value, so Clear and this
 * title can't drift out of sync with each other. Both components are in the
 * manager bundle, so this needs no channel traffic at all.
 */
export const PanelTitle: React.FC = () => {
  const entries = useSyncExternalStore(subscribe, getEntries);
  const label = useParameter<EventsInspectorParameters>(PARAM_KEY, {}).label ?? 'Events inspector';
  return <span>{entries.length > 0 ? `${label} ${entries.length}` : label}</span>;
};
