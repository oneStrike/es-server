import type {
  NotificationAnnouncementSnapshotDto,
  NotificationChapterSnapshotDto,
  NotificationCommentSnapshotDto,
  NotificationTaskReminderInfoDto,
  NotificationTaskRewardSnapshotDto,
  NotificationTaskSnapshotDto,
  NotificationTopicSnapshotDto,
  NotificationWorkSnapshotDto,
} from './dto/notification.dto'
import type { MESSAGE_NOTIFICATION_CATEGORY_KEYS } from './notification.constant'

/** 通知分类键，统一约束偏好、模板与投影视图的分类值域。 */
export type MessageNotificationCategoryKey =
  (typeof MESSAGE_NOTIFICATION_CATEGORY_KEYS)[number]

/** 评论类通知复用的容器快照 DTO。 */
export type NotificationCommentContainerDto =
  | NotificationWorkSnapshotDto
  | NotificationTopicSnapshotDto
  | NotificationChapterSnapshotDto

/** 评论操作类通知数据 DTO。 */
export interface NotificationCommentActionDataDto {
  object: NotificationCommentSnapshotDto
  container: NotificationCommentContainerDto
  parentContainer: NotificationWorkSnapshotDto | null
}

/** 评论回复通知数据 DTO。 */
export interface NotificationCommentReplyDataDto extends NotificationCommentActionDataDto {
  parentComment: NotificationCommentSnapshotDto | null
}

/** 主题对象通知数据 DTO。 */
export interface NotificationTopicObjectDataDto {
  object: NotificationTopicSnapshotDto
}

/** 主题评论通知数据 DTO。 */
export interface NotificationTopicCommentedDataDto {
  object: NotificationCommentSnapshotDto
  container: NotificationTopicSnapshotDto
}

/** 系统公告通知数据 DTO。 */
export interface NotificationAnnouncementDataDto {
  object: NotificationAnnouncementSnapshotDto
}

/** 任务提醒通知数据 DTO。 */
export interface NotificationTaskReminderDataDto {
  object: NotificationTaskSnapshotDto
  reminder: NotificationTaskReminderInfoDto
  reward: NotificationTaskRewardSnapshotDto | null
}

/** 各通知分类对应的数据结构 DTO 映射。 */
export interface NotificationDataByTypeDto {
  comment_reply: NotificationCommentReplyDataDto
  comment_mention: NotificationCommentActionDataDto
  comment_like: NotificationCommentActionDataDto
  topic_like: NotificationTopicObjectDataDto
  topic_favorited: NotificationTopicObjectDataDto
  topic_commented: NotificationTopicCommentedDataDto
  topic_mentioned: NotificationTopicObjectDataDto
  user_followed: null
  system_announcement: NotificationAnnouncementDataDto
  task_reminder: NotificationTaskReminderDataDto
}

/** 用户通知对外返回的非空结构化数据 DTO。 */
export type UserNotificationDataDto = Exclude<
  NotificationDataByTypeDto[MessageNotificationCategoryKey],
  null
>
