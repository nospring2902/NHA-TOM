import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { FriendsService } from './friends.service';

@Controller('api/v1/friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.friendsService.list(userId);
  }

  @Get('suggestions')
  listSuggestions(@Query('limit') limit = '6', @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.friendsService.listSuggestions(userId, Number(limit));
  }

  @Get('requests')
  listRequests(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.friendsService.listRequests(userId);
  }

  @Post('requests')
  sendRequest(@Body() payload: CreateFriendRequestDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.friendsService.sendRequest(userId, payload.friendId);
  }

  @Post('requests/:id/accept')
  async acceptRequest(@Param('id') requestId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    const result = await this.friendsService.acceptRequest(userId, requestId);

    return {
      success: true,
      message: 'Đã chấp nhận lời mời kết bạn',
      data: {
        requestId: result.request.id,
        friend: result.friend,
      },
    };
  }

  @Post('requests/:id/reject')
  rejectRequest(@Param('id') requestId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.friendsService.rejectRequest(userId, requestId);
  }

  @Get(':friendId/messages')
  listMessages(
    @Param('friendId') friendId: string,
    @Query('limit') limit = '50',
    @Req() req: Request,
    @Query('cursor') cursor?: string,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.friendsService.listMessages(userId, friendId, Number(limit), cursor);
  }

  @Post(':friendId/messages')
  async createMessage(
    @Param('friendId') friendId: string,
    @Body() payload: SendMessageDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    const message = await this.friendsService.createMessage(userId, friendId, payload.content);

    return {
      success: true,
      message: 'Send message successfully',
      data: message,
    };
  }
}
