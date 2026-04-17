import type { PublishMessageDomainEventInput } from '@libs/message/eventing/message-event.type'
import type {
  TaskAutoAssignedReminderEventInput,
  TaskExpiringSoonReminderEventInput,
  TaskReminderNotificationEventInput,
  TaskReminderNotificationPayload,
  TaskReminderRewardSummary,
  TaskRewardGrantedReminderEventInput,
} from './task.type'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import {
  normalizeTaskType,
  TaskReminderKindEnum,
} from './task.constant'

/**
 * 任务提醒事件组装器。
 * 统一生成任务提醒领域事件与稳定 projectionKey/context 合同。
 */
export class TaskNotificationService {
  private readonly payloadVersion = 1

  createAutoAssignedReminderEvent(
    params: TaskAutoAssignedReminderEventInput,
  ): PublishMessageDomainEventInput {
    return this.buildTaskReminderDomainEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.AUTO_ASSIGNED,
    })
  }

  createExpiringSoonReminderEvent(
    params: TaskExpiringSoonReminderEventInput,
  ): PublishMessageDomainEventInput {
    return this.buildTaskReminderDomainEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.EXPIRING_SOON,
      expiredAt: params.expiredAt,
    })
  }

  createRewardGrantedReminderEvent(
    params: TaskRewardGrantedReminderEventInput,
  ): PublishMessageDomainEventInput {
    return this.buildTaskReminderDomainEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.REWARD_GRANTED,
      rewardItems: params.rewardItems,
      ledgerRecordIds: params.ledgerRecordIds,
    })
  }

  buildAutoAssignedReminderBizKey(assignmentId: number) {
    return `task:reminder:auto-assigned:assignment:${assignmentId}`
  }

  buildExpiringSoonReminderBizKey(assignmentId: number) {
    return `task:reminder:expiring:assignment:${assignmentId}`
  }

  buildRewardGrantedReminderBizKey(assignmentId: number) {
    return `task:reminder:reward:assignment:${assignmentId}`
  }

  private buildTaskReminderDomainEvent(
    params: TaskReminderNotificationEventInput,
  ): PublishMessageDomainEventInput {
    const message = this.buildTaskReminderMessage(params)
    const rewardSummary: TaskReminderRewardSummary | undefined =
      params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED
      && (params.rewardItems?.length ?? 0) > 0
        ? {
            rewardItems: params.rewardItems ?? [],
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
      actionUrl: this.buildTaskReminderActionUrl(params.reminderKind),
      rewardSummary,
    }

    return {
      eventKey: this.resolveTaskReminderEventKey(params),
      subjectType: 'user',
      subjectId: params.receiverUserId,
      targetType: 'task',
      targetId: params.task.id,
      operatorId: undefined,
      context: {
        receiverUserId: params.receiverUserId,
        projectionKey: params.bizKey,
        title: message.title,
        content: message.content,
        expiresAt: params.expiredAt,
        payload,
      },
    }
  }

  private resolveTaskReminderEventKey(
    params: TaskReminderNotificationEventInput,
  ): PublishMessageDomainEventInput['eventKey'] {
    if (params.reminderKind === TaskReminderKindEnum.AUTO_ASSIGNED) {
      return 'task.reminder.auto_assigned'
    }
    if (params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED) {
      return 'task.reminder.reward_granted'
    }
    if (params.reminderKind === TaskReminderKindEnum.EXPIRING_SOON) {
      return 'task.reminder.expiring'
    }
    throw new Error(`Unsupported task reminder kind: ${params.reminderKind}`)
  }

  private buildTaskReminderMessage(params: TaskReminderNotificationEventInput) {
    if (params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED) {
      const rewardParts: string[] = []
      for (const rewardItem of params.rewardItems ?? []) {
        if (rewardItem.amount <= 0) {
          continue
        }
        if (rewardItem.assetType === GrowthRewardRuleAssetTypeEnum.POINTS) {
          rewardParts.push(`积分 +${rewardItem.amount}`)
          continue
        }
        if (rewardItem.assetType === GrowthRewardRuleAssetTypeEnum.EXPERIENCE) {
          rewardParts.push(`经验 +${rewardItem.amount}`)
        }
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

    if (params.reminderKind === TaskReminderKindEnum.AUTO_ASSIGNED) {
      return {
        title: '你有新的任务待完成',
        content: `任务《${params.task.title}》已自动加入你的任务列表。`,
      }
    }
    throw new Error(`Unsupported task reminder kind: ${params.reminderKind}`)
  }

  private buildTaskReminderActionUrl(
    reminderKind: TaskReminderKindEnum,
  ): TaskReminderNotificationPayload['actionUrl'] {
    if (
      reminderKind === TaskReminderKindEnum.AUTO_ASSIGNED
      || reminderKind === TaskReminderKindEnum.EXPIRING_SOON
      || reminderKind === TaskReminderKindEnum.REWARD_GRANTED
    ) {
      return '/task/my'
    }
    throw new Error(`Unsupported task reminder kind: ${reminderKind}`)
  }
}
