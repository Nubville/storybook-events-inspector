export const ADDON_ID = 'wc-custom-events';
export const PANEL_ID = `${ADDON_ID}/panel`;

/** Story/project parameter key: `parameters.wcCustomEvents = { ... }`. */
export const PARAM_KEY = 'wcCustomEvents';

export const EVENTS = {
  /** preview -> manager: one captured event, ready to render. */
  LOG: `${ADDON_ID}/log`,
  /** manager -> preview: "dispatch this event into the canvas". */
  DISPATCH: `${ADDON_ID}/dispatch`,
  /** preview -> manager: dispatch above either succeeded or threw. */
  DISPATCH_RESULT: `${ADDON_ID}/dispatch-result`,
} as const;
