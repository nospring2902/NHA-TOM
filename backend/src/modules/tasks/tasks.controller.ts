import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

@Controller('api/v1')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Post('ponds/:pondId/tasks')
  create(
    @Param('pondId') pondId: string,
    @Body() payload: CreateTaskDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.create(userId, pondId, payload);
  }

  @Get('ponds/:pondId/tasks')
  list(@Param('pondId') pondId: string, @Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.list(pondId, userId);
  }

  @Get('ponds/:pondId/tasks/:taskId')
  getById(
    @Param('pondId') pondId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.getById(pondId, taskId, userId);
  }

  @Patch('ponds/:pondId/tasks/:taskId')
  update(
    @Param('pondId') pondId: string,
    @Param('taskId') taskId: string,
    @Body() payload: UpdateTaskDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.update(pondId, taskId, userId, payload);
  }

  @Delete('ponds/:pondId/tasks/:taskId')
  delete(
    @Param('pondId') pondId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.delete(pondId, taskId, userId);
  }

  @Patch('tasks/:taskId/status')
  updateStatus(
    @Param('taskId') taskId: string,
    @Body() payload: UpdateTaskStatusDto,
    @Req() req: Request,
  ) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.updateStatus(taskId, userId, payload.status);
  }

  @Get('tasks/my')
  listMyTasks(@Req() req: Request) {
    const userId = this.authContextService.requireCurrentUserId(req);
    return this.tasksService.listMyTasks(userId);
  }
}
