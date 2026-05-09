import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, limit = 20, authorUserId?: string) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 20;
    const skip = (safePage - 1) * safeLimit;
    const where = authorUserId ? { authorUserId } : undefined;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
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
          likes: {
            where: {
              userId,
            },
            select: {
              userId: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where,
      }),
    ]);

    return {
      success: true,
      message: 'Posts list',
      data: rows.map((post) => this.serializePost(post)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }

  async create(userId: string, payload: CreatePostDto) {
    const content = payload.content.trim();
    if (!content) {
      throw new BadRequestException('Nội dung bài viết không được để trống');
    }

    const imageUrl = payload.imageUrl?.trim();
    const post = await this.prisma.post.create({
      data: {
        authorUserId: userId,
        content,
        imageUrl: imageUrl || undefined,
      },
      include: {
        authorUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        likes: {
          where: {
            userId,
          },
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Create post successfully',
      data: this.serializePost(post),
    };
  }

  async like(postId: string, userId: string) {
    await this.ensurePostExists(postId);

    await this.prisma.postLike.upsert({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
      update: {},
      create: {
        postId,
        userId,
      },
    });

    const likeCount = await this.prisma.postLike.count({
      where: {
        postId,
      },
    });

    return {
      success: true,
      message: 'Like post successfully',
      data: {
        postId,
        liked: true,
        likeCount,
      },
    };
  }

  async unlike(postId: string, userId: string) {
    await this.ensurePostExists(postId);

    await this.prisma.postLike.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    const likeCount = await this.prisma.postLike.count({
      where: {
        postId,
      },
    });

    return {
      success: true,
      message: 'Unlike post successfully',
      data: {
        postId,
        liked: false,
        likeCount,
      },
    };
  }

  async listComments(postId: string) {
    await this.ensurePostExists(postId);

    const comments = await this.prisma.postComment.findMany({
      where: {
        postId,
      },
      orderBy: {
        createdAt: 'asc',
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
    });

    return {
      success: true,
      message: 'Comments list',
      data: comments.map((comment) => this.serializeComment(comment)),
    };
  }

  async createComment(postId: string, userId: string, payload: CreateCommentDto) {
    const content = payload.content.trim();
    if (!content) {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }

    await this.ensurePostExists(postId);

    const comment = await this.prisma.postComment.create({
      data: {
        postId,
        authorUserId: userId,
        content,
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
    });

    return {
      success: true,
      message: 'Create comment successfully',
      data: this.serializeComment(comment),
    };
  }

  private serializePost(post: {
    id: string;
    content: string;
    imageUrl: string | null;
    pondId: string | null;
    createdAt: Date;
    updatedAt: Date;
    authorUser: {
      id: string;
      fullName: string;
      email: string;
    };
    likes?: Array<{ userId: string }>;
    _count: {
      likes: number;
      comments: number;
    };
  }) {
    return {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl ?? undefined,
      pondId: post.pondId ?? undefined,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.authorUser,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      liked: Boolean(post.likes && post.likes.length > 0),
    };
  }

  private serializeComment(comment: {
    id: string;
    postId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    authorUser: {
      id: string;
      fullName: string;
      email: string;
    };
  }) {
    return {
      id: comment.id,
      postId: comment.postId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.authorUser,
    };
  }

  private async ensurePostExists(postId: string) {
    const exists = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
      },
    });

    if (!exists) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
  }
}
