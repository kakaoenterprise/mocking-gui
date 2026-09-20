import { setupMockingServer } from '@kakaocloud/mocking-gui/server';
import { cookies } from 'next/headers';

import { ClientApiPlayground } from '@/features/playground/components/ClientApiPlayground';
import { ServerApiPlayground } from '@/features/playground/components/ServerApiPlayground';
import { UserProfileClient } from '@/features/user/components/UserProfileClient';
import { UserProfileServer } from '@/features/user/components/UserProfileServer';
import { mockingConfig } from '@/mocks/config';

// Fix for self-signed certificate in development
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export default async function Home() {
  const cookieStore = await cookies();
  const cookieStr = cookieStore.toString();

  // Setup Mocking GUI server with cookies for SSR synchronization
  const server = await setupMockingServer({
    ...mockingConfig,
    cookie: cookieStr,
  });

  server?.listen();
  let serverContent: React.ReactNode;
  let serverPlayground: React.ReactNode;
  try {
    // Ensure the MSW server remains active while rendering the RSC.
    // Every server-side fetch must resolve inside this window, or it escapes to the
    // real network.
    serverContent = await UserProfileServer();
    serverPlayground = await ServerApiPlayground();
  } finally {
    server?.close();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-zinc-900 font-mono">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-900 dark:text-white">
          Mocking GUI Next.js Example
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          Demonstrating <strong>Server-Side Rendering (RSC)</strong> and{' '}
          <strong>Client-Side Rendering (CSR)</strong> synchronization with Mocking GUI.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Server Side Section */}
          <div>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white border-b pb-2">
              Server Component
            </h2>
            {serverContent}
          </div>

          {/* Client Side Section */}
          <div>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white border-b pb-2">
              Client Component
            </h2>
            <UserProfileClient />
          </div>
        </div>

        {/* API Playground */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">API Playground</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Every shared mock handler, called from both sides. Server cards re-render through{' '}
            <code>router.refresh()</code>; client cards refetch in place. Mutations run on the
            client only.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white border-b pb-2">
                Server Components (reads only)
              </h3>
              {serverPlayground}
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white border-b pb-2">
                Client Components
              </h3>
              <ClientApiPlayground />
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 bg-white dark:bg-zinc-800/30 p-8 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
          <p className="mb-4 font-semibold text-lg text-gray-700 dark:text-gray-300">
            How to verify synchronization:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400">
            <li>
              Open the <strong>Mocking GUI Panel</strong> (bottom left).
            </li>
            <li>
              Go to <strong>Mocks</strong> tab and find <strong>User API</strong>.
            </li>
            <li>
              Change the variant (e.g. <em>Success</em> &rarr; <em>Guest</em>).
            </li>
            <li>
              Click <strong>Refetch</strong> on the <strong>Client Component</strong> (updates
              instantly).
            </li>
            <li>
              Click <strong>Refetch</strong> on the <strong>Server Component</strong> (triggers
              server refresh, updates via cookie sync).
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
