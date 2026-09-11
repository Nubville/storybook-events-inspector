/** How a dispatch target reads in the log: its tag name, lowercase, or a fallback. */
export function describe(node: EventTarget | null | undefined): string {
  if (!node) return '—';
  if (node instanceof Element) return node.localName;
  if (typeof window !== 'undefined' && node === window) return 'window';
  if (typeof document !== 'undefined' && node === document) return 'document';
  // A bare `EventTarget` subclass — the usual shape of a hand-rolled event
  // bus or store. Its class name is the only useful handle it has; plain
  // `String(node)` would render every one of them as '[object Object]'.
  const name = (node as object).constructor?.name;
  return name && name !== 'Object' ? name : String(node);
}
