import type {
  CreateTaskInput,
  QueryTaskAssignmentPageInput,
  QueryTaskAssignmentReconciliationPageInput,
  QueryTaskPageInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import { escapeLikePattern } from '@db/core'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm'
import {
  getTaskTypeFilterValues,
  normalizeTaskObjectiveType,
} from './task.constant'

/**
 * 分页查询任务列表（管理端）。
 */
export async function getTaskPage(this: any, queryDto: QueryTaskPageInput) {
  const conditions = [isNull(this.taskTable.deletedAt)]

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
    result.list.map((item: { id: number }) => item.id),
  )
  return {
    ...result,
    list: result.list.map((taskRecord: any) =>
      this.toAdminTaskView(taskRecord, runtimeHealthMap.get(taskRecord.id)),
    ),
  }
}

/**
 * 获取任务详情（管理端）。
 */
export async function getTaskDetail(this: any, id: number) {
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
 * 创建任务（管理端）。
 */
export async function createTask(
  this: any,
  dto: CreateTaskInput,
  adminUserId: number,
) {
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
 * 更新任务（管理端）。
 */
export async function updateTask(
  this: any,
  dto: UpdateTaskInput,
  adminUserId: number,
) {
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
      : (this.asRecord(existingTask.objectiveConfig) ??
        existingTask.objectiveConfig ??
        undefined)
  this.ensurePositiveTaskTargetCount(dto.targetCount)
  this.ensureTaskObjectiveContract({
    objectiveType,
    eventCode,
    objectiveConfig: objectiveConfig as
    | Record<string, unknown>
    | null
    | undefined,
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
          and(eq(this.taskTable.id, dto.id), isNull(this.taskTable.deletedAt)),
        ),
    { duplicate: '任务编码已存在' },
  )

  this.drizzle.assertAffectedRows(result, '任务不存在')
  return true
}

/**
 * 更新任务状态（管理端）。
 */
export async function updateTaskStatus(
  this: any,
  dto: UpdateTaskStatusInput,
) {
  const result = await this.drizzle.withErrorHandling(() =>
    this.db
      .update(this.taskTable)
      .set({
        status: dto.status,
        isEnabled: dto.isEnabled,
      })
      .where(and(eq(this.taskTable.id, dto.id), isNull(this.taskTable.deletedAt))),
  )

  this.drizzle.assertAffectedRows(result, '任务不存在')
  return true
}

/**
 * 删除任务（软删除）。
 */
export async function deleteTask(this: any, id: number) {
  const now = new Date()
  await this.drizzle.withTransaction(async (tx: any) => {
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
 * 分页查询任务分配列表（管理端）。
 */
export async function getTaskAssignmentPage(
  this: any,
  queryDto: QueryTaskAssignmentPageInput,
) {
  const { orderBy } = queryDto
  const assignmentConditions = [isNull(this.taskAssignmentTable.deletedAt)]

  if (queryDto.taskId !== undefined) {
    assignmentConditions.push(eq(this.taskAssignmentTable.taskId, queryDto.taskId))
  }
  if (queryDto.userId !== undefined) {
    assignmentConditions.push(eq(this.taskAssignmentTable.userId, queryDto.userId))
  }
  if (queryDto.status !== undefined) {
    assignmentConditions.push(eq(this.taskAssignmentTable.status, queryDto.status))
  }

  const result = await this.queryTaskAssignmentPage({
    whereClause: and(...assignmentConditions),
    pageIndex: queryDto.pageIndex,
    pageSize: queryDto.pageSize,
    orderBy,
    includeTaskDetail: true,
  })

  return {
    ...result,
    list: result.list.map((item: any) => this.toAdminTaskAssignmentView(item)),
  }
}

/**
 * 分页查询任务奖励与通知对账视图（管理端）。
 */
export async function getTaskAssignmentReconciliationPage(
  this: any,
  queryDto: QueryTaskAssignmentReconciliationPageInput,
) {
  const { orderBy } = queryDto
  const assignmentConditions = [isNull(this.taskAssignmentTable.deletedAt)]

  if (queryDto.assignmentId !== undefined) {
    assignmentConditions.push(eq(this.taskAssignmentTable.id, queryDto.assignmentId))
  }
  if (queryDto.taskId !== undefined) {
    assignmentConditions.push(eq(this.taskAssignmentTable.taskId, queryDto.taskId))
  }
  if (queryDto.userId !== undefined) {
    assignmentConditions.push(eq(this.taskAssignmentTable.userId, queryDto.userId))
  }
  if (queryDto.rewardStatus !== undefined) {
    assignmentConditions.push(
      eq(this.taskAssignmentTable.rewardStatus, queryDto.rewardStatus),
    )
  }

  const eventAssignmentIds = await this.queryAssignmentIdsByEventFilter(queryDto)
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
    whereClause: and(...assignmentConditions),
    pageIndex: queryDto.pageIndex,
    pageSize: queryDto.pageSize,
    orderBy,
    includeTaskDetail: true,
  })
  const assignmentIds = result.list.map((item: { id: number }) => item.id)
  const [eventMap, rewardReminderMap] = await Promise.all([
    this.getAssignmentEventProgressMap(assignmentIds),
    this.getAssignmentRewardReminderMap(assignmentIds),
  ])

  return {
    ...result,
    list: result.list.map((item: any) => {
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
