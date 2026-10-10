import type { PortfolioSummaryDto } from '@gold/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentMember, HouseholdGuard } from '../households/household.guard';
import type { MemberContext } from '../households/household.service';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
@UseGuards(HouseholdGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('summary')
  summary(@CurrentMember() member: MemberContext): Promise<PortfolioSummaryDto> {
    return this.portfolio.getSummary(member);
  }
}
