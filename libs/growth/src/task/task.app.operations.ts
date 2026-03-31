import type {
  ClaimTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  TaskCompleteInput,
  TaskEventProgressInput,
  TaskEventProgressResult,
  TaskProgressInput,
} from './task.type'
import {
  canConsumeEventEnvelopeByConsumer,
  EventDefinitionConsumerEnum,
} from '@libs/growth/event-definition'
import { BadRequestException, ConflictException } from '@nestjs/common'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  getTaskTypeFilterValues,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskProgressActionTypeEnum,
  TaskProgressSourceEnum,
} from './task.constant'

/**
 * 获取可领取的任务列表（应用端）。
 */
export async function getAvailableTasks(
  this: any,
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
      (taskRecord: { claimMode: number }) =>
        taskRecord.claimMode === TaskClaimModeEnum.MANUAL,
    ),
    userId,
    now,
  )
  const pagedTasks = filteredTasks.slice(page.offset, page.offset + page.limit)

  await this.ensureAutoAssignmentsForUser(userId, now)
  await this.tryNotifyAvailableTasksFromPage(userId, pagedTasks, now)

  return {
    list: pagedTasks.map((taskRecord: any) => this.toAppTaskView(taskRecord)),
    total: filteredTasks.length,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  }
}

/**
 * 获取我的任务列表（应用端）。
 */
export async function getMyTasks(
  this: any,
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
    assignmentConditions.push(eq(this.taskAssignmentTable.status, queryDto.status))
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
    list: result.list.map((item: any) => this.toAppMyTaskView(item)),
  }
}

/**
 * 获取用户中心任务摘要。
 */
export async function getUserTaskSummary(this: any, userId: number) {
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
      (taskRecord: { claimMode: number }) =>
        taskRecord.claimMode === TaskClaimModeEnum.MANUAL,
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
 * 领取任务（应用端）。
 */
export async function claimTask(
  this: any,
  dto: ClaimTaskInput,
  userId: number,
) {
  const now = new Date()
  const taskRecord = await this.findClaimableTask(dto.taskId, now)
  const cycleKey = this.buildCycleKey(taskRecord, now)
  await this.createOrGetAssignment(taskRecord, userId, cycleKey, now, {
    progressSource: TaskProgressSourceEnum.MANUAL,
  })
  return true
}

/**
 * 上报任务进度（应用端）。
 */
export async function reportProgress(
  this: any,
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
      assignment = await this.createOrGetAssignment(taskRecord, userId, cycleKey, now)
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

  const nextProgress = Math.min(assignment.target, assignment.progress + dto.delta)
  const shouldAutoComplete =
    taskRecord.completeMode === TaskCompleteModeEnum.AUTO &&
    nextProgress >= assignment.target
  const nextStatus = shouldAutoComplete
    ? TaskAssignmentStatusEnum.COMPLETED
    : TaskAssignmentStatusEnum.IN_PROGRESS
  const completedAt = shouldAutoComplete ? now : undefined
  const context = this.parseJsonValue(dto.context)

  const updatedRows = await this.drizzle.withTransaction(async (tx: any) => {
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
 * 完成任务（应用端）。
 */
export async function completeTask(
  this: any,
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
  const updatedRows = await this.drizzle.withTransaction(async (tx: any) => {
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
 */
export async function consumeEventProgress(
  this: any,
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
