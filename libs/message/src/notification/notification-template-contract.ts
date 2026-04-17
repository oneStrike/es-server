import type { MessageNotificationCategoryKey } from './notification.constant'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'

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
    titleTemplate: '{{payload.actorNickname}} 回复了你的评论',
    contentTemplate: '{{payload.replyExcerpt}}',
    remark: 'canonical notification template: 评论回复',
  },
  comment_mention: {
    titleTemplate: '{{payload.actorNickname}} 在评论中提到了你',
    contentTemplate: '{{payload.commentExcerpt}}',
    remark: 'canonical notification template: 评论提及',
  },
  comment_like: {
    titleTemplate: '{{payload.actorNickname}} 点赞了你的评论',
    contentTemplate: '{{payload.actorNickname}} 点赞了你的评论',
    remark: 'canonical notification template: 评论点赞',
  },
  topic_like: {
    titleTemplate: '{{payload.actorNickname}} 点赞了你的主题',
    contentTemplate: '{{payload.subject.title}}',
    remark: 'canonical notification template: 主题点赞',
  },
  topic_favorited: {
    titleTemplate: '{{payload.actorNickname}} 收藏了你的主题',
    contentTemplate: '{{payload.subject.title}}',
    remark: 'canonical notification template: 主题收藏',
  },
  topic_commented: {
    titleTemplate: '{{payload.actorNickname}} 评论了你的主题',
    contentTemplate: '{{payload.commentExcerpt}}',
    remark: 'canonical notification template: 主题评论',
  },
  topic_mentioned: {
    titleTemplate: '{{payload.actorNickname}} 在主题中提到了你',
    contentTemplate: '{{payload.subject.title}}',
    remark: 'canonical notification template: 主题提及',
  },
  user_followed: {
    titleTemplate: '{{payload.actorNickname}} 关注了你',
    contentTemplate: '{{payload.actorNickname}} 关注了你',
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
