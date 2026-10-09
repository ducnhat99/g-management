import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock, SystemClock } from '../common/clock';
import { PriceSnapshotStore, PrismaPriceSnapshotStore } from './price-snapshot.store';
import { PricesConfig } from './prices.config';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { NgocThinhPriceSource } from './sources/ngocthinh';
import { PriceSource } from './sources/price-source';

@Module({
  controllers: [PricesController],
  providers: [
    PricesService,
    { provide: PriceSnapshotStore, useClass: PrismaPriceSnapshotStore },
    { provide: PriceSource, useClass: NgocThinhPriceSource },
    { provide: Clock, useClass: SystemClock },
    { provide: PricesConfig, useFactory: PricesConfig.fromEnv, inject: [ConfigService] },
  ],
  exports: [PricesService],
})
export class PricesModule {}
