import { DrizzleService } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import { TaskExecutionService } from './task-execution.service'
import {
  TASK_EXPIRING_SOON_REMINDER_HOURS,
  TaskAssignmentStatusEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务运行时服务。
 *
 * 负责定时过期、奖励补偿和过期提醒调度，是 task 域的 cron 入口。
 */
@Injectable()
export class TaskRuntimeService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
    protected readonly taskExecutionService: TaskExecutionService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 定时关闭已到期 assignment。
   *
   * 该任务只做状态关闭与日志补写，不负责奖励补偿。
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
   * 定时补偿已完成但奖励未成功的 assignment。
   */
  @Cron('30 */5 * * * *')
  async retryCompletedAssignmentRewards() {
    await this.taskExecutionService.retryCompletedAssignmentRewardsBatch(100)
  }

  /**
   * 定时发送即将过期提醒。
   *
   * 每个 assignment 只会通过稳定 bizKey 提醒一次，避免重复推送。
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
        .filter((item): item is typeof item & { expiredAt: Date } =>
          Boolean(item.expiredAt),
        )
        .map((item) =>
          this.taskNotificationService.createExpiringSoonReminderEvent({
            bizKey:
              this.taskNotificationService.buildExpiringSoonReminderBizKey(
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
}
