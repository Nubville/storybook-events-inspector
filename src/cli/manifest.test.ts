import { describe as suite, expect, it } from 'vitest';

import { catalogFromManifest, ManifestError } from './manifest';

const MANIFEST = {
  schemaVersion: '2.1.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'src/button.ts',
      declarations: [
        {
          kind: 'class',
          name: 'MyButton',
          tagName: 'my-button',
          events: [{ name: 'item-change' }, { name: 'my-click' }],
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'src/toggle.ts',
      declarations: [
        { kind: 'class', name: 'MyToggle', tagName: 'my-toggle', events: [{ name: 'item-change' }] },
        { kind: 'variable', name: 'helper' },
      ],
    },
  ],
};

suite('catalogFromManifest', () => {
  it('inverts the manifest: event name -> the tags that fire it', () => {
    expect(catalogFromManifest(MANIFEST)).toEqual([
      { name: 'item-change', tags: ['my-button', 'my-toggle'] },
      { name: 'my-click', tags: ['my-button'] },
    ]);
  });

  it('collapses a name declared by several tags into the one entry that produces `shared`', () => {
    const shared = catalogFromManifest(MANIFEST).find((entry) => entry.name === 'item-change');
    expect(shared?.tags).toHaveLength(2);
  });

  it('ignores declarations that are not custom elements', () => {
    const catalog = catalogFromManifest({
      modules: [
        {
          declarations: [
            { kind: 'class', name: 'PlainClass', events: [{ name: 'not-an-element' }] },
            { kind: 'function', name: 'helper' },
          ],
        },
      ],
    });
    expect(catalog).toEqual([]);
  });

  it('tolerates modules and declarations with no events at all', () => {
    expect(catalogFromManifest({ modules: [{}, { declarations: [{ tagName: 'my-el' }] }] })).toEqual([]);
  });

  it('skips malformed event entries rather than emitting a nameless catalog row', () => {
    const catalog = catalogFromManifest({
      modules: [{ declarations: [{ tagName: 'my-el', events: [{}, { name: 'real-event' }] }] }],
    });
    expect(catalog).toEqual([{ name: 'real-event', tags: ['my-el'] }]);
  });

  it('is deterministic, so regenerating an unchanged manifest does not churn the diff', () => {
    const reversed = { modules: [...MANIFEST.modules].reverse() };
    expect(catalogFromManifest(reversed)).toEqual(catalogFromManifest(MANIFEST));
  });

  it('deduplicates a tag that declares the same event twice', () => {
    const catalog = catalogFromManifest({
      modules: [{ declarations: [{ tagName: 'my-el', events: [{ name: 'dupe' }, { name: 'dupe' }] }] }],
    });
    expect(catalog).toEqual([{ name: 'dupe', tags: ['my-el'] }]);
  });

  it('explains itself when handed something that is not a manifest', () => {
    expect(() => catalogFromManifest({ nope: true })).toThrow(ManifestError);
    expect(() => catalogFromManifest(null)).toThrow(ManifestError);
    expect(() => catalogFromManifest('a string')).toThrow(ManifestError);
  });
});
