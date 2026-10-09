import {
  toQuantityChi,
  type CreatePurchaseInput,
  type PurchaseDto,
  type UpdatePurchaseInput,
} from '@gold/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { toPurchaseDto } from './purchase.mapper';
import { PurchaseStore, type PurchaseWrite } from './purchase.store';

/** "" and whitespace-only notes are stored as null. */
const normalizeNote = (note: string | null | undefined) => (note ? note : null);

@Injectable()
export class PurchasesService {
  constructor(private readonly store: PurchaseStore) {}

  async list(userId: string): Promise<PurchaseDto[]> {
    return (await this.store.list(userId)).map(toPurchaseDto);
  }

  async get(userId: string, id: string): Promise<PurchaseDto> {
    const purchase = await this.store.find(userId, id);
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return toPurchaseDto(purchase);
  }

  async create(userId: string, input: CreatePurchaseInput): Promise<PurchaseDto> {
    const purchase = await this.store.create(userId, {
      quantityChi: toQuantityChi(input.quantity, input.unit),
      unitPrice: input.unitPrice,
      purchasedAt: input.purchasedAt,
      note: normalizeNote(input.note),
    });
    return toPurchaseDto(purchase);
  }

  async update(userId: string, id: string, input: UpdatePurchaseInput): Promise<PurchaseDto> {
    const data: Partial<PurchaseWrite> = {
      ...(input.quantity !== undefined &&
        input.unit !== undefined && { quantityChi: toQuantityChi(input.quantity, input.unit) }),
      ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
      ...(input.purchasedAt !== undefined && { purchasedAt: input.purchasedAt }),
      ...(input.note !== undefined && { note: normalizeNote(input.note) }),
    };
    const purchase = await this.store.update(userId, id, data);
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return toPurchaseDto(purchase);
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.store.delete(userId, id))) {
      throw new NotFoundException('Purchase not found');
    }
  }
}
