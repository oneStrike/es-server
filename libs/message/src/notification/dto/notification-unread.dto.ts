import { NestedProperty, NumberProperty } from '@libs/platform/decorators'

export const NOTIFICATION_UNREAD_BY_CATEGORY_EXAMPLE = {
  comment_reply: 2,
  comment_mention: 0,
  comment_like: 0,
  topic_like: 1,
  topic_favorited: 0,
  topic_commented: 0,
  topic_mentioned: 0,
  user_followed: 0,
  system_announcement: 0,
  task_reminder: 0,
}

export const NOTIFICATION_UNREAD_SUMMARY_EXAMPLE = {
  total: 3,
  byCategory: NOTIFICATION_UNREAD_BY_CATEGORY_EXAMPLE,
}

export class NotificationUnreadByCategoryDto {
  @NumberProperty({
    description: '评论回复未读数',
    example: 2,
    validation: false,
  })
  comment_reply!: number

  @NumberProperty({
    description: '评论提及未读数',
    example: 0,
    validation: false,
  })
  comment_mention!: number

  @NumberProperty({
    description: '评论点赞未读数',
    example: 0,
    validation: false,
  })
  comment_like!: number

  @NumberProperty({
    description: '主题点赞未读数',
    example: 1,
    validation: false,
  })
  topic_like!: number

  @NumberProperty({
    description: '主题收藏未读数',
    example: 0,
    validation: false,
  })
  topic_favorited!: number

  @NumberProperty({
    description: '主题评论未读数',
    example: 0,
    validation: false,
  })
  topic_commented!: number

  @NumberProperty({
    description: '主题提及未读数',
    example: 0,
    validation: false,
  })
  topic_mentioned!: number

  @NumberProperty({
    description: '用户关注未读数',
    example: 0,
    validation: false,
  })
  user_followed!: number

  @NumberProperty({
    description: '系统公告未读数',
    example: 0,
    validation: false,
  })
  system_announcement!: number

  @NumberProperty({
    description: '任务提醒未读数',
    example: 0,
    validation: false,
  })
  task_reminder!: number
}

export class BaseNotificationUnreadDto {
  @NumberProperty({
    description: '未读通知总数',
    example: 3,
    validation: false,
  })
  total!: number

  @NestedProperty({
    description: '按通知类型拆分的未读数量',
    type: NotificationUnreadByCategoryDto,
    example: NOTIFICATION_UNREAD_BY_CATEGORY_EXAMPLE,
    validation: false,
  })
  byCategory!: NotificationUnreadByCategoryDto
}
