/**
 * 论坛成长事件 Key 定义
 * 用于成长事件触发与订阅
 */
export const ForumGrowthEventKey = {
  /** 主题创建 */
  TopicCreate: 'forum.topic.create',
  /** 回复创建 */
  ReplyCreate: 'forum.reply.create',
  /** 主题点赞 */
  TopicLike: 'forum.topic.like',
  /** 回复点赞 */
  ReplyLike: 'forum.reply.like',
  /** 主题收藏 */
  TopicFavorite: 'forum.topic.favorite',
  /** 主题浏览 */
  TopicView: 'forum.topic.view',
  /** 举报创建 */
  ReportCreate: 'forum.report.create',
} as const
