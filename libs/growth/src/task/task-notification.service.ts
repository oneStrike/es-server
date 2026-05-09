import type { PublishMessageDomainEventInput } from '@libs/message/eventing/message-event.type'
import type {
  TaskAutoAssignedReminderEventInput,
  TaskExpiringSoonReminderEventInput,
  TaskReminderEventKey,
  TaskReminderMessage,
  TaskReminderNotificationEventInput,
  TaskReminderNotificationKind,
  TaskReminderNotificationPayload,
  TaskReminderRewardAssetType,
  TaskReminderRewardSummary,
  TaskRewardGrantedReminderEventInput,
} from './types/task.type'
import { Injectable } from '@nestjs/common'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import { normalizeTaskType, TaskReminderKindEnum } from './task.constant'

/**
 * 任务提醒事件组装器。
 * 统一生成任务提醒领域事件与稳定 projectionKey/context 合同。
 */
@Injectable()
export class TaskNotificationService {
  // 生成自动加入任务提醒事件。
  createAutoAssignedReminderEvent(
    params: TaskAutoAssignedReminderEventInput,
  ): PublishMessageDomainEventInput {
    return this.buildTaskReminderDomainEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.AUTO_ASSIGNED,
    })
  }

  // 生成即将过期提醒事件。
  createExpiringSoonReminderEvent(
    params: TaskExpiringSoonReminderEventInput,
  ): PublishMessageDomainEventInput {
    return this.buildTaskReminderDomainEvent({
      ...params,
      reminderKind: TaskReminderKindEnum.EXPIRING_SOON,
      expiredAt: params.expiredAt,
    })
  }

  // 生成奖励到账提醒事件。
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

  // 构建自动加入任务提醒的幂等键。
  buildAutoAssignedReminderBizKey(instanceId: number) {
    return `task:reminder:auto-assigned:instance:${instanceId}`
  }

  // 构建即将过期提醒的幂等键。
  buildExpiringSoonReminderBizKey(instanceId: number) {
    return `task:reminder:expiring:instance:${instanceId}`
  }

  // 构建奖励到账提醒的幂等键。
  buildRewardGrantedReminderBizKey(instanceId: number) {
    return `task:reminder:reward:instance:${instanceId}`
  }

  // 组装统一的任务提醒领域事件。
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
        instanceId: params.instanceId,
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

  // 把任务提醒枚举映射成通知 payload 子类型。
  private mapReminderKind(
    reminderKind: TaskReminderKindEnum,
  ): TaskReminderNotificationKind {
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

  // 判断奖励资产是否允许透出到任务提醒。
  private isNotificationTaskRewardAssetType(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ): assetType is TaskReminderRewardAssetType {
    return (
      assetType === GrowthRewardRuleAssetTypeEnum.POINTS ||
      assetType === GrowthRewardRuleAssetTypeEnum.EXPERIENCE ||
      assetType === GrowthRewardRuleAssetTypeEnum.ITEM ||
      assetType === GrowthRewardRuleAssetTypeEnum.CURRENCY ||
      assetType === GrowthRewardRuleAssetTypeEnum.LEVEL
    )
  }

  // 解析任务提醒对应的消息事件键。
  private resolveTaskReminderEventKey(
    params: TaskReminderNotificationEventInput,
  ): TaskReminderEventKey {
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

  // 生成任务提醒标题与正文。
  private buildTaskReminderMessage(
    params: TaskReminderNotificationEventInput,
  ): TaskReminderMessage {
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
