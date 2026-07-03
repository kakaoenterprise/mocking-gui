import { PropsWithChildren, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { panelZIndex } from '@constants/zIndex';
import { createPortal } from 'react-dom';

import { ShadowContainerContext } from './shadowContext';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ShadowRootPortal = (props: PropsWithChildren<{ styleText?: string }>) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<ShadowRoot | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    rootRef.current = root;

    let mount = root.querySelector('#mocking-gui-shadow-mount') as HTMLElement | null;
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'mocking-gui-shadow-mount';
      root.appendChild(mount);
    }

    mount.style.pointerEvents = 'auto';

    // Radix UI's DismissableLayer listens on `document` for outside-click detection.
    // In Shadow DOM, pointerdown events are retargeted to the shadow host when they
    // cross the boundary, breaking Radix's contains() check. Re-dispatch as a
    // composed event so document-level listeners receive the real composedPath.
    const bridgePointerDown = (e: Event) => {
      const pe = e as PointerEvent;
      // When clicking inside an *already-open* Radix overlay (a trigger such as
      // Select/Popover/DropdownMenu, or its portaled content such as
      // SelectContent/DropdownMenuContent), skip re-dispatch. Otherwise the
      // re-dispatched event reaches DismissableLayer as a second, "outside"
      // pointerdown (its target is the shadow host, not inside the overlay),
      // closing the overlay before the click can commit a selection.
      // Both open triggers and open content carry `data-state="open"`, but so
      // do non-overlay primitives like Collapsible/Accordion/Tabs, which stay
      // "open" for as long as a row is expanded. Matching on `data-state`
      // alone would suppress the bridge for every click inside an expanded
      // row, permanently preventing any Select/Popover/DropdownMenu in that
      // row from ever seeing an outside click. Overlay triggers carry
      // `aria-haspopup`, and popper-positioned overlay content carries
      // `data-side` — neither appears on Collapsible/Accordion/Tabs, so
      // require one of those alongside `data-state="open"` to identify a
      // genuine open overlay.
      const isInsideOpenRadixOverlay = pe
        .composedPath()
        .some(
          el =>
            el instanceof Element &&
            el.getAttribute('data-state') === 'open' &&
            (el.hasAttribute('aria-haspopup') || el.hasAttribute('data-side')),
        );
      if (isInsideOpenRadixOverlay) return;

      const synth = new PointerEvent(pe.type, { ...pe, bubbles: true, composed: true });
      host.dispatchEvent(synth);
    };
    root.addEventListener('pointerdown', bridgePointerDown, { capture: true });

    const syncDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      mount.classList.toggle('dark', isDark);
    };

    syncDarkMode();

    const observer = new MutationObserver(syncDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    setMountNode(mount);
    return () => {
      observer.disconnect();
      root.removeEventListener('pointerdown', bridgePointerDown, { capture: true });
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mount = root.querySelector('#mocking-gui-shadow-mount') as HTMLElement | null;
    if (mount) {
      mount.setAttribute('data-ready', '');
    }

    if (!props.styleText) {
      if (styleRef.current && styleRef.current.parentNode === root) {
        styleRef.current.remove();
      }
      styleRef.current = null;
      return;
    }

    if (!styleRef.current) {
      const style = document.createElement('style');
      style.setAttribute('data-mocking-gui-isolated', 'true');
      style.textContent = props.styleText;
      root.appendChild(style);
      styleRef.current = style;
      return;
    }

    if (styleRef.current.textContent !== props.styleText) {
      styleRef.current.textContent = props.styleText;
    }
  }, [props.styleText, mountNode]);

  return (
    <div
      ref={hostRef}
      id="mocking-gui-shadow-host"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: panelZIndex.host,
      }}
    >
      {mountNode
        ? createPortal(
            <ShadowContainerContext.Provider value={mountNode}>
              {props.children}
            </ShadowContainerContext.Provider>,
            mountNode,
          )
        : null}
    </div>
  );
};

export default ShadowRootPortal;
