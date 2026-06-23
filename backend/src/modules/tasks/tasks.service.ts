import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PondAccessService } from '../collaboration/pond-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../friends/realtime.service';

const TASK_INCLUDE = {
  creator: { select: { id: true, fullName: true, email: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  pond: { select: { id: true, name: true, farmName: true } },
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pondAccessService: PondAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Create a task (only OWNER).
   */
  async create(
    userId: string,
    pondId: string,
    payload: {
      title: string;
      description?: string;
      assigneeId?: string;
      priority?: TaskPriority;
      dueDate?: string;
    },
  ) {
    await this.pondAccessService.assertOwnerAccess(pondId, userId);

    // Validate assignee: must be owner or farm member
    if (payload.assigneeId) {
      const groupUserIds = await this.pondAccessService.getPondGroupUserIds(pondId);
      if (!groupUserIds.includes(payload.assigneeId)) {
        throw new BadRequestException('Người được gán phải là thành viên trong nhóm');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        pondId,
        creatorId: userId,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        assigneeId: payload.assigneeId || null,
        priority: payload.priority || 'MEDIUM',
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      },
      include: TASK_INCLUDE,
    });

    // Notify all pond group members
    const groupUserIds = await this.pondAccessService.getPondGroupUserIds(pondId);
    this.realtimeService.emitToUsers(groupUserIds, 'task:created', {
      task: this.serializeTask(task),
      pondId,
    });

    // Notify assignee specifically (if different from creator)
    if (task.assigneeId && task.assigneeId !== userId) {
      await this.notificationsService.create(
        task.assigneeId,
        'task_assigned',
        'Nhiệm vụ mới',
        `Bạn được gán nhiệm vụ "${task.title}" tại ao ${task.pond.name}`,
        { taskId: task.id, pondId },
      );
    }

    return {
      success: true,
      message: 'Tạo nhiệm vụ thành công',
      data: this.serializeTask(task),
    };
  }

  /**
   * List tasks for a pond (OWNER + MEMBER).
   */
  async list(pondId: string, userId: string) {
    await this.pondAccessService.assertReadAccess(pondId, userId);

    const tasks = await this.prisma.task.findMany({
      where: { pondId },
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'List tasks',
      data: tasks.map((task) => this.serializeTask(task)),
    };
  }

  /**
   * Get task detail (OWNER + MEMBER).
   */
  async getById(pondId: string, taskId: string, userId: string) {
    await this.pondAccessService.assertReadAccess(pondId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, pondId },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }

    return {
      success: true,
      message: 'Task detail',
      data: this.serializeTask(task),
    };
  }

  /**
   * Update task info (only OWNER).
   */
  async update(
    pondId: string,
    taskId: string,
    userId: string,
    payload: {
      title?: string;
      description?: string;
      assigneeId?: string;
      priority?: TaskPriority;
      dueDate?: string;
    },
  ) {
    await this.pondAccessService.assertOwnerAccess(pondId, userId);

    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, pondId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }

    // Validate assignee if provided
    if (payload.assigneeId) {
      const groupUserIds = await this.pondAccessService.getPondGroupUserIds(pondId);
      if (!groupUserIds.includes(payload.assigneeId)) {
        throw new BadRequestException('Người được gán phải là thành viên trong nhóm');
      }
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: payload.title?.trim(),
        description: payload.description?.trim(),
        assigneeId: payload.assigneeId,
        priority: payload.priority,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      },
      include: TASK_INCLUDE,
    });

    // Notify group
    const groupUserIds = await this.pondAccessService.getPondGroupUserIds(pondId);
    this.realtimeService.emitToUsers(groupUserIds, 'task:updated', {
      task: this.serializeTask(task),
      pondId,
      updatedBy: userId,
    });

    // Notify new assignee if changed
    if (payload.assigneeId && payload.assigneeId !== userId) {
      await this.notificationsService.create(
        payload.assigneeId,
        'task_assigned',
        'Nhiệm vụ được gán',
        `Bạn được gán nhiệm vụ "${task.title}" tại ao ${task.pond.name}`,
        { taskId: task.id, pondId },
      );
    }

    return {
      success: true,
      message: 'Cập nhật nhiệm vụ thành công',
      data: this.serializeTask(task),
    };
  }

  /**
   * Update task status (assignee only, or owner).
   */
  async updateStatus(taskId: string, userId: string, status: TaskStatus) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { pond: { select: { id: true, name: true, ownerId: true } } },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }

    // Only assignee or owner can update status
    const isAssignee = task.assigneeId === userId;
    const isOwner = task.pond.ownerId === userId;

    if (!isAssignee && !isOwner) {
      throw new ForbiddenException('Chỉ người được gán hoặc chủ sở hữu mới có quyền cập nhật trạng thái');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'DONE' ? new Date() : status === 'TODO' ? null : undefined,
      },
      include: TASK_INCLUDE,
    });

    // Notify group
    const groupUserIds = await this.pondAccessService.getPondGroupUserIds(task.pondId);
    this.realtimeService.emitToUsers(groupUserIds, 'task:updated', {
      task: this.serializeTask(updatedTask),
      pondId: task.pondId,
      updatedBy: userId,
    });

    // Get updater name for notification
    const updater = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const statusLabels: Record<TaskStatus, string> = {
      TODO: 'Chưa bắt đầu',
      IN_PROGRESS: 'Đang thực hiện',
      DONE: 'Hoàn thành',
      CANCELLED: 'Đã hủy',
    };

    // Notify all other group members
    for (const memberId of groupUserIds) {
      if (memberId !== userId) {
        await this.notificationsService.create(
          memberId,
          'task_updated',
          'Cập nhật nhiệm vụ',
          `${updater?.fullName ?? 'Thành viên'} đã cập nhật "${updatedTask.title}" → ${statusLabels[status]}`,
          { taskId, pondId: task.pondId, status },
        );
      }
    }

    return {
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: this.serializeTask(updatedTask),
    };
  }

  /**
   * Delete a task (only OWNER).
   */
  async delete(pondId: string, taskId: string, userId: string) {
    await this.pondAccessService.assertOwnerAccess(pondId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, pondId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }

    await this.prisma.task.delete({ where: { id: taskId } });

    return {
      success: true,
      message: 'Xóa nhiệm vụ thành công',
      data: { id: taskId, deleted: true },
    };
  }

  /**
   * List all tasks assigned to the current user (cross-pond).
   */
  async listMyTasks(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { assigneeId: userId },
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'My tasks',
      data: tasks.map((task) => this.serializeTask(task)),
    };
  }

  private serializeTask(task: {
    id: string;
    pondId: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    creatorId: string;
    assigneeId: string | null;
    dueDate: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    creator: { id: string; fullName: string; email: string };
    assignee: { id: string; fullName: string; email: string } | null;
    pond: { id: string; name: string; farmName: string };
  }) {
    return {
      id: task.id,
      pondId: task.pondId,
      pondName: task.pond.name,
      farmName: task.pond.farmName,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      creator: task.creator,
      assignee: task.assignee,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
