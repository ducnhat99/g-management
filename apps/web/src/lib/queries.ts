import type {
  CreatePurchaseInput,
  PortfolioSummaryDto,
  PriceDto,
  PurchaseDto,
  UpdatePurchaseInput,
} from '@gold/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from './api';

export const summaryKey = ['portfolio', 'summary'] as const;

/** Opening the dashboard = GET /portfolio/summary, which also checks the price (1-hour rule). */
export function useSummary() {
  return useQuery({
    queryKey: summaryKey,
    queryFn: () => getApi().get<PortfolioSummaryDto>('/portfolio/summary'),
  });
}

function useInvalidateSummary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: summaryKey });
}

export function useRefreshPrice() {
  const invalidate = useInvalidateSummary();
  return useMutation({
    mutationFn: () => getApi().post<PriceDto>('/prices/refresh'),
    // Also on error: a 429 means another tab or device refreshed, so reload to get its result.
    onSettled: invalidate,
  });
}

export function useCreatePurchase() {
  const invalidate = useInvalidateSummary();
  return useMutation({
    mutationFn: (body: CreatePurchaseInput) => getApi().post<PurchaseDto>('/purchases', body),
    onSuccess: invalidate,
  });
}

export function useUpdatePurchase() {
  const invalidate = useInvalidateSummary();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePurchaseInput }) =>
      getApi().patch<PurchaseDto>(`/purchases/${id}`, body),
    onSuccess: invalidate,
  });
}

export function useDeletePurchase() {
  const invalidate = useInvalidateSummary();
  return useMutation({
    mutationFn: (id: string) => getApi().delete(`/purchases/${id}`),
    onSuccess: invalidate,
  });
}
