'use client';

import { ReactNode, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { APITester } from './APITester';

interface APITesterWithRefreshProps {
  title: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  status: number | null;
  headers?: Record<string, string>;
  data: unknown;
  error?: unknown;
  children?: ReactNode;
}

export function APITesterWithRefresh(props: APITesterWithRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefetch = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return <APITester {...props} onRefetch={handleRefetch} loading={isPending} />;
}
