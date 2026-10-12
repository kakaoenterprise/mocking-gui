// @vitest-environment jsdom
import { act, useLayoutEffect, useRef } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import ShadowRootPortal from './ShadowRootPortal';

type FirstPaintState = { hasStyle: boolean; isReady: boolean };

/**
 * Records what the shadow root holds when this child first commits. A child's
 * layout effect runs before its parent's, so anything the portal only adds in
 * its own layout effect is still missing here.
 */
const Probe = ({ onFirstCommit }: { onFirstCommit: (state: FirstPaintState) => void }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const root = ref.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    onFirstCommit({
      hasStyle: root.querySelector('style[data-mocking-gui-isolated]') !== null,
      isReady: root.querySelector('#mocking-gui-shadow-mount')?.hasAttribute('data-ready') ?? false,
    });
  }, [onFirstCommit]);
  return <span ref={ref} />;
};

describe('ShadowRootPortal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Without StrictMode, as in a production build: StrictMode's second effect
  // pass used to attach the stylesheet early and hide the bug in dev.
  it('attaches the stylesheet before its children first commit', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const states: FirstPaintState[] = [];
    act(() => {
      root.render(
        <ShadowRootPortal styleText="#mocking-gui-shadow-mount { --border: red; }">
          <Probe onFirstCommit={state => states.push(state)} />
        </ShadowRootPortal>,
      );
    });

    expect(states[0]).toEqual({ hasStyle: true, isReady: true });
  });
});
