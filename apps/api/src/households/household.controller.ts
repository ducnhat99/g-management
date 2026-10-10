import {
  changeRoleSchema,
  inviteMemberSchema,
  type ChangeRoleInput,
  type HouseholdDto,
  type HouseholdInviteDto,
  type HouseholdMemberDto,
  type InviteMemberInput,
} from '@gold/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentMember, HouseholdGuard, RequireRole } from './household.guard';
import { HouseholdService, type MemberContext } from './household.service';

@Controller('household')
@UseGuards(HouseholdGuard)
export class HouseholdController {
  constructor(private readonly households: HouseholdService) {}

  @Get()
  get(@CurrentMember() member: MemberContext): Promise<HouseholdDto> {
    return this.households.get(member);
  }

  @Post('invites')
  @RequireRole('owner')
  invite(
    @CurrentMember() member: MemberContext,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
  ): Promise<HouseholdInviteDto> {
    return this.households.invite(member, body);
  }

  @Post('invites/:id/resend')
  @RequireRole('owner')
  @HttpCode(200)
  resend(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HouseholdInviteDto> {
    return this.households.resendInvite(member, id);
  }

  @Delete('invites/:id')
  @RequireRole('owner')
  @HttpCode(204)
  revoke(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.households.revokeInvite(member, id);
  }

  @Patch('members/:id')
  @RequireRole('owner')
  changeRole(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeRoleSchema)) body: ChangeRoleInput,
  ): Promise<HouseholdMemberDto> {
    return this.households.changeRole(member, id, body.role);
  }

  @Delete('members/:id')
  @RequireRole('owner')
  @HttpCode(204)
  remove(
    @CurrentMember() member: MemberContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.households.removeMember(member, id);
  }
}
