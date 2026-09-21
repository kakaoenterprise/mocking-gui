'use client';

import { ReactNode, useState } from 'react';

interface APITesterProps {
  title: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  onRefetch: () => void;
  loading: boolean;
  status: number | null;
  headers?: Record<string, string>;
  data: unknown;
  error?: unknown;
  children?: ReactNode;
}

/** Strings (text, HTML, XML, placeholders) print as-is; everything else as JSON. */
const formatBody = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export function APITester({
  title,
  description,
  method,
  url,
  onRefetch,
  loading,
  status,
  headers,
  data,
  error,
  children,
}: APITesterProps) {
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('body');

  const isSuccess = status && status >= 200 && status < 300;
  const isError = status && status >= 400;

  return (
    <div className="bg-white dark:bg-zinc-800/30 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-zinc-800/50 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 uppercase">
              {method}
            </span>
            <code className="text-sm text-gray-500 dark:text-gray-400 font-mono">{url}</code>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{description}</p>
        </div>

        <div className="flex items-center gap-3">
          {status && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isSuccess
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : isError
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Status: {status}
            </span>
          )}
          <button
            onClick={onRefetch}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm'
            }`}
          >
            {loading ? 'Fetching...' : 'Refetch'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <div className="flex gap-1 mb-2">
          {(['body', 'headers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-600'
              }`}
            >
              {tab === 'body'
                ? 'Body'
                : `Headers${headers ? ` (${Object.keys(headers).length})` : ''}`}
            </button>
          ))}
        </div>
        {activeTab === 'headers' ? (
          <div className="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-auto max-h-[400px] shadow-inner">
            <pre className="text-sm text-gray-300 font-mono">
              {headers && Object.keys(headers).length > 0 ? (
                Object.entries(headers)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n')
              ) : (
                <span className="text-gray-500 italic">No headers yet...</span>
              )}
            </pre>
          </div>
        ) : (
          <div className="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-auto max-h-[400px] shadow-inner">
            <pre className="text-sm text-gray-300 font-mono">
              {data || error ? (
                formatBody(data ?? error)
              ) : (
                <span className="text-gray-500 italic">No data fetched yet...</span>
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Additional Content (Instructions, etc.) */}
      {children && (
        <div className="p-6 bg-blue-50/50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
          {children}
        </div>
      )}
    </div>
  );
}
