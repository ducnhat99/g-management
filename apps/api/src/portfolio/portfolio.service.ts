import { calculatePortfolio, todayInVietnam, type PortfolioSummaryDto } from '@gold/shared';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Clock } from '../common/clock';
import { HouseholdService, type MemberContext } from '../households/household.service';
import { PricesService } from '../prices/prices.service';
import { PurchasesService } from '../purchases/purchases.service';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prices: PricesService,
    private readonly purchases: PurchasesService,
    private readonly households: HouseholdService,
    private readonly clock: Clock,
  ) {}

  /**
   * Price + profit/loss of the caller's household in one call, so opening the dashboard also checks
   * the price (same 1-hour rule as GET /prices/latest). With no price at all, still returns the
   * purchases and their cost.
   */
  async getSummary(member: MemberContext): Promise<PortfolioSummaryDto> {
    const [priceResult, purchases, memberCount] = await Promise.all([
      this.prices.getLatest().then(
        (price) => ({ price, priceError: null }),
        (error: unknown) => {
          if (!(error instanceof ServiceUnavailableException)) throw error;
          return { price: null, priceError: error.message };
        },
      ),
      this.purchases.list(member),
      this.households.memberCount(member.householdId),
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
      access: { role: member.role, memberCount },
    };
  }
}
