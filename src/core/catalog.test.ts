import { describe as suite, expect, it } from 'vitest';

import { indexCatalog, matchesFilter } from './catalog';

suite('matchesFilter', () => {
  it('keeps everything when no filter is set — capture is complete by default', () => {
    expect(matchesFilter('anything-at-all', [], [])).toBe(true);
  });

  it('narrows to the filtered names once a filter is set', () => {
    expect(matchesFilter('demo-change', ['demo-change'], [])).toBe(true);
    expect(matchesFilter('demo-secret', ['demo-change'], [])).toBe(false);
  });

  it('adds `extra` names back on top of a non-empty filter', () => {
    expect(matchesFilter('demo-secret', ['demo-change'], ['demo-secret'])).toBe(true);
  });

  it('ignores `extra` when the filter is empty, since everything already matches', () => {
    expect(matchesFilter('demo-change', [], ['demo-secret'])).toBe(true);
    expect(matchesFilter('demo-secret', [], ['demo-secret'])).toBe(true);
  });
});

suite('indexCatalog', () => {
  it('maps each event name to the tags that declare it', () => {
    const index = indexCatalog([
      { name: 'demo-change', tags: ['demo-button', 'demo-toggle'] },
      { name: 'demo-command', tags: ['demo-toggle'] },
    ]);

    expect(index.get('demo-change')).toEqual(['demo-button', 'demo-toggle']);
    expect(index.get('demo-command')).toEqual(['demo-toggle']);
  });

  it('returns undefined for an undocumented name — the `undocumented` flag', () => {
    expect(indexCatalog([]).get('demo-secret')).toBeUndefined();
  });

  it('distinguishes a shared name (more than one tag) from a sole owner', () => {
    const index = indexCatalog([
      { name: 'shared-name', tags: ['a-one', 'a-two'] },
      { name: 'owned-name', tags: ['a-one'] },
    ]);

    expect((index.get('shared-name') ?? []).length > 1).toBe(true);
    expect((index.get('owned-name') ?? []).length > 1).toBe(false);
  });
});
