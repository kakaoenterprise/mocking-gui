import { describe, expect, it, vi } from 'vitest';

import { applyScenario } from '../../adapter';
import { serializeScenarioCookie, serializeScenario } from '../../serialize';

import type { Scenario } from '../../../types/handler';
import type { InitScriptCapable } from '../../adapter';

const ORIGIN = 'https://example.com';

const scenario: Scenario = {
  id: 'scenario-1',
  name: 'Test Scenario',
  configs: {},
  createdAt: new Date().toISOString(),
};

type InitScriptArg = { key: string; value: string; origin: string };

class FakeContext implements InitScriptCapable {
  addInitScriptCalls: Array<{
    script: (arg: InitScriptArg) => void;
    arg: InitScriptArg;
  }> = [];

  addCookiesCalls: Array<{ name: string; value: string; url: string }[]> = [];

  async addInitScript(script: (arg: InitScriptArg) => void, arg: InitScriptArg): Promise<void> {
    this.addInitScriptCalls.push({ script, arg });
  }

  async addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void> {
    this.addCookiesCalls.push(cookies);
  }
}

/** Runs a captured init script against stubbed `window.localStorage`/`location`. */
const runInitScript = (
  { script, arg }: { script: (arg: InitScriptArg) => void; arg: InitScriptArg },
  pageOrigin: string,
) => {
  const setItem = vi.fn();
  const globalWithWindow = globalThis as unknown as { window?: unknown };
  const previousWindow = globalWithWindow.window;

  globalWithWindow.window = {
    localStorage: { setItem },
    location: { origin: pageOrigin },
  };

  try {
    script(arg);
  } finally {
    globalWithWindow.window = previousWindow;
  }

  return setItem;
};

describe('applyScenario', () => {
  it('seeds localStorage via addInitScript and skips the cookie by default', async () => {
    const context = new FakeContext();

    await applyScenario(context, scenario, { origin: ORIGIN });

    expect(context.addInitScriptCalls).toHaveLength(1);
    expect(context.addInitScriptCalls[0].arg).toEqual({
      ...serializeScenario(scenario),
      origin: ORIGIN,
    });
    expect(context.addCookiesCalls).toHaveLength(0);
  });

  it('also sets the sync cookie when ssr is requested, scoped to the origin', async () => {
    const context = new FakeContext();

    await applyScenario(context, scenario, { origin: ORIGIN, ssr: true });

    expect(context.addInitScriptCalls).toHaveLength(1);
    expect(context.addCookiesCalls).toEqual([
      [{ ...serializeScenarioCookie(scenario), url: ORIGIN }],
    ]);
  });

  it('writes to localStorage when the page origin matches', async () => {
    const context = new FakeContext();
    await applyScenario(context, scenario, { origin: ORIGIN });

    const call = context.addInitScriptCalls[0];
    const setItem = runInitScript(call, ORIGIN);

    expect(setItem).toHaveBeenCalledWith(call.arg.key, call.arg.value);
  });

  it('writes nothing when the page origin differs (e.g. an auth redirect)', async () => {
    const context = new FakeContext();
    await applyScenario(context, scenario, { origin: ORIGIN });

    const setItem = runInitScript(context.addInitScriptCalls[0], 'https://idp.example.org');

    expect(setItem).not.toHaveBeenCalled();
  });
});
