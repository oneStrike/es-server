import type {
  TaskEventProgressInput,
  TaskEventProgressResult,
} from './task.type'
import { DrizzleService } from '@db/core'
import {
  canConsumeEventEnvelopeByConsumer,
  EventDefinitionConsumerEnum,
} from '@libs/growth/event-definition'
import { MessageOutboxService } from '@libs/message/outbox'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import {
  ClaimTaskDto,
  QueryAvailableTaskDto,
  QueryMyTaskDto,
  QueryTaskAssignmentDto,
  QueryTaskAssignmentReconciliationDto,
  TaskCompleteDto,
  TaskProgressDto,
} from './dto/task.dto'
import {
  getTaskTypeFilterValues,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskProgressActionTypeEnum,
  TaskProgressSourceEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务执行服务。
 *
 * 负责任务 assignment 的查询与推进、事件消费、奖励补偿以及执行态对账视图，
 * 是 task 域执行链路的核心编排服务。
 */
@Injectable()
export class TaskExecutionService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 获取当前用户可领取的任务列表。
   *
   * 该查询只返回手动领取任务；自动领取任务会在读链路中补齐 assignment，
   * 但不会混入可领取列表的返回结果。
   */
  async getAvailableTasks(queryDto: QueryAvailableTaskDto, userId: number) {
    const now = new Date()
    const page = this.drizzle.buildPage(queryDto)
    const tasks = await this.db
      .select()
      .from(this.taskTable)
      .where(this.buildAvailableWhere(queryDto.type, TaskClaimModeEnum.MANUAL))
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
   * 获取当前用户的任务列表。
   *
   * 在返回列表前，会先关闭已过期 assignment 并补齐自动领取任务，
   * 确保用户端看到的是当前周期下的稳定状态。
   */
  async getMyTasks(queryDto: QueryMyTaskDto, userId: number) {
    const now = new Date()
    await this.expireDueAssignmentsForUser(userId, now)
    await this.ensureAutoAssignmentsForUser(userId, now)

    const assignmentConditions = [
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
      queryDto.type !== undefined
        ? inArray(this.taskTable.type, getTaskTypeFilterValues(queryDto.type))
        : undefined
    const result = await this.queryTaskAssignmentPage({
      assignmentWhereClause: assignmentWhere,
      taskWhereClause: taskWhere,
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: queryDto.orderBy,
    })

    return {
      ...result,
      list: result.list.map((item) => this.toAppMyTaskView(item)),
    }
  }

  /**
   * 获取用户中心任务摘要。
   *
   * 该摘要复用任务页同一套过期、自动领取和可见状态口径，避免中心页与任务页出现计数漂移。
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
   * 手动领取任务。
   *
   * 同一用户、同一任务、同一周期内最多只会创建一条 assignment；
   * 幂等命中时直接复用已有记录，不重复写入领取日志。
   */
  async claimTask(dto: ClaimTaskDto, userId: number) {
    const now = new Date()
    const taskRecord = await this.findClaimableTask(dto.taskId, now)
    const cycleKey = this.buildCycleKey(taskRecord, now)

    await this.createOrGetAssignment(taskRecord, userId, cycleKey, now, {
      progressSource: TaskProgressSourceEnum.MANUAL,
    })
    return true
  }

  /**
   * 手动推进任务进度。
   *
   * 该链路使用 assignment 版本号做乐观锁，避免高并发下的进度覆盖。
   * 已完成 assignment 会走奖励补偿分支，不再重复推进。
   */
  async reportProgress(dto: TaskProgressDto, userId: number) {
    if (dto.delta <= 0) {
      throw new BadRequestException('进度增量必须大于0')
    }

    const now = new Date()
    const taskRecord = await this.findAvailableTask(dto.taskId, now)
    const cycleKey = this.buildCycleKey(taskRecord, now)

    let assignment = await this.findAssignmentByUniqueKey(
      taskRecord.id,
      userId,
      cycleKey,
    )

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

    const nextProgress = Math.min(
      assignment.target,
      assignment.progress + dto.delta,
    )
    const shouldAutoComplete =
      taskRecord.completeMode === TaskCompleteModeEnum.AUTO &&
      nextProgress >= assignment.target
    const nextStatus = shouldAutoComplete
      ? TaskAssignmentStatusEnum.COMPLETED
      : TaskAssignmentStatusEnum.IN_PROGRESS
    const completedAt = shouldAutoComplete ? now : undefined
    const context = this.parseJsonValue(dto.context)

    const updatedRows = await this.drizzle.withTransaction(async (tx) => {
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

      await tx.insert(this.taskProgressLogTable).values(
        this.buildTaskProgressLogRecord({
          assignmentId: assignment.id,
          userId,
          actionType: shouldAutoComplete
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
   * 显式完成任务。
   *
   * 仅允许已达标 assignment 进入完成态；若已完成则只补偿奖励，不重复写状态。
   */
  async completeTask(dto: TaskCompleteDto, userId: number) {
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
    if (assignment.progress < assignment.target) {
      throw new BadRequestException('任务进度未达成')
    }

    const finalProgress = Math.max(assignment.progress, assignment.target)
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
   *
   * 该链路按 event envelope 的 `occurredAt` 落周期，并通过 assignment + bizKey 保证幂等。
   */
  async consumeEventProgress(input: TaskEventProgressInput) {
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

  /**
   * 分页查询后台 assignment 列表。
   */
  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentDto) {
    const assignmentConditions = [isNull(this.taskAssignmentTable.deletedAt)]

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

    const result = await this.queryTaskAssignmentPage({
      assignmentWhereClause: and(...assignmentConditions),
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: queryDto.orderBy,
    })

    return {
      ...result,
      list: result.list.map((item) => this.toAdminTaskAssignmentView(item)),
    }
  }

  /**
   * 分页查询任务奖励与通知对账视图。
   *
   * 该接口把 assignment、事件推进日志和奖励提醒状态聚合成单页结果，减少排障时的跨表切换。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationDto,
  ) {
    const assignmentConditions = [isNull(this.taskAssignmentTable.deletedAt)]

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

    const eventAssignmentIds =
      await this.queryAssignmentIdsByEventFilter(queryDto)
    if (eventAssignmentIds && eventAssignmentIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: queryDto.pageIndex ?? 1,
        pageSize: queryDto.pageSize ?? 15,
      }
    }
    if (eventAssignmentIds) {
      assignmentConditions.push(
        inArray(this.taskAssignmentTable.id, eventAssignmentIds),
      )
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
      assignmentWhereClause: and(...assignmentConditions),
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: queryDto.orderBy,
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
   * 重试单条已完成任务的奖励结算。
   *
   * 该入口依赖 assignment 快照重放完成事件，避免模板变更后补偿语义漂移。
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
   * 批量扫描并重试待补偿奖励。
   *
   * 定时任务与后台手动批处理共用该入口，统一复用 assignment 快照语义。
   */
  async retryCompletedAssignmentRewardsBatch(limit = 100) {
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
}
