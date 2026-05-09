import type { TaskExpiredInstanceRawRow } from './types/task.type'
import { DrizzleService, extractRows } from '@db/core'
import { MessageDomainEventPublisher } from '@libs/message/eventing/message-domain-event.publisher'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { TaskExecutionService } from './task-execution.service'
import { TaskNotificationService } from './task-notification.service'
import {
  TASK_EXPIRING_SOON_REMINDER_HOURS,
  TaskDefinitionStatusEnum,
  TaskEventActionTypeEnum,
  TaskEventProgressSourceEnum,
  TaskInstanceStatusEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

/**
 * 新任务模型中的运行时服务。
 *
 * 负责 实例的过期收口、奖励补偿重试和即将过期提醒调度。
 */
@Injectable()
export class TaskRuntimeService extends TaskServiceSupport {
  // 注入运行时调度需要的数据库、消息和执行服务。
  constructor(
    drizzle: DrizzleService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisher,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskNotificationService: TaskNotificationService,
  ) {
    super(drizzle)
  }

  // 定时关闭已到期的实例。
  @Cron('0 */5 * * * *')
  async expireTaskInstances() {
    const now = new Date()
    return this.drizzle.withTransaction(async (tx) => {
      // 使用原生 SQL 是为了在同一事务语句中锁定到期实例、更新实例和步骤，并返回事件日志所需投影。
      const result = await tx.execute(sql`
        WITH due_instances AS (
          SELECT
            id,
            task_id,
            user_id
          FROM task_instance
          WHERE deleted_at IS NULL
            AND status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
            AND expired_at <= ${now}
          FOR UPDATE
        ),
        updated_instances AS (
          UPDATE task_instance i
          SET
            status = ${TaskInstanceStatusEnum.EXPIRED},
            version = i.version + 1
          FROM due_instances
          WHERE i.id = due_instances.id
            AND i.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
          RETURNING
            i.id AS instance_id,
            i.task_id,
            i.user_id
        ),
        updated_steps AS (
          UPDATE task_instance_step s
          SET
            status = ${TaskInstanceStatusEnum.EXPIRED},
            version = s.version + 1
          FROM updated_instances
          WHERE s.instance_id = updated_instances.instance_id
            AND s.status IN (${TaskInstanceStatusEnum.PENDING}, ${TaskInstanceStatusEnum.IN_PROGRESS})
          RETURNING s.id
        )
        SELECT
          instance_id AS "instanceId",
          task_id AS "taskId",
          user_id AS "userId"
        FROM updated_instances
      `)
      const rows = extractRows<TaskExpiredInstanceRawRow>(result)

      if (rows.length > 0) {
        await tx.insert(this.taskEventLogTable).values(
          rows.map((row) => ({
            taskId: row.taskId,
            instanceId: row.instanceId,
            userId: row.userId,
            actionType: TaskEventActionTypeEnum.EXPIRE,
            progressSource: TaskEventProgressSourceEnum.SYSTEM,
            accepted: true,
            delta: 0,
            beforeValue: 0,
            afterValue: 0,
            occurredAt: now,
          })),
        )
      }

      return rows.length
    })
  }

  // 定时补建旧实例缺失的步骤快照。
  @Cron('15 */10 * * * *')
  async repairMissingActiveTaskInstanceSteps() {
    return this.taskExecutionService.repairMissingActiveTaskInstanceSteps(500)
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
