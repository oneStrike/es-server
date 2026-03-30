import type { TaskAssignmentSelect, TaskSelect } from '@db/schema'
import type { TaskRewardSettlementResult } from '@libs/growth/growth-reward'
import type { SQL } from 'drizzle-orm'
import type {
  AutoAssignmentTaskSource,
  ClaimTaskInput,
  CreateTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  QueryTaskAssignmentPageInput,
  QueryTaskPageInput,
  TaskCompleteInput,
  TaskProgressInput,
  TaskQueryOrderByInput,
  TaskRewardConfig,
  TaskSnapshotSource,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import { DrizzleService, escapeLikePattern } from '@db/core'
import {
  createEventEnvelope,
  EventDefinitionEntityTypeEnum,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition'
import { UserGrowthRewardService } from '@libs/growth/growth-reward'
import { MessageNotificationTypeEnum } from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import {
  TASK_AVAILABLE_REMINDER_RECENT_HOURS,
  TASK_COMPLETE_EVENT_CODE,
  TASK_COMPLETE_EVENT_KEY,
  TASK_EXPIRING_SOON_REMINDER_HOURS,
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskProgressActionTypeEnum,
  TaskReminderKindEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
} from './task.constant'

/**
 * 任务服务
 *
 * 负责任务配置、领取、进度与完成状态管理。
 *
 * 主要功能：
 * - 任务配置管理（CRUD）：创建、更新、删除、查询任务配置
 * - 任务分配管理：用户领取任务、自动分配任务
 * - 任务进度管理：上报进度、完成任务
 * - 任务过期处理：定时任务自动标记过期分配
 *
 * 任务生命周期：
 * 1. 任务创建（草稿状态）
 * 2. 任务发布（发布状态）
 * 3. 用户领取任务（创建待开始分配）
 * 4. 用户执行任务（推进进度并进入进行中）
 * 5. 任务完成（触发奖励）
 * 6. 任务过期（自动标记）
 */
@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 任务表 */
  private get taskTable() {
    return this.drizzle.schema.task
  }

  /** 任务分配表 */
  private get taskAssignmentTable() {
    return this.drizzle.schema.taskAssignment
  }

  /** 任务进度日志表 */
  private get taskProgressLogTable() {
    return this.drizzle.schema.taskProgressLog
  }

  /**
   * 按条件分页查询任务分配，并按需携带任务信息。
   *
   * 该方法统一管理排序解析与总数统计，确保管理端与应用端列表查询语义一致。
   */
  private async queryTaskAssignmentPage(params: {
    whereClause: SQL | undefined
    pageIndex?: number
    pageSize?: number
    orderBy?: TaskQueryOrderByInput
    includeTaskDetail: boolean
  }) {
    const { whereClause, pageIndex, pageSize, orderBy, includeTaskDetail } =
      params
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const order = this.drizzle.buildOrderBy(orderBy, {
      table: this.taskAssignmentTable,
      fallbackOrderBy: { id: 'desc' },
    })
    const orderBys = order.orderBySql

    const list = includeTaskDetail
      ? await (orderBys.length > 0
          ? this.db
              .select({
                assignment: this.taskAssignmentTable,
                task: {
                  id: this.taskTable.id,
                  title: this.taskTable.title,
                  type: this.taskTable.type,
                  rewardConfig: this.taskTable.rewardConfig,
                  targetCount: this.taskTable.targetCount,
                  completeMode: this.taskTable.completeMode,
                  claimMode: this.taskTable.claimMode,
                },
              })
              .from(this.taskAssignmentTable)
              .leftJoin(
                this.taskTable,
                eq(this.taskAssignmentTable.taskId, this.taskTable.id),
              )
              .where(whereClause)
              .limit(page.limit)
              .offset(page.offset)
              .orderBy(...orderBys)
          : this.db
              .select({
                assignment: this.taskAssignmentTable,
                task: {
                  id: this.taskTable.id,
                  title: this.taskTable.title,
                  type: this.taskTable.type,
                  rewardConfig: this.taskTable.rewardConfig,
                  targetCount: this.taskTable.targetCount,
                  completeMode: this.taskTable.completeMode,
                  claimMode: this.taskTable.claimMode,
                },
              })
              .from(this.taskAssignmentTable)
              .leftJoin(
                this.taskTable,
                eq(this.taskAssignmentTable.taskId, this.taskTable.id),
              )
              .where(whereClause)
              .limit(page.limit)
              .offset(page.offset))
      : await (orderBys.length > 0
          ? this.db
              .select({
                assignment: this.taskAssignmentTable,
                task: {
                  id: this.taskTable.id,
                  title: this.taskTable.title,
                  type: this.taskTable.type,
                  rewardConfig: this.taskTable.rewardConfig,
                },
              })
              .from(this.taskAssignmentTable)
              .leftJoin(
                this.taskTable,
                eq(this.taskAssignmentTable.taskId, this.taskTable.id),
              )
              .where(whereClause)
              .limit(page.limit)
              .offset(page.offset)
              .orderBy(...orderBys)
          : this.db
              .select({
                assignment: this.taskAssignmentTable,
                task: {
                  id: this.taskTable.id,
                  title: this.taskTable.title,
                  type: this.taskTable.type,
                  rewardConfig: this.taskTable.rewardConfig,
                },
              })
              .from(this.taskAssignmentTable)
              .leftJoin(
                this.taskTable,
                eq(this.taskAssignmentTable.taskId, this.taskTable.id),
              )
              .where(whereClause)
              .limit(page.limit)
              .offset(page.offset))

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.taskAssignmentTable)
      .leftJoin(
        this.taskTable,
        eq(this.taskAssignmentTable.taskId, this.taskTable.id),
      )
      .where(whereClause)

    return {
      list: list.map((item) => ({
        ...item.assignment,
        task: item.task,
      })),
      total: Number(countResult?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // ==================== 管理端接口 ====================

  /**
   * 分页查询任务列表（管理端）
   *
   * @param queryDto 查询参数
   * @returns 分页结果
   */
  async getTaskPage(queryDto: QueryTaskPageInput) {
    const conditions: SQL[] = [isNull(this.taskTable.deletedAt)]

    if (queryDto.status !== undefined) {
      conditions.push(eq(this.taskTable.status, queryDto.status))
    }
    if (queryDto.type !== undefined) {
      conditions.push(eq(this.taskTable.type, queryDto.type))
    }
    if (queryDto.isEnabled !== undefined) {
      conditions.push(eq(this.taskTable.isEnabled, queryDto.isEnabled))
    }
    if (queryDto.title) {
      conditions.push(
        ilike(this.taskTable.title, `%${escapeLikePattern(queryDto.title)}%`),
      )
    }

    return this.drizzle.ext.findPagination(this.taskTable, {
      where: and(...conditions),
      ...queryDto,
    })
  }

  /**
   * 获取任务详情（管理端）
   *
   * @param id 任务ID
   * @returns 任务详情
   * @throws NotFoundException 任务不存在
   */
  async getTaskDetail(id: number) {
    const taskRecord = await this.db.query.task.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!taskRecord) {
      throw new NotFoundException('任务不存在')
    }
    return taskRecord
  }

  /**
   * 创建任务（管理端）
   *
   * @param dto 创建参数
   * @param adminUserId 管理员用户ID
   * @returns 创建结果，包含任务ID
   * @throws BadRequestException 发布时间无效或任务编码已存在
   */
  async createTask(dto: CreateTaskInput, adminUserId: number) {
    // 校验发布时间窗口
    this.ensurePublishWindow(dto.publishStartAt, dto.publishEndAt)
    const rewardConfig = this.parseTaskRewardConfig(dto.rewardConfig)

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.taskTable).values({
          ...dto,
          rewardConfig,
          repeatRule: this.parseJsonValue(dto.repeatRule),
          createdById: adminUserId,
          updatedById: adminUserId,
        }),
      { duplicate: '任务编码已存在' },
    )

    return true
  }

  /**
   * 更新任务（管理端）
   *
   * @param dto 更新参数，包含任务ID和需要更新的字段
   * @param adminUserId 管理员用户ID
   * @returns 更新结果，包含任务ID
   * @throws NotFoundException 任务不存在
   * @throws BadRequestException 发布时间无效或任务编码已存在
   */
  async updateTask(dto: UpdateTaskInput, adminUserId: number) {
    // 校验发布时间窗口
    this.ensurePublishWindow(dto.publishStartAt, dto.publishEndAt)
    const rewardConfig = this.parseTaskRewardConfig(dto.rewardConfig)

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskTable)
          .set({
            ...dto,
            rewardConfig,
            repeatRule: this.parseJsonValue(dto.repeatRule),
            updatedById: adminUserId,
          })
          .where(eq(this.taskTable.id, dto.id)),
      { duplicate: '任务编码已存在' },
    )

    this.drizzle.assertAffectedRows(result, '任务不存在')
    return true
  }

  /**
   * 更新任务状态（管理端）
   *
   * 用于快速切换任务的状态和启用/禁用状态。
   *
   * @param dto 更新参数
   * @returns 更新结果
   * @throws NotFoundException 任务不存在
   */
  async updateTaskStatus(dto: UpdateTaskStatusInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.taskTable)
        .set({
          status: dto.status,
          isEnabled: dto.isEnabled,
        })
        .where(eq(this.taskTable.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '任务不存在')
    return true
  }

  /**
   * 删除任务（软删除）
   *
   * @param id 任务ID
   * @returns 删除结果
   */
  async deleteTask(id: number) {
    await this.drizzle.ext.softDelete(this.taskTable, eq(this.taskTable.id, id))
    return true
  }

  /**
   * 分页查询任务分配列表（管理端）
   *
   * 查询用户领取的任务分配记录，包含关联的任务信息。
   *
   * @param queryDto 查询参数
   * @returns 分页结果，包含任务分配和关联任务信息
   */
  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentPageInput) {
    const { orderBy } = queryDto

    const assignmentConditions: SQL[] = [
      isNull(this.taskAssignmentTable.deletedAt),
    ]

    if (queryDto.taskId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.taskId, queryDto.taskId),
      )
    }
    if (queryDto.userId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.userId, queryDto.userId),
      )
    }
    if (queryDto.status !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.status, queryDto.status),
      )
    }

    const whereClause = and(...assignmentConditions)

    const result = await this.queryTaskAssignmentPage({
      whereClause,
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy,
      includeTaskDetail: false,
    })
    return result
  }

  // ==================== 应用端接口 ====================

  /**
   * 获取可领取的任务列表（应用端）
   *
   * 查询当前用户可领取的任务，同时自动为自动领取模式的任务创建分配。
   *
   * @param queryDto 查询参数
   *   - type: 任务类型
   *   - pageIndex: 页码
   *   - pageSize: 每页数量
   * @param userId 当前用户ID
   * @returns 分页结果
   */
  async getAvailableTasks(queryDto: QueryAppTaskInput, userId: number) {
    const { type } = queryDto
    const where = this.buildAvailableWhere(type)
    const now = new Date()

    const result = await this.drizzle.ext.findPagination(this.taskTable, {
      where,
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: JSON.stringify([{ priority: 'desc' }, { createdAt: 'desc' }]),
    })

    // 为自动领取模式的任务确保分配已创建
    await this.ensureAutoAssignments(userId, result.list)
    await this.tryNotifyAvailableTasksFromPage(userId, result.list, now)
    return result
  }

  /**
   * 获取我的任务列表（应用端）
   *
   * 查询当前用户已领取的任务分配列表。
   * 会先确保所有自动领取的任务都已分配给用户。
   *
   * @param queryDto 查询参数
   *   - status: 分配状态
   *   - type: 任务类型
   *   - pageIndex: 页码
   *   - pageSize: 每页数量
   *   - orderBy: 排序条件
   * @param userId 当前用户ID
   * @returns 分页结果，包含分配和任务信息
   */
  async getMyTasks(queryDto: QueryMyTaskInput, userId: number) {
    // 确保自动领取的任务都已分配
    await this.ensureAutoAssignmentsForUser(userId)
    const { type, orderBy } = queryDto

    // 构建查询条件
    const assignmentConditions: SQL[] = [
      eq(this.taskAssignmentTable.userId, userId),
      isNull(this.taskAssignmentTable.deletedAt),
    ]

    if (queryDto.status !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.status, queryDto.status),
      )
    }

    const assignmentWhere = and(...assignmentConditions)
    const taskWhere =
      type !== undefined ? eq(this.taskTable.type, type) : undefined
    const whereClause =
      assignmentWhere && taskWhere
        ? and(assignmentWhere, taskWhere)
        : (assignmentWhere ?? taskWhere)
    const result = await this.queryTaskAssignmentPage({
      whereClause,
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy,
      includeTaskDetail: true,
    })
    return result
  }

  /**
   * 领取任务（应用端）
   *
   * 用户手动领取一个任务，创建任务分配记录。
   * 如果当前周期内已有分配，返回已有分配。
   *
   * @param dto 领取参数
   *   - taskId: 任务ID
   * @param userId 当前用户ID
   * @returns 任务分配记录
   * @throws BadRequestException 任务未开始或已结束
   * @throws NotFoundException 任务不存在
   */
  async claimTask(dto: ClaimTaskInput, userId: number) {
    // 检查任务是否可领取
    const now = new Date()
    const taskRecord = await this.findClaimableTask(dto.taskId, now)
    // 计算当前周期标识
    const cycleKey = this.buildCycleKey(taskRecord, now)
    // 创建或获取已存在的分配
    await this.createOrGetAssignment(taskRecord, userId, cycleKey, now)
    return true
  }

  /**
   * 上报任务进度（应用端）
   *
   * 更新用户任务的执行进度。如果任务为自动领取模式且未领取，
   * 会自动创建分配。仅 AUTO 模式会在达标时自动完成，
   * MANUAL 模式达标后仍需显式调用 completeTask。
   *
   * 使用乐观锁机制防止并发更新冲突。
   *
   * @param dto 进度参数
   *   - taskId: 任务ID
   *   - delta: 进度增量（必须大于0）
   *   - context: 上下文信息（JSON字符串）
   * @param userId 当前用户ID
   * @returns 是否更新成功
   * @throws BadRequestException 进度增量无效或任务未领取
   * @throws NotFoundException 任务不存在
   */
  async reportProgress(dto: TaskProgressInput, userId: number) {
    // 校验进度增量
    if (dto.delta <= 0) {
      throw new BadRequestException('进度增量必须大于0')
    }
    // 检查任务是否可用
    const now = new Date()
    const taskRecord = await this.findAvailableTask(dto.taskId, now)
    const cycleKey = this.buildCycleKey(taskRecord, now)

    // 查找现有分配
    let assignment = await this.findAssignmentByUniqueKey(
      taskRecord.id,
      userId,
      cycleKey,
    )

    // 如果没有分配，自动领取模式的任务会自动创建分配
    if (!assignment) {
      if (taskRecord.claimMode === TaskClaimModeEnum.AUTO) {
        assignment = await this.createOrGetAssignment(
          taskRecord,
          userId,
          cycleKey,
          now,
        )
      } else {
        throw new BadRequestException('任务未领取')
      }
    }

    // 已完成或已过期的分配直接返回
    if (assignment.status === TaskAssignmentStatusEnum.COMPLETED) {
      await this.settleCompletedAssignmentRewardIfNeeded(
        userId,
        taskRecord,
        assignment,
      )
      return true
    }

    if (assignment.status === TaskAssignmentStatusEnum.EXPIRED) {
      throw new BadRequestException('任务已过期')
    }

    // 计算新进度（不超过目标值）
    const nextProgress = Math.min(
      assignment.target,
      assignment.progress + dto.delta,
    )
    // 只有 AUTO 模式会在进度达标时自动完成；其他情况统一保持未完成。
    const shouldAutoComplete =
      taskRecord.completeMode === TaskCompleteModeEnum.AUTO &&
      nextProgress >= assignment.target
    const nextStatus =
      shouldAutoComplete
        ? TaskAssignmentStatusEnum.COMPLETED
        : TaskAssignmentStatusEnum.IN_PROGRESS
    const completedAt = shouldAutoComplete ? now : undefined
    const context = this.parseJsonValue(dto.context)

    // 事务更新：更新分配并记录进度日志
    const updatedRows = await this.drizzle.withTransaction(async (tx) => {
      // 使用乐观锁更新（version字段）
      const updateResult = await tx
        .update(this.taskAssignmentTable)
        .set({
          progress: nextProgress,
          status: nextStatus,
          completedAt,
          context: context ?? assignment.context,
          version: sql`${this.taskAssignmentTable.version} + 1`,
        })
        .where(
          and(
            eq(this.taskAssignmentTable.id, assignment.id),
            eq(this.taskAssignmentTable.version, assignment.version),
          ),
        )

      if ((updateResult.rowCount ?? 0) === 0) {
        return 0
      }

      // 记录进度日志
      await tx.insert(this.taskProgressLogTable).values({
        assignmentId: assignment.id,
        userId,
        actionType:
          shouldAutoComplete
            ? TaskProgressActionTypeEnum.COMPLETE
            : TaskProgressActionTypeEnum.PROGRESS,
        delta: dto.delta,
        beforeValue: assignment.progress,
        afterValue: nextProgress,
        context,
      })

      return updateResult.rowCount ?? 0
    })

    if (updatedRows === 0) {
      throw new ConflictException('任务进度更新冲突，请重试')
    }

    // 如果刚完成，触发完成事件（发放奖励）
    if (
      assignment.status !== TaskAssignmentStatusEnum.COMPLETED &&
      nextStatus === TaskAssignmentStatusEnum.COMPLETED
    ) {
      await this.emitTaskCompleteEvent(userId, taskRecord, {
        ...assignment,
        completedAt: now,
      })
    }
    return true
  }

  /**
   * 完成任务（应用端）
   *
   * 显式将已达标任务标记为完成状态。
   * MANUAL 模式依赖该接口完成任务，AUTO 模式则作为补偿入口兜底。
   *
   * @param dto 完成参数
   *   - taskId: 任务ID
   * @param userId 当前用户ID
   * @returns 是否更新成功
   * @throws BadRequestException 任务未领取或进度未达成
   * @throws NotFoundException 任务不存在
   */
  async completeTask(dto: TaskCompleteInput, userId: number) {
    const now = new Date()
    const taskRecord = await this.findAvailableTask(dto.taskId, now)
    const cycleKey = this.buildCycleKey(taskRecord, now)

    const assignment = await this.findAssignmentByUniqueKey(
      taskRecord.id,
      userId,
      cycleKey,
    )

    if (!assignment) {
      throw new BadRequestException('任务未领取')
    }
    // 已完成则直接返回
    if (assignment.status === TaskAssignmentStatusEnum.COMPLETED) {
      await this.settleCompletedAssignmentRewardIfNeeded(
        userId,
        taskRecord,
        assignment,
      )
      return true
    }
    if (assignment.status === TaskAssignmentStatusEnum.EXPIRED) {
      throw new BadRequestException('任务已过期')
    }
    // 显式完成只允许达标后的 assignment 进入完成态。
    if (assignment.progress < assignment.target) {
      throw new BadRequestException('任务进度未达成')
    }

    const finalProgress = Math.max(assignment.progress, assignment.target)

    // 事务更新：标记完成并记录日志
    const updatedRows = await this.drizzle.withTransaction(async (tx) => {
      const updateResult = await tx
        .update(this.taskAssignmentTable)
        .set({
          progress: finalProgress,
          status: TaskAssignmentStatusEnum.COMPLETED,
          completedAt: now,
          version: sql`${this.taskAssignmentTable.version} + 1`,
        })
        .where(
          and(
            eq(this.taskAssignmentTable.id, assignment.id),
            eq(this.taskAssignmentTable.version, assignment.version),
          ),
        )

      if ((updateResult.rowCount ?? 0) === 0) {
        return 0
      }

      await tx.insert(this.taskProgressLogTable).values({
        assignmentId: assignment.id,
        userId,
        actionType: TaskProgressActionTypeEnum.COMPLETE,
        delta: 0,
        beforeValue: assignment.progress,
        afterValue: finalProgress,
      })

      return updateResult.rowCount ?? 0
    })

    if (updatedRows === 0) {
      throw new ConflictException('任务完成状态更新冲突，请重试')
    }

    // 触发完成事件（发放奖励）
    await this.emitTaskCompleteEvent(userId, taskRecord, {
      ...assignment,
      completedAt: now,
    })
    return true
  }

  // ==================== 定时任务 ====================

  /**
   * 过期任务分配检查（定时任务）
   *
   * 每5分钟执行一次，自动将过期的任务分配标记为已过期。
   * 检查条件：分配状态为待开始或进行中，且过期时间已到。
   */
  @Cron('0 */5 * * * *')
  async expireAssignments() {
    const now = new Date()
    await this.drizzle.withTransaction(async (tx) => {
      const expiredAssignments = await tx
        .update(this.taskAssignmentTable)
        .set({
          status: TaskAssignmentStatusEnum.EXPIRED,
        })
        .where(
          and(
            isNull(this.taskAssignmentTable.deletedAt),
            inArray(this.taskAssignmentTable.status, [
              TaskAssignmentStatusEnum.PENDING,
              TaskAssignmentStatusEnum.IN_PROGRESS,
            ]),
            lte(this.taskAssignmentTable.expiredAt, now),
          ),
        )
        .returning({
          assignmentId: this.taskAssignmentTable.id,
          userId: this.taskAssignmentTable.userId,
          progress: this.taskAssignmentTable.progress,
        })

      if (expiredAssignments.length === 0) {
        return
      }

      await tx.insert(this.taskProgressLogTable).values(
        expiredAssignments.map((assignment) => ({
          assignmentId: assignment.assignmentId,
          userId: assignment.userId,
          actionType: TaskProgressActionTypeEnum.EXPIRE,
          delta: 0,
          beforeValue: assignment.progress,
          afterValue: assignment.progress,
        })),
      )
    })
  }

  /**
   * 即将过期任务提醒（定时任务）
   *
   * 每小时扫描一次未来 24 小时内即将过期且仍未完成的任务分配，
   * 通过稳定幂等键保证每个 assignment 只提醒一次。
   */
  @Cron('0 0 * * * *')
  async notifyExpiringSoonAssignments() {
    const now = new Date()
    const deadline = this.addHours(now, TASK_EXPIRING_SOON_REMINDER_HOURS)

    const assignments = await this.db
      .select({
        assignmentId: this.taskAssignmentTable.id,
        taskId: this.taskAssignmentTable.taskId,
        userId: this.taskAssignmentTable.userId,
        cycleKey: this.taskAssignmentTable.cycleKey,
        expiredAt: this.taskAssignmentTable.expiredAt,
        title: this.taskTable.title,
      })
      .from(this.taskAssignmentTable)
      .innerJoin(
        this.taskTable,
        eq(this.taskAssignmentTable.taskId, this.taskTable.id),
      )
      .where(
        and(
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.status, [
            TaskAssignmentStatusEnum.PENDING,
            TaskAssignmentStatusEnum.IN_PROGRESS,
          ]),
          gte(this.taskAssignmentTable.expiredAt, now),
          lte(this.taskAssignmentTable.expiredAt, deadline),
          isNull(this.taskTable.deletedAt),
        ),
      )

    if (assignments.length === 0) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEvents(
      assignments
        .filter((item) => item.expiredAt)
        .map((item) =>
          this.buildTaskReminderNotificationEvent({
            bizKey: this.buildTaskExpiringSoonReminderBizKey(item.assignmentId),
            receiverUserId: item.userId,
            taskId: item.taskId,
            taskTitle: item.title,
            cycleKey: item.cycleKey,
            reminderKind: TaskReminderKindEnum.EXPIRING_SOON,
            assignmentId: item.assignmentId,
            expiredAt: item.expiredAt ?? undefined,
          }),
        ),
    )
  }

  // ==================== 私有方法 ====================

  /**
   * 校验发布时间窗口
   *
   * 确保发布开始时间不晚于结束时间。
   *
   * @param startAt 发布开始时间
   * @param endAt 发布结束时间
   * @throws BadRequestException 发布时间无效
   */
  private ensurePublishWindow(startAt?: Date | null, endAt?: Date | null) {
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('发布开始时间不能晚于结束时间')
    }
  }

  /**
   * 解析JSON字符串
   *
   * 将字符串解析为JSON对象，用于处理前端传递的JSON配置。
   *
   * @param value JSON字符串
   * @returns 解析后的对象，如果为空则返回undefined
   * @throws BadRequestException JSON格式错误
   */
  private parseJsonValue(value?: string | Record<string, unknown> | null) {
    if (value === undefined || value === null || value === '') {
      return undefined
    }
    if (typeof value === 'object') {
      return value
    }
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      throw new BadRequestException('JSON格式错误')
    }
  }

  /**
   * 解析并校验任务奖励配置。
   * 当前只允许 points / experience 两个正整数字段，空对象会被归一化为 null。
   */
  private parseTaskRewardConfig(
    value?: string | Record<string, unknown> | null,
  ): TaskRewardConfig | null | undefined {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const parsed = this.parseJsonValue(value)
    if (parsed === null) {
      return null
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('rewardConfig 必须是 JSON 对象')
    }

    const record = parsed
    const unsupportedKeys = Object.keys(record).filter(
      (key) => !['points', 'experience'].includes(key),
    )
    if (unsupportedKeys.length > 0) {
      throw new BadRequestException(
        `rewardConfig 暂只支持 points、experience，暂不支持字段：${unsupportedKeys.join(', ')}`,
      )
    }

    const rewardConfig: TaskRewardConfig = {}
    if ('points' in record && record.points !== undefined) {
      rewardConfig.points = this.parseRewardConfigPositiveInt(
        record.points,
        'rewardConfig.points',
      )
    }
    if ('experience' in record && record.experience !== undefined) {
      rewardConfig.experience = this.parseRewardConfigPositiveInt(
        record.experience,
        'rewardConfig.experience',
      )
    }

    return Object.keys(rewardConfig).length > 0 ? rewardConfig : null
  }

  /**
   * 校验奖励配置中的正整数值。
   *
   * 任务奖励配置要求值为正整数，避免非法数值进入奖励结算路径。
   */
  private parseRewardConfigPositiveInt(value: unknown, fieldName: string) {
    if (!Number.isInteger(value) || Number(value) <= 0) {
      throw new BadRequestException(
        `${fieldName} 必须是大于 0 的整数，清空请传 null 或移除该字段`,
      )
    }
    return Number(value)
  }

  /**
   * 构建可领取任务的查询条件
   *
   * 条件包括：
   * - 未删除
   * - 已发布状态
   * - 已启用
   * - 在发布时间窗口内
   *
   * @param type 任务类型（可选）
   * @returns 查询条件
   */
  private buildAvailableWhere(type?: TaskSelect['type']): SQL | undefined {
    const now = new Date()
    // 发布开始时间条件：为空或已到开始时间
    const publishStartCondition = or(
      isNull(this.taskTable.publishStartAt),
      lte(this.taskTable.publishStartAt, now),
    )
    // 发布结束时间条件：为空或未到结束时间
    const publishEndCondition = or(
      isNull(this.taskTable.publishEndAt),
      gte(this.taskTable.publishEndAt, now),
    )

    const conditions: SQL[] = [
      isNull(this.taskTable.deletedAt),
      eq(this.taskTable.status, TaskStatusEnum.PUBLISHED),
      eq(this.taskTable.isEnabled, true),
    ]

    if (publishStartCondition) {
      conditions.push(publishStartCondition)
    }
    if (publishEndCondition) {
      conditions.push(publishEndCondition)
    }
    if (type !== undefined) {
      conditions.push(eq(this.taskTable.type, type))
    }
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * 查找可用任务
   *
   * 查找满足基本条件的任务：未删除、已启用、已发布。
   *
   * @param taskId 任务ID
   * @returns 任务记录
   * @throws NotFoundException 任务不存在
   */
  private async findAvailableTask(taskId: number, now = new Date()) {
    const [taskRecord] = await this.db
      .select()
      .from(this.taskTable)
      .where(
        and(
          eq(this.taskTable.id, taskId),
          isNull(this.taskTable.deletedAt),
          eq(this.taskTable.isEnabled, true),
          eq(this.taskTable.status, TaskStatusEnum.PUBLISHED),
        ),
      )
      .limit(1)

    if (!taskRecord) {
      throw new NotFoundException('任务不存在')
    }
    this.assertTaskInPublishWindow(taskRecord, now)
    return taskRecord
  }

  /**
   * 查找可领取的任务
   *
   * 在可用任务基础上，额外校验任务是否在发布时间窗口内。
   *
   * @param taskId 任务ID
   * @returns 任务记录
   * @throws BadRequestException 任务未开始或已结束
   * @throws NotFoundException 任务不存在
   */
  private async findClaimableTask(taskId: number, now = new Date()) {
    return this.findAvailableTask(taskId, now)
  }

  /**
   * 构建任务周期标识
   *
   * 根据任务的重复规则生成当前周期的唯一标识：
   * - 一次性任务：返回 'once'
   * - 每日任务：返回日期字符串 'YYYY-MM-DD'
   * - 每周任务：返回周起始日期 'week-YYYY-MM-DD'
   * - 每月任务：返回月份 'YYYY-MM'
   *
   * @param taskRecord 任务记录对象
   * @param taskRecord.repeatRule 重复规则
   * @param now 当前时间
   * @returns 周期标识
   */
  private buildCycleKey(taskRecord: Pick<TaskSelect, 'repeatRule'>, now: Date): string {
    const type = this.getTaskRepeatType(taskRecord)
    if (type === TaskRepeatTypeEnum.DAILY) {
      return this.formatDate(now)
    }
    if (type === TaskRepeatTypeEnum.WEEKLY) {
      return `week-${this.formatDate(this.getWeekStart(now))}`
    }
    if (type === TaskRepeatTypeEnum.MONTHLY) {
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    }
    return TaskRepeatTypeEnum.ONCE
  }

  /**
   * 解析任务重复类型。
   *
   * repeatRule 当前只认 type 字段，缺省时回退到一次性任务。
   */
  private getTaskRepeatType(taskRecord: Pick<TaskSelect, 'repeatRule'>) {
    const rule = taskRecord.repeatRule as { type?: string } | null
    const type = rule?.type ?? TaskRepeatTypeEnum.ONCE
    return Object.values(TaskRepeatTypeEnum).includes(
      type as TaskRepeatTypeEnum,
    )
      ? (type as TaskRepeatTypeEnum)
      : TaskRepeatTypeEnum.ONCE
  }

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   *
   * @param date 日期对象
   * @returns 格式化的日期字符串
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10)
  }

  /**
   * 获取周起始日期（周一）
   *
   * @param date 日期对象
   * @returns 该周周一的日期对象
   */
  private getWeekStart(date: Date): Date {
    const base = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    )
    const day = base.getUTCDay() || 7
    base.setUTCDate(base.getUTCDate() - day + 1)
    return base
  }

  /**
   * 构建任务快照
   *
   * 创建任务信息的快照，用于任务分配记录中保存任务状态。
   * 确保即使任务配置变更，历史分配仍保留当时的任务信息。
   *
   * @param taskRecord 任务记录对象
   * @param taskRecord.id 任务ID
   * @param taskRecord.code 任务编码
   * @param taskRecord.title 任务标题
   * @param taskRecord.type 任务类型
   * @param taskRecord.rewardConfig 奖励配置
   * @param taskRecord.targetCount 目标数量
   * @returns 任务快照对象
   */
  private buildTaskSnapshot(taskRecord: TaskSnapshotSource) {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      type: taskRecord.type,
      rewardConfig: taskRecord.rewardConfig,
      targetCount: taskRecord.targetCount,
    }
  }

  /**
   * 根据唯一键查找任务分配
   *
   * 唯一键由 任务ID + 用户ID + 周期标识 组成。
   *
   * @param taskId 任务ID
   * @param userId 用户ID
   * @param cycleKey 周期标识
   * @returns 任务分配记录，不存在则返回undefined
   */
  private async findAssignmentByUniqueKey(
    taskId: number,
    userId: number,
    cycleKey: string,
  ) {
    const [assignment] = await this.db
      .select()
      .from(this.taskAssignmentTable)
      .where(
        and(
          eq(this.taskAssignmentTable.taskId, taskId),
          eq(this.taskAssignmentTable.userId, userId),
          eq(this.taskAssignmentTable.cycleKey, cycleKey),
          isNull(this.taskAssignmentTable.deletedAt),
        ),
      )
      .limit(1)
    return assignment
  }

  /**
   * 创建或获取已存在的任务分配
   *
   * 处理并发领取场景：通过唯一键 + onConflictDoNothing
   * 保证只创建一条分配记录，并在并发命中时回查已有分配。
   *
   * @param taskRecord 任务信息对象
   * @param taskRecord.id 任务ID
   * @param taskRecord.code 任务编码
   * @param taskRecord.title 任务标题
   * @param taskRecord.type 任务类型
   * @param taskRecord.rewardConfig 奖励配置
   * @param taskRecord.targetCount 目标数量
   * @param taskRecord.claimMode 领取模式
   * @param taskRecord.publishEndAt 发布结束时间
   * @param taskRecord.repeatRule 重复规则
   * @param userId 用户ID
   * @param cycleKey 周期标识
   * @param now 当前时间
   * @returns 任务分配
   */
  private async createOrGetAssignment(
    taskRecord: TaskSnapshotSource &
      Pick<TaskSelect, 'claimMode' | 'publishEndAt' | 'repeatRule'>,
    userId: number,
    cycleKey: string,
    now: Date,
  ) {
    const taskSnapshot = this.buildTaskSnapshot(taskRecord)
    let createdAssignment: TaskAssignmentSelect | undefined

    const assignment = await this.drizzle.withTransaction(async (tx) => {
      const [insertedAssignment] = await tx
        .insert(this.taskAssignmentTable)
        .values({
          taskId: taskRecord.id,
          userId,
          cycleKey,
          status: TaskAssignmentStatusEnum.PENDING,
          progress: 0,
          target: taskRecord.targetCount,
          claimedAt: now,
          expiredAt: this.buildAssignmentExpiredAt(taskRecord, now),
          taskSnapshot,
        })
        .onConflictDoNothing()
        .returning()

      if (insertedAssignment) {
        createdAssignment = insertedAssignment
        await tx.insert(this.taskProgressLogTable).values({
          assignmentId: insertedAssignment.id,
          userId,
          actionType: TaskProgressActionTypeEnum.CLAIM,
          delta: 0,
          beforeValue: 0,
          afterValue: 0,
        })
        return insertedAssignment
      }

      const [existing] = await tx
        .select()
        .from(this.taskAssignmentTable)
        .where(
          and(
            eq(this.taskAssignmentTable.taskId, taskRecord.id),
            eq(this.taskAssignmentTable.userId, userId),
            eq(this.taskAssignmentTable.cycleKey, cycleKey),
            isNull(this.taskAssignmentTable.deletedAt),
          ),
        )
        .limit(1)

      if (existing) {
        return existing
      }

      throw new NotFoundException('任务分配创建失败')
    })

    if (createdAssignment && taskRecord.claimMode === TaskClaimModeEnum.AUTO) {
      await this.tryNotifyAutoAssignedTask(
        userId,
        taskRecord,
        assignment,
        cycleKey,
      )
    }

    return assignment
  }

  /**
   * 确保一组任务的自动分配
   *
   * 批量检查并为自动领取模式的任务创建分配。
   *
   * @param userId 用户ID
   * @param tasks 任务列表
   */
  private async ensureAutoAssignments(userId: number, tasks: TaskSelect[]) {
    await Promise.all(
      tasks.map(async (taskRecord) =>
        this.ensureAutoAssignment(userId, taskRecord.id),
      ),
    )
  }

  /**
   * 确保用户的所有自动领取任务已分配
   *
   * 查询所有可用任务，为自动领取模式的任务创建分配。
   *
   * @param userId 用户ID
   */
  private async ensureAutoAssignmentsForUser(userId: number) {
    const where = this.buildAvailableWhere()
    const tasks = await this.db
      .select({
        id: this.taskTable.id,
        code: this.taskTable.code,
        title: this.taskTable.title,
        type: this.taskTable.type,
        rewardConfig: this.taskTable.rewardConfig,
        targetCount: this.taskTable.targetCount,
        claimMode: this.taskTable.claimMode,
        publishStartAt: this.taskTable.publishStartAt,
        publishEndAt: this.taskTable.publishEndAt,
        repeatRule: this.taskTable.repeatRule,
      })
      .from(this.taskTable)
      .where(where)

    await Promise.all(
      tasks.map(async (taskRecord) =>
        this.ensureAutoAssignmentByTask(userId, taskRecord),
      ),
    )
  }

  /**
   * 确保单个任务的自动分配
   *
   * 根据任务ID查找任务，如果为自动领取模式则创建分配。
   *
   * @param userId 用户ID
   * @param taskId 任务ID
   */
  private async ensureAutoAssignment(userId: number, taskId: number) {
    // 查找自动领取模式的可用任务
    const [taskRecord] = await this.db
      .select()
      .from(this.taskTable)
      .where(
        and(
          eq(this.taskTable.id, taskId),
          isNull(this.taskTable.deletedAt),
          eq(this.taskTable.isEnabled, true),
          eq(this.taskTable.status, TaskStatusEnum.PUBLISHED),
          eq(this.taskTable.claimMode, TaskClaimModeEnum.AUTO),
        ),
      )
      .limit(1)

    if (!taskRecord) {
      return
    }
    await this.ensureAutoAssignmentByTask(userId, taskRecord)
  }

  /**
   * 根据任务信息确保自动分配
   *
   * 校验任务的时间窗口和领取模式，创建分配。
   *
   * @param userId 用户ID
   * @param taskRecord 任务信息对象
   * @param taskRecord.id 任务ID
   * @param taskRecord.code 任务编码
   * @param taskRecord.title 任务标题
   * @param taskRecord.type 任务类型
   * @param taskRecord.rewardConfig 奖励配置
   * @param taskRecord.targetCount 目标数量
   * @param taskRecord.claimMode 领取模式
   * @param taskRecord.publishStartAt 发布开始时间
   * @param taskRecord.publishEndAt 发布结束时间
   * @param taskRecord.repeatRule 重复规则
   */
  private async ensureAutoAssignmentByTask(
    userId: number,
    taskRecord: AutoAssignmentTaskSource,
  ) {
    // 非自动领取模式跳过
    if (taskRecord.claimMode !== TaskClaimModeEnum.AUTO) {
      return
    }
    const now = new Date()
    if (this.getTaskAvailabilityError(taskRecord, now)) {
      return
    }
    // 计算周期并创建分配
    const cycleKey = this.buildCycleKey(taskRecord, now)
    await this.createOrGetAssignment(taskRecord, userId, cycleKey, now)
  }

  /**
   * 触发任务完成事件
   *
   * 任务完成时调用用户成长奖励服务发放奖励。
   *
   * @param userId 用户ID
   * @param taskRecord 任务信息对象
   * @param taskRecord.id 任务ID
   * @param taskRecord.title 任务标题
   * @param taskRecord.rewardConfig 奖励配置
   * @param assignment 任务分配信息对象
   * @param assignment.id 分配ID
   * @param assignment.completedAt 任务完成时间，用于构建统一事件壳的 occurredAt
   */
  private async emitTaskCompleteEvent(
    userId: number,
    taskRecord: {
      id: number
      title?: string
      rewardConfig: unknown
    },
    assignment: { id: number, completedAt?: Date | null },
  ) {
    const taskCompleteEvent = this.buildTaskCompleteEventEnvelope({
      userId,
      taskId: taskRecord.id,
      assignmentId: assignment.id,
      occurredAt: assignment.completedAt ?? undefined,
    })

    const rewardResult =
      await this.userGrowthRewardService.tryRewardTaskComplete({
        userId,
        taskId: taskRecord.id,
        assignmentId: assignment.id,
        rewardConfig: taskRecord.rewardConfig,
        eventEnvelope: taskCompleteEvent,
      })

    await this.syncTaskAssignmentRewardState(assignment.id, rewardResult)
    await this.tryNotifyTaskRewardGranted(
      userId,
      taskRecord,
      assignment,
      rewardResult,
    )
  }

  /**
   * 在任务完成后按需触发奖励结算。
   *
   * 仅当分配记录尚未结算成功时才触发结算，避免重复调用奖励服务。
   */
  private async settleCompletedAssignmentRewardIfNeeded(
    userId: number,
    taskRecord: {
      id: number
      rewardConfig: unknown
    },
    assignment: { id: number, rewardStatus: TaskAssignmentSelect['rewardStatus'] },
  ) {
    if (assignment.rewardStatus === TaskAssignmentRewardStatusEnum.SUCCESS) {
      return
    }

    await this.emitTaskCompleteEvent(userId, taskRecord, assignment)
  }

  /**
   * 同步任务分配奖励状态。
   *
   * 奖励结算流程属于可降级副作用，写库失败时只记录日志，不阻断主流程。
   */
  private async syncTaskAssignmentRewardState(
    assignmentId: number,
    rewardResult: TaskRewardSettlementResult,
  ) {
    try {
      const updateResult = await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.taskAssignmentTable)
          .set({
            rewardStatus: rewardResult.success
              ? TaskAssignmentRewardStatusEnum.SUCCESS
              : TaskAssignmentRewardStatusEnum.FAILED,
            rewardResultType: rewardResult.success
              ? rewardResult.resultType
              : TaskAssignmentRewardResultTypeEnum.FAILED,
            rewardSettledAt: rewardResult.settledAt,
            rewardLedgerIds: rewardResult.ledgerRecordIds,
            lastRewardError: rewardResult.success
              ? null
              : (rewardResult.errorMessage ?? '任务奖励发放失败，请稍后重试'),
          })
          .where(eq(this.taskAssignmentTable.id, assignmentId)),
      )

      this.drizzle.assertAffectedRows(updateResult, '任务分配不存在')
    } catch (error) {
      this.logger.warn(
        `task_reward_state_sync_failed assignmentId=${assignmentId} resultType=${rewardResult.resultType} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * 尝试发送“新任务可领”提醒
   *
   * 当前仅对手动领取任务生效，并限制为最近 24 小时进入可领取状态的任务，
   * 避免用户首次打开任务页时收到历史积压提醒。
   */
  private async tryNotifyAvailableTasksFromPage(
    userId: number,
    tasks: TaskSelect[],
    now: Date,
  ) {
    const recentBoundary = this.addHours(
      now,
      -TASK_AVAILABLE_REMINDER_RECENT_HOURS,
    )
    const notifications = tasks
      .filter(
        (taskRecord) =>
          taskRecord.claimMode === TaskClaimModeEnum.MANUAL &&
          this.getTaskAvailableReferenceTime(taskRecord).getTime() >=
          recentBoundary.getTime(),
      )
      .map((taskRecord) => {
        const cycleKey = this.buildCycleKey(taskRecord, now)
        return this.buildTaskReminderNotificationEvent({
          bizKey: this.buildTaskAvailableReminderBizKey(
            taskRecord.id,
            userId,
            cycleKey,
          ),
          receiverUserId: userId,
          taskId: taskRecord.id,
          taskTitle: taskRecord.title,
          cycleKey,
          reminderKind: TaskReminderKindEnum.AVAILABLE,
          claimMode: taskRecord.claimMode,
        })
      })

    if (notifications.length === 0) {
      return
    }

    try {
      await this.messageOutboxService.enqueueNotificationEvents(notifications)
    } catch (error) {
      this.logger.warn(
        `task_available_reminder_enqueue_failed userId=${userId} count=${notifications.length} error=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 尝试发送“自动分配的新任务”提醒
   *
   * 自动领取任务创建 assignment 后立刻补一条提醒，帮助用户感知任务已进入“我的任务”。
   */
  private async tryNotifyAutoAssignedTask(
    userId: number,
    taskRecord: {
      id: number
      title: string
      claimMode?: number
    },
    assignment: { id: number },
    cycleKey: string,
  ) {
    try {
      await this.messageOutboxService.enqueueNotificationEvent({
        eventType: MessageNotificationTypeEnum.TASK_REMINDER,
        bizKey: this.buildTaskAvailableReminderBizKey(
          taskRecord.id,
          userId,
          cycleKey,
        ),
        payload: this.buildTaskReminderNotificationEvent({
          bizKey: this.buildTaskAvailableReminderBizKey(
            taskRecord.id,
            userId,
            cycleKey,
          ),
          receiverUserId: userId,
          taskId: taskRecord.id,
          taskTitle: taskRecord.title,
          cycleKey,
          reminderKind: TaskReminderKindEnum.AVAILABLE,
          claimMode: taskRecord.claimMode,
          assignmentId: assignment.id,
        }).payload,
      })
    } catch (error) {
      this.logger.warn(
        `task_auto_assignment_reminder_enqueue_failed userId=${userId} taskId=${taskRecord.id} assignmentId=${assignment.id} error=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 尝试发送“奖励到账”提醒
   *
   * 仅当本次任务奖励真实落账时发送；命中幂等、失败或未配置奖励都不会再次提醒。
   */
  private async tryNotifyTaskRewardGranted(
    userId: number,
    taskRecord: {
      id: number
      title?: string
    },
    assignment: { id: number },
    rewardResult: TaskRewardSettlementResult,
  ) {
    if (
      rewardResult.resultType !== TaskAssignmentRewardResultTypeEnum.APPLIED
    ) {
      return
    }

    const grantedPoints = this.getAppliedRewardAmount(rewardResult.pointsReward)
    const grantedExperience = this.getAppliedRewardAmount(
      rewardResult.experienceReward,
    )
    if (grantedPoints <= 0 && grantedExperience <= 0) {
      return
    }

    try {
      await this.messageOutboxService.enqueueNotificationEvent(
        this.buildTaskReminderNotificationEvent({
          bizKey: this.buildTaskRewardGrantedReminderBizKey(assignment.id),
          receiverUserId: userId,
          taskId: taskRecord.id,
          taskTitle: taskRecord.title ?? `任务#${taskRecord.id}`,
          reminderKind: TaskReminderKindEnum.REWARD_GRANTED,
          assignmentId: assignment.id,
          points: grantedPoints,
          experience: grantedExperience,
          ledgerRecordIds: rewardResult.ledgerRecordIds,
        }),
      )
    } catch (error) {
      this.logger.warn(
        `task_reward_reminder_enqueue_failed userId=${userId} taskId=${taskRecord.id} assignmentId=${assignment.id} error=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 计算任务进入可领取状态的参考时间
   *
   * 优先使用 publishStartAt；未设置时回退到 createdAt，便于界定“新任务可领”的提醒窗口。
   */
  private getTaskAvailableReferenceTime(
    taskRecord: Pick<TaskSelect, 'publishStartAt' | 'createdAt'>,
  ) {
    return taskRecord.publishStartAt ?? taskRecord.createdAt
  }

  /**
   * 计算真实到账的奖励数量
   *
   * 仅统计本次真实落账成功的奖励，幂等命中与未配置奖励都会返回 0。
   */
  private getAppliedRewardAmount(
    reward: TaskRewardSettlementResult['pointsReward'],
  ) {
    if (!reward.success || reward.duplicated || reward.skipped) {
      return 0
    }
    return reward.configuredAmount
  }

  /**
   * 构建任务提醒 outbox 事件
   *
   * title/content 同时作为 fallback 文案与模板渲染上下文，确保模板缺失时仍可直接投递。
   */
  private buildTaskReminderNotificationEvent(params: {
    bizKey: string
    receiverUserId: number
    taskId: number
    taskTitle: string
    cycleKey?: string
    reminderKind: TaskReminderKindEnum
    claimMode?: number
    assignmentId?: number
    expiredAt?: Date
    points?: number
    experience?: number
    ledgerRecordIds?: number[]
  }) {
    const message = this.buildTaskReminderMessage(params)
    return {
      eventType: MessageNotificationTypeEnum.TASK_REMINDER,
      bizKey: params.bizKey,
      payload: {
        receiverUserId: params.receiverUserId,
        type: MessageNotificationTypeEnum.TASK_REMINDER,
        targetId: params.taskId,
        title: message.title,
        content: message.content,
        payload: {
          title: message.title,
          content: message.content,
          reminderKind: params.reminderKind,
          taskId: params.taskId,
          taskTitle: params.taskTitle,
          cycleKey: params.cycleKey,
          assignmentId: params.assignmentId,
          expiredAt: params.expiredAt,
          points: params.points,
          experience: params.experience,
          ledgerRecordIds: params.ledgerRecordIds,
        },
      },
    }
  }

  /**
   * 构建任务提醒文案
   * 第一阶段只保留最小可读文案，不把复杂业务判断下沉到模板层。
   */
  private buildTaskReminderMessage(params: {
    taskTitle: string
    reminderKind: TaskReminderKindEnum
    claimMode?: number
    points?: number
    experience?: number
  }) {
    if (params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED) {
      const rewardParts: string[] = []
      if (params.points && params.points > 0) {
        rewardParts.push(`积分 +${params.points}`)
      }
      if (params.experience && params.experience > 0) {
        rewardParts.push(`经验 +${params.experience}`)
      }
      return {
        title: '任务奖励已到账',
        content: `任务《${params.taskTitle}》奖励已到账${rewardParts.length > 0 ? `：${rewardParts.join('，')}` : ''}`,
      }
    }

    if (params.reminderKind === TaskReminderKindEnum.EXPIRING_SOON) {
      return {
        title: '任务即将过期',
        content: `任务《${params.taskTitle}》将在 24 小时内过期，请尽快完成。`,
      }
    }

    if (params.claimMode === TaskClaimModeEnum.AUTO) {
      return {
        title: '你有新的任务待完成',
        content: `任务《${params.taskTitle}》已自动加入你的任务列表。`,
      }
    }

    return {
      title: '发现新的可领取任务',
      content: `任务《${params.taskTitle}》现已可领取。`,
    }
  }

  /**
   * 构建“新任务可领”提醒幂等键
   * 维度固定为 task + user + cycle，确保重复周期任务每期最多提醒一次。
   */
  private buildTaskAvailableReminderBizKey(
    taskId: number,
    userId: number,
    cycleKey: string,
  ) {
    return `task:reminder:available:task:${taskId}:cycle:${cycleKey}:user:${userId}`
  }

  /**
   * 构建“任务即将过期”提醒幂等键
   * 维度固定为 assignment，确保单个分配仅提醒一次。
   */
  private buildTaskExpiringSoonReminderBizKey(assignmentId: number) {
    return `task:reminder:expiring:assignment:${assignmentId}`
  }

  /**
   * 构建“任务奖励到账”提醒幂等键
   * 维度固定为 assignment，避免补偿结算时重复通知。
   */
  private buildTaskRewardGrantedReminderBizKey(assignmentId: number) {
    return `task:reminder:reward:assignment:${assignmentId}`
  }

  /**
   * 时间加减辅助方法
   * 支持按小时平移时间，供提醒窗口计算复用。
   */
  private addHours(date: Date, hours: number) {
    const next = new Date(date)
    next.setHours(next.getHours() + hours)
    return next
  }

  /**
   * 统一序列化提醒链路异常
   * 仅用于 warning 日志，避免 sidecar 通知失败影响主业务链路。
   */
  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }

  /**
   * 统一判断任务是否落在发布时间窗口内。
   *
   * 发布时间窗口对 claim / progress / complete 共用，避免不同入口出现边界漂移。
   */
  private getTaskAvailabilityError(
    taskRecord: Pick<TaskSelect, 'publishStartAt' | 'publishEndAt'>,
    now: Date,
  ) {
    if (taskRecord.publishStartAt && taskRecord.publishStartAt > now) {
      return '任务未开始'
    }
    if (taskRecord.publishEndAt && taskRecord.publishEndAt < now) {
      return '任务已结束'
    }
    return undefined
  }

  /**
   * 断言任务当前可执行 claim / progress / complete。
   *
   * 任务配置存在不代表当前仍处在有效发布窗口，调用方需要在读到任务后立即校验。
   */
  private assertTaskInPublishWindow(
    taskRecord: Pick<TaskSelect, 'publishStartAt' | 'publishEndAt'>,
    now: Date,
  ) {
    const availabilityError = this.getTaskAvailabilityError(taskRecord, now)
    if (availabilityError) {
      throw new BadRequestException(availabilityError)
    }
  }

  /**
   * 计算 assignment 的真实过期时间。
   *
   * 一次性任务只受 publishEndAt 约束；重复任务则取“当前周期结束时间”和
   * publishEndAt 中更早的那个，确保旧周期 assignment 能被稳定关闭。
   */
  private buildAssignmentExpiredAt(
    taskRecord: Pick<TaskSelect, 'publishEndAt' | 'repeatRule'>,
    now: Date,
  ) {
    const cycleExpiredAt = this.getCycleExpiredAt(taskRecord, now)
    const publishEndAt = taskRecord.publishEndAt ?? undefined

    if (!cycleExpiredAt) {
      return publishEndAt
    }
    if (!publishEndAt) {
      return cycleExpiredAt
    }
    return cycleExpiredAt.getTime() <= publishEndAt.getTime()
      ? cycleExpiredAt
      : publishEndAt
  }

  /**
   * 计算当前周期的结束时间。
   *
   * 周期边界统一按 UTC 计算，保持 cycleKey 与 expiredAt 的口径一致。
   */
  private getCycleExpiredAt(
    taskRecord: Pick<TaskSelect, 'repeatRule'>,
    now: Date,
  ) {
    const repeatType = this.getTaskRepeatType(taskRecord)
    if (repeatType === TaskRepeatTypeEnum.DAILY) {
      return new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
        ),
      )
    }
    if (repeatType === TaskRepeatTypeEnum.WEEKLY) {
      const weekStart = this.getWeekStart(now)
      return new Date(
        Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate() + 7,
        ),
      )
    }
    if (repeatType === TaskRepeatTypeEnum.MONTHLY) {
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      )
    }
    return undefined
  }

  /**
   * 构建任务完成事件 envelope。
   * 当前任务域尚未进入统一事件定义表，先使用稳定字符串编码承载最小事件语义。
   */
  private buildTaskCompleteEventEnvelope(params: {
    userId: number
    taskId: number
    assignmentId: number
    occurredAt?: Date
  }) {
    return createEventEnvelope({
      code: TASK_COMPLETE_EVENT_CODE,
      key: TASK_COMPLETE_EVENT_KEY,
      subjectType: EventDefinitionEntityTypeEnum.USER,
      subjectId: params.userId,
      targetType: EventDefinitionEntityTypeEnum.TASK_ASSIGNMENT,
      targetId: params.assignmentId,
      occurredAt: params.occurredAt,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      context: {
        taskId: params.taskId,
        assignmentId: params.assignmentId,
      },
    })
  }
}
