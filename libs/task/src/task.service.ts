import type { JwtUserInfoInterface } from '@libs/base/types'
import type {
  ClaimTaskDto,
  CreateTaskDto,
  QueryAppTaskDto,
  QueryMyTaskDto,
  QueryTaskAssignmentDto,
  QueryTaskDto,
  TaskCompleteDto,
  TaskProgressDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto'
import { BaseService, Prisma } from '@libs/base/database'
import { UserGrowthEventService } from '@libs/user/growth-event'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskGrowthEventKey,
  TaskProgressActionTypeEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
} from './task.constant'

@Injectable()
export class TaskService extends BaseService {
  get task() {
    return this.prisma.task
  }

  get taskAssignment() {
    return this.prisma.taskAssignment
  }

  get taskProgressLog() {
    return this.prisma.taskProgressLog
  }

  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  async getTaskPage(queryDto: QueryTaskDto) {
    const { title, status, type, isEnabled, ...other } = queryDto
    const where: Prisma.TaskWhereInput = { deletedAt: null }
    if (title) {
      where.title = { contains: title, mode: 'insensitive' }
    }
    if (status !== undefined) {
      where.status = status
    }
    if (type !== undefined) {
      where.type = type
    }
    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }
    return this.task.findPagination({ where: { ...where, ...other } })
  }

  async getTaskDetail(id: number) {
    const task = await this.task.findFirst({
      where: { id, deletedAt: null },
    })
    if (!task) {
      throw new NotFoundException('任务不存在')
    }
    return task
  }

  async createTask(dto: CreateTaskDto, adminUser: JwtUserInfoInterface) {
    await this.ensureCodeUnique(dto.code)
    this.ensurePublishWindow(dto.publishStartAt, dto.publishEndAt)
    const data: Prisma.TaskCreateInput = {
      code: dto.code,
      title: dto.title,
      description: dto.description,
      cover: dto.cover,
      type: dto.type,
      status: dto.status ?? TaskStatusEnum.DRAFT,
      priority: dto.priority,
      isEnabled: dto.isEnabled,
      claimMode: dto.claimMode,
      completeMode: dto.completeMode,
      targetCount: dto.targetCount,
      rewardConfig: this.parseJsonValue(dto.rewardConfig),
      publishStartAt: dto.publishStartAt,
      publishEndAt: dto.publishEndAt,
      repeatRule: this.parseJsonValue(dto.repeatRule),
      createdBy: { connect: { id: Number(adminUser.sub) } },
      updatedBy: { connect: { id: Number(adminUser.sub) } },
    }
    const created = await this.task.create({ data })
    return { id: created.id }
  }

  async updateTask(dto: UpdateTaskDto, adminUser: JwtUserInfoInterface) {
    const task = await this.task.findFirst({
      where: { id: dto.id, deletedAt: null },
    })
    if (!task) {
      throw new NotFoundException('任务不存在')
    }
    if (dto.code && dto.code !== task.code) {
      await this.ensureCodeUnique(dto.code, dto.id)
    }
    this.ensurePublishWindow(dto.publishStartAt, dto.publishEndAt)
    const data: Prisma.TaskUpdateInput = {
      code: dto.code,
      title: dto.title,
      description: dto.description,
      cover: dto.cover,
      type: dto.type,
      status: dto.status,
      priority: dto.priority,
      isEnabled: dto.isEnabled,
      claimMode: dto.claimMode,
      completeMode: dto.completeMode,
      targetCount: dto.targetCount,
      rewardConfig: this.parseJsonValue(dto.rewardConfig),
      publishStartAt: dto.publishStartAt,
      publishEndAt: dto.publishEndAt,
      repeatRule: this.parseJsonValue(dto.repeatRule),
      updatedBy: { connect: { id: Number(adminUser.sub) } },
    }
    await this.task.update({
      where: { id: dto.id },
      data,
    })
    return { id: dto.id }
  }

  async updateTaskStatus(dto: UpdateTaskStatusDto) {
    await this.task.findFirstOrThrow({
      where: { id: dto.id, deletedAt: null },
    })
    await this.task.update({
      where: { id: dto.id },
      data: {
        status: dto.status,
        isEnabled: dto.isEnabled,
      },
    })
    return { id: dto.id }
  }

  async deleteTask(id: number) {
    await this.task.softDelete({ id })
    return { id }
  }

  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentDto) {
    const { taskId, userId, status, ...other } = queryDto
    const where: Prisma.TaskAssignmentWhereInput = { deletedAt: null }
    if (taskId !== undefined) {
      where.taskId = taskId
    }
    if (userId !== undefined) {
      where.userId = userId
    }
    if (status !== undefined) {
      where.status = status
    }
    return this.taskAssignment.findPagination({
      where: { ...where, ...other },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            rewardConfig: true,
          },
        },
      },
    })
  }

  async getAvailableTasks(queryDto: QueryAppTaskDto, userId: number) {
    const { type, ...other } = queryDto
    const where = this.buildAvailableWhere(type)
    const orderBy =
      (other as { orderBy?: Prisma.TaskOrderByWithRelationInput }).orderBy ?? [
        { priority: Prisma.SortOrder.desc },
        { createdAt: Prisma.SortOrder.desc },
      ]

    const result = await this.task.findPagination({
      where: { ...where, ...other },
      orderBy,
    })
    await this.ensureAutoAssignments(userId, result.list)
    return result
  }

  async getMyTasks(queryDto: QueryMyTaskDto, userId: number) {
    await this.ensureAutoAssignmentsForUser(userId)
    const { status, type, ...other } = queryDto
    const where: Prisma.TaskAssignmentWhereInput = {
      deletedAt: null,
      userId,
    }
    if (status !== undefined) {
      where.status = status
    }
    if (type !== undefined) {
      where.task = { type }
    }
    return this.taskAssignment.findPagination({
      where: { ...where, ...other },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            rewardConfig: true,
            targetCount: true,
            completeMode: true,
            claimMode: true,
          },
        },
      },
    })
  }

  async claimTask(dto: ClaimTaskDto, userId: number) {
    const task = await this.findClaimableTask(dto.taskId)
    const now = new Date()
    const cycleKey = this.buildCycleKey(task, now)
    const existing = await this.taskAssignment.findUnique({
      where: {
        taskId_userId_cycleKey: {
          taskId: task.id,
          userId,
          cycleKey,
        },
      },
    })
    if (existing) {
      return existing
    }
    return this.createAssignment(task, userId, cycleKey, now)
  }

  async reportProgress(dto: TaskProgressDto, userId: number) {
    if (dto.delta <= 0) {
      throw new BadRequestException('进度增量必须大于0')
    }
    const task = await this.findAvailableTask(dto.taskId)
    const now = new Date()
    const cycleKey = this.buildCycleKey(task, now)
    let assignment = await this.taskAssignment.findUnique({
      where: {
        taskId_userId_cycleKey: {
          taskId: task.id,
          userId,
          cycleKey,
        },
      },
    })
    if (!assignment) {
      if (task.claimMode === TaskClaimModeEnum.AUTO) {
        assignment = await this.createAssignment(task, userId, cycleKey, now)
      } else {
        throw new BadRequestException('任务未领取')
      }
    }
    if (
      assignment.status === TaskAssignmentStatusEnum.COMPLETED ||
      assignment.status === TaskAssignmentStatusEnum.EXPIRED
    ) {
      return assignment
    }
    const nextProgress = Math.min(
      assignment.target,
      assignment.progress + dto.delta,
    )
    const nextStatus =
      nextProgress >= assignment.target
        ? TaskAssignmentStatusEnum.COMPLETED
        : assignment.status
    const completedAt =
      nextStatus === TaskAssignmentStatusEnum.COMPLETED ? now : undefined
    const context = this.parseJsonValue(dto.context)
    const assignmentContext = this.toInputJsonValue(assignment.context)

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.taskAssignment.update({
        where: { id: assignment.id, version: assignment.version },
        data: {
          progress: nextProgress,
          status: nextStatus,
          completedAt,
          context: context ?? assignmentContext,
          version: { increment: 1 },
        },
      })
      await tx.taskProgressLog.create({
        data: {
          assignmentId: assignment.id,
          userId,
          actionType:
            nextStatus === TaskAssignmentStatusEnum.COMPLETED
              ? TaskProgressActionTypeEnum.COMPLETE
              : TaskProgressActionTypeEnum.PROGRESS,
          delta: dto.delta,
          beforeValue: assignment.progress,
          afterValue: nextProgress,
          context,
        },
      })
      return updatedAssignment
    })

    if (
      assignment.status !== TaskAssignmentStatusEnum.COMPLETED &&
      updated.status === TaskAssignmentStatusEnum.COMPLETED
    ) {
      await this.emitTaskCompleteEvent(userId, task, updated)
    }
    return updated
  }

  async completeTask(dto: TaskCompleteDto, userId: number) {
    const task = await this.findAvailableTask(dto.taskId)
    const now = new Date()
    const cycleKey = this.buildCycleKey(task, now)
    const assignment = await this.taskAssignment.findUnique({
      where: {
        taskId_userId_cycleKey: {
          taskId: task.id,
          userId,
          cycleKey,
        },
      },
    })
    if (!assignment) {
      throw new BadRequestException('任务未领取')
    }
    if (assignment.status === TaskAssignmentStatusEnum.COMPLETED) {
      return assignment
    }
    if (
      task.completeMode === TaskCompleteModeEnum.AUTO &&
      assignment.progress < assignment.target
    ) {
      throw new BadRequestException('任务进度未达成')
    }
    const finalProgress = Math.max(assignment.progress, assignment.target)
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.taskAssignment.update({
        where: { id: assignment.id, version: assignment.version },
        data: {
          progress: finalProgress,
          status: TaskAssignmentStatusEnum.COMPLETED,
          completedAt: now,
          version: { increment: 1 },
        },
      })
      await tx.taskProgressLog.create({
        data: {
          assignmentId: assignment.id,
          userId,
          actionType: TaskProgressActionTypeEnum.COMPLETE,
          delta: 0,
          beforeValue: assignment.progress,
          afterValue: finalProgress,
        },
      })
      return updatedAssignment
    })
    await this.emitTaskCompleteEvent(userId, task, updated)
    return updated
  }

  @Cron('0 */5 * * * *')
  async expireAssignments() {
    const now = new Date()
    await this.taskAssignment.updateMany({
      where: {
        status: {
          in: [
            TaskAssignmentStatusEnum.PENDING,
            TaskAssignmentStatusEnum.IN_PROGRESS,
          ],
        },
        expiredAt: { lte: now },
      },
      data: {
        status: TaskAssignmentStatusEnum.EXPIRED,
      },
    })
  }

  private async ensureCodeUnique(code: string, excludeId?: number) {
    const exists = await this.task.findFirst({
      where: {
        code,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (exists) {
      throw new BadRequestException('任务编码已存在')
    }
  }

  private ensurePublishWindow(
    startAt?: Date | null,
    endAt?: Date | null,
  ) {
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('发布开始时间不能晚于结束时间')
    }
  }

  private parseJsonValue(value?: string | null) {
    if (value === undefined || value === null || value === '') {
      return undefined
    }
    try {
      const parsed = JSON.parse(value) as Prisma.JsonValue
      return this.toInputJsonValue(parsed)
    } catch {
      throw new BadRequestException('JSON格式错误')
    }
  }

  private toInputJsonValue(
    value?: Prisma.JsonValue | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return Prisma.JsonNull
    }
    return value as Prisma.InputJsonValue
  }

  private buildAvailableWhere(type?: number) {
    const now = new Date()
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      status: TaskStatusEnum.PUBLISHED,
      isEnabled: true,
      AND: [
        {
          OR: [
            { publishStartAt: null },
            { publishStartAt: { lte: now } },
          ],
        },
        {
          OR: [
            { publishEndAt: null },
            { publishEndAt: { gte: now } },
          ],
        },
      ],
    }
    if (type !== undefined) {
      where.type = type
    }
    return where
  }

  private async findAvailableTask(taskId: number) {
    const task = await this.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        isEnabled: true,
        status: TaskStatusEnum.PUBLISHED,
      },
    })
    if (!task) {
      throw new NotFoundException('任务不存在')
    }
    return task
  }

  private async findClaimableTask(taskId: number) {
    const task = await this.findAvailableTask(taskId)
    const now = new Date()
    if (task.publishStartAt && task.publishStartAt > now) {
      throw new BadRequestException('任务未开始')
    }
    if (task.publishEndAt && task.publishEndAt < now) {
      throw new BadRequestException('任务已结束')
    }
    return task
  }

  private buildCycleKey(task: { repeatRule: Prisma.JsonValue | null }, now: Date) {
    const rule = task.repeatRule as { type?: string } | null
    const type = rule?.type ?? TaskRepeatTypeEnum.ONCE
    if (type === TaskRepeatTypeEnum.DAILY) {
      return this.formatDate(now)
    }
    if (type === TaskRepeatTypeEnum.WEEKLY) {
      return `week-${this.formatDate(this.getWeekStart(now))}`
    }
    if (type === TaskRepeatTypeEnum.MONTHLY) {
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
        2,
        '0',
      )}`
    }
    return TaskRepeatTypeEnum.ONCE
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10)
  }

  private getWeekStart(date: Date) {
    const base = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    )
    const day = base.getUTCDay() || 7
    base.setUTCDate(base.getUTCDate() - day + 1)
    return base
  }

  private buildTaskSnapshot(task: {
    id: number
    code: string
    title: string
    type: number
    rewardConfig: Prisma.JsonValue | null
    targetCount: number
  }) {
    return {
      id: task.id,
      code: task.code,
      title: task.title,
      type: task.type,
      rewardConfig: task.rewardConfig,
      targetCount: task.targetCount,
    }
  }

  private async createAssignment(
    task: {
      id: number
      code: string
      title: string
      type: number
      rewardConfig: Prisma.JsonValue | null
      targetCount: number
      publishEndAt: Date | null
    },
    userId: number,
    cycleKey: string,
    now: Date,
  ) {
    const taskSnapshot = this.buildTaskSnapshot(task)
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.taskAssignment.create({
        data: {
          taskId: task.id,
          userId,
          cycleKey,
          status: TaskAssignmentStatusEnum.IN_PROGRESS,
          progress: 0,
          target: task.targetCount,
          claimedAt: now,
          expiredAt: task.publishEndAt ?? undefined,
          taskSnapshot,
        },
      })
      await tx.taskProgressLog.create({
        data: {
          assignmentId: assignment.id,
          userId,
          actionType: TaskProgressActionTypeEnum.CLAIM,
          delta: 0,
          beforeValue: 0,
          afterValue: 0,
        },
      })
      return assignment
    })
  }

  private async ensureAutoAssignments(userId: number, tasks: Array<{ id: number }>) {
    for (const task of tasks) {
      await this.ensureAutoAssignment(userId, task.id)
    }
  }

  private async ensureAutoAssignmentsForUser(userId: number) {
    const tasks = await this.task.findMany({
      where: this.buildAvailableWhere(),
      select: { id: true },
    })
    for (const task of tasks) {
      await this.ensureAutoAssignment(userId, task.id)
    }
  }

  private async ensureAutoAssignment(userId: number, taskId: number) {
    const task = await this.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        isEnabled: true,
        status: TaskStatusEnum.PUBLISHED,
        claimMode: TaskClaimModeEnum.AUTO,
      },
    })
    if (!task) {
      return
    }
    const now = new Date()
    if (task.publishStartAt && task.publishStartAt > now) {
      return
    }
    if (task.publishEndAt && task.publishEndAt < now) {
      return
    }
    const cycleKey = this.buildCycleKey(task, now)
    const exists = await this.taskAssignment.findUnique({
      where: {
        taskId_userId_cycleKey: {
          taskId: task.id,
          userId,
          cycleKey,
        },
      },
    })
    if (exists) {
      return
    }
    await this.createAssignment(task, userId, cycleKey, now)
  }

  private async emitTaskCompleteEvent(
    userId: number,
    task: {
      id: number
      rewardConfig: Prisma.JsonValue | null
    },
    assignment: { id: number },
  ) {
    await this.userGrowthEventService.handleEvent({
      business: 'task',
      eventKey: TaskGrowthEventKey.COMPLETE,
      userId,
      targetId: task.id,
      occurredAt: new Date(),
      context: JSON.stringify({
        taskId: task.id,
        assignmentId: assignment.id,
        rewardConfig: task.rewardConfig,
      }),
    })
  }
}
