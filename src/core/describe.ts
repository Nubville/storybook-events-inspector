/** How an element reads in the log: its tag name, lowercase, or a fallback. */
export function describe(node: EventTarget | null | undefined): string {
  if (!node) return '—';
  if (node instanceof Element) return node.localName;
  if (node === window) return 'window';
  if (node === document) return 'document';
  return String(node);
}
