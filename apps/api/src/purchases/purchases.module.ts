import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { PrismaPurchaseStore, PurchaseStore } from './purchase.store';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [HouseholdsModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, { provide: PurchaseStore, useClass: PrismaPurchaseStore }],
  exports: [PurchasesService],
})
export class PurchasesModule {}
