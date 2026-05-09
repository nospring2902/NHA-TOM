import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { AuthContextService } from '../auth/auth-context.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

const POST_UPLOAD_DIR = join(process.cwd(), 'uploads', 'posts');

const ensurePostUploadDir = () => {
  if (!existsSync(POST_UPLOAD_DIR)) {
    mkdirSync(POST_UPLOAD_DIR, { recursive: true });
  }
};

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
    @Query('mine') mine = 'false',
    @Query('authorId') authorId,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    const onlyMine = mine === 'true' || mine === '1';
    const authorFilter = typeof authorId === 'string' && authorId.trim() ? authorId.trim() : undefined;
    return this.postsService.list(
      userId,
      Number(page),
      Number(limit),
      onlyMine ? userId : authorFilter,
    );
  }

  @Post()
  create(@Body() payload: CreatePostDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.postsService.create(userId, payload);
  }

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          ensurePostUploadDir();
          callback(null, POST_UPLOAD_DIR);
        },
        filename: (_req, file, callback) => {
          const timestamp = Date.now();
          const randomPart = Math.random().toString(16).slice(2, 10);
          const extension = extname(file.originalname || '') || '.jpg';
          callback(null, `post-${timestamp}-${randomPart}${extension}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Chỉ hỗ trợ tải ảnh'), false);
          return;
        }

        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Ảnh không hợp lệ');
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/uploads/posts/${file.filename}`;

    return {
      success: true,
      message: 'Upload image successfully',
      data: {
        url,
      },
    };
  }

  @Post(':id/like')
  like(@Param('id') postId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.postsService.like(postId, userId);
  }

  @Delete(':id/like')
  unlike(@Param('id') postId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.postsService.unlike(postId, userId);
  }

  @Get(':id/comments')
  listComments(@Param('id') postId: string, @Req() req: Request) {
    this.authContextService.requireCurrentUserId(req);
    return this.postsService.listComments(postId);
  }

  @Post(':id/comments')
  createComment(@Param('id') postId: string, @Body() payload: CreateCommentDto, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.postsService.createComment(postId, userId, payload);
  }
}
