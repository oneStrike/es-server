import type { SQL } from 'drizzle-orm'
import type {
  ClaimTaskInput,
  CreateTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  QueryTaskAssignmentPageInput,
  QueryTaskPageInput,
  TaskCompleteInput,
  TaskProgressInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { UserGrowthRewardService } from '@libs/growth/growth-reward'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import {
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskProgressActionTypeEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
} from './task.constant'

/** 任务实体类型 */
type Task = typeof import('@db/schema').task.$inferSelect
/** 任务分配实体类型 */

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
 * 3. 用户领取任务（创建任务分配）
 * 4. 用户执行任务（进度更新）
 * 5. 任务完成（触发奖励）
 * 6. 任务过期（自动标记）
 */
@Injectable()
export class TaskService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
  ) { }

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

  private async queryTaskAssignmentPage(
    params: {
      whereClause: SQL | undefined
      pageIndex?: number
      pageSize?: number
      orderBy?: unknown
      includeTaskDetail: boolean
    },
  ) {
    const { whereClause, pageIndex, pageSize, orderBy, includeTaskDetail } = params
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const order = this.drizzle.buildOrderBy(orderBy, {
      table: this.taskAssignmentTable,
      fallbackOrderBy: { id: 'desc' },
    })
    const orderBys = order.orderBySql

    const list = includeTaskDetail
      ? await (
        orderBys.length > 0
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
            .offset(page.offset)
      )
      : await (
        orderBys.length > 0
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
            .offset(page.offset)
      )

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

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.taskTable).values({
          ...dto,
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

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskTable)
          .set({
            ...dto,
            rewardConfig: this.parseJsonValue(dto.rewardConfig),
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

    const assignmentConditions: SQL[] = [isNull(this.taskAssignmentTable.deletedAt)]

    if (queryDto.taskId !== undefined) {
      assignmentConditions.push(eq(this.taskAssignmentTable.taskId, queryDto.taskId))
    }
    if (queryDto.userId !== undefined) {
      assignmentConditions.push(eq(this.taskAssignmentTable.userId, queryDto.userId))
    }
    if (queryDto.status !== undefined) {
      assignmentConditions.push(eq(this.taskAssignmentTable.status, queryDto.status))
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

    const result = await this.drizzle.ext.findPagination(this.taskTable, {
      where,
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: JSON.stringify([{ priority: 'desc' }, { createdAt: 'desc' }]),
    })

    // 为自动领取模式的任务确保分配已创建
    await this.ensureAutoAssignments(userId, result.list)
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
      assignmentConditions.push(eq(this.taskAssignmentTable.status, queryDto.status))
    }

    const assignmentWhere = and(...assignmentConditions)
    const taskWhere =
      type !== undefined ? eq(this.taskTable.type, type) : undefined
    const whereClause = assignmentWhere && taskWhere
      ? and(assignmentWhere, taskWhere)
      : assignmentWhere ?? taskWhere
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
    const taskRecord = await this.findClaimableTask(dto.taskId)
    const now = new Date()
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
   * 会自动创建分配。当进度达到目标时自动标记为完成。
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
    const taskRecord = await this.findAvailableTask(dto.taskId)
    const now = new Date()
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
    if (
      assignment.status === TaskAssignmentStatusEnum.COMPLETED ||
      assignment.status === TaskAssignmentStatusEnum.EXPIRED
    ) {
      return true
    }

    // 计算新进度（不超过目标值）
    const nextProgress = Math.min(
      assignment.target,
      assignment.progress + dto.delta,
    )
    // 判断是否完成
    const nextStatus =
      nextProgress >= assignment.target
        ? TaskAssignmentStatusEnum.COMPLETED
        : assignment.status
    const completedAt =
      nextStatus === TaskAssignmentStatusEnum.COMPLETED ? now : undefined
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

      // 记录进度日志
      await tx.insert(this.taskProgressLogTable).values({
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
      await this.emitTaskCompleteEvent(userId, taskRecord, assignment)
    }
    return true
  }

  /**
   * 完成任务（应用端）
   *
   * 手动标记任务为完成状态。仅适用于手动完成模式的任务。
   * 自动完成模式的任务需要进度达标后才能完成。
   *
   * @param dto 完成参数
   *   - taskId: 任务ID
   * @param userId 当前用户ID
   * @returns 是否更新成功
   * @throws BadRequestException 任务未领取或进度未达成
   * @throws NotFoundException 任务不存在
   */
  async completeTask(dto: TaskCompleteInput, userId: number) {
    const taskRecord = await this.findAvailableTask(dto.taskId)
    const now = new Date()
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
      return true
    }
    // 自动完成模式需要进度达标
    if (
      taskRecord.completeMode === TaskCompleteModeEnum.AUTO &&
      assignment.progress < assignment.target
    ) {
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
    await this.emitTaskCompleteEvent(userId, taskRecord, assignment)
    return true
  }

  // ==================== 定时任务 ====================

  /**
   * 过期任务分配检查（定时任务）
   *
   * 每5分钟执行一次，自动将过期的任务分配标记为已过期。
   * 检查条件：分配状态为待领取或进行中，且过期时间已到。
   */
  @Cron('0 */5 * * * *')
  async expireAssignments() {
    const now = new Date()
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.taskAssignmentTable)
        .set({
          status: TaskAssignmentStatusEnum.EXPIRED,
        })
        .where(
          and(
            inArray(this.taskAssignmentTable.status, [
              TaskAssignmentStatusEnum.PENDING,
              TaskAssignmentStatusEnum.IN_PROGRESS,
            ]),
            lte(this.taskAssignmentTable.expiredAt, now),
          ),
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
  private parseJsonValue(
    value?: string | Record<string, unknown> | null,
  ) {
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
  private buildAvailableWhere(type?: number): SQL | undefined {
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
  private async findAvailableTask(taskId: number) {
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
  private async findClaimableTask(taskId: number) {
    const taskRecord = await this.findAvailableTask(taskId)
    const now = new Date()
    // 校验任务是否已开始
    if (taskRecord.publishStartAt && taskRecord.publishStartAt > now) {
      throw new BadRequestException('任务未开始')
    }
    // 校验任务是否已结束
    if (taskRecord.publishEndAt && taskRecord.publishEndAt < now) {
      throw new BadRequestException('任务已结束')
    }
    return taskRecord
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
  private buildCycleKey(
    taskRecord: { repeatRule: unknown },
    now: Date,
  ): string {
    const rule = taskRecord.repeatRule as { type?: string } | null
    const type = rule?.type ?? TaskRepeatTypeEnum.ONCE
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
  private buildTaskSnapshot(taskRecord: {
    id: number
    code: string
    title: string
    type: number
    rewardConfig: unknown
    targetCount: number
  }) {
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
   * @param taskRecord.publishEndAt 发布结束时间
   * @param userId 用户ID
   * @param cycleKey 周期标识
   * @param now 当前时间
   * @returns 任务分配
   */
  private async createOrGetAssignment(
    taskRecord: {
      id: number
      code: string
      title: string
      type: number
      rewardConfig: unknown
      targetCount: number
      publishEndAt: Date | null
    },
    userId: number,
    cycleKey: string,
    now: Date,
  ) {
    const taskSnapshot = this.buildTaskSnapshot(taskRecord)

    return this.drizzle.withTransaction(async (tx) => {
      const [createdAssignment] = await tx
        .insert(this.taskAssignmentTable)
        .values({
          taskId: taskRecord.id,
          userId,
          cycleKey,
          status: TaskAssignmentStatusEnum.IN_PROGRESS,
          progress: 0,
          target: taskRecord.targetCount,
          claimedAt: now,
          expiredAt: taskRecord.publishEndAt ?? undefined,
          taskSnapshot,
        })
        .onConflictDoNothing()
        .returning()

      if (createdAssignment) {
        await tx.insert(this.taskProgressLogTable).values({
          assignmentId: createdAssignment.id,
          userId,
          actionType: TaskProgressActionTypeEnum.CLAIM,
          delta: 0,
          beforeValue: 0,
          afterValue: 0,
        })
        return createdAssignment
      }

      const [existing] = await tx
        .select()
        .from(this.taskAssignmentTable)
        .where(
          and(
            eq(this.taskAssignmentTable.taskId, taskRecord.id),
            eq(this.taskAssignmentTable.userId, userId),
            eq(this.taskAssignmentTable.cycleKey, cycleKey),
          ),
        )
        .limit(1)

      if (existing) {
        return existing
      }

      throw new NotFoundException('任务分配创建失败')
    })
  }

  /**
   * 确保一组任务的自动分配
   *
   * 批量检查并为自动领取模式的任务创建分配。
   *
   * @param userId 用户ID
   * @param tasks 任务列表
   */
  private async ensureAutoAssignments(userId: number, tasks: Task[]) {
    await Promise.all(
      tasks.map(async (taskRecord) => this.ensureAutoAssignment(userId, taskRecord.id)),
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
      tasks.map(async (taskRecord) => this.ensureAutoAssignmentByTask(userId, taskRecord)),
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
    taskRecord: {
      id: number
      code: string
      title: string
      type: number
      rewardConfig: unknown
      targetCount: number
      claimMode: number
      publishStartAt: Date | null
      publishEndAt: Date | null
      repeatRule: unknown
    },
  ) {
    // 非自动领取模式跳过
    if (taskRecord.claimMode !== TaskClaimModeEnum.AUTO) {
      return
    }
    const now = new Date()
    // 任务未开始
    if (taskRecord.publishStartAt && taskRecord.publishStartAt > now) {
      return
    }
    // 任务已结束
    if (taskRecord.publishEndAt && taskRecord.publishEndAt < now) {
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
   * @param taskRecord.rewardConfig 奖励配置
   * @param assignment 任务分配信息对象
   * @param assignment.id 分配ID
   */
  private async emitTaskCompleteEvent(
    userId: number,
    taskRecord: {
      id: number
      rewardConfig: unknown
    },
    assignment: { id: number },
  ) {
    await this.userGrowthRewardService.tryRewardTaskComplete({
      userId,
      taskId: taskRecord.id,
      assignmentId: assignment.id,
      rewardConfig: taskRecord.rewardConfig as Record<string, unknown> | null,
    })
  }
}
