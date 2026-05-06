import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, limit = 5) {
    const keyword = query.trim();
    if (!keyword) {
      return {
        users: [],
        posts: [],
      };
    }

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 5;

    const [users, posts] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: {
          OR: [
            {
              fullName: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
        take: safeLimit,
        orderBy: {
          fullName: 'asc',
        },
      }),
      this.prisma.post.findMany({
        where: {
          content: {
            contains: keyword,
            mode: 'insensitive',
          },
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
        take: safeLimit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      users,
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        author: post.authorUser,
      })),
    };
  }
}
