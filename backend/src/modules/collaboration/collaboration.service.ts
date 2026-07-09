import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../friends/realtime.service';

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Owner invites a friend to co-manage all their ponds.
   */
  async invite(ownerId: string, friendId: string) {
    if (ownerId === friendId) {
      throw new BadRequestException('Không thể mời chính mình');
    }

    // Check invitee exists and is not an admin
    const invitee = await this.prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, role: true },
    });

    if (!invitee) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (invitee.role === 'ADMIN') {
      throw new BadRequestException('Không thể mời admin cộng tác');
    }

    // Check friendship
    const friendship = await this.prisma.friend.findUnique({
      where: {
        userId_friendId: {
          userId: ownerId,
          friendId,
        },
      },
      select: { userId: true },
    });

    if (!friendship) {
      throw new BadRequestException('Chỉ có thể mời bạn bè cộng tác');
    }

    // Check if already a member
    const existingMember = await this.prisma.farmMember.findUnique({
      where: {
        ownerId_memberId: {
          ownerId,
          memberId: friendId,
        },
      },
      select: { id: true },
    });

    if (existingMember) {
      throw new ConflictException('Người này đã là thành viên');
    }

    // Upsert invite (re-send if previously rejected)
    const invite = await this.prisma.farmInvite.upsert({
      where: {
        ownerId_inviteeId: {
          ownerId,
          inviteeId: friendId,
        },
      },
      update: {
        status: 'PENDING',
      },
      create: {
        ownerId,
        inviteeId: friendId,
        status: 'PENDING',
      },
      include: {
        owner: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // Create notification
    const notification = await this.prisma.notification.create({
      data: {
        userId: friendId,
        type: 'farm_invite',
        title: 'Lời mời cộng tác',
        body: `${invite.owner.fullName} mời bạn cùng quản lý nhà tôm`,
        metadata: { inviteId: invite.id, ownerId },
      },
    });

    // Emit realtime
    this.realtimeService.emitToUser(friendId, 'farm:invite', {
      inviteId: invite.id,
      owner: invite.owner,
    });
    this.realtimeService.emitToUser(friendId, 'notification:new', notification);

    return {
      success: true,
      message: 'Đã gửi lời mời cộng tác',
      data: {
        inviteId: invite.id,
        status: invite.status,
      },
    };
  }

  /**
   * User accepts a farm collaboration invite.
   */
  async acceptInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.farmInvite.findUnique({
      where: { id: inviteId },
      include: {
        invitee: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!invite || invite.inviteeId !== userId) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Lời mời đã được xử lý');
    }

    await this.prisma.$transaction([
      this.prisma.farmInvite.update({
        where: { id: inviteId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.farmMember.create({
        data: {
          ownerId: invite.ownerId,
          memberId: userId,
        },
      }),
    ]);

    // Notify owner
    const notification = await this.prisma.notification.create({
      data: {
        userId: invite.ownerId,
        type: 'farm_invite_accepted',
        title: 'Lời mời được chấp nhận',
        body: `${invite.invitee.fullName} đã chấp nhận lời mời cộng tác`,
        metadata: { memberId: userId },
      },
    });

    this.realtimeService.emitToUser(invite.ownerId, 'farm:invite:accepted', {
      member: invite.invitee,
    });
    this.realtimeService.emitToUser(invite.ownerId, 'notification:new', notification);

    return {
      success: true,
      message: 'Đã chấp nhận lời mời cộng tác',
      data: { inviteId },
    };
  }

  /**
   * User rejects a farm collaboration invite.
   */
  async rejectInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.farmInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.inviteeId !== userId) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Lời mời đã được xử lý');
    }

    await this.prisma.farmInvite.update({
      where: { id: inviteId },
      data: { status: 'REJECTED' },
    });

    return {
      success: true,
      message: 'Đã từ chối lời mời cộng tác',
      data: { inviteId },
    };
  }

  /**
   * List pending invites received by user.
   */
  async listMyInvites(userId: string) {
    const invites = await this.prisma.farmInvite.findMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
      },
      include: {
        owner: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'List invites',
      data: invites.map((invite) => ({
        id: invite.id,
        owner: invite.owner,
        createdAt: invite.createdAt,
      })),
    };
  }

  /**
   * Owner lists their farm members.
   */
  async listMembers(ownerId: string) {
    const members = await this.prisma.farmMember.findMany({
      where: { ownerId },
      include: {
        member: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'List members',
      data: members.map((m) => ({
        id: m.id,
        userId: m.member.id,
        fullName: m.member.fullName,
        email: m.member.email,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Owner removes a member from their farm.
   */
  async removeMember(ownerId: string, farmMemberId: string) {
    const member = await this.prisma.farmMember.findUnique({
      where: { id: farmMemberId },
      include: {
        owner: { select: { id: true, fullName: true } },
      },
    });

    if (!member || member.ownerId !== ownerId) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    await this.prisma.farmMember.delete({
      where: { id: farmMemberId },
    });

    // Notify removed member
    const notification = await this.prisma.notification.create({
      data: {
        userId: member.memberId,
        type: 'farm_member_removed',
        title: 'Đã rời nhóm cộng tác',
        body: `Bạn đã bị xóa khỏi nhóm cộng tác của ${member.owner.fullName}`,
        metadata: { ownerId },
      },
    });

    this.realtimeService.emitToUser(member.memberId, 'farm:member:removed', {
      ownerId,
    });
    this.realtimeService.emitToUser(member.memberId, 'notification:new', notification);

    return {
      success: true,
      message: 'Đã xóa thành viên',
      data: { id: farmMemberId },
    };
  }

  /**
   * List farms where user is a collaborator (member), with all ponds.
   */
  async listCollaborativeFarms(userId: string) {
    const memberships = await this.prisma.farmMember.findMany({
      where: { memberId: userId },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            ownedPonds: {
              select: {
                id: true,
                name: true,
                farmName: true,
                province: true,
                district: true,
                ward: true,
                areaM2: true,
                averageDepthM: true,
                latitude: true,
                longitude: true,
                waterType: true,
                lifecycleStatus: true,
                timezone: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'List collaborative farms',
      data: memberships.map((m) => ({
        farmMemberId: m.id,
        owner: {
          id: m.owner.id,
          fullName: m.owner.fullName,
          email: m.owner.email,
        },
        ponds: m.owner.ownedPonds,
        joinedAt: m.createdAt,
      })),
    };
  }
}
