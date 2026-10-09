import { calculatePortfolio, todayInVietnam, type PortfolioSummaryDto } from '@gold/shared';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Clock } from '../common/clock';
import { PricesService } from '../prices/prices.service';
import { PurchasesService } from '../purchases/purchases.service';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prices: PricesService,
    private readonly purchases: PurchasesService,
    private readonly clock: Clock,
  ) {}

  /**
   * Price + profit/loss in one call, so opening the dashboard also checks the price (same 1-hour
   * rule as GET /prices/latest). With no price at all, still returns the purchases and their cost.
   */
  async getSummary(userId: string): Promise<PortfolioSummaryDto> {
    const [priceResult, purchases] = await Promise.all([
      this.prices.getLatest().then(
        (price) => ({ price, priceError: null }),
        (error: unknown) => {
          if (!(error instanceof ServiceUnavailableException)) throw error;
          return { price: null, priceError: error.message };
        },
      ),
      this.purchases.list(userId),
    ]);
    const { price, priceError } = priceResult;
    return {
      price,
      priceError,
      portfolio: calculatePortfolio(
        purchases,
        price?.buyPrice ?? null,
        todayInVietnam(this.clock.now()),
      ),
    };
  }
}
