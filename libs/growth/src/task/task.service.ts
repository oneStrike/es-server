import type { Db } from '@db/core'
import type { TaskAssignmentSelect, TaskSelect } from '@db/schema'
import type { TaskRewardSettlementResult } from '@libs/growth/growth-reward'
import type { Dayjs } from 'dayjs'
import type { SQL } from 'drizzle-orm'
import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  AutoAssignmentTaskSource,
  ClaimTaskInput,
  CreateTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  QueryTaskAssignmentPageInput,
  QueryTaskAssignmentReconciliationPageInput,
  QueryTaskPageInput,
  RetryCompletedAssignmentRewardsResult,
  TaskCompleteInput,
  TaskEventProgressInput,
  TaskEventProgressResult,
  TaskProgressInput,
  TaskQueryOrderByInput,
  TaskRepeatRuleConfig,
  TaskRewardConfig,
  TaskSnapshotSource,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import process from 'node:process'
import { DrizzleService, escapeLikePattern } from '@db/core'
import {
  canConsumeEventEnvelopeByConsumer,
  createEventEnvelope,
  EventDefinitionConsumerEnum,
  EventDefinitionEntityTypeEnum,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition'
import { UserGrowthRewardService } from '@libs/growth/growth-reward'
import {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { GROWTH_RULE_TYPE_VALUES } from '../growth-rule.constant'
import { TaskNotificationService } from './task-notification.service'
import {
  getTaskTypeFilterValues,
  normalizeTaskObjectiveType,
  normalizeTaskType,
  TASK_AVAILABLE_REMINDER_RECENT_HOURS,
  TASK_COMPLETE_EVENT_CODE,
  TASK_COMPLETE_EVENT_KEY,
  TASK_EXPIRING_SOON_REMINDER_HOURS,
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskObjectiveTypeEnum,
  TaskProgressActionTypeEnum,
  TaskProgressSourceEnum,
  TaskReminderKindEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
  TaskUserVisibleStatusEnum,
} from './task.constant'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

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
  private readonly taskNotificationService = new TaskNotificationService()
  private readonly defaultTaskTimezone =
    this.normalizeTaskTimezone(process.env.TZ) ?? 'Asia/Shanghai'

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

  /** 通知投递结果表 */
  private get notificationDeliveryTable() {
    return this.drizzle.schema.notificationDelivery
  }

  /** 消息发件箱表 */
  private get messageOutboxTable() {
    return this.drizzle.schema.messageOutbox
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
                  objectiveType: this.taskTable.objectiveType,
                  eventCode: this.taskTable.eventCode,
                  objectiveConfig: this.taskTable.objectiveConfig,
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
                  objectiveType: this.taskTable.objectiveType,
                  eventCode: this.taskTable.eventCode,
                  objectiveConfig: this.taskTable.objectiveConfig,
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
                  objectiveType: this.taskTable.objectiveType,
                  eventCode: this.taskTable.eventCode,
                  objectiveConfig: this.taskTable.objectiveConfig,
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
                  objectiveType: this.taskTable.objectiveType,
                  eventCode: this.taskTable.eventCode,
                  objectiveConfig: this.taskTable.objectiveConfig,
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
        task: item.task ? this.normalizeTaskRelation(item.task) : item.task,
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
      conditions.push(
        inArray(this.taskTable.type, getTaskTypeFilterValues(queryDto.type)),
      )
    }
    if (queryDto.isEnabled !== undefined) {
      conditions.push(eq(this.taskTable.isEnabled, queryDto.isEnabled))
    }
    if (queryDto.title) {
      conditions.push(
        ilike(this.taskTable.title, `%${escapeLikePattern(queryDto.title)}%`),
      )
    }

    const result = await this.drizzle.ext.findPagination(this.taskTable, {
      where: and(...conditions),
      ...queryDto,
    })
    const runtimeHealthMap = await this.getTaskRuntimeHealthMap(
      result.list.map((item) => item.id),
    )
    return {
      ...result,
      list: result.list.map((taskRecord) =>
        this.toAdminTaskView(taskRecord, runtimeHealthMap.get(taskRecord.id)),
      ),
    }
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
    const runtimeHealthMap = await this.getTaskRuntimeHealthMap([taskRecord.id])
    return this.toAdminTaskView(taskRecord, runtimeHealthMap.get(taskRecord.id))
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
    const objectiveType = this.parseTaskObjectiveType(dto.objectiveType)
    const eventCode = this.parseTaskEventCode(dto.eventCode)
    const objectiveConfig = this.parseTaskObjectiveConfig(dto.objectiveConfig)
    this.ensurePositiveTaskTargetCount(dto.targetCount)
    this.ensureTaskObjectiveContract({
      objectiveType,
      eventCode,
      objectiveConfig,
    })
    const rewardConfig = this.parseTaskRewardConfig(dto.rewardConfig)
    const repeatRule = this.parseTaskRepeatRule(dto.repeatRule)

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.taskTable).values({
          ...dto,
          objectiveType,
          eventCode,
          objectiveConfig,
          rewardConfig,
          repeatRule,
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
    const existingTask = await this.db.query.task.findFirst({
      where: {
        id: dto.id,
        deletedAt: { isNull: true },
      },
    })
    if (!existingTask) {
      throw new NotFoundException('任务不存在')
    }

    const objectiveType =
      dto.objectiveType !== undefined
        ? this.parseTaskObjectiveType(dto.objectiveType)
        : normalizeTaskObjectiveType(existingTask.objectiveType)
    const eventCode =
      dto.eventCode !== undefined
        ? this.parseTaskEventCode(dto.eventCode)
        : (existingTask.eventCode ?? undefined)
    const objectiveConfig =
      dto.objectiveConfig !== undefined
        ? this.parseTaskObjectiveConfig(dto.objectiveConfig)
        : (this.asRecord(existingTask.objectiveConfig) ?? existingTask.objectiveConfig ?? undefined)
    this.ensurePositiveTaskTargetCount(dto.targetCount)
    this.ensureTaskObjectiveContract({
      objectiveType,
      eventCode,
      objectiveConfig: objectiveConfig as Record<string, unknown> | null | undefined,
    })
    const rewardConfig = this.parseTaskRewardConfig(dto.rewardConfig)
    const repeatRule = this.parseTaskRepeatRule(dto.repeatRule)
    const nextPublishStartAt =
      dto.publishStartAt !== undefined
        ? (dto.publishStartAt ?? null)
        : existingTask.publishStartAt
    const nextPublishEndAt =
      dto.publishEndAt !== undefined
        ? (dto.publishEndAt ?? null)
        : existingTask.publishEndAt

    this.ensurePublishWindow(
      nextPublishStartAt ?? undefined,
      nextPublishEndAt ?? undefined,
    )
    await this.assertNoActiveAssignmentConfigMutation(
      existingTask,
      dto,
      repeatRule,
      objectiveType,
    )

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.taskTable)
          .set({
            ...dto,
            objectiveType,
            eventCode,
            objectiveConfig,
            rewardConfig,
            repeatRule,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.taskTable.id, dto.id),
              isNull(this.taskTable.deletedAt),
            ),
          ),
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
        .where(
          and(eq(this.taskTable.id, dto.id), isNull(this.taskTable.deletedAt)),
        ),
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
    const now = new Date()
    await this.drizzle.withTransaction(async (tx) => {
      const targetTask = await tx.query.task.findFirst({
        where: {
          id,
          deletedAt: { isNull: true },
        },
      })
      if (!targetTask) {
        throw new BadRequestException('删除失败：数据不存在')
      }

      await tx
        .update(this.taskTable)
        .set({ deletedAt: now })
        .where(and(eq(this.taskTable.id, id), isNull(this.taskTable.deletedAt)))

      await this.expireAssignmentsByWhere(tx, {
        now,
        whereClause: eq(this.taskAssignmentTable.taskId, id),
        overrideExpiredAt: now,
      })
    })
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
      includeTaskDetail: true,
    })
    return {
      ...result,
      list: result.list.map((item) => this.toAdminTaskAssignmentView(item)),
    }
  }

  /**
   * 分页查询任务奖励与通知对账视图（管理端）。
   *
   * 聚合 assignment、事件推进日志和奖励到账提醒结果，缩短排障时跨表来回翻查的路径。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationPageInput,
  ) {
    const { orderBy } = queryDto
    const assignmentConditions: SQL[] = [
      isNull(this.taskAssignmentTable.deletedAt),
    ]

    if (queryDto.assignmentId !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.id, queryDto.assignmentId),
      )
    }
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
    if (queryDto.rewardStatus !== undefined) {
      assignmentConditions.push(
        eq(this.taskAssignmentTable.rewardStatus, queryDto.rewardStatus),
      )
    }

    const eventAssignmentIds = await this.queryAssignmentIdsByEventFilter(
      queryDto,
    )
    if (eventAssignmentIds && eventAssignmentIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: queryDto.pageIndex ?? 1,
        pageSize: queryDto.pageSize ?? 15,
      }
    }
    if (eventAssignmentIds) {
      assignmentConditions.push(inArray(this.taskAssignmentTable.id, eventAssignmentIds))
    }

    const notificationAssignmentIds =
      await this.queryAssignmentIdsByRewardReminderFilter(queryDto)
    if (notificationAssignmentIds && notificationAssignmentIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: queryDto.pageIndex ?? 1,
        pageSize: queryDto.pageSize ?? 15,
      }
    }
    if (notificationAssignmentIds) {
      assignmentConditions.push(
        inArray(this.taskAssignmentTable.id, notificationAssignmentIds),
      )
    }

    const result = await this.queryTaskAssignmentPage({
      whereClause: and(...assignmentConditions),
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy,
      includeTaskDetail: true,
    })
    const assignmentIds = result.list.map((item) => item.id)
    const [eventMap, rewardReminderMap] = await Promise.all([
      this.getAssignmentEventProgressMap(assignmentIds),
      this.getAssignmentRewardReminderMap(assignmentIds),
    ])

    return {
      ...result,
      list: result.list.map((item) => {
        const taskView = this.buildAssignmentTaskView(item)
        const latestEvent = eventMap.get(item.id)
        const rewardReminder = rewardReminderMap.get(item.id)

        return {
          id: item.id,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          taskId: item.taskId,
          userId: item.userId,
          cycleKey: item.cycleKey,
          status: item.status,
          rewardStatus: item.rewardStatus,
          rewardResultType: item.rewardResultType,
          progress: item.progress,
          target: item.target,
          claimedAt: item.claimedAt,
          completedAt: item.completedAt,
          expiredAt: item.expiredAt,
          rewardSettledAt: item.rewardSettledAt,
          rewardLedgerIds: item.rewardLedgerIds,
          lastRewardError: item.lastRewardError,
          visibleStatus: this.resolveTaskUserVisibleStatus({
            status: item.status,
            rewardStatus: item.rewardStatus,
            rewardConfig: taskView?.rewardConfig,
          }),
          task: taskView,
          latestEventCode: latestEvent?.eventCode ?? null,
          latestEventBizKey: latestEvent?.eventBizKey ?? null,
          latestEventOccurredAt: latestEvent?.eventOccurredAt ?? null,
          rewardReminder: rewardReminder
            ? {
                bizKey: rewardReminder.bizKey,
                status: rewardReminder.status,
                failureReason: rewardReminder.failureReason,
                lastAttemptAt: rewardReminder.lastAttemptAt,
              }
            : null,
        }
      }),
    }
  }

  /**
   * 手动重试单条已完成任务的奖励结算（管理端）。
   */
  async retryTaskAssignmentReward(assignmentId: number) {
    const assignment = await this.db.query.taskAssignment.findFirst({
      where: {
        id: assignmentId,
        deletedAt: { isNull: true },
      },
      with: {
        task: true,
      },
    })

    if (!assignment) {
      throw new NotFoundException('任务分配不存在')
    }
    if (assignment.status !== TaskAssignmentStatusEnum.COMPLETED) {
      throw new BadRequestException('仅已完成任务允许重试奖励结算')
    }
    if (assignment.rewardStatus === TaskAssignmentRewardStatusEnum.SUCCESS) {
      throw new BadRequestException('任务奖励已结算成功，无需重试')
    }

    await this.emitTaskCompleteEvent(
      assignment.userId,
      this.buildTaskRewardTaskRecord(
        assignment.taskId,
        assignment.task ?? undefined,
        assignment,
      ),
      {
        id: assignment.id,
        completedAt: assignment.completedAt,
      },
    )
    return true
  }

  /**
   * 批量扫描并重试已完成但奖励未成功的任务分配（管理端 / 定时任务共用）。
   */
  async retryCompletedAssignmentRewardsBatch(
    limit = 100,
  ): Promise<RetryCompletedAssignmentRewardsResult> {
    const assignments = await this.db
      .select({
        assignmentId: this.taskAssignmentTable.id,
        taskId: this.taskAssignmentTable.taskId,
        userId: this.taskAssignmentTable.userId,
        completedAt: this.taskAssignmentTable.completedAt,
        taskSnapshot: this.taskAssignmentTable.taskSnapshot,
        code: this.taskTable.code,
        title: this.taskTable.title,
        type: this.taskTable.type,
        rewardConfig: this.taskTable.rewardConfig,
      })
      .from(this.taskAssignmentTable)
      .leftJoin(
        this.taskTable,
        eq(this.taskAssignmentTable.taskId, this.taskTable.id),
      )
      .where(
        and(
          isNull(this.taskAssignmentTable.deletedAt),
          eq(
            this.taskAssignmentTable.status,
            TaskAssignmentStatusEnum.COMPLETED,
          ),
          inArray(this.taskAssignmentTable.rewardStatus, [
            TaskAssignmentRewardStatusEnum.PENDING,
            TaskAssignmentRewardStatusEnum.FAILED,
          ]),
        ),
      )
      .orderBy(asc(this.taskAssignmentTable.id))
      .limit(Math.max(1, Math.min(limit, 500)))

    for (const assignment of assignments) {
      await this.emitTaskCompleteEvent(
        assignment.userId,
        this.buildTaskRewardTaskRecord(
          assignment.taskId,
          assignment,
          assignment,
        ),
        {
          id: assignment.assignmentId,
          completedAt: assignment.completedAt,
        },
      )
    }

    return {
      scannedCount: assignments.length,
      triggeredCount: assignments.length,
    }
  }

  // ==================== 应用端接口 ====================

  /**
   * 获取可领取的任务列表（应用端）
   *
   * 查询当前用户可领取的任务，同时自动为自动领取模式的任务创建分配。
   *
   * @param queryDto 查询参数
   *   - type: 任务场景类型
   *   - pageIndex: 页码
   *   - pageSize: 每页数量
   * @param userId 当前用户ID
   * @returns 分页结果
   */
  async getAvailableTasks(queryDto: QueryAppTaskInput, userId: number) {
    const now = new Date()
    const { type } = queryDto
    const page = this.drizzle.buildPage(queryDto)
    const where = this.buildAvailableWhere(type, TaskClaimModeEnum.MANUAL)
    const tasks = await this.db
      .select()
      .from(this.taskTable)
      .where(where)
      .orderBy(desc(this.taskTable.priority), desc(this.taskTable.createdAt))
    const filteredTasks = await this.filterClaimableTasksForUser(
      tasks.filter(
        (taskRecord) => taskRecord.claimMode === TaskClaimModeEnum.MANUAL,
      ),
      userId,
      now,
    )
    const pagedTasks = filteredTasks.slice(page.offset, page.offset + page.limit)

    await this.ensureAutoAssignmentsForUser(userId, now)
    await this.tryNotifyAvailableTasksFromPage(userId, pagedTasks, now)

    return {
      list: pagedTasks.map((taskRecord) => this.toAppTaskView(taskRecord)),
      total: filteredTasks.length,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 获取我的任务列表（应用端）
   *
   * 查询当前用户已领取的任务分配列表。
   * 会先确保所有自动领取的任务都已分配给用户。
   *
   * @param queryDto 查询参数
   *   - status: 分配状态
   *   - type: 任务场景类型
   *   - pageIndex: 页码
   *   - pageSize: 每页数量
   *   - orderBy: 排序条件
   * @param userId 当前用户ID
   * @returns 分页结果，包含分配和任务信息
   */
  async getMyTasks(queryDto: QueryMyTaskInput, userId: number) {
    const now = new Date()
    await this.expireDueAssignmentsForUser(userId, now)
    // 确保自动领取的任务都已分配
    await this.ensureAutoAssignmentsForUser(userId, now)
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
      type !== undefined
        ? inArray(this.taskTable.type, getTaskTypeFilterValues(type))
        : undefined
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
    return {
      ...result,
      list: result.list.map((item) => this.toAppMyTaskView(item)),
    }
  }

  /**
   * 获取用户中心任务摘要。
   *
   * 复用任务读模型收口后的语义，确保用户中心与任务页看到的是同一套状态口径。
   */
  async getUserTaskSummary(userId: number) {
    const now = new Date()
    await this.expireDueAssignmentsForUser(userId, now)
    await this.ensureAutoAssignmentsForUser(userId, now)

    const manualTasks = await this.db
      .select()
      .from(this.taskTable)
      .where(this.buildAvailableWhere(undefined, TaskClaimModeEnum.MANUAL))
      .orderBy(desc(this.taskTable.priority), desc(this.taskTable.createdAt))

    const claimableTasks = await this.filterClaimableTasksForUser(
      manualTasks.filter(
        (taskRecord) => taskRecord.claimMode === TaskClaimModeEnum.MANUAL,
      ),
      userId,
      now,
    )

    const [claimedRows, inProgressRows, rewardPendingRows] = await Promise.all([
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(this.taskAssignmentTable)
        .where(
          and(
            eq(this.taskAssignmentTable.userId, userId),
            isNull(this.taskAssignmentTable.deletedAt),
            eq(this.taskAssignmentTable.status, TaskAssignmentStatusEnum.PENDING),
          ),
        ),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(this.taskAssignmentTable)
        .where(
          and(
            eq(this.taskAssignmentTable.userId, userId),
            isNull(this.taskAssignmentTable.deletedAt),
            eq(
              this.taskAssignmentTable.status,
              TaskAssignmentStatusEnum.IN_PROGRESS,
            ),
          ),
        ),
      this.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(this.taskAssignmentTable)
        .where(
          and(
            eq(this.taskAssignmentTable.userId, userId),
            isNull(this.taskAssignmentTable.deletedAt),
            eq(
              this.taskAssignmentTable.status,
              TaskAssignmentStatusEnum.COMPLETED,
            ),
            inArray(this.taskAssignmentTable.rewardStatus, [
              TaskAssignmentRewardStatusEnum.PENDING,
              TaskAssignmentRewardStatusEnum.FAILED,
            ]),
          ),
        ),
    ])

    return {
      claimableCount: claimableTasks.length,
      claimedCount: Number(claimedRows[0]?.count ?? 0),
      inProgressCount: Number(inProgressRows[0]?.count ?? 0),
      rewardPendingCount: Number(rewardPendingRows[0]?.count ?? 0),
    }
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
    await this.createOrGetAssignment(taskRecord, userId, cycleKey, now, {
      progressSource: TaskProgressSourceEnum.MANUAL,
    })
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
        this.buildTaskRewardTaskRecord(taskRecord.id, taskRecord, assignment),
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
      await tx.insert(this.taskProgressLogTable).values(
        this.buildTaskProgressLogRecord({
          assignmentId: assignment.id,
          userId,
          actionType:
            shouldAutoComplete
              ? TaskProgressActionTypeEnum.COMPLETE
              : TaskProgressActionTypeEnum.PROGRESS,
          progressSource: TaskProgressSourceEnum.MANUAL,
          delta: dto.delta,
          beforeValue: assignment.progress,
          afterValue: nextProgress,
          context,
        }),
      )

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
      await this.emitTaskCompleteEvent(
        userId,
        this.buildTaskRewardTaskRecord(taskRecord.id, taskRecord, assignment),
        {
          ...assignment,
          completedAt: now,
        },
      )
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
        this.buildTaskRewardTaskRecord(taskRecord.id, taskRecord, assignment),
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

      await tx.insert(this.taskProgressLogTable).values(
        this.buildTaskProgressLogRecord({
          assignmentId: assignment.id,
          userId,
          actionType: TaskProgressActionTypeEnum.COMPLETE,
          progressSource: TaskProgressSourceEnum.MANUAL,
          delta: 0,
          beforeValue: assignment.progress,
          afterValue: finalProgress,
        }),
      )

      return updateResult.rowCount ?? 0
    })

    if (updatedRows === 0) {
      throw new ConflictException('任务完成状态更新冲突，请重试')
    }

    // 触发完成事件（发放奖励）
    await this.emitTaskCompleteEvent(
      userId,
      this.buildTaskRewardTaskRecord(taskRecord.id, taskRecord, assignment),
      {
        ...assignment,
        completedAt: now,
      },
    )
    return true
  }

  /**
   * 消费业务事件并推进事件型任务。
   * 仅处理 `objectiveType=EVENT_COUNT` 的任务，按事件发生时间落周期，并基于 assignment + bizKey 做幂等。
   */
  async consumeEventProgress(
    input: TaskEventProgressInput,
  ): Promise<TaskEventProgressResult> {
    const result: TaskEventProgressResult = {
      matchedTaskIds: [],
      progressedAssignmentIds: [],
      completedAssignmentIds: [],
      duplicateAssignmentIds: [],
    }

    if (
      !canConsumeEventEnvelopeByConsumer(
        input.eventEnvelope,
        EventDefinitionConsumerEnum.TASK,
      )
    ) {
      return result
    }

    const occurredAt = input.eventEnvelope.occurredAt ?? new Date()
    const candidateTasks = await this.findEventProgressTasks(
      input.eventEnvelope.code,
      occurredAt,
    )

    for (const taskRecord of candidateTasks) {
      if (
        !this.matchesTaskObjectiveConfig(
          taskRecord.objectiveConfig,
          input.eventEnvelope.context,
        )
      ) {
        continue
      }

      result.matchedTaskIds.push(taskRecord.id)
      const assignmentResult = await this.advanceAssignmentByEvent({
        taskRecord,
        userId: input.eventEnvelope.subjectId,
        eventEnvelope: input.eventEnvelope,
        eventBizKey: input.bizKey,
        occurredAt,
      })

      if (!assignmentResult.assignmentId) {
        continue
      }
      if (assignmentResult.duplicate) {
        result.duplicateAssignmentIds.push(assignmentResult.assignmentId)
        continue
      }
      if (assignmentResult.completed) {
        result.completedAssignmentIds.push(assignmentResult.assignmentId)
        continue
      }
      if (assignmentResult.progressed) {
        result.progressedAssignmentIds.push(assignmentResult.assignmentId)
      }
    }

    return result
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
    await this.drizzle.withTransaction(async (tx) =>
      this.expireAssignmentsByWhere(tx, {
        now,
        whereClause: lte(this.taskAssignmentTable.expiredAt, now),
      }),
    )
  }

  /**
   * 已完成任务奖励补偿（定时任务）
   *
   * 周期性扫描已完成但奖励尚未结算成功的 assignment，基于 assignment 快照重试结算，
   * 避免任务下线、过期或配置变更后失去补偿入口。
   */
  @Cron('30 */5 * * * *')
  async retryCompletedAssignmentRewards() {
    await this.retryCompletedAssignmentRewardsBatch(100)
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
        code: this.taskTable.code,
        title: this.taskTable.title,
        type: this.taskTable.type,
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
        .filter(
          (
            item,
          ): item is typeof item & { expiredAt: Date } => Boolean(item.expiredAt),
        )
        .map((item) =>
          this.taskNotificationService.createExpiringSoonReminderEvent({
            bizKey: this.taskNotificationService.buildExpiringSoonReminderBizKey(
              item.assignmentId,
            ),
            receiverUserId: item.userId,
            task: {
              id: item.taskId,
              code: item.code,
              title: item.title,
              type: item.type,
            },
            cycleKey: item.cycleKey,
            assignmentId: item.assignmentId,
            expiredAt: item.expiredAt,
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
   * 校验任务目标次数。
   *
   * 任务目标是状态机判定的核心边界，必须始终保持为正整数。
   */
  private ensurePositiveTaskTargetCount(value?: number) {
    if (value === undefined) {
      return
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException('targetCount 必须是大于 0 的整数')
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
   * 解析并校验任务重复规则。
   * 当前仅支持 type=once/daily/weekly/monthly，传 null 表示清空为一次性任务。
   */
  private parseTaskRepeatRule(
    value?: string | Record<string, unknown> | null,
  ): TaskRepeatRuleConfig | null | undefined {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const parsed = this.parseJsonValue(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('repeatRule 必须是 JSON 对象')
    }

    const type = parsed.type
    if (!Object.values(TaskRepeatTypeEnum).includes(type as TaskRepeatTypeEnum)) {
      throw new BadRequestException(
        'repeatRule.type 仅支持 once、daily、weekly、monthly',
      )
    }

    const rawTimezone = parsed.timezone
    if (rawTimezone !== undefined && rawTimezone !== null) {
      if (typeof rawTimezone !== 'string' || rawTimezone.trim() === '') {
        throw new BadRequestException('repeatRule.timezone 必须是非空字符串')
      }
      if (!this.normalizeTaskTimezone(rawTimezone)) {
        throw new BadRequestException(
          'repeatRule.timezone 必须是合法的 IANA 时区标识',
        )
      }
    }

    return {
      type: type as TaskRepeatTypeEnum,
      timezone:
        typeof rawTimezone === 'string' && rawTimezone.trim() !== ''
          ? rawTimezone.trim()
          : undefined,
    }
  }

  /**
   * 解析任务目标附加配置。
   * 当前仅允许 JSON 对象或 null。
   */
  private parseTaskObjectiveConfig(
    value?: string | Record<string, unknown> | null,
  ) {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const parsed = this.parseJsonValue(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('objectiveConfig 必须是 JSON 对象')
    }
    return parsed
  }

  /**
   * 归一化并校验任务目标类型。
   */
  private parseTaskObjectiveType(value?: number | null) {
    if (value === undefined || value === null) {
      return TaskObjectiveTypeEnum.MANUAL
    }
    if (!Object.values(TaskObjectiveTypeEnum).includes(value)) {
      throw new BadRequestException('objectiveType 仅支持 MANUAL、EVENT_COUNT')
    }
    return value
  }

  /**
   * 归一化并校验目标事件编码。
   */
  private parseTaskEventCode(value?: number | string | null) {
    if (value === undefined || value === '') {
      return undefined
    }
    if (value === null) {
      return null
    }

    const numericValue =
      typeof value === 'string' ? Number.parseInt(value, 10) : value
    if (!Number.isInteger(numericValue)) {
      throw new BadRequestException('eventCode 必须是合法的事件编码')
    }
    if (!GROWTH_RULE_TYPE_VALUES.includes(numericValue as GrowthRuleTypeEnum)) {
      throw new BadRequestException('eventCode 不是受支持的成长事件编码')
    }
    return numericValue as GrowthRuleTypeEnum
  }

  /**
   * 校验任务目标模型合同。
   */
  private ensureTaskObjectiveContract(params: {
    objectiveType: TaskObjectiveTypeEnum
    eventCode?: GrowthRuleTypeEnum | null
    objectiveConfig?: Record<string, unknown> | null
  }) {
    if (params.objectiveType === TaskObjectiveTypeEnum.MANUAL) {
      if (params.eventCode !== undefined && params.eventCode !== null) {
        throw new BadRequestException(
          'MANUAL 任务不能配置 eventCode，请改为 EVENT_COUNT 或清空 eventCode',
        )
      }
      if (params.objectiveConfig !== undefined && params.objectiveConfig !== null) {
        throw new BadRequestException(
          'MANUAL 任务不能配置 objectiveConfig，请改为 EVENT_COUNT 或清空 objectiveConfig',
        )
      }
      return
    }

    if (params.eventCode === undefined || params.eventCode === null) {
      throw new BadRequestException('EVENT_COUNT 任务必须配置 eventCode')
    }
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
   * @param type 任务场景类型（可选）
   * @returns 查询条件
   */
  private buildAvailableWhere(
    type?: TaskSelect['type'],
    claimMode?: TaskSelect['claimMode'],
    now = new Date(),
  ): SQL | undefined {
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
      conditions.push(
        inArray(this.taskTable.type, getTaskTypeFilterValues(type)),
      )
    }
    if (claimMode !== undefined) {
      conditions.push(eq(this.taskTable.claimMode, claimMode))
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
   * 根据事件编码查找当前可消费的事件型任务。
   * 事件推进仍受发布时间窗口约束，但统一以事件发生时间判断是否命中当前发布实例。
   */
  private async findEventProgressTasks(
    eventCode: GrowthRuleTypeEnum,
    occurredAt: Date,
  ) {
    const whereClause = and(
      this.buildAvailableWhere(undefined, undefined, occurredAt),
      eq(this.taskTable.objectiveType, TaskObjectiveTypeEnum.EVENT_COUNT),
      eq(this.taskTable.eventCode, eventCode),
    )

    return this.db
      .select()
      .from(this.taskTable)
      .where(whereClause)
      .orderBy(desc(this.taskTable.priority), asc(this.taskTable.id))
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
    const cycleAnchor = this.getTaskCycleAnchor(taskRecord, now)
    if (type === TaskRepeatTypeEnum.DAILY) {
      return this.formatDate(cycleAnchor)
    }
    if (type === TaskRepeatTypeEnum.WEEKLY) {
      return `week-${this.formatDate(this.getWeekStart(cycleAnchor))}`
    }
    if (type === TaskRepeatTypeEnum.MONTHLY) {
      return cycleAnchor.format('YYYY-MM')
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
   * 已有进行中 assignment 时，阻止修改会改写存量任务语义的关键配置。
   */
  private async assertNoActiveAssignmentConfigMutation(
    taskRecord: Pick<
      TaskSelect,
      | 'id'
      | 'repeatRule'
      | 'completeMode'
      | 'publishStartAt'
      | 'publishEndAt'
      | 'objectiveType'
      | 'eventCode'
      | 'objectiveConfig'
    >,
    dto: UpdateTaskInput,
    repeatRule: TaskRepeatRuleConfig | null | undefined,
    objectiveType: TaskObjectiveTypeEnum,
  ) {
    const nextRepeatType =
      dto.repeatRule !== undefined
        ? this.getTaskRepeatType({ repeatRule: repeatRule ?? null })
        : this.getTaskRepeatType(taskRecord)
    const repeatRuleChanged =
      dto.repeatRule !== undefined
      && nextRepeatType !== this.getTaskRepeatType(taskRecord)
    const completeModeChanged =
      dto.completeMode !== undefined
      && dto.completeMode !== taskRecord.completeMode
    const objectiveTypeChanged =
      dto.objectiveType !== undefined
      && objectiveType !== normalizeTaskObjectiveType(taskRecord.objectiveType)
    const eventCodeChanged =
      dto.eventCode !== undefined
      && (dto.eventCode ?? null) !== (taskRecord.eventCode ?? null)
    const objectiveConfigChanged =
      dto.objectiveConfig !== undefined
      && JSON.stringify(
          this.asRecord(dto.objectiveConfig) ?? dto.objectiveConfig ?? null,
        )
        !== JSON.stringify(this.asRecord(taskRecord.objectiveConfig) ?? taskRecord.objectiveConfig ?? null)
    const publishWindowChanged =
      (dto.publishStartAt !== undefined
        && !this.isSameNullableDate(
          dto.publishStartAt ?? null,
          taskRecord.publishStartAt ?? null,
        ))
        || (dto.publishEndAt !== undefined
          && !this.isSameNullableDate(
          dto.publishEndAt ?? null,
          taskRecord.publishEndAt ?? null,
        ))

    if (
      !repeatRuleChanged
      && !completeModeChanged
      && !objectiveTypeChanged
      && !eventCodeChanged
      && !objectiveConfigChanged
      && !publishWindowChanged
    ) {
      return
    }

    const [activeAssignment] = await this.db
      .select({ id: this.taskAssignmentTable.id })
      .from(this.taskAssignmentTable)
      .where(
        and(
          eq(this.taskAssignmentTable.taskId, taskRecord.id),
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.status, [
            TaskAssignmentStatusEnum.PENDING,
            TaskAssignmentStatusEnum.IN_PROGRESS,
          ]),
        ),
      )
      .limit(1)

    if (!activeAssignment) {
      return
    }

    const blockedFields: string[] = []
    if (repeatRuleChanged) {
      blockedFields.push('周期规则')
    }
    if (completeModeChanged) {
      blockedFields.push('完成方式')
    }
    if (objectiveTypeChanged || eventCodeChanged || objectiveConfigChanged) {
      blockedFields.push('任务目标')
    }
    if (publishWindowChanged) {
      blockedFields.push('发布时间窗口')
    }

    throw new BadRequestException(
      `存在进行中的任务分配，不能修改${blockedFields.join('和')}`,
    )
  }

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   *
   * @param date 日期对象
   * @returns 格式化的日期字符串
   */
  private formatDate(date: Dayjs): string {
    return date.format('YYYY-MM-DD')
  }

  /**
   * 获取周起始日期（周一）
   *
   * @param date 日期对象
   * @returns 该周周一的日期对象
   */
  private getWeekStart(date: Dayjs): Dayjs {
    return date.startOf('day').subtract(date.isoWeekday() - 1, 'day')
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
   * @param taskRecord.type 任务场景类型
   * @param taskRecord.objectiveType 任务目标类型
   * @param taskRecord.eventCode 目标事件编码
   * @param taskRecord.rewardConfig 奖励配置
   * @param taskRecord.targetCount 目标数量
   * @returns 任务快照对象
   */
  private buildTaskSnapshot(taskRecord: TaskSnapshotSource) {
    return {
      id: taskRecord.id,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description,
      cover: taskRecord.cover,
      type: normalizeTaskType(taskRecord.type),
      claimMode: taskRecord.claimMode,
      completeMode: taskRecord.completeMode,
      objectiveType: normalizeTaskObjectiveType(taskRecord.objectiveType),
      eventCode: taskRecord.eventCode ?? null,
      objectiveConfig: taskRecord.objectiveConfig ?? null,
      repeatRule: taskRecord.repeatRule,
      publishStartAt: taskRecord.publishStartAt,
      publishEndAt: taskRecord.publishEndAt,
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
   * 统一关闭命中条件的活跃 assignment，并补写 EXPIRE 审计日志。
   */
  private async expireAssignmentsByWhere(
    db: Db,
    params: {
      now: Date
      whereClause: SQL
      overrideExpiredAt?: Date
    },
  ) {
    const expiredAssignments = await db
      .update(this.taskAssignmentTable)
      .set({
        status: TaskAssignmentStatusEnum.EXPIRED,
        expiredAt: params.overrideExpiredAt ?? undefined,
        version: sql`${this.taskAssignmentTable.version} + 1`,
      })
      .where(
        and(
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.status, [
            TaskAssignmentStatusEnum.PENDING,
            TaskAssignmentStatusEnum.IN_PROGRESS,
          ]),
          params.whereClause,
        ),
      )
      .returning({
        assignmentId: this.taskAssignmentTable.id,
        userId: this.taskAssignmentTable.userId,
        progress: this.taskAssignmentTable.progress,
      })

    if (expiredAssignments.length === 0) {
      return 0
    }

    await db.insert(this.taskProgressLogTable).values(
      expiredAssignments.map((assignment) => ({
        ...this.buildTaskProgressLogRecord({
          assignmentId: assignment.assignmentId,
          userId: assignment.userId,
          actionType: TaskProgressActionTypeEnum.EXPIRE,
          progressSource: TaskProgressSourceEnum.SYSTEM,
          delta: 0,
          beforeValue: assignment.progress,
          afterValue: assignment.progress,
        }),
      })),
    )

    return expiredAssignments.length
  }

  /**
   * 用户查询“我的任务”前，先即时收口本用户已过期但尚未被 cron 处理的 assignment。
   */
  private async expireDueAssignmentsForUser(userId: number, now: Date) {
    await this.drizzle.withTransaction(async (tx) =>
      this.expireAssignmentsByWhere(tx, {
        now,
        whereClause:
          and(
            eq(this.taskAssignmentTable.userId, userId),
            lte(this.taskAssignmentTable.expiredAt, now),
          )!,
      }),
    )
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
    options?: {
      notifyAutoAssignment?: boolean
      progressSource?: TaskProgressSourceEnum
    },
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
        await tx.insert(this.taskProgressLogTable).values(
          this.buildTaskProgressLogRecord({
            assignmentId: insertedAssignment.id,
            userId,
            actionType: TaskProgressActionTypeEnum.CLAIM,
            progressSource:
              options?.progressSource
              ?? (taskRecord.claimMode === TaskClaimModeEnum.AUTO
                ? TaskProgressSourceEnum.SYSTEM
                : TaskProgressSourceEnum.MANUAL),
            delta: 0,
            beforeValue: 0,
            afterValue: 0,
          }),
        )
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

    if (
      createdAssignment
      && taskRecord.claimMode === TaskClaimModeEnum.AUTO
      && options?.notifyAutoAssignment !== false
    ) {
      await this.tryNotifyAutoAssignedTask(
        userId,
        taskRecord,
        assignment,
        cycleKey,
      )
    }

    return assignment
  }

  private buildTaskProgressLogRecord(params: {
    assignmentId: number
    userId: number
    actionType: TaskProgressActionTypeEnum
    progressSource: TaskProgressSourceEnum
    delta: number
    beforeValue: number
    afterValue: number
    context?: unknown
    eventCode?: GrowthRuleTypeEnum | null
    eventBizKey?: string | null
    eventOccurredAt?: Date | null
  }) {
    return {
      assignmentId: params.assignmentId,
      userId: params.userId,
      actionType: params.actionType,
      progressSource: params.progressSource,
      delta: params.delta,
      beforeValue: params.beforeValue,
      afterValue: params.afterValue,
      eventCode: params.eventCode ?? null,
      eventBizKey: params.eventBizKey ?? null,
      eventOccurredAt: params.eventOccurredAt ?? null,
      context: params.context,
    }
  }

  private buildTaskEventProgressContext(
    eventEnvelope: TaskEventProgressInput['eventEnvelope'],
    bizKey: string,
  ) {
    return {
      ...(eventEnvelope.context ?? {}),
      eventCode: eventEnvelope.code,
      eventKey: eventEnvelope.key,
      eventBizKey: bizKey,
      eventSubjectId: eventEnvelope.subjectId,
      eventOperatorId: eventEnvelope.operatorId,
      governanceStatus: eventEnvelope.governanceStatus,
      occurredAt: eventEnvelope.occurredAt.toISOString(),
    }
  }

  private matchesTaskObjectiveConfig(
    objectiveConfig: unknown,
    eventContext?: Record<string, unknown>,
  ) {
    const normalizedObjectiveConfig = this.asRecord(objectiveConfig)
    if (!normalizedObjectiveConfig) {
      return true
    }

    const normalizedEventContext = eventContext ?? {}
    return Object.entries(normalizedObjectiveConfig).every(([key, value]) =>
      JSON.stringify(normalizedEventContext[key]) === JSON.stringify(value),
    )
  }

  private async advanceAssignmentByEvent(params: {
    taskRecord: TaskSelect
    userId: number
    eventEnvelope: TaskEventProgressInput['eventEnvelope']
    eventBizKey: string
    occurredAt: Date
  }) {
    const cycleKey = this.buildCycleKey(params.taskRecord, params.occurredAt)
    let assignment = await this.findAssignmentByUniqueKey(
      params.taskRecord.id,
      params.userId,
      cycleKey,
    )

    if (!assignment) {
      if (params.taskRecord.claimMode !== TaskClaimModeEnum.AUTO) {
        return { assignmentId: undefined, progressed: false, completed: false, duplicate: false }
      }

      assignment = await this.createOrGetAssignment(
        params.taskRecord,
        params.userId,
        cycleKey,
        params.occurredAt,
        {
          notifyAutoAssignment: false,
          progressSource: TaskProgressSourceEnum.EVENT,
        },
      )
    }

    if (assignment.status === TaskAssignmentStatusEnum.COMPLETED) {
      await this.settleCompletedAssignmentRewardIfNeeded(
        params.userId,
        this.buildTaskRewardTaskRecord(params.taskRecord.id, params.taskRecord, assignment),
        assignment,
      )
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    if (assignment.status === TaskAssignmentStatusEnum.EXPIRED) {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    if (
      params.taskRecord.claimMode === TaskClaimModeEnum.MANUAL
      && assignment.claimedAt
      && params.occurredAt.getTime() < assignment.claimedAt.getTime()
    ) {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    const nextProgress = Math.min(assignment.target, assignment.progress + 1)
    const shouldAutoComplete =
      params.taskRecord.completeMode === TaskCompleteModeEnum.AUTO
      && nextProgress >= assignment.target
    if (!shouldAutoComplete && nextProgress <= assignment.progress) {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: false,
      }
    }

    const nextStatus =
      shouldAutoComplete
        ? TaskAssignmentStatusEnum.COMPLETED
        : TaskAssignmentStatusEnum.IN_PROGRESS
    const eventContext = this.buildTaskEventProgressContext(
      params.eventEnvelope,
      params.eventBizKey,
    )
    const eventApplied = await this.applyAssignmentEventProgress({
      assignment,
      userId: params.userId,
      nextProgress,
      nextStatus,
      eventCode: params.eventEnvelope.code,
      eventBizKey: params.eventBizKey,
      eventOccurredAt: params.occurredAt,
      context: eventContext,
    })

    if (eventApplied === 'duplicate') {
      return {
        assignmentId: assignment.id,
        progressed: false,
        completed: false,
        duplicate: true,
      }
    }

    if (
      assignment.status !== TaskAssignmentStatusEnum.COMPLETED
      && nextStatus === TaskAssignmentStatusEnum.COMPLETED
    ) {
      await this.emitTaskCompleteEvent(
        params.userId,
        this.buildTaskRewardTaskRecord(params.taskRecord.id, params.taskRecord, assignment),
        {
          ...assignment,
          completedAt: params.occurredAt,
        },
      )
    }

    return {
      assignmentId: assignment.id,
      progressed: nextStatus !== TaskAssignmentStatusEnum.COMPLETED,
      completed: nextStatus === TaskAssignmentStatusEnum.COMPLETED,
      duplicate: false,
    }
  }

  private async applyAssignmentEventProgress(params: {
    assignment: TaskAssignmentSelect
    userId: number
    nextProgress: number
    nextStatus: TaskAssignmentStatusEnum
    eventCode: GrowthRuleTypeEnum
    eventBizKey: string
    eventOccurredAt: Date
    context: Record<string, unknown>
  }) {
    return this.drizzle.withTransaction(async (tx) => {
      const [insertedLog] = await tx
        .insert(this.taskProgressLogTable)
        .values(
          this.buildTaskProgressLogRecord({
            assignmentId: params.assignment.id,
            userId: params.userId,
            actionType:
              params.nextStatus === TaskAssignmentStatusEnum.COMPLETED
                ? TaskProgressActionTypeEnum.COMPLETE
                : TaskProgressActionTypeEnum.PROGRESS,
            progressSource: TaskProgressSourceEnum.EVENT,
            delta: Math.max(0, params.nextProgress - params.assignment.progress),
            beforeValue: params.assignment.progress,
            afterValue: params.nextProgress,
            eventCode: params.eventCode,
            eventBizKey: params.eventBizKey,
            eventOccurredAt: params.eventOccurredAt,
            context: params.context,
          }),
        )
        .onConflictDoNothing({
          target: [
            this.taskProgressLogTable.assignmentId,
            this.taskProgressLogTable.eventBizKey,
          ],
        })
        .returning({ id: this.taskProgressLogTable.id })

      if (!insertedLog) {
        return 'duplicate' as const
      }

      const updateResult = await tx
        .update(this.taskAssignmentTable)
        .set({
          progress: params.nextProgress,
          status: params.nextStatus,
          completedAt:
            params.nextStatus === TaskAssignmentStatusEnum.COMPLETED
              ? params.eventOccurredAt
              : undefined,
          context: params.context,
          version: sql`${this.taskAssignmentTable.version} + 1`,
        })
        .where(
          and(
            eq(this.taskAssignmentTable.id, params.assignment.id),
            eq(this.taskAssignmentTable.version, params.assignment.version),
          ),
        )

      if ((updateResult.rowCount ?? 0) === 0) {
        throw new ConflictException('任务事件推进冲突，请重试')
      }

      return 'applied' as const
    })
  }

  /**
   * 从候选任务中过滤掉当前周期已领取的记录。
   *
   * “可领取任务”列表只应展示当前周期尚未生成 assignment 的手动任务。
   */
  private async filterClaimableTasksForUser(
    tasks: TaskSelect[],
    userId: number,
    now: Date,
  ) {
    if (tasks.length === 0) {
      return tasks
    }

    const cycleKeyByTaskId = new Map<number, string>()
    for (const taskRecord of tasks) {
      cycleKeyByTaskId.set(taskRecord.id, this.buildCycleKey(taskRecord, now))
    }

    const taskIds = tasks.map((taskRecord) => taskRecord.id)
    const cycleKeys = [...new Set(cycleKeyByTaskId.values())]
    const existingAssignments = await this.db
      .select({
        taskId: this.taskAssignmentTable.taskId,
        cycleKey: this.taskAssignmentTable.cycleKey,
      })
      .from(this.taskAssignmentTable)
      .where(
        and(
          eq(this.taskAssignmentTable.userId, userId),
          isNull(this.taskAssignmentTable.deletedAt),
          inArray(this.taskAssignmentTable.taskId, taskIds),
          inArray(this.taskAssignmentTable.cycleKey, cycleKeys),
        ),
      )

    const claimedKeys = new Set(
      existingAssignments.map(
        (assignment) => `${assignment.taskId}:${assignment.cycleKey}`,
      ),
    )

    return tasks.filter((taskRecord) => {
      const cycleKey = cycleKeyByTaskId.get(taskRecord.id)
      return !claimedKeys.has(`${taskRecord.id}:${cycleKey}`)
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
  private async ensureAutoAssignments(
    userId: number,
    tasks: TaskSelect[],
    now: Date,
  ) {
    await Promise.all(
      tasks.map(async (taskRecord) =>
        this.ensureAutoAssignmentByTask(userId, taskRecord, now),
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
  private async ensureAutoAssignmentsForUser(userId: number, now: Date) {
    const where = this.buildAvailableWhere()
    const tasks = await this.db
      .select({
        id: this.taskTable.id,
        code: this.taskTable.code,
        title: this.taskTable.title,
        description: this.taskTable.description,
        cover: this.taskTable.cover,
        type: this.taskTable.type,
        completeMode: this.taskTable.completeMode,
        objectiveType: this.taskTable.objectiveType,
        eventCode: this.taskTable.eventCode,
        objectiveConfig: this.taskTable.objectiveConfig,
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
        this.ensureAutoAssignmentByTask(userId, taskRecord, now),
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
    now = new Date(),
  ) {
    // 非自动领取模式跳过
    if (taskRecord.claimMode !== TaskClaimModeEnum.AUTO) {
      return
    }
    if (this.getTaskAvailabilityError(taskRecord, now)) {
      return
    }
    // 计算周期并创建分配
    const cycleKey = this.buildCycleKey(taskRecord, now)
    await this.createOrGetAssignment(taskRecord, userId, cycleKey, now)
  }

  /**
   * 构建任务奖励结算所需的最小任务视图。
   * 优先使用 assignment 快照，避免 live task 配置变更改写历史结算语义。
   */
  private buildTaskRewardTaskRecord(
    taskId: number,
    currentTask?: {
      code?: string | null
      title?: string | null
      type?: number | null
      rewardConfig?: unknown
    },
    assignment?: {
      taskSnapshot?: TaskAssignmentSelect['taskSnapshot']
    },
  ) {
    const snapshot = this.asRecord(assignment?.taskSnapshot)

    return {
      id: taskId,
      code:
        typeof snapshot?.code === 'string'
          ? snapshot.code
          : (currentTask?.code ?? undefined),
      title:
        typeof snapshot?.title === 'string'
          ? snapshot.title
          : (currentTask?.title ?? undefined),
      type:
        typeof snapshot?.type === 'number'
          ? snapshot.type
          : (currentTask?.type ?? undefined),
      rewardConfig: snapshot?.rewardConfig ?? currentTask?.rewardConfig,
    }
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
        return this.taskNotificationService.createAvailableReminderEvent({
          bizKey: this.taskNotificationService.buildAvailableReminderBizKey(
            taskRecord.id,
            userId,
            cycleKey,
          ),
          receiverUserId: userId,
          task: {
            id: taskRecord.id,
            code: taskRecord.code,
            title: taskRecord.title,
            type: taskRecord.type,
          },
          cycleKey,
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
      code?: string | null
      title: string
      type?: number | null
      claimMode?: number
    },
    assignment: { id: number },
    cycleKey: string,
  ) {
    try {
      await this.messageOutboxService.enqueueNotificationEvent(
        this.taskNotificationService.createAvailableReminderEvent({
          bizKey: this.taskNotificationService.buildAvailableReminderBizKey(
            taskRecord.id,
            userId,
            cycleKey,
          ),
          receiverUserId: userId,
          task: {
            id: taskRecord.id,
            code: taskRecord.code,
            title: taskRecord.title,
            type: taskRecord.type,
          },
          cycleKey,
          claimMode: taskRecord.claimMode,
          assignmentId: assignment.id,
        }),
      )
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
      code?: string | null
      title?: string
      type?: number | null
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
        this.taskNotificationService.createRewardGrantedReminderEvent({
          bizKey: this.taskNotificationService.buildRewardGrantedReminderBizKey(
            assignment.id,
          ),
          receiverUserId: userId,
          task: {
            id: taskRecord.id,
            code: taskRecord.code,
            title: taskRecord.title ?? `任务#${taskRecord.id}`,
            type: taskRecord.type,
          },
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

  private toAppTaskView(taskRecord: Pick<
    TaskSelect,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'code'
    | 'title'
    | 'description'
    | 'cover'
    | 'type'
    | 'priority'
    | 'claimMode'
    | 'completeMode'
    | 'objectiveType'
    | 'eventCode'
    | 'objectiveConfig'
    | 'targetCount'
    | 'rewardConfig'
    | 'publishStartAt'
    | 'publishEndAt'
    | 'repeatRule'
  >) {
    return {
      id: taskRecord.id,
      createdAt: taskRecord.createdAt,
      updatedAt: taskRecord.updatedAt,
      code: taskRecord.code,
      title: taskRecord.title,
      description: taskRecord.description,
      cover: taskRecord.cover,
      type: normalizeTaskType(taskRecord.type),
      priority: taskRecord.priority,
      claimMode: taskRecord.claimMode,
      completeMode: taskRecord.completeMode,
      objectiveType: normalizeTaskObjectiveType(taskRecord.objectiveType),
      eventCode: taskRecord.eventCode,
      objectiveConfig: taskRecord.objectiveConfig,
      targetCount: taskRecord.targetCount,
      rewardConfig: taskRecord.rewardConfig,
      publishStartAt: taskRecord.publishStartAt,
      publishEndAt: taskRecord.publishEndAt,
      repeatRule: taskRecord.repeatRule,
      visibleStatus: TaskUserVisibleStatusEnum.CLAIMABLE,
    }
  }

  private toAppMyTaskView(
    item: TaskAssignmentSelect & {
      task?: {
        id: number | null
        code?: string | null
        title: string | null
        description?: string | null
        cover?: string | null
        type: number | null
        objectiveType?: number | null
        eventCode?: number | null
        objectiveConfig?: unknown
        rewardConfig: unknown
        targetCount?: number | null
        completeMode?: number | null
        claimMode?: number | null
      } | null
    },
  ) {
    const taskView = this.buildAssignmentTaskView(item)
    return {
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      taskId: item.taskId,
      cycleKey: item.cycleKey,
      status: item.status,
      rewardStatus: item.rewardStatus,
      rewardResultType: item.rewardResultType,
      progress: item.progress,
      target: item.target,
      claimedAt: item.claimedAt,
      completedAt: item.completedAt,
      expiredAt: item.expiredAt,
      rewardSettledAt: item.rewardSettledAt,
      rewardLedgerIds: item.rewardLedgerIds,
      lastRewardError: item.lastRewardError,
      visibleStatus: this.resolveTaskUserVisibleStatus({
        status: item.status,
        rewardStatus: item.rewardStatus,
        rewardConfig: taskView?.rewardConfig,
      }),
      task: taskView,
    }
  }

  private toAdminTaskView(
    taskRecord: TaskSelect,
    runtimeHealth?: {
      activeAssignmentCount: number
      pendingRewardCompensationCount: number
      latestReminder?: {
        reminderKind?: string
        status: MessageNotificationDispatchStatusEnum
        failureReason?: string | null
        lastAttemptAt: Date
        updatedAt: Date
      }
    },
  ) {
    return {
      ...this.normalizeTaskTypeRecord(taskRecord),
      activeAssignmentCount: runtimeHealth?.activeAssignmentCount ?? 0,
      pendingRewardCompensationCount:
        runtimeHealth?.pendingRewardCompensationCount ?? 0,
      latestReminder: runtimeHealth?.latestReminder ?? null,
    }
  }

  private toAdminTaskAssignmentView(
    item: TaskAssignmentSelect & {
      task?: {
        id: number | null
        code?: string | null
        title: string | null
        description?: string | null
        cover?: string | null
        type: number | null
        objectiveType?: number | null
        eventCode?: number | null
        objectiveConfig?: unknown
        rewardConfig: unknown
        targetCount?: number | null
        completeMode?: number | null
        claimMode?: number | null
      } | null
    },
  ) {
    const taskView = this.buildAssignmentTaskView(item)
    return {
      ...item,
      visibleStatus: this.resolveTaskUserVisibleStatus({
        status: item.status,
        rewardStatus: item.rewardStatus,
        rewardConfig: taskView?.rewardConfig,
      }),
      task: taskView,
    }
  }

  private normalizeTaskTypeRecord<T extends { type: number | null }>(record: T) {
    return {
      ...record,
      type: normalizeTaskType(record.type),
      objectiveType: normalizeTaskObjectiveType(
        (record as { objectiveType?: number | null }).objectiveType,
      ),
    }
  }

  private normalizeTaskRelation(record: {
    id: number | null
    code?: string | null
    title: string | null
    description?: string | null
    cover?: string | null
    type: number | null
    objectiveType?: number | null
    eventCode?: number | null
    objectiveConfig?: unknown
    rewardConfig: unknown
    targetCount?: number | null
    completeMode?: number | null
    claimMode?: number | null
  }) {
    return {
      ...record,
      type: normalizeTaskType(record.type),
      objectiveType: normalizeTaskObjectiveType(record.objectiveType),
    }
  }

  private buildAssignmentTaskView(
    item: TaskAssignmentSelect & {
      task?: {
        id: number | null
        code?: string | null
        title: string | null
        description?: string | null
        cover?: string | null
        type: number | null
        objectiveType?: number | null
        eventCode?: number | null
        objectiveConfig?: unknown
        rewardConfig: unknown
        targetCount?: number | null
        completeMode?: number | null
        claimMode?: number | null
      } | null
    },
  ) {
    const snapshot = this.asRecord(item.taskSnapshot)
    const liveTask = item.task ? this.normalizeTaskRelation(item.task) : null
    const taskId =
      this.readSnapshotPositiveInt(snapshot?.id)
      ?? liveTask?.id
      ?? item.taskId

    if (!taskId) {
      return null
    }

    return {
      id: taskId,
      code:
        this.readSnapshotString(snapshot?.code)
        ?? liveTask?.code
        ?? `task-${taskId}`,
      title:
        this.readSnapshotString(snapshot?.title)
        ?? liveTask?.title
        ?? `任务#${taskId}`,
      description:
        this.readSnapshotString(snapshot?.description)
        ?? liveTask?.description
        ?? null,
      cover:
        this.readSnapshotString(snapshot?.cover) ?? liveTask?.cover ?? null,
      type: normalizeTaskType(
        this.readSnapshotPositiveInt(snapshot?.type) ?? liveTask?.type,
      ),
      objectiveType: normalizeTaskObjectiveType(
        this.readSnapshotPositiveInt(snapshot?.objectiveType)
        ?? liveTask?.objectiveType,
      ),
      eventCode:
        this.readSnapshotPositiveInt(snapshot?.eventCode)
        ?? liveTask?.eventCode
        ?? null,
      objectiveConfig:
        snapshot?.objectiveConfig ?? liveTask?.objectiveConfig ?? null,
      rewardConfig: snapshot?.rewardConfig ?? liveTask?.rewardConfig ?? null,
      targetCount:
        this.readSnapshotPositiveInt(snapshot?.targetCount)
        ?? liveTask?.targetCount
        ?? item.target,
      completeMode:
        this.readSnapshotPositiveInt(snapshot?.completeMode)
        ?? liveTask?.completeMode
        ?? TaskCompleteModeEnum.MANUAL,
      claimMode:
        this.readSnapshotPositiveInt(snapshot?.claimMode)
        ?? liveTask?.claimMode
        ?? TaskClaimModeEnum.MANUAL,
    }
  }

  private resolveTaskUserVisibleStatus(params: {
    status: TaskAssignmentSelect['status']
    rewardStatus?: TaskAssignmentSelect['rewardStatus'] | null
    rewardConfig?: unknown
  }) {
    if (params.status === TaskAssignmentStatusEnum.EXPIRED) {
      return TaskUserVisibleStatusEnum.EXPIRED
    }
    if (params.status === TaskAssignmentStatusEnum.IN_PROGRESS) {
      return TaskUserVisibleStatusEnum.IN_PROGRESS
    }
    if (params.status === TaskAssignmentStatusEnum.PENDING) {
      return TaskUserVisibleStatusEnum.CLAIMED
    }
    if (params.status === TaskAssignmentStatusEnum.COMPLETED) {
      if (!this.hasConfiguredTaskReward(params.rewardConfig)) {
        return TaskUserVisibleStatusEnum.COMPLETED
      }
      return params.rewardStatus === TaskAssignmentRewardStatusEnum.SUCCESS
        ? TaskUserVisibleStatusEnum.REWARD_GRANTED
        : TaskUserVisibleStatusEnum.REWARD_PENDING
    }
    return TaskUserVisibleStatusEnum.UNAVAILABLE
  }

  private async getTaskRuntimeHealthMap(taskIds: number[]) {
    const uniqueTaskIds = [...new Set(taskIds.filter((id) => id > 0))]
    if (uniqueTaskIds.length === 0) {
      return new Map<number, {
        activeAssignmentCount: number
        pendingRewardCompensationCount: number
        latestReminder?: {
          reminderKind?: string
          status: MessageNotificationDispatchStatusEnum
          failureReason?: string | null
          lastAttemptAt: Date
          updatedAt: Date
        }
      }>()
    }

    const [activeRows, rewardPendingRows, reminderRows] = await Promise.all([
      this.db
        .select({
          taskId: this.taskAssignmentTable.taskId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(this.taskAssignmentTable)
        .where(
          and(
            isNull(this.taskAssignmentTable.deletedAt),
            inArray(this.taskAssignmentTable.taskId, uniqueTaskIds),
            inArray(this.taskAssignmentTable.status, [
              TaskAssignmentStatusEnum.PENDING,
              TaskAssignmentStatusEnum.IN_PROGRESS,
              TaskAssignmentStatusEnum.COMPLETED,
            ]),
          ),
        )
        .groupBy(this.taskAssignmentTable.taskId),
      this.db
        .select({
          taskId: this.taskAssignmentTable.taskId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(this.taskAssignmentTable)
        .where(
          and(
            isNull(this.taskAssignmentTable.deletedAt),
            inArray(this.taskAssignmentTable.taskId, uniqueTaskIds),
            eq(
              this.taskAssignmentTable.status,
              TaskAssignmentStatusEnum.COMPLETED,
            ),
            inArray(this.taskAssignmentTable.rewardStatus, [
              TaskAssignmentRewardStatusEnum.PENDING,
              TaskAssignmentRewardStatusEnum.FAILED,
            ]),
          ),
        )
        .groupBy(this.taskAssignmentTable.taskId),
      this.queryLatestTaskReminderRows(uniqueTaskIds),
    ])

    const runtimeMap = new Map<number, {
      activeAssignmentCount: number
      pendingRewardCompensationCount: number
      latestReminder?: {
        reminderKind?: string
        status: MessageNotificationDispatchStatusEnum
        failureReason?: string | null
        lastAttemptAt: Date
        updatedAt: Date
      }
    }>()

    for (const taskId of uniqueTaskIds) {
      runtimeMap.set(taskId, {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      })
    }

    for (const row of activeRows) {
      const current = runtimeMap.get(row.taskId) ?? {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      }
      runtimeMap.set(row.taskId, {
        ...current,
        activeAssignmentCount: Number(row.count ?? 0),
      })
    }

    for (const row of rewardPendingRows) {
      const current = runtimeMap.get(row.taskId) ?? {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      }
      runtimeMap.set(row.taskId, {
        ...current,
        pendingRewardCompensationCount: Number(row.count ?? 0),
      })
    }

    for (const row of reminderRows) {
      if (!runtimeMap.has(row.taskId)) {
        continue
      }
      const current = runtimeMap.get(row.taskId) ?? {
        activeAssignmentCount: 0,
        pendingRewardCompensationCount: 0,
      }
      runtimeMap.set(row.taskId, {
        ...current,
        latestReminder: {
          reminderKind: row.reminderKind ?? undefined,
          status: row.status,
          failureReason: row.failureReason ?? undefined,
          lastAttemptAt: row.lastAttemptAt,
          updatedAt: row.updatedAt,
        },
      })
    }

    return runtimeMap
  }

  private async queryLatestTaskReminderRows(taskIds: number[]) {
    const taskIdSql =
      sql<number>`(${this.messageOutboxTable.payload} -> 'payload' ->> 'taskId')::int`
    const reminderKindSql =
      sql<string | null>`${this.messageOutboxTable.payload} -> 'payload' ->> 'reminderKind'`

    const rows = await this.db
      .select({
        taskId: taskIdSql,
        reminderKind: reminderKindSql,
        status: this.notificationDeliveryTable.status,
        failureReason: this.notificationDeliveryTable.failureReason,
        lastAttemptAt: this.notificationDeliveryTable.lastAttemptAt,
        updatedAt: this.notificationDeliveryTable.updatedAt,
      })
      .from(this.notificationDeliveryTable)
      .leftJoin(
        this.messageOutboxTable,
        eq(this.notificationDeliveryTable.outboxId, this.messageOutboxTable.id),
      )
      .where(
        and(
          eq(
            this.notificationDeliveryTable.notificationType,
            MessageNotificationTypeEnum.TASK_REMINDER,
          ),
          inArray(taskIdSql, taskIds),
        ),
      )
      .orderBy(
        desc(this.notificationDeliveryTable.updatedAt),
        desc(this.notificationDeliveryTable.id),
      )

    const latestRows: Array<{
      taskId: number
      reminderKind: string | null
      status: MessageNotificationDispatchStatusEnum
      failureReason: string | null
      lastAttemptAt: Date
      updatedAt: Date
    }> = []
    const seenTaskIds = new Set<number>()

    for (const row of rows) {
      if (!row.taskId || seenTaskIds.has(row.taskId)) {
        continue
      }
      seenTaskIds.add(row.taskId)
      latestRows.push({
        taskId: row.taskId,
        reminderKind: row.reminderKind,
        status: row.status as MessageNotificationDispatchStatusEnum,
        failureReason: row.failureReason,
        lastAttemptAt: row.lastAttemptAt,
        updatedAt: row.updatedAt,
      })
    }

    return latestRows
  }

  private async queryAssignmentIdsByEventFilter(
    queryDto: Pick<
      QueryTaskAssignmentReconciliationPageInput,
      'eventCode' | 'eventBizKey'
    >,
  ) {
    if (queryDto.eventCode === undefined && !queryDto.eventBizKey?.trim()) {
      return undefined
    }

    const conditions: SQL[] = []
    if (queryDto.eventCode !== undefined) {
      conditions.push(eq(this.taskProgressLogTable.eventCode, queryDto.eventCode))
    }
    if (queryDto.eventBizKey?.trim()) {
      conditions.push(eq(this.taskProgressLogTable.eventBizKey, queryDto.eventBizKey.trim()))
    }

    const rows = await this.db
      .select({ assignmentId: this.taskProgressLogTable.assignmentId })
      .from(this.taskProgressLogTable)
      .where(and(...conditions))

    return [...new Set(rows.map((item) => item.assignmentId))]
  }

  private async queryAssignmentIdsByRewardReminderFilter(
    queryDto: Pick<
      QueryTaskAssignmentReconciliationPageInput,
      'notificationStatus'
    >,
  ) {
    if (queryDto.notificationStatus === undefined) {
      return undefined
    }

    const assignmentIdSql =
      sql<number>`(${this.messageOutboxTable.payload} -> 'payload' ->> 'assignmentId')::int`
    const reminderKindSql =
      sql<string | null>`${this.messageOutboxTable.payload} -> 'payload' ->> 'reminderKind'`
    const rows = await this.db
      .select({ assignmentId: assignmentIdSql })
      .from(this.notificationDeliveryTable)
      .leftJoin(
        this.messageOutboxTable,
        eq(this.notificationDeliveryTable.outboxId, this.messageOutboxTable.id),
      )
      .where(
        and(
          eq(
            this.notificationDeliveryTable.notificationType,
            MessageNotificationTypeEnum.TASK_REMINDER,
          ),
          eq(this.notificationDeliveryTable.status, queryDto.notificationStatus),
          eq(reminderKindSql, TaskReminderKindEnum.REWARD_GRANTED),
        ),
      )

    return [...new Set(rows.map((item) => item.assignmentId).filter(Boolean))]
  }

  private async getAssignmentEventProgressMap(assignmentIds: number[]) {
    const uniqueAssignmentIds = [...new Set(assignmentIds.filter((id) => id > 0))]
    if (uniqueAssignmentIds.length === 0) {
      return new Map<number, {
        eventCode: number | null
        eventBizKey: string | null
        eventOccurredAt: Date | null
      }>()
    }

    const rows = await this.db
      .select({
        assignmentId: this.taskProgressLogTable.assignmentId,
        eventCode: this.taskProgressLogTable.eventCode,
        eventBizKey: this.taskProgressLogTable.eventBizKey,
        eventOccurredAt: this.taskProgressLogTable.eventOccurredAt,
        id: this.taskProgressLogTable.id,
      })
      .from(this.taskProgressLogTable)
      .where(
        and(
          inArray(this.taskProgressLogTable.assignmentId, uniqueAssignmentIds),
          sql`${this.taskProgressLogTable.eventCode} IS NOT NULL`,
        ),
      )
      .orderBy(desc(this.taskProgressLogTable.id))

    const result = new Map<number, {
      eventCode: number | null
      eventBizKey: string | null
      eventOccurredAt: Date | null
    }>()
    for (const row of rows) {
      if (result.has(row.assignmentId)) {
        continue
      }
      result.set(row.assignmentId, {
        eventCode: row.eventCode,
        eventBizKey: row.eventBizKey,
        eventOccurredAt: row.eventOccurredAt,
      })
    }
    return result
  }

  private async getAssignmentRewardReminderMap(assignmentIds: number[]) {
    const uniqueAssignmentIds = [...new Set(assignmentIds.filter((id) => id > 0))]
    if (uniqueAssignmentIds.length === 0) {
      return new Map<number, {
        bizKey: string
        status: MessageNotificationDispatchStatusEnum
        failureReason: string | null
        lastAttemptAt: Date
      }>()
    }

    const assignmentIdSql =
      sql<number>`(${this.messageOutboxTable.payload} -> 'payload' ->> 'assignmentId')::int`
    const reminderKindSql =
      sql<string | null>`${this.messageOutboxTable.payload} -> 'payload' ->> 'reminderKind'`
    const rows = await this.db
      .select({
        assignmentId: assignmentIdSql,
        bizKey: this.notificationDeliveryTable.bizKey,
        status: this.notificationDeliveryTable.status,
        failureReason: this.notificationDeliveryTable.failureReason,
        lastAttemptAt: this.notificationDeliveryTable.lastAttemptAt,
        id: this.notificationDeliveryTable.id,
      })
      .from(this.notificationDeliveryTable)
      .leftJoin(
        this.messageOutboxTable,
        eq(this.notificationDeliveryTable.outboxId, this.messageOutboxTable.id),
      )
      .where(
        and(
          eq(
            this.notificationDeliveryTable.notificationType,
            MessageNotificationTypeEnum.TASK_REMINDER,
          ),
          inArray(assignmentIdSql, uniqueAssignmentIds),
          eq(reminderKindSql, TaskReminderKindEnum.REWARD_GRANTED),
        ),
      )
      .orderBy(desc(this.notificationDeliveryTable.id))

    const result = new Map<number, {
      bizKey: string
      status: MessageNotificationDispatchStatusEnum
      failureReason: string | null
      lastAttemptAt: Date
    }>()
    for (const row of rows) {
      if (!row.assignmentId || result.has(row.assignmentId)) {
        continue
      }
      result.set(row.assignmentId, {
        bizKey: row.bizKey,
        status: row.status as MessageNotificationDispatchStatusEnum,
        failureReason: row.failureReason,
        lastAttemptAt: row.lastAttemptAt,
      })
    }
    return result
  }

  private hasConfiguredTaskReward(rewardConfig: unknown) {
    const rewardRecord = this.asRecord(rewardConfig)
    if (!rewardRecord) {
      return false
    }
    return (
      (this.readSnapshotPositiveInt(rewardRecord.points) ?? 0) > 0
      || (this.readSnapshotPositiveInt(rewardRecord.experience) ?? 0) > 0
    )
  }

  private readSnapshotString(value: unknown) {
    return typeof value === 'string' && value.trim() !== '' ? value : undefined
  }

  private readSnapshotPositiveInt(value: unknown) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : undefined
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

  private asRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private normalizeTaskTimezone(timezone?: string | null) {
    if (!timezone || typeof timezone !== 'string') {
      return undefined
    }

    const normalizedTimezone = timezone.trim()
    if (normalizedTimezone === '') {
      return undefined
    }

    try {
      Intl.DateTimeFormat('zh-CN', {
        timeZone: normalizedTimezone,
      })
      return normalizedTimezone
    } catch {
      return undefined
    }
  }

  private getTaskRepeatTimezone(taskRecord: Pick<TaskSelect, 'repeatRule'>) {
    const repeatRule = this.asRecord(taskRecord.repeatRule)
    return this.normalizeTaskTimezone(
      typeof repeatRule?.timezone === 'string' ? repeatRule.timezone : undefined,
    )
    ?? this.defaultTaskTimezone
  }

  private getTaskCycleAnchor(
    taskRecord: Pick<TaskSelect, 'repeatRule'>,
    now: Date,
  ) {
    return dayjs(now).tz(this.getTaskRepeatTimezone(taskRecord))
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

  private isSameNullableDate(left?: Date | null, right?: Date | null) {
    if (!left && !right) {
      return true
    }
    if (!left || !right) {
      return false
    }
    return left.getTime() === right.getTime()
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
    const cycleAnchor = this.getTaskCycleAnchor(taskRecord, now)
    if (repeatType === TaskRepeatTypeEnum.DAILY) {
      return cycleAnchor.startOf('day').add(1, 'day').toDate()
    }
    if (repeatType === TaskRepeatTypeEnum.WEEKLY) {
      return this.getWeekStart(cycleAnchor).add(1, 'week').toDate()
    }
    if (repeatType === TaskRepeatTypeEnum.MONTHLY) {
      return cycleAnchor.startOf('month').add(1, 'month').toDate()
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
