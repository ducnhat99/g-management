import { Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock';
import { HouseholdsModule } from '../households/households.module';
import { PricesModule } from '../prices/prices.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [PricesModule, PurchasesModule, HouseholdsModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, { provide: Clock, useClass: SystemClock }],
})
export class PortfolioModule {}
