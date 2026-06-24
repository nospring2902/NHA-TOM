import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(currentUserId: string, query: string, limit = 5) {
    const keyword = query.trim();
    if (!keyword) {
      return {
        users: [],
        posts: [],
      };
    }

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 5;

    // Fetch users matching the keyword (excluding self)
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { fullName: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, email: true },
      take: safeLimit,
      orderBy: { fullName: 'asc' },
    });

    // Fetch posts matching the keyword
    const posts = await this.prisma.post.findMany({
      where: { content: { contains: keyword, mode: 'insensitive' } },
      include: { authorUser: { select: { id: true, fullName: true, email: true } } },
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch friendships for the current user
    const userFriends = await this.prisma.friend.findMany({
      where: { userId: currentUserId },
    });

    // Fetch pending friend requests involving the current user
    const userFriendRequests = await this.prisma.friendRequest.findMany({
      where: {
        OR: [
          { requesterId: currentUserId },
          { recipientId: currentUserId },
        ],
        status: 'PENDING',
      },
    });

    // Map friendships and pending requests to determine status for each found user
    const mappedUsers = users.map(user => {
      let friendStatus: 'NONE' | 'FRIEND' | 'PENDING' = 'NONE';
      const isFriend = userFriends.some(f => f.friendId === user.id);
      if (isFriend) {
        friendStatus = 'FRIEND';
      } else {
        const pending = userFriendRequests.find(r =>
          (r.requesterId === currentUserId && r.recipientId === user.id) ||
          (r.recipientId === currentUserId && r.requesterId === user.id)
        );
        if (pending) friendStatus = 'PENDING';
      }
      return { ...user, friendStatus };
    });

    return {
      users: mappedUsers,
      posts: posts.map(post => ({
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        author: post.authorUser,
      })),
    };
  }
}
