import {
  createPurchaseSchema,
  updatePurchaseSchema,
  type CreatePurchaseInput,
  type PurchaseDto,
  type UpdatePurchaseInput,
} from '@gold/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentMember, HouseholdGuard, RequireRole } from '../households/household.guard';
import type { MemberContext } from '../households/household.service';
import { PurchasesService } from './purchases.service';

/** Every household member can read; adding, editing and deleting need the editor role. */
@Controller('purchases')
@UseGuards(HouseholdGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@CurrentMember() member: MemberContext): Promise<PurchaseDto[]> {
    return this.purchases.list(member);
  }

  @Post()
  @RequireRole('editor')
  create(
    @CurrentMember() member: MemberContext,
    @Body(new ZodValidationPipe(createPurchaseSchema)) body: CreatePurchaseInput,
  ): Promise<PurchaseDto> {
    return this.purchases.create(member, body);
  }

  @Get(':id')
  get(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseDto> {
    return this.purchases.get(member, id);
  }

  @Patch(':id')
  @RequireRole('editor')
  update(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePurchaseSchema)) body: UpdatePurchaseInput,
  ): Promise<PurchaseDto> {
    return this.purchases.update(member, id, body);
  }

  @Delete(':id')
  @RequireRole('editor')
  @HttpCode(204)
  delete(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.purchases.delete(member, id);
  }
}
