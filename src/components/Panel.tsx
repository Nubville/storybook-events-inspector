import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ActionBar, AddonPanel, Collapsible, EmptyTabContent, ScrollArea } from 'storybook/internal/components';
import { useChannel, useParameter, useStorybookState } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';
import { ObjectInspector } from 'react-inspector';

import { ADDON_ID, EVENTS, PANEL_ID, PARAM_KEY } from '../constants';
import { indexCatalog } from '../core/catalog';
import type { DispatchResult, LogEntry } from '../core/types';
import { effectiveFilter } from '../effectiveFilter';
import type { EventsInspectorParameters } from '../types';
import { DispatchForm } from './DispatchForm';
import { addEntry, clearEntries, getEntries, markAllViewed, subscribe } from './entriesStore';
import { Flags } from './Flags';
import { inspectorTheme } from './inspectorTheme';

interface PanelProps {
  active: boolean;
}

const EMPTY_PARAMS: EventsInspectorParameters = {};

const Scroll = styled(ScrollArea)({
  flex: 1,
  minHeight: 0,
});

// A real <button>, not a div with an onClick — Collapsible's `summary` is
// purely decorative content with no click-to-toggle of its own (confirmed by
// inspecting its rendered DOM: no role, no handler); `toggleProps` below is
// meant to be spread onto whatever the caller uses as the actual trigger, and
// a button is what gives that trigger keyboard support (Enter/Space) for free.
const SummaryRow = styled.button(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  fontSize: 12,
  font: 'inherit',
  color: 'inherit',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  ':hover': {
    color: theme.color.secondary,
  },
}));

const Stats = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  fontSize: 11,
}));

// Rows are full-width blocks (not a fixed-column <table>) so a payload of any
// shape gets the space it needs — the same reason the built-in Actions addon
// stacks name-then-payload instead of squeezing an inspector into a column.
const Row = styled.div(({ theme }) => ({
  padding: '8px 12px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const RowHead = styled.div({
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  flexWrap: 'wrap',
  fontSize: 12,
  marginBottom: 4,
});

const Time = styled.span(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11,
  color: theme.textMutedColor,
  flexShrink: 0,
}));

const Name = styled.span(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const FiredBy = styled.span(({ theme }) => ({
  marginLeft: 'auto',
  fontSize: 11,
  color: theme.textMutedColor,
  code: {
    fontFamily: theme.typography.fonts.mono,
    color: theme.color.defaultText,
  },
}));

export const Panel: React.FC<PanelProps> = ({ active }) => {
  const theme = useTheme();
  const params = useParameter<EventsInspectorParameters>(PARAM_KEY, EMPTY_PARAMS);
  // NOT the `active` render prop above — verified live that it does not track
  // "is this tab the one currently selected" the way its name suggests (it
  // stayed `true` while the Controls tab was the one actually visible).
  // `selectedPanel` is the real signal; same state field `getSelectedPanel()`
  // reads, confirmed by inspecting manager-api's own source, exposed here
  // via the same already-reactive hook this file uses for `storyId`.
  const { storyId, selectedPanel } = useStorybookState() as { storyId: string; selectedPanel?: string };
  const isSelected = selectedPanel === PANEL_ID;

  const catalog = params.catalog ?? [];
  const filter = useMemo(() => effectiveFilter(params), [params]);
  const compact = params.compact ?? false;
  const maxEvents = params.maxEvents ?? 100;
  const byName = useMemo(() => indexCatalog(catalog), [catalog]);
  const treeTheme = useMemo(() => inspectorTheme(theme), [theme]);

  // A manager-local store, not useAddonState — PanelTitle.tsx (mounted
  // separately, in the tab bar) reads the same module for its live count, so
  // there is still exactly one array and still nothing to race. What's gone is
  // the channel sync useAddonState performs on every write, which was
  // re-serializing the whole log into the preview iframe per captured event.
  const entries = useSyncExternalStore(subscribe, getEntries);
  const [seen, setSeen] = React.useState<ReadonlySet<string>>(new Set());
  const [dispatchResult, setDispatchResult] = React.useState<DispatchResult | null>(null);

  const emit = useChannel({
    [EVENTS.LOG]: (entry: LogEntry) => {
      addEntry(entry, maxEvents);
      setSeen((prev) => (prev.has(entry.name) ? prev : new Set(prev).add(entry.name)));
    },
    [EVENTS.DISPATCH_RESULT]: (result: DispatchResult) => setDispatchResult(result),
  });

  // A story switch invalidates everything below — same reason the built-in
  // Actions addon clears its log per story.
  useEffect(() => {
    clearEntries();
    setSeen(new Set());
    setDispatchResult(null);
  }, [storyId]);

  // Only badge what arrived while nobody was actually looking — matches
  // PanelTitle reading entriesStore's unviewed count. Re-runs on every new
  // entry too, so events arriving *while already open* never badge at all.
  useEffect(() => {
    if (isSelected) markAllViewed();
  }, [isSelected, entries]);

  // Coverage of the *documented* surface specifically — capture itself has no
  // upper bound to measure against (it sees everything by default), so this
  // is only meaningful when a catalog is actually supplied.
  const catalogSeen = useMemo(() => {
    if (catalog.length === 0) return 0;
    let count = 0;
    for (const name of seen) if (byName.has(name)) count += 1;
    return count;
  }, [seen, byName, catalog.length]);

  const stats: string[] = [];
  if (catalog.length > 0) stats.push(`${catalogSeen} of ${catalog.length} catalog events seen`);
  if (filter.length > 0) {
    stats.push(`narrowed to ${params.catalogOnly && !params.filter?.length ? 'your catalog' : filter.length}`);
  }

  return (
    <AddonPanel active={active}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Collapsible
          storageKey={`${ADDON_ID}-dispatch`}
          initialCollapsed
          summary={(state) => (
            <SummaryRow {...state.toggleProps}>
              <span>Dispatch event</span>
              {stats.length > 0 && <Stats>{stats.join(' · ')}</Stats>}
            </SummaryRow>
          )}
        >
          <DispatchForm catalog={catalog} storyId={storyId} emit={emit} result={dispatchResult} />
        </Collapsible>

        <Scroll vertical>
          {entries.length === 0 ? (
            <EmptyTabContent
              title="No events yet"
              description={
                filter.length > 0
                  ? params.catalogOnly && !params.filter?.length
                    ? `Narrowed to your catalog's ${filter.length} event name${
                        filter.length === 1 ? '' : 's'
                      } — everything else is filtered out. Interact with a component in the canvas to see them arrive here.`
                    : `Narrowed to ${filter.length} event name${
                        filter.length === 1 ? '' : 's'
                      }. Interact with a component in the canvas to see them arrive here.`
                  : 'Capturing every custom event automatically — no registration needed. Interact with a component in the canvas to see them arrive here.'
              }
            />
          ) : (
            entries.map((entry) => (
              <Row key={entry.seq}>
                <RowHead>
                  <Time>{entry.time}</Time>
                  <Name>{entry.name}</Name>
                  <Flags entry={entry} tags={byName.get(entry.name)} />
                  <FiredBy>
                    fired by <code>{entry.origin}</code>
                  </FiredBy>
                </RowHead>
                {!compact && entry.detail !== undefined && (
                  // react-inspector's own .d.ts types `theme` as string-only, but its
                  // README documents a full custom-object theme too (confirmed against
                  // its source) — the type is just behind the actual runtime support.
                  <ObjectInspector data={entry.detail} theme={treeTheme as unknown as string} expandLevel={1} />
                )}
              </Row>
            ))
          )}
        </Scroll>

        {/* Matches the built-in Actions addon's own Clear button exactly — same
            component, same bottom placement — per direct maintainer feedback. */}
        <ActionBar actionItems={[{ title: 'Clear', onClick: () => clearEntries(), disabled: entries.length === 0 }]} />
      </div>
    </AddonPanel>
  );
};
