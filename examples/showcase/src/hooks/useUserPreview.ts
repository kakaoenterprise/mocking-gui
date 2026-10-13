import { useCallback, useEffect, useState } from 'react';

import { handlerKey, readMockState, type PersistedHandlerConfig } from '@/lib/mockState';
import { PETSTORE_ENDPOINTS } from '@/mocks/constants/endpoints';

/**
 * Who answered: the real Petstore (the row's toggle is off, so MSW passes the
 * request through), or one of the two kinds of mock on the same row.
 */
export type ResponseSource =
  | { kind: 'real' }
  | { kind: 'manual'; variant: string }
  | { kind: 'swagger'; variant: string };

export type UserPreview = {
  phase: 'loading' | 'done';
  source: ResponseSource | null;
  /** `0` when the request never got an answer (offline, blocked). */
  status: number | null;
  ms: number | null;
  /** The response body, pretty-printed when it is JSON. */
  body: string | null;
  reload: () => Promise<void>;
};

export const PREVIEW_USERNAME = 'user1';

/** The request the screen sends, as it would read in a network log. */
export const REQUEST_URL = PETSTORE_ENDPOINTS.USER_BY_NAME.replace(':username', PREVIEW_USERNAME);

const ROW_KEY = handlerKey('get', PETSTORE_ENDPOINTS.USER_BY_NAME);

/** The panel writes its state in this document, which raises no `storage` event. */
const POLL_MS = 400;

const readRowConfig = (): PersistedHandlerConfig | undefined =>
  readMockState().handlerConfigs?.[ROW_KEY];

/**
 * Which source the panel has this row set to — the same rule the library uses
 * to build the MSW handler: off passes through, otherwise the stored type picks
 * the variant list.
 */
const toSource = (config: PersistedHandlerConfig | undefined): ResponseSource => {
  if (!config?.active || !config.type) return { kind: 'real' };
  if (config.type === 'Swagger') return { kind: 'swagger', variant: config.variant ?? '' };
  return { kind: 'manual', variant: config.variant ?? '' };
};

/** JSON is indented for reading; anything else is shown as it came. */
const prettify = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/**
 * The response for `user1`, and where it came from.
 *
 * The source is taken from the row's config at the moment the request leaves,
 * so a result is never labelled with a setting that changed while it was in
 * flight. It refetches whenever the row's config changes, so a flip in the
 * panel shows up without a Reload click.
 */
export const useUserPreview = (): UserPreview => {
  const [state, setState] = useState<Omit<UserPreview, 'reload'>>({
    phase: 'loading',
    source: null,
    status: null,
    ms: null,
    body: null,
  });

  const load = useCallback(async () => {
    const source = toSource(readRowConfig());
    setState(current => ({ ...current, phase: 'loading', source }));
    const started = performance.now();

    try {
      const response = await fetch(REQUEST_URL);
      const text = await response.text();
      const ms = Math.round(performance.now() - started);

      setState({ phase: 'done', source, status: response.status, ms, body: prettify(text) });
    } catch {
      setState({
        phase: 'done',
        source,
        status: 0,
        ms: Math.round(performance.now() - started),
        body: null,
      });
    }
  }, []);

  useEffect(() => {
    void load();

    let last = JSON.stringify(readRowConfig() ?? null);
    const timer = window.setInterval(() => {
      const next = JSON.stringify(readRowConfig() ?? null);
      if (next === last) return;
      last = next;
      void load();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [load]);

  return { ...state, reload: load };
};
