import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 20;
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        skip,
        take: safeLimit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          authorUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.post.count(),
    ]);

    return {
      success: true,
      message: 'Posts list',
      data: rows.map((post) => ({
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        pondId: post.pondId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: post.authorUser,
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }

  async create(userId: string, payload: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        authorUserId: userId,
        content: payload.content.trim(),
        imageUrl: payload.imageUrl?.trim(),
      },
    });

    return {
      success: true,
      message: 'Create post successfully',
      data: post,
    };
  }

  like(postId: string) {
    throw new NotImplementedException({
      success: false,
      message: 'Like feature chưa sẵn sàng vì schema chưa có post_likes',
      data: {
        postId,
      },
    });
  }

  unlike(postId: string) {
    throw new NotImplementedException({
      success: false,
      message: 'Unlike feature chưa sẵn sàng vì schema chưa có post_likes',
      data: {
        postId,
      },
    });
  }

  listComments(postId: string) {
    throw new NotImplementedException({
      success: false,
      message: 'Comment feature chưa sẵn sàng vì schema chưa có post_comments',
      data: {
        postId,
      },
    });
  }

  createComment(postId: string, payload: CreateCommentDto) {
    throw new NotImplementedException({
      success: false,
      message: 'Comment feature chưa sẵn sàng vì schema chưa có post_comments',
      data: {
        postId,
        payload,
      },
    });
  }
}
