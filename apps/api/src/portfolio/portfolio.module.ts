import { Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock';
import { PricesModule } from '../prices/prices.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [PricesModule, PurchasesModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, { provide: Clock, useClass: SystemClock }],
})
export class PortfolioModule {}
