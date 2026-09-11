/**
 * The third adapter over `core/`, predicted back when the Storybook adapter
 * was split out: this is a self-contained browser bundle (no Storybook, no
 * React, no imports left unresolved) that the MCP server injects directly
 * into a story's `iframe.html`, bypassing Storybook's manager/channel
 * entirely. It exposes the same capture + dispatch primitives the Storybook
 * panel uses, as a plain global an automation tool (Playwright, here) can
 * call into.
 */
import { matchesFilter } from './catalog';
import { describe } from './describe';
import { dispatchSyntheticEvent, findCustomElement } from './dispatch';
import { onCustomEvent } from './inspector';
import { safeDetail } from './safeDetail';
import type { CapturedEvent, DispatchOptions, LogEntry } from './types';

export interface BrowserBridge {
  /**
   * Start capturing. `report` is called once per matching event. Returns an
   * unsubscribe function. Catalog-based annotation (`shared`/`undocumented`)
   * isn't done here — same as the Storybook adapter, that's a consumer-side
   * concern applied to a raw, complete stream, not a capture-time filter.
   */
  start(
    report: (entry: LogEntry) => void,
    options?: { filter?: readonly string[]; extra?: readonly string[] },
  ): () => void;
  /** The reverse direction — dispatch a synthetic event at the real rendered custom element. */
  dispatch(name: string, options: DispatchOptions): ReturnType<typeof dispatchSyntheticEvent>;
}

let seq = 0;

function toLogEntry(captured: CapturedEvent): LogEntry {
  return {
    seq: seq++,
    time: new Date().toISOString(),
    name: captured.type,
    origin: describe(captured.origin),
    target: describe(captured.externalTarget),
    retargeted: captured.origin !== captured.externalTarget,
    notComposed: !captured.composed,
    detail: safeDetail(captured.detail),
  };
}

const bridge: BrowserBridge = {
  start(report, options = {}) {
    const filter = options.filter ?? [];
    const extra = options.extra ?? [];
    return onCustomEvent((captured) => {
      if (!matchesFilter(captured.type, filter, extra)) return;
      report(toLogEntry(captured));
    });
  },
  dispatch(name, options) {
    const target = findCustomElement(document.body) ?? document.body;
    return dispatchSyntheticEvent(target, name, options);
  },
};

declare global {
  interface Window {
    __eventsInspector?: BrowserBridge;
  }
}

window.__eventsInspector = bridge;
