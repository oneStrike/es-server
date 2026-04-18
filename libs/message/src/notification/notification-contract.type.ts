import type { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import type { StructuredValue } from '@libs/platform/utils/jsonParse'
import type { MessageNotificationCategoryKey } from './notification.constant'

export type MessageNotificationType = MessageNotificationCategoryKey

/** 稳定通知文案块：只承载最终展示结果。 */
export interface NotificationMessageBlock {
  title: string
  body: string
}

/** 稳定触发者快照：通知页只展示最小用户信息。 */
export interface NotificationUserSnapshot {
  id: number
  nickname?: string
  avatarUrl: string | null
}

/** 稳定评论快照。 */
export interface NotificationCommentSnapshot {
  kind: 'comment'
  id: number
  snippet?: string
}

/** 稳定主题快照。 */
export interface NotificationTopicSnapshot {
  kind: 'topic'
  id: number
  title?: string
  cover?: string
  sectionId?: number
}

/** 稳定作品快照。 */
export interface NotificationWorkSnapshot {
  kind: 'work'
  id: number
  title?: string
  cover?: string
  workType?: number
}

/** 稳定章节快照。 */
export interface NotificationChapterSnapshot {
  kind: 'chapter'
  id: number
  title?: string
  subtitle?: string
  cover?: string
  workId?: number
  workType?: number
}

/** 稳定公告快照。 */
export interface NotificationAnnouncementSnapshot {
  kind: 'announcement'
  id: number
  title?: string
  summary?: string
  announcementType?: number
  priorityLevel?: number
}

/** 稳定任务快照。 */
export interface NotificationTaskSnapshot {
  kind: 'task'
  id: number
  code?: string
  title?: string
  cover?: string
  sceneType?: number
}

/** 评论类通知复用的容器快照。 */
export type NotificationCommentContainerSnapshot =
  | NotificationWorkSnapshot
  | NotificationTopicSnapshot
  | NotificationChapterSnapshot

/** 评论操作类通知数据。 */
export interface NotificationCommentActionData {
  object: NotificationCommentSnapshot
  container: NotificationCommentContainerSnapshot
  parentContainer?: NotificationWorkSnapshot
}

/** 主题评论通知数据。 */
export interface NotificationTopicCommentedData {
  object: NotificationCommentSnapshot
  container: NotificationTopicSnapshot
}

/** 任务提醒奖励资产类型。类型层精确对齐数据库闭集值域：1=积分、2=经验、3=道具、4=虚拟货币、5=等级。 */
export type NotificationTaskRewardAssetType =
  | GrowthRewardRuleAssetTypeEnum.POINTS
  | GrowthRewardRuleAssetTypeEnum.EXPERIENCE
  | GrowthRewardRuleAssetTypeEnum.ITEM
  | GrowthRewardRuleAssetTypeEnum.CURRENCY
  | GrowthRewardRuleAssetTypeEnum.LEVEL

/** 任务奖励到账快照。 */
export interface NotificationTaskRewardSnapshot {
  items: Array<{
    assetType: NotificationTaskRewardAssetType
    amount: number
  }>
  ledgerRecordIds: number[]
}

/** 任务提醒信息。 */
export interface NotificationTaskReminderInfo {
  kind: 'auto_assigned' | 'expiring_soon' | 'reward_granted'
  assignmentId?: number
  cycleKey?: string
  expiredAt?: string
}

/** 任务提醒通知数据。 */
export interface NotificationTaskReminderData {
  object: NotificationTaskSnapshot
  reminder: NotificationTaskReminderInfo
  reward?: NotificationTaskRewardSnapshot
}

/** 各通知分类对应的数据结构。 */
export interface NotificationDataByTypeMap {
  comment_reply: NotificationCommentActionData
  comment_mention: NotificationCommentActionData
  comment_like: NotificationCommentActionData
  topic_like: {
    object: NotificationTopicSnapshot
  }
  topic_favorited: {
    object: NotificationTopicSnapshot
  }
  topic_commented: NotificationTopicCommentedData
  topic_mentioned: {
    object: NotificationTopicSnapshot
  }
  user_followed: null
  system_announcement: {
    object: NotificationAnnouncementSnapshot
  }
  task_reminder: NotificationTaskReminderData
}

export type MessageNotificationData =
  NotificationDataByTypeMap[MessageNotificationType]

/** 通知对外读模型。 */
export interface MessageNotificationPublicView<
  TType extends MessageNotificationType = MessageNotificationType,
> {
  id: number
  type: TType
  actor?: NotificationUserSnapshot
  message: NotificationMessageBlock
  data: NotificationDataByTypeMap[TType]
  isRead: boolean
  readAt?: Date
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

/** JSON 归一化后允许写入 payload 列的新通知数据。 */
export type MessageNotificationStoredData =
  | StructuredValue
  | MessageNotificationData
  | null
