/**
 * The Storybook adapter — thin by design. All the actual capture/dispatch
 * logic lives in `core/`, which has never heard of Storybook. This file's
 * only job is translating between that and Storybook's manager/preview
 * channel: relay each `CapturedEvent` as a serialized `LogEntry` (a detail
 * can carry elements or cycles that aren't structured-clonable — see
 * `core/safeDetail`), and relay a manager dispatch request into a real
 * `dispatchEvent` call on the story's canvas.
 */
import { useChannel, useEffect } from 'storybook/preview-api';
import type { DecoratorFunction, ProjectAnnotations, Renderer } from 'storybook/internal/types';

import { EVENTS, PARAM_KEY } from './constants';
import { matchesFilter } from './core/catalog';
import { describe } from './core/describe';
import { dispatchSyntheticEvent, findCustomElement } from './core/dispatch';
import { onCustomEvent } from './core/inspector';
import { safeDetail } from './core/safeDetail';
import type { CapturedEvent, LogEntry } from './core/types';
import { effectiveFilter } from './effectiveFilter';
import type { DispatchRequest, WcCustomEventsParameters } from './types';

let seq = 0;

function toLogEntry(captured: CapturedEvent): LogEntry {
  const target = describe(captured.externalTarget);
  return {
    seq: seq++,
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    name: captured.type,
    origin: describe(captured.origin),
    target,
    retargeted: captured.origin !== captured.externalTarget,
    notComposed: !captured.composed,
    detail: safeDetail(captured.detail),
  };
}

export const withCustomEvents: DecoratorFunction = (storyFn, context) => {
  const params = (context.parameters?.[PARAM_KEY] ?? {}) as WcCustomEventsParameters;
  const filter = effectiveFilter(params);
  const extra = params.extra ?? [];
  const canvasElement = context.canvasElement;
  const storyId = context.id;

  const emit = useChannel({
    [EVENTS.DISPATCH]: (request: DispatchRequest) => {
      // The channel is shared by every story instance in the iframe (docs mode
      // renders several at once) — ignore a request meant for a different one.
      if (request.storyId !== storyId) return;

      const target = findCustomElement(canvasElement) ?? canvasElement.firstElementChild ?? canvasElement;
      const result = dispatchSyntheticEvent(target, request.name, request);
      emit(EVENTS.DISPATCH_RESULT, result);
    },
  });

  // Subscribe once per story; re-subscribe only if filter/extra actually
  // change, since the predicate they produce is captured in the closure.
  useEffect(() => {
    return onCustomEvent((captured) => {
      if (!matchesFilter(captured.type, filter, extra)) return;
      emit(EVENTS.LOG, toLogEntry(captured));
    });
  }, [filter.join(' '), extra.join(' ')]);

  return storyFn();
};

const preview: ProjectAnnotations<Renderer> = {
  decorators: [withCustomEvents],
};

export default preview;
