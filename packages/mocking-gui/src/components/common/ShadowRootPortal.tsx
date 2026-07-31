import { PropsWithChildren, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { createPortal } from 'react-dom';
import { panelZIndex } from '@constants/zIndex';

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
      // Skip re-dispatch for clicks inside an already-open Radix overlay (trigger or
      // portaled content) — otherwise it reaches DismissableLayer as a second, "outside"
      // pointerdown and closes the overlay before the click commits. Match only the two
      // shapes an open overlay takes (not `data-state="open"` alone, which Collapsible/
      // Accordion/Tabs also carry while expanded): an expanded trigger
      // (`aria-expanded="true"` with `aria-haspopup` or `role="combobox"`, the latter for
      // Select, whose trigger has no `aria-haspopup`), or popper-positioned content
      // (`data-state="open"` with `data-side`).
      const isInsideOpenRadixOverlay = pe.composedPath().some(node => {
        if (!(node instanceof Element)) return false;
        const isOpenOverlayTrigger =
          node.getAttribute('aria-expanded') === 'true' &&
          (node.hasAttribute('aria-haspopup') || node.getAttribute('role') === 'combobox');
        const isOpenOverlayContent =
          node.getAttribute('data-state') === 'open' && node.hasAttribute('data-side');
        return isOpenOverlayTrigger || isOpenOverlayContent;
      });
      if (isInsideOpenRadixOverlay) return;

      const synth = new PointerEvent(pe.type, { ...pe, bubbles: true, composed: true });
      host.dispatchEvent(synth);
    };
    root.addEventListener('pointerdown', bridgePointerDown, { capture: true });

    // Host-page focus traps (MUI FocusTrap, Radix FocusScope) see `document.activeElement`
    // as the shadow host itself, not the real focused element, so `contains()` fails and
    // the trap yanks focus back — breaking input inside this panel. Stop `focusin` at the
    // host so it never reaches the trap's listener on `document`.
    const stopFocusInBubble = (e: FocusEvent) => {
      e.stopPropagation();
    };
    host.addEventListener('focusin', stopFocusInBubble);

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
      host.removeEventListener('focusin', stopFocusInBubble);
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
