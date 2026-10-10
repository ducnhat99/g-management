import type {
  AssignableRole,
  CreatePurchaseInput,
  HouseholdDto,
  HouseholdInviteDto,
  HouseholdMemberDto,
  InviteMemberInput,
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

export const householdKey = ['household'] as const;

/** Members, the caller's role and (for the owner) pending invites. */
export function useHousehold() {
  return useQuery({
    queryKey: householdKey,
    queryFn: () => getApi().get<HouseholdDto>('/household'),
  });
}

/** After any member change, reload the member list and the summary (role, member count). */
function useInvalidateHousehold() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: householdKey }),
      queryClient.invalidateQueries({ queryKey: summaryKey }),
    ]);
}

export function useInviteMember() {
  const invalidate = useInvalidateHousehold();
  return useMutation({
    mutationFn: (body: InviteMemberInput) =>
      getApi().post<HouseholdInviteDto>('/household/invites', body),
    onSuccess: invalidate,
  });
}

export function useResendInvite() {
  const invalidate = useInvalidateHousehold();
  return useMutation({
    mutationFn: (inviteId: string) =>
      getApi().post<HouseholdInviteDto>(`/household/invites/${inviteId}/resend`),
    onSuccess: invalidate,
  });
}

export function useRevokeInvite() {
  const invalidate = useInvalidateHousehold();
  return useMutation({
    mutationFn: (inviteId: string) => getApi().delete(`/household/invites/${inviteId}`),
    onSuccess: invalidate,
  });
}

export function useChangeMemberRole() {
  const invalidate = useInvalidateHousehold();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: AssignableRole }) =>
      getApi().patch<HouseholdMemberDto>(`/household/members/${memberId}`, { role }),
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidateHousehold();
  return useMutation({
    mutationFn: (memberId: string) => getApi().delete(`/household/members/${memberId}`),
    onSuccess: invalidate,
  });
}
