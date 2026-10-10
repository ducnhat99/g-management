import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock, SystemClock } from '../common/clock';
import { AuthAdmin, SupabaseAuthAdmin } from './auth-admin';
import { HouseholdConfig } from './household.config';
import { HouseholdController } from './household.controller';
import { HouseholdGuard } from './household.guard';
import { HouseholdService } from './household.service';
import { HouseholdStore, PrismaHouseholdStore } from './household.store';

@Module({
  controllers: [HouseholdController],
  providers: [
    HouseholdService,
    HouseholdGuard,
    { provide: HouseholdStore, useClass: PrismaHouseholdStore },
    { provide: AuthAdmin, useFactory: SupabaseAuthAdmin.fromEnv, inject: [ConfigService] },
    { provide: HouseholdConfig, useFactory: HouseholdConfig.fromEnv, inject: [ConfigService] },
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [HouseholdService, HouseholdGuard],
})
export class HouseholdsModule {}
