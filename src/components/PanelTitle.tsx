import React from 'react';
import { Badge } from 'storybook/internal/components';
import { useParameter, useStorybookApi } from 'storybook/manager-api';

import { PANEL_ID, PARAM_KEY } from '../constants';
import type { EventsInspectorParameters } from '../types';
import { getUnviewedCount, subscribe } from './entriesStore';

/**
 * The tab's own title, not a toolbar item — a toolbar is for global,
 * view-affecting toggles (background, viewport, zoom); this is a log, the
 * same shape as Actions/Interactions, so it belongs where those live.
 *
 * Matches the accessibility addon's own tab-badge convention exactly (a
 * `Badge compact status={...}` next to the label, active-colored while the
 * tab is the one actually open) rather than a bespoke number-in-the-string —
 * per direct feedback from a Storybook maintainer. Badges *unviewed* events,
 * not the running total: the point of a badge is "you should look," which a
 * count that never goes back down doesn't communicate.
 *
 * `api.getSelectedPanel()` exists at runtime but isn't in this version's
 * public .d.ts (confirmed by reading the accessibility addon's own source,
 * which calls it the same way) — hence the narrow cast, not a broad `any`.
 */
export const PanelTitle: React.FC = () => {
  const api = useStorybookApi() as { getSelectedPanel(): string };
  const [count, setCount] = React.useState(getUnviewedCount());
  React.useEffect(() => subscribe(() => setCount(getUnviewedCount())), []);

  const label = useParameter<EventsInspectorParameters>(PARAM_KEY, {}).label ?? 'Events inspector';
  const badge =
    count === 0 ? null : (
      <Badge compact status={api.getSelectedPanel() === PANEL_ID ? 'active' : 'neutral'}>
        {count}
      </Badge>
    );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{label}</span>
      {badge}
    </div>
  );
};
