import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { SearchService } from './search.service';

@Controller('api/v1/search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  async search(
    @Query('q') q = '',
    @Query('limit') limit = '5',
    @Req() req: Request,
  ) {
    this.authContextService.requireCurrentUserId(req);

    const data = await this.searchService.search(q, Number(limit));

    return {
      success: true,
      message: 'Search results',
      data,
    };
  }
}
