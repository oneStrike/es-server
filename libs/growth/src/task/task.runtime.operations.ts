import type { RetryCompletedAssignmentRewardsResult } from './task.type'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import {
  TASK_EXPIRING_SOON_REMINDER_HOURS,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
} from './task.constant'

/**
 * 手动重试单条已完成任务的奖励结算。
 */
export async function retryTaskAssignmentReward(this: any, assignmentId: number) {
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
 * 批量扫描并重试已完成但奖励未成功的任务分配。
 */
export async function retryCompletedAssignmentRewardsBatch(
  this: any,
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
    .leftJoin(this.taskTable, eq(this.taskAssignmentTable.taskId, this.taskTable.id))
    .where(
      and(
        isNull(this.taskAssignmentTable.deletedAt),
        eq(this.taskAssignmentTable.status, TaskAssignmentStatusEnum.COMPLETED),
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
      this.buildTaskRewardTaskRecord(assignment.taskId, assignment, assignment),
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

/**
 * 过期任务分配检查（定时任务）。
 */
export async function expireAssignments(this: any) {
  const now = new Date()
  await this.drizzle.withTransaction(async (tx: any) =>
    this.expireAssignmentsByWhere(tx, {
      now,
      whereClause: lte(this.taskAssignmentTable.expiredAt, now),
    }),
  )
}

/**
 * 已完成任务奖励补偿（定时任务）。
 */
export async function retryCompletedAssignmentRewards(this: any) {
  await retryCompletedAssignmentRewardsBatch.call(this, 100)
}

/**
 * 即将过期任务提醒（定时任务）。
 */
export async function notifyExpiringSoonAssignments(this: any) {
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
    .innerJoin(this.taskTable, eq(this.taskAssignmentTable.taskId, this.taskTable.id))
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
      .filter((item: any): item is typeof item & { expiredAt: Date } =>
        Boolean(item.expiredAt),
      )
      .map((item: any) =>
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
