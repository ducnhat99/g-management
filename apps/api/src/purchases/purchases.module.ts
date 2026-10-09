import { Module } from '@nestjs/common';
import { PrismaPurchaseStore, PurchaseStore } from './purchase.store';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, { provide: PurchaseStore, useClass: PrismaPurchaseStore }],
  exports: [PurchasesService],
})
export class PurchasesModule {}
