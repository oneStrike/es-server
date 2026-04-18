import type { MessageNotificationCategoryKey } from './notification.constant'

export interface CanonicalNotificationTemplateContract {
  titleTemplate: string
  contentTemplate: string
  remark: string
}

const CANONICAL_NOTIFICATION_TEMPLATE_CONTRACT_MAP: Record<
  MessageNotificationCategoryKey,
  CanonicalNotificationTemplateContract
> = {
  comment_reply: {
    titleTemplate: '{{actor.nickname}} 回复了你的评论',
    contentTemplate: '{{data.object.snippet}}',
    remark: 'canonical notification template: 评论回复',
  },
  comment_mention: {
    titleTemplate: '{{actor.nickname}} 在评论中提到了你',
    contentTemplate: '{{data.object.snippet}}',
    remark: 'canonical notification template: 评论提及',
  },
  comment_like: {
    titleTemplate: '{{actor.nickname}} 点赞了你的评论',
    contentTemplate: '{{data.object.snippet}}',
    remark: 'canonical notification template: 评论点赞',
  },
  topic_like: {
    titleTemplate: '{{actor.nickname}} 点赞了你的主题',
    contentTemplate: '{{data.object.title}}',
    remark: 'canonical notification template: 主题点赞',
  },
  topic_favorited: {
    titleTemplate: '{{actor.nickname}} 收藏了你的主题',
    contentTemplate: '{{data.object.title}}',
    remark: 'canonical notification template: 主题收藏',
  },
  topic_commented: {
    titleTemplate: '{{actor.nickname}} 评论了你的主题',
    contentTemplate: '{{data.object.snippet}}',
    remark: 'canonical notification template: 主题评论',
  },
  topic_mentioned: {
    titleTemplate: '{{actor.nickname}} 在主题中提到了你',
    contentTemplate: '{{data.object.title}}',
    remark: 'canonical notification template: 主题提及',
  },
  user_followed: {
    titleTemplate: '{{actor.nickname}} 关注了你',
    contentTemplate: '{{actor.nickname}} 关注了你',
    remark: 'canonical notification template: 用户关注',
  },
  system_announcement: {
    titleTemplate: '{{title}}',
    contentTemplate: '{{content}}',
    remark: 'canonical notification template: 系统公告',
  },
  task_reminder: {
    titleTemplate: '{{title}}',
    contentTemplate: '{{content}}',
    remark: 'canonical notification template: 任务提醒',
  },
}

export function getCanonicalNotificationTemplateContract(
  categoryKey: MessageNotificationCategoryKey,
) {
  return CANONICAL_NOTIFICATION_TEMPLATE_CONTRACT_MAP[categoryKey]
}
