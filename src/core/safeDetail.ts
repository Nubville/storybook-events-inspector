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
 */
export function safeDetail(detail: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (detail === null || detail === undefined) return detail;
  if (typeof detail !== 'object') {
    return typeof detail === 'function' ? '[Function]' : detail;
  }
  if (detail instanceof Element) return `<${detail.localName}>`;
  if (detail instanceof Date) return detail.toISOString();
  if (depth > 4) return '[…]';
  if (seen.has(detail)) return '[Circular]';
  seen.add(detail);
  if (Array.isArray(detail)) return detail.map((v) => safeDetail(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail as Record<string, unknown>)) {
    out[k] = safeDetail(v, depth + 1, seen);
  }
  return out;
}
