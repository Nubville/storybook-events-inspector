import { describe as suite, expect, it } from 'vitest';

import { effectiveFilter } from './effectiveFilter';

const CATALOG = [
  { name: 'demo-change', tags: ['demo-button', 'demo-toggle'] },
  { name: 'demo-command', tags: ['demo-toggle'] },
];

suite('effectiveFilter', () => {
  it('is empty by default, meaning "keep everything"', () => {
    expect(effectiveFilter({})).toEqual([]);
  });

  it('uses an explicit filter as-is', () => {
    expect(effectiveFilter({ filter: ['demo-change'] })).toEqual(['demo-change']);
  });

  it('derives the filter from the catalog when catalogOnly is set', () => {
    expect(effectiveFilter({ catalogOnly: true, catalog: CATALOG })).toEqual(['demo-change', 'demo-command']);
  });

  it('lets an explicit filter win over catalogOnly', () => {
    expect(effectiveFilter({ catalogOnly: true, catalog: CATALOG, filter: ['demo-command'] })).toEqual([
      'demo-command',
    ]);
  });

  it('is empty when catalogOnly is set with no catalog, rather than filtering everything out', () => {
    expect(effectiveFilter({ catalogOnly: true })).toEqual([]);
  });

  it('does not hand back the caller’s array, so the parameter object stays immutable', () => {
    const filter = ['demo-change'];
    expect(effectiveFilter({ filter })).not.toBe(filter);
  });
});
