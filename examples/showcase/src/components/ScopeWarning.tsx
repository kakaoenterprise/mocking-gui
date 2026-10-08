import { useEffect, useState } from 'react';

/**
 * A Service Worker only controls pages inside its scope, and a page outside it
 * fails in the most confusing way available: the worker registers, MSW logs
 * "Mocking enabled", the panel works — and every single request quietly goes to
 * the network anyway.
 *
 * `navigator.serviceWorker.controller` is the one honest signal, so it is
 * surfaced instead of left in the console. The delay before checking exists
 * because the controller is only set once the worker claims this client, which
 * happens during startup.
 */
export function ScopeWarning() {
  const [uncontrolled, setUncontrolled] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setUncontrolled(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setUncontrolled(!navigator.serviceWorker.controller);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, []);

  if (!uncontrolled) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">
        This page is not under the Service Worker&apos;s control — nothing below is mocked.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">
        Every request will reach the real network and fail, whatever the panel says. The usual cause
        is landing on this page without the trailing slash, which puts it one character outside the
        worker&apos;s scope. Try{' '}
        <code className="rounded bg-amber-100 px-1">{import.meta.env.BASE_URL}</code> exactly, and
        check the console for the scope warning MSW prints.
      </p>
    </div>
  );
}
