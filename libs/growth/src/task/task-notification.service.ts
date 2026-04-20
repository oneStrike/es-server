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
import { normalizeTaskType, TaskReminderKindEnum } from './task.constant'

/**
 * 任务提醒事件组装器。
 * 统一生成任务提醒领域事件与稳定 projectionKey/context 合同。
 */
export class TaskNotificationService {
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
    const normalizedTaskType = normalizeTaskType(params.task.type)
    const normalizedReminderKind = this.mapReminderKind(params.reminderKind)
    const rewardSummary: TaskReminderRewardSummary | undefined =
      params.reminderKind === TaskReminderKindEnum.REWARD_GRANTED &&
      (params.rewardItems?.length ?? 0) > 0
        ? {
            items: (params.rewardItems ?? []).flatMap((item) => {
              if (
                item.amount <= 0 ||
                !this.isNotificationTaskRewardAssetType(item.assetType)
              ) {
                return []
              }
              return [{ assetType: item.assetType, amount: item.amount }]
            }),
            ledgerRecordIds: params.ledgerRecordIds ?? [],
          }
        : undefined

    const payload = {
      object: {
        kind: 'task',
        id: params.task.id,
        code: params.task.code ?? `task-${params.task.id}`,
        title: params.task.title,
        type: normalizedTaskType,
      },
      reminder: {
        kind: normalizedReminderKind,
        assignmentId: params.assignmentId,
        cycleKey: params.cycleKey,
        expiredAt: params.expiredAt,
      },
      reward: rewardSummary,
    } satisfies TaskReminderNotificationPayload

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

  private mapReminderKind(
    reminderKind: TaskReminderKindEnum,
  ): TaskReminderNotificationPayload['reminder']['kind'] {
    if (reminderKind === TaskReminderKindEnum.AUTO_ASSIGNED) {
      return 'auto_assigned'
    }
    if (reminderKind === TaskReminderKindEnum.EXPIRING_SOON) {
      return 'expiring_soon'
    }
    if (reminderKind === TaskReminderKindEnum.REWARD_GRANTED) {
      return 'reward_granted'
    }
    throw new Error(`Unsupported task reminder kind: ${reminderKind}`)
  }

  private isNotificationTaskRewardAssetType(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ): assetType is NonNullable<TaskReminderRewardSummary>['items'][number]['assetType'] {
    return (
      assetType === GrowthRewardRuleAssetTypeEnum.POINTS ||
      assetType === GrowthRewardRuleAssetTypeEnum.EXPERIENCE ||
      assetType === GrowthRewardRuleAssetTypeEnum.ITEM ||
      assetType === GrowthRewardRuleAssetTypeEnum.CURRENCY ||
      assetType === GrowthRewardRuleAssetTypeEnum.LEVEL
    )
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
}
