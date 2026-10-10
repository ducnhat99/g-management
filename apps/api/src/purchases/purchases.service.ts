import {
  toQuantityChi,
  type CreatePurchaseInput,
  type PurchaseDto,
  type UpdatePurchaseInput,
} from '@gold/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Purchase } from '@prisma/client';
import { HouseholdService, type MemberContext } from '../households/household.service';
import { toPurchaseDto } from './purchase.mapper';
import { PurchaseStore, type PurchaseWrite } from './purchase.store';

/** "" and whitespace-only notes are stored as null. */
const normalizeNote = (note: string | null | undefined) => (note ? note : null);

/** Purchases of the caller's household. Role checks happen in HouseholdGuard. */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly store: PurchaseStore,
    private readonly households: HouseholdService,
  ) {}

  async list(member: MemberContext): Promise<PurchaseDto[]> {
    const [purchases, emails] = await Promise.all([
      this.store.list(member.householdId),
      this.households.memberEmails(member.householdId),
    ]);
    return purchases.map((purchase) => toPurchaseDto(purchase, emails));
  }

  async get(member: MemberContext, id: string): Promise<PurchaseDto> {
    return this.toDto(member, await this.store.find(member.householdId, id));
  }

  async create(member: MemberContext, input: CreatePurchaseInput): Promise<PurchaseDto> {
    const purchase = await this.store.create(member.householdId, member.userId, {
      quantityChi: toQuantityChi(input.quantity, input.unit),
      unitPrice: input.unitPrice,
      purchasedAt: input.purchasedAt,
      note: normalizeNote(input.note),
    });
    return this.toDto(member, purchase);
  }

  async update(
    member: MemberContext,
    id: string,
    input: UpdatePurchaseInput,
  ): Promise<PurchaseDto> {
    const data: Partial<PurchaseWrite> = {
      ...(input.quantity !== undefined &&
        input.unit !== undefined && { quantityChi: toQuantityChi(input.quantity, input.unit) }),
      ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
      ...(input.purchasedAt !== undefined && { purchasedAt: input.purchasedAt }),
      ...(input.note !== undefined && { note: normalizeNote(input.note) }),
    };
    return this.toDto(member, await this.store.update(member.householdId, id, data));
  }

  async delete(member: MemberContext, id: string): Promise<void> {
    if (!(await this.store.delete(member.householdId, id))) {
      throw new NotFoundException('Purchase not found');
    }
  }

  private async toDto(member: MemberContext, purchase: Purchase | null): Promise<PurchaseDto> {
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return toPurchaseDto(purchase, await this.households.memberEmails(member.householdId));
  }
}
