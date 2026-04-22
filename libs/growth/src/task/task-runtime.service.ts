import { DrizzleService } from '@db/core'
import { MessageDomainEventPublisher } from '@libs/message/eventing/message-domain-event.publisher'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { TaskExecutionService } from './task-execution.service'
import { TaskNotificationService } from './task-notification.service'
import { TASK_EXPIRING_SOON_REMINDER_HOURS, TaskDefinitionStatusEnum, TaskEventActionTypeEnum, TaskInstanceStatusEnum } from './task.constant'

import { TaskServiceSupport } from './task.service.support'

/**
 * 新任务模型中的运行时服务。
 *
 * 负责 实例的过期收口、奖励补偿重试和即将过期提醒调度。
 */
@Injectable()
export class TaskRuntimeService extends TaskServiceSupport {
  private readonly taskNotificationService = new TaskNotificationService()

  // 注入运行时调度需要的数据库、消息和执行服务。
  constructor(
    drizzle: DrizzleService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisher,
    private readonly taskExecutionService: TaskExecutionService,
  ) {
    super(drizzle)
  }

  // 定时关闭已到期的实例。
  @Cron('0 */5 * * * *')
  async expireTaskInstances() {
    const now = new Date()
    const rows = await this.db
      .select({
        id: this.taskInstanceTable.id,
        taskId: this.taskInstanceTable.taskId,
        userId: this.taskInstanceTable.userId,
      })
      .from(this.taskInstanceTable)
      .where(
        and(
          isNull(this.taskInstanceTable.deletedAt),
          inArray(this.taskInstanceTable.status, [
            TaskInstanceStatusEnum.PENDING,
            TaskInstanceStatusEnum.IN_PROGRESS,
          ]),
          lte(this.taskInstanceTable.expiredAt, now),
        ),
      )

    if (rows.length === 0) {
      return 0
    }

    const instanceIds = rows.map((item) => item.id)
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .update(this.taskInstanceStepTable)
        .set({
          status: TaskInstanceStatusEnum.EXPIRED,
          version: sql`${this.taskInstanceStepTable.version} + 1`,
        })
        .where(inArray(this.taskInstanceStepTable.instanceId, instanceIds))

      await tx
        .update(this.taskInstanceTable)
        .set({
          status: TaskInstanceStatusEnum.EXPIRED,
          version: sql`${this.taskInstanceTable.version} + 1`,
        })
        .where(inArray(this.taskInstanceTable.id, instanceIds))
    })

    for (const row of rows) {
      await this.db.insert(this.taskEventLogTable).values({
        taskId: row.taskId,
        instanceId: row.id,
        userId: row.userId,
        actionType: TaskEventActionTypeEnum.EXPIRE,
        progressSource: 3,
        accepted: true,
        delta: 0,
        beforeValue: 0,
        afterValue: 0,
      })
    }

    return rows.length
  }

  // 定时补偿已完成但奖励未成功的实例。
  @Cron('30 */5 * * * *')
  async retryCompletedTaskRewards() {
    return this.taskExecutionService.retryCompletedTaskRewardsBatch(100)
  }

  // 定时发送即将过期提醒。
  @Cron('0 0 * * * *')
  async notifyExpiringSoonTaskInstances() {
    const now = new Date()
    const deadline = this.addHours(now, TASK_EXPIRING_SOON_REMINDER_HOURS)
    const rows = await this.db
      .select({
        instanceId: this.taskInstanceTable.id,
        taskId: this.taskInstanceTable.taskId,
        userId: this.taskInstanceTable.userId,
        cycleKey: this.taskInstanceTable.cycleKey,
        expiredAt: this.taskInstanceTable.expiredAt,
        code: this.taskDefinitionTable.code,
        title: this.taskDefinitionTable.title,
        sceneType: this.taskDefinitionTable.sceneType,
      })
      .from(this.taskInstanceTable)
      .innerJoin(
        this.taskDefinitionTable,
        eq(this.taskInstanceTable.taskId, this.taskDefinitionTable.id),
      )
      .where(
        and(
          isNull(this.taskInstanceTable.deletedAt),
          eq(this.taskDefinitionTable.status, TaskDefinitionStatusEnum.ACTIVE),
          inArray(this.taskInstanceTable.status, [
            TaskInstanceStatusEnum.PENDING,
            TaskInstanceStatusEnum.IN_PROGRESS,
          ]),
          gte(this.taskInstanceTable.expiredAt, now),
          lte(this.taskInstanceTable.expiredAt, deadline),
        ),
      )
      .orderBy(desc(this.taskInstanceTable.expiredAt))

    for (const row of rows.filter(
      (item): item is typeof item & { expiredAt: Date } =>
        Boolean(item.expiredAt),
    )) {
      await this.messageDomainEventPublisher.publish(
        this.taskNotificationService.createExpiringSoonReminderEvent({
          bizKey: this.taskNotificationService.buildExpiringSoonReminderBizKey(
            row.instanceId,
          ),
          receiverUserId: row.userId,
          task: {
            id: row.taskId,
            code: row.code,
            title: row.title,
            type: row.sceneType,
          },
          cycleKey: row.cycleKey,
          instanceId: row.instanceId,
          expiredAt: row.expiredAt,
        }),
      )
    }

    return rows.length
  }
}
