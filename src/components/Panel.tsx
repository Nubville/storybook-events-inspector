import React, { useEffect, useMemo, useState } from 'react';
import { AddonPanel, Button, EmptyTabContent, ScrollArea } from 'storybook/internal/components';
import { useAddonState, useChannel, useParameter, useStorybookState } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';
import { ObjectInspector } from 'react-inspector';

import { ADDON_ID, EVENTS, PARAM_KEY } from '../constants';
import { indexCatalog } from '../core/catalog';
import type { DispatchResult, LogEntry } from '../core/types';
import { effectiveFilter } from '../effectiveFilter';
import type { EventsInspectorParameters } from '../types';
import { DispatchForm } from './DispatchForm';
import { Flags } from './Flags';
import { inspectorTheme } from './inspectorTheme';

interface PanelProps {
  active: boolean;
}

const EMPTY_PARAMS: EventsInspectorParameters = {};

const Head = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  fontSize: 11,
  color: theme.textMutedColor,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const Scroll = styled(ScrollArea)({
  flex: 1,
  minHeight: 0,
});

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
  const { storyId } = useStorybookState();

  const catalog = params.catalog ?? [];
  const filter = useMemo(() => effectiveFilter(params), [params]);
  const compact = params.compact ?? false;
  const label = params.label ?? 'Events inspector';
  const maxEvents = params.maxEvents ?? 100;
  const byName = useMemo(() => indexCatalog(catalog), [catalog]);
  const treeTheme = useMemo(() => inspectorTheme(theme), [theme]);

  // Shared addon state, not local — PanelTitle.tsx (mounted separately, in
  // the tab bar) reads this same slot for its live count. A single source of
  // truth here instead of local state mirrored into a second shared value:
  // two updates racing each other (entries changing, then a mirror syncing
  // afterward) is exactly what caused the tab count to go stale after Clear
  // during development. One state, so there's nothing left to race.
  const [entries, setEntries] = useAddonState<LogEntry[]>(ADDON_ID, []);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);

  const emit = useChannel({
    [EVENTS.LOG]: (entry: LogEntry) => {
      setEntries((prev) => [entry, ...prev].slice(0, Math.max(1, maxEvents)));
      setSeen((prev) => (prev.has(entry.name) ? prev : new Set(prev).add(entry.name)));
    },
    [EVENTS.DISPATCH_RESULT]: (result: DispatchResult) => setDispatchResult(result),
  });

  // A story switch invalidates everything below — same reason the built-in
  // Actions addon clears its log per story.
  useEffect(() => {
    setEntries([]);
    setSeen(new Set());
    setDispatchResult(null);
  }, [storyId]);

  // Coverage of the *documented* surface specifically — capture itself has no
  // upper bound to measure against (it sees everything by default), so this
  // is only meaningful when a catalog is actually supplied.
  const catalogSeen = useMemo(() => {
    if (catalog.length === 0) return 0;
    let count = 0;
    for (const name of seen) if (byName.has(name)) count += 1;
    return count;
  }, [seen, byName, catalog.length]);

  return (
    <AddonPanel active={active}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DispatchForm catalog={catalog} storyId={storyId} emit={emit} result={dispatchResult} />

        <Head>
          <span>
            <strong>{label}</strong> · {entries.length} logged
            {catalog.length > 0 && (
              <>
                {' '}
                · {catalogSeen} of {catalog.length} catalog events seen
              </>
            )}
            {filter.length > 0 && (
              <> · narrowed to {params.catalogOnly && !params.filter?.length ? 'your catalog' : filter.length}</>
            )}
          </span>
          <Button size="small" variant="ghost" onClick={() => setEntries([])} disabled={entries.length === 0}>
            Clear
          </Button>
        </Head>

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
      </div>
    </AddonPanel>
  );
};
