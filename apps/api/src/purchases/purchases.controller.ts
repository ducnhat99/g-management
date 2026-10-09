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
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@CurrentUser() userId: string): Promise<PurchaseDto[]> {
    return this.purchases.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createPurchaseSchema)) body: CreatePurchaseInput,
  ): Promise<PurchaseDto> {
    return this.purchases.create(userId, body);
  }

  @Get(':id')
  get(@CurrentUser() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<PurchaseDto> {
    return this.purchases.get(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePurchaseSchema)) body: UpdatePurchaseInput,
  ): Promise<PurchaseDto> {
    return this.purchases.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.purchases.delete(userId, id);
  }
}
