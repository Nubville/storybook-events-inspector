import { describe as suite, expect, it } from 'vitest';

import { safeDetail } from './safeDetail';

suite('safeDetail', () => {
  it('passes primitives through untouched', () => {
    expect(safeDetail(1)).toBe(1);
    expect(safeDetail('a')).toBe('a');
    expect(safeDetail(true)).toBe(true);
    expect(safeDetail(null)).toBeNull();
    expect(safeDetail(undefined)).toBeUndefined();
  });

  it('replaces elements with their tag name, since they cannot be structured-cloned', () => {
    const el = document.createElement('demo-button');
    expect(safeDetail({ el })).toEqual({ el: '<demo-button>' });
  });

  it('replaces functions, which also cannot cross the channel', () => {
    expect(safeDetail({ onDone: () => undefined })).toEqual({ onDone: '[Function]' });
  });

  it('breaks cycles instead of throwing — the log must survive its own payload', () => {
    const detail: Record<string, unknown> = { name: 'a' };
    detail.self = detail;

    expect(() => safeDetail(detail)).not.toThrow();
    expect(safeDetail(detail)).toEqual({ name: 'a', self: '[Circular]' });
  });

  it('truncates past a depth cap rather than walking forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
    expect(safeDetail(deep)).toEqual({ a: { b: { c: { d: { e: '[…]' } } } } });
  });

  it('serializes dates', () => {
    expect(safeDetail({ when: new Date(0) })).toEqual({ when: '1970-01-01T00:00:00.000Z' });
  });

  it('walks arrays', () => {
    const el = document.createElement('demo-button');
    expect(safeDetail([1, 'two', el])).toEqual([1, 'two', '<demo-button>']);
  });

  it('handles the same object appearing twice without calling it circular', () => {
    const shared = { id: 1 };
    // Both branches are reachable without a cycle; only a true back-reference
    // should read as '[Circular]'.
    expect(safeDetail({ a: shared, b: shared })).toEqual({ a: { id: 1 }, b: { id: 1 } });
  });

  it('preserves an Error as its name and message, which Object.entries would drop', () => {
    expect(safeDetail({ err: new Error('boom') })).toEqual({ err: '[Error: boom]' });
  });

  it('keeps a custom error subclass name', () => {
    class ValidationError extends Error {
      override name = 'ValidationError';
    }
    expect(safeDetail(new ValidationError('field required'))).toBe('[ValidationError: field required]');
  });

  it('preserves a Map as tagged entries, not an empty object', () => {
    const map = new Map<unknown, unknown>([
      ['a', 1],
      [2, 'b'],
    ]);
    expect(safeDetail(map)).toEqual({
      '[Map]': [
        ['a', 1],
        [2, 'b'],
      ],
    });
  });

  it('preserves a Set as tagged values', () => {
    expect(safeDetail(new Set([1, 2]))).toEqual({ '[Set]': [1, 2] });
  });

  it('recurses into Map and Set contents', () => {
    const el = document.createElement('demo-button');
    expect(safeDetail(new Set([el]))).toEqual({ '[Set]': ['<demo-button>'] });
    expect(safeDetail(new Map([['el', el]]))).toEqual({ '[Map]': [['el', '<demo-button>']] });
  });

  it('serializes a RegExp', () => {
    expect(safeDetail({ pattern: /^a.c$/gi })).toEqual({ pattern: '/^a.c$/gi' });
  });

  it('stringifies a BigInt, which would otherwise make JSON.stringify throw', () => {
    expect(safeDetail({ id: 9007199254740993n })).toEqual({ id: '9007199254740993n' });
  });

  it('stringifies a Symbol, which JSON drops and structured clone rejects', () => {
    expect(safeDetail({ tag: Symbol('sb') })).toEqual({ tag: 'Symbol(sb)' });
  });

  it('produces output both consumers can actually carry', () => {
    // The two real constraints, asserted together: the panel structured-clones
    // it over postMessage, the MCP server JSON.stringifies it.
    const detail: Record<string, unknown> = {
      el: document.createElement('demo-button'),
      err: new Error('boom'),
      map: new Map([['a', 1]]),
      set: new Set([1]),
      when: new Date(0),
      big: 1n,
      sym: Symbol('s'),
      fn: () => undefined,
      re: /x/,
    };
    detail.self = detail;

    const safe = safeDetail(detail);
    expect(() => JSON.stringify(safe)).not.toThrow();
    expect(() => structuredClone(safe)).not.toThrow();
  });
});
