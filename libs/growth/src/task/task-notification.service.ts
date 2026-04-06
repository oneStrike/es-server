import type { CreateNotificationOutboxEventDto } from '@libs/message/outbox/dto/outbox-event.dto';
import type {
  TaskAvailableReminderEventInput,
  TaskExpiringSoonReminderEventInput,
  TaskReminderNotificationEventInput,
  TaskReminderNotificationPayload,
  TaskReminderRewardSummary,
  TaskRewardGrantedReminderEventInput,
} from './task.type'
import { MessageNotificationTypeEnum } from '@libs/message/notification-constant'
import {
  normalizeTaskType,
  TaskClaimModeEnum,
  TaskReminderKindEnum,
} from './task.constant'

/**
 * 任务通知组装器
 *
 * 负责统一生成任务提醒的 outbox 事件、稳定 bizKey 和 payload 合同，
 * 避免 TaskService 长期直接拼装任务通知细节。
 */
export class TaskNotificationService {
  private readonly payloadVersion = 1

  createAvailableReminderEvent(
    params: TaskAvailableReminderEventInput,
  ): CreateNotificationOutboxEventDto {
    return this.buildTaskReminderNotificationEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.AVAILABLE,
      claimMode: params.claimMode,
    })
  }

  createExpiringSoonReminderEvent(
    params: TaskExpiringSoonReminderEventInput,
  ): CreateNotificationOutboxEventDto {
    return this.buildTaskReminderNotificationEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.EXPIRING_SOON,
      expiredAt: params.expiredAt,
    })
  }

  createRewardGrantedReminderEvent(
    params: TaskRewardGrantedReminderEventInput,
  ): CreateNotificationOutboxEventDto {
    return this.buildTaskReminderNotificationEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.REWARD_GRANTED,
      points: params.points,
      experience: params.experience,
      ledgerRecordIds: params.ledgerRecordIds,
    })
  }

  buildAvailableReminderBizKey(taskId: number, userId: number, cycleKey: string) {
    return `task:reminder:available:task:${taskId}:cycle:${cycleKey}:user:${userId}`
  }

  buildExpiringSoonReminderBizKey(assignmentId: number) {
    return `task:reminder:expiring:assignment:${assignmentId}`
  }

  buildRewardGrantedReminderBizKey(assignmentId: number) {
    return `task:reminder:reward:assignment:${assignmentId}`
  }

  private buildTaskReminderNotificationEvent(
    params: TaskReminderNotificationEventInput,
  ) {
    const message = this.buildTaskReminderMessage(params)
    const rewardSummary: TaskReminderRewardSummary | undefined =
      params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED
      && ((params.points ?? 0) > 0 || (params.experience ?? 0) > 0)
        ? {
            points: params.points ?? 0,
            experience: params.experience ?? 0,
            ledgerRecordIds: params.ledgerRecordIds ?? [],
          }
        : undefined
    const payload: TaskReminderNotificationPayload = {
      payloadVersion: this.payloadVersion,
      reminderKind: params.reminderKind,
      taskId: params.task.id,
      taskCode: params.task.code ?? `task-${params.task.id}`,
      title: params.task.title,
      taskTitle: params.task.title,
      sceneType: normalizeTaskType(params.task.type),
      cycleKey: params.cycleKey,
      assignmentId: params.assignmentId,
      expiredAt: params.expiredAt,
      actionUrl: this.buildTaskReminderActionUrl(
        params.reminderKind,
        params.claimMode,
      ),
      rewardSummary,
      points: params.points,
      experience: params.experience,
      ledgerRecordIds: params.ledgerRecordIds,
    }

    return {
      eventType: MessageNotificationTypeEnum.TASK_REMINDER,
      bizKey: params.bizKey,
      payload: {
        receiverUserId: params.receiverUserId,
        type: MessageNotificationTypeEnum.TASK_REMINDER,
        targetId: params.task.id,
        title: message.title,
        content: message.content,
        payload,
      },
    }
  }

  private buildTaskReminderMessage(params: TaskReminderNotificationEventInput) {
    if (params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED) {
      const rewardParts: string[] = []
      if (params.points && params.points > 0) {
        rewardParts.push(`积分 +${params.points}`)
      }
      if (params.experience && params.experience > 0) {
        rewardParts.push(`经验 +${params.experience}`)
      }
      return {
        title: '任务奖励已到账',
        content: `任务《${params.task.title}》奖励已到账${rewardParts.length > 0 ? `：${rewardParts.join('，')}` : ''}`,
      }
    }

    if (params.reminderKind === TaskReminderKindEnum.EXPIRING_SOON) {
      return {
        title: '任务即将过期',
        content: `任务《${params.task.title}》将在 24 小时内过期，请尽快完成。`,
      }
    }

    if (params.claimMode === TaskClaimModeEnum.AUTO) {
      return {
        title: '你有新的任务待完成',
        content: `任务《${params.task.title}》已自动加入你的任务列表。`,
      }
    }

    return {
      title: '发现新的可领取任务',
      content: `任务《${params.task.title}》现已可领取。`,
    }
  }

  private buildTaskReminderActionUrl(
    reminderKind: TaskReminderKindEnum,
    claimMode?: TaskAvailableReminderEventInput['claimMode'],
  ) {
    if (
      reminderKind === TaskReminderKindEnum.EXPIRING_SOON
      || reminderKind === TaskReminderKindEnum.REWARD_GRANTED
      || claimMode === TaskClaimModeEnum.AUTO
    ) {
      return '/task/my'
    }
    return '/task/available'
  }
}
