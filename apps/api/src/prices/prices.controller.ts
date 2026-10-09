import type { PriceDto, PriceHistoryItemDto } from '@gold/shared';
import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PricesService } from './prices.service';

const MAX_HISTORY_DAYS = 365;

@Controller('prices')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get('latest')
  latest(): Promise<PriceDto> {
    return this.prices.getLatest();
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(): Promise<PriceDto> {
    return this.prices.refresh();
  }

  @Get('history')
  history(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<PriceHistoryItemDto[]> {
    if (days < 1 || days > MAX_HISTORY_DAYS) {
      throw new BadRequestException(`days must be between 1 and ${MAX_HISTORY_DAYS}`);
    }
    return this.prices.getHistory(days);
  }
}
