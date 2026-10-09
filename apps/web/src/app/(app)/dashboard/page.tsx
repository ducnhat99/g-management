'use client';

import type { PortfolioSummaryDto } from '@gold/shared';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api';

/** Temporary (Phase 6): shows the raw /portfolio/summary JSON. Phase 7 builds the real dashboard. */
export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ['portfolio', 'summary'],
    queryFn: () => getApi().get<PortfolioSummaryDto>('/portfolio/summary'),
  });

  return (
    <section>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      {summary.isPending && <p className="mt-4 text-stone-600">Đang tải…</p>}
      {summary.isError && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Không tải được dữ liệu: {summary.error.message}
        </p>
      )}
      {summary.data && (
        <pre className="mt-4 overflow-x-auto rounded-md bg-stone-900 p-4 text-xs text-stone-100">
          {JSON.stringify(summary.data, null, 2)}
        </pre>
      )}
    </section>
  );
}
