import React, { useState } from 'react';
import { Button, Form } from 'storybook/internal/components';
import { styled, useTheme } from 'storybook/theming';

import { EVENTS } from '../constants';
import type { DispatchResult, EventCatalogEntry } from '../types';

const Row = styled.div({
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  padding: '10px 12px',
});

const NameField = styled.input(({ theme }) => ({
  flex: '1 1 auto',
  minWidth: 0,
  font: 'inherit',
  fontSize: 12,
  padding: '6px 8px',
  borderRadius: 4,
  border: `1px solid ${theme.appBorderColor}`,
  background: theme.background.content,
  color: theme.color.defaultText,
}));

const DetailField = styled.textarea(({ theme }) => ({
  flex: '1 1 auto',
  minWidth: 0,
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11,
  padding: '6px 8px',
  borderRadius: 4,
  border: `1px solid ${theme.appBorderColor}`,
  background: theme.background.content,
  color: theme.color.defaultText,
  resize: 'vertical',
}));

const CheckLabel = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  whiteSpace: 'nowrap',
});

const Status = styled.span<{ tone: 'error' | 'ok' }>(({ theme, tone }) => ({
  fontSize: 11,
  color: tone === 'error' ? theme.color.negative : theme.color.positive,
}));

interface DispatchFormProps {
  catalog: readonly EventCatalogEntry[];
  storyId: string;
  emit: (event: string, ...args: unknown[]) => void;
  result: DispatchResult | null;
}

/**
 * The reverse of the log below: instead of watching what a component fires,
 * fire a synthetic event *at* it (composed onto its first child in the canvas)
 * and see whether it responds — useful for a "command" event a component is
 * documented to listen for, not just the ones it dispatches.
 */
export const DispatchForm: React.FC<DispatchFormProps> = ({ catalog, storyId, emit, result }) => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [detailText, setDetailText] = useState('');
  const [bubbles, setBubbles] = useState(true);
  const [composed, setComposed] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);

  const send = (event: React.FormEvent): void => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    let detail: unknown;
    if (detailText.trim()) {
      try {
        detail = JSON.parse(detailText);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setParseError(null);
    emit(EVENTS.DISPATCH, { name: trimmed, detail, bubbles, composed, storyId });
  };

  return (
    <Form onSubmit={send} style={{ borderBottom: `1px solid ${theme.appBorderColor}` }}>
      <Row>
        <NameField
          list="storybook-events-inspector-catalog"
          placeholder="event name, e.g. item-change"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Event name to dispatch"
        />
        <datalist id="storybook-events-inspector-catalog">
          {catalog.map((entry) => (
            <option key={entry.name} value={entry.name} />
          ))}
        </datalist>
        <DetailField
          rows={1}
          placeholder="detail (JSON, optional)"
          value={detailText}
          onChange={(e) => setDetailText(e.target.value)}
          aria-label="Event detail as JSON"
        />
        <CheckLabel>
          <input type="checkbox" checked={bubbles} onChange={(e) => setBubbles(e.target.checked)} />
          bubbles
        </CheckLabel>
        <CheckLabel>
          <input type="checkbox" checked={composed} onChange={(e) => setComposed(e.target.checked)} />
          composed
        </CheckLabel>
        <Button type="submit" size="small" variant="outline" disabled={!name.trim()}>
          Dispatch
        </Button>
      </Row>
      {(parseError || result) && (
        <Row style={{ paddingTop: 0, marginTop: -8 }}>
          {parseError ? (
            <Status tone="error">Invalid JSON detail: {parseError}</Status>
          ) : result && !result.ok ? (
            <Status tone="error">Dispatch threw: {result.error}</Status>
          ) : (
            <Status tone="ok">Dispatched.</Status>
          )}
        </Row>
      )}
    </Form>
  );
};
