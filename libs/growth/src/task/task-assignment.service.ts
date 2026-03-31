import type {
  ClaimTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  TaskCompleteInput,
  TaskProgressInput,
} from './task.type'
import { DrizzleService } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
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
 * 用户任务编排服务。
 *
 * 负责可领取列表、我的任务、领取、进度推进、显式完成和用户中心摘要，
 * 是 app 侧任务状态机的主要入口。
 */
@Injectable()
export class TaskAssignmentService extends TaskServiceSupport {
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
  async getAvailableTasks(
    queryDto: QueryAppTaskInput,
    userId: number,
  ) {
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
  async getMyTasks(
    queryDto: QueryMyTaskInput,
    userId: number,
  ) {
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
    const whereClause =
      assignmentWhere && taskWhere
        ? and(assignmentWhere, taskWhere)
        : (assignmentWhere ?? taskWhere)
    const result = await this.queryTaskAssignmentPage({
      whereClause,
      pageIndex: queryDto.pageIndex,
      pageSize: queryDto.pageSize,
      orderBy: queryDto.orderBy,
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
  async claimTask(dto: ClaimTaskInput, userId: number) {
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
  async reportProgress(
    dto: TaskProgressInput,
    userId: number,
  ) {
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
  async completeTask(
    dto: TaskCompleteInput,
    userId: number,
  ) {
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
}
