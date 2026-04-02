import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

@Controller('api/v1/posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.postsService.list(Number(page), Number(limit));
  }

  @Post()
  create(@Body() payload: CreatePostDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.postsService.create(userId, payload);
  }

  @Post(':id/like')
  like(@Param('id') postId: string) {
    return this.postsService.like(postId);
  }

  @Delete(':id/like')
  unlike(@Param('id') postId: string) {
    return this.postsService.unlike(postId);
  }

  @Get(':id/comments')
  listComments(@Param('id') postId: string) {
    return this.postsService.listComments(postId);
  }

  @Post(':id/comments')
  createComment(@Param('id') postId: string, @Body() payload: CreateCommentDto) {
    return this.postsService.createComment(postId, payload);
  }
}
