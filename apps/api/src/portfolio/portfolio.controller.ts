import type { PortfolioSummaryDto } from '@gold/shared';
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('summary')
  summary(@CurrentUser() userId: string): Promise<PortfolioSummaryDto> {
    return this.portfolio.getSummary(userId);
  }
}
