import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { CollaborationService } from './collaboration.service';
import { InviteMemberDto } from './dto/invite-member.dto';

@Controller('api/v1/collaboration')
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Post('invite')
  invite(@Body() payload: InviteMemberDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.invite(userId, payload.friendId);
  }

  @Get('invites')
  listMyInvites(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.listMyInvites(userId);
  }

  @Post('invites/:id/accept')
  acceptInvite(@Param('id') inviteId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.acceptInvite(userId, inviteId);
  }

  @Post('invites/:id/reject')
  rejectInvite(@Param('id') inviteId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.rejectInvite(userId, inviteId);
  }

  @Get('members')
  listMembers(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.listMembers(userId);
  }

  @Delete('members/:id')
  removeMember(@Param('id') memberId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.removeMember(userId, memberId);
  }

  @Get('farms')
  listCollaborativeFarms(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.collaborationService.listCollaborativeFarms(userId);
  }
}
