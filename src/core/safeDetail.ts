/**
 * `JSON.stringify` on an event detail is not safe: a detail can carry element
 * references, and a circular one throws — which would take the whole log down at
 * the moment it's needed most. It also isn't safe to hand a raw detail to
 * `channel.emit` at all: the channel may cross an iframe boundary via
 * `postMessage`, which requires structured-clonable data, and a DOM element or a
 * class instance with methods is not that.
 *
 * Serialize defensively instead, in the preview before it ever reaches the
 * channel: elements become their tag name, cycles and over-deep branches become
 * a marker, and nothing throws or fails to clone.
 *
 * Two different consumers constrain what may come out of here, and the stricter
 * one wins:
 *
 *  - the Storybook panel, across `postMessage` — needs structured-clonable;
 *  - the MCP server, via `JSON.stringify` — needs JSON-representable, which is
 *    narrower. A `BigInt` clones fine but makes `JSON.stringify` *throw*, and a
 *    `Symbol` silently vanishes. Both are flattened to strings below for that
 *    reason, not for display.
 */

/** Values worth naming rather than flattening to an unhelpful `{}`. */
function describeLeaf(detail: object): string | undefined {
  if (detail instanceof Element) return `<${detail.localName}>`;
  if (detail instanceof Date) return detail.toISOString();
  // `Object.entries` on an Error yields nothing — its own message and name are
  // non-enumerable — so the default object walk would render the single most
  // useful thing in a failing payload as `{}`.
  if (detail instanceof Error) return `[${detail.name}: ${detail.message}]`;
  if (detail instanceof RegExp) return String(detail);
  return undefined;
}

export function safeDetail(detail: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (detail === null || detail === undefined) return detail;

  if (typeof detail !== 'object') {
    if (typeof detail === 'function') return '[Function]';
    // Neither survives the trip: BigInt throws in JSON.stringify, Symbol is
    // dropped by it and rejected by structured clone.
    if (typeof detail === 'bigint') return `${detail}n`;
    if (typeof detail === 'symbol') return String(detail);
    return detail;
  }

  const leaf = describeLeaf(detail);
  if (leaf !== undefined) return leaf;

  if (depth > 4) return '[…]';
  if (seen.has(detail)) return '[Circular]';

  // `seen` tracks the current *path*, not everything ever visited: the entry
  // is removed again on the way out. Tracking every visited object instead
  // would report the second branch of `{ item, selectedItem }` — the same
  // object referenced twice, with no cycle anywhere — as '[Circular]', which
  // is the same data loss this function exists to prevent.
  seen.add(detail);
  const walk = (value: unknown): unknown => safeDetail(value, depth + 1, seen);

  let serialized: unknown;
  if (Array.isArray(detail)) {
    serialized = detail.map(walk);
  } else if (detail instanceof Map) {
    // Tagged rather than bare, so a Map is distinguishable from an array of
    // pairs — and kept as pairs rather than an object, since Map keys are not
    // necessarily strings.
    serialized = { '[Map]': [...detail].map(([key, value]) => [walk(key), walk(value)]) };
  } else if (detail instanceof Set) {
    serialized = { '[Set]': [...detail].map(walk) };
  } else {
    serialized = Object.fromEntries(Object.entries(detail as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
  }
  seen.delete(detail);

  return serialized;
}
