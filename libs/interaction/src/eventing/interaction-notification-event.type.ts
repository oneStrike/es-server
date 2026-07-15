/** 评论提及通知事实的格式化入参。 */
export interface CommentMentionNotificationEventInput {
  receiverUserId: number
  actorUserId: number
  commentId: number
  targetType: number
  targetId: number
  actorNickname?: string
  commentExcerpt?: string
  targetDisplayTitle?: string
}

/** 主题提及通知事实的格式化入参。 */
export interface TopicMentionNotificationEventInput {
  receiverUserId: number
  actorUserId: number
  topicId: number
  actorNickname?: string
  topicTitle?: string
}

/** 评论点赞通知事实的格式化入参。 */
export interface CommentLikeNotificationEventInput {
  receiverUserId: number
  actorUserId: number
  commentId: number
  targetType: number
  targetId: number
  actorNickname?: string
  commentExcerpt?: string
}

/** 用户关注通知事实的格式化入参。 */
export interface UserFollowedNotificationEventInput {
  receiverUserId: number
  actorUserId: number
  targetType: number
  targetId: number
  actorNickname?: string
}

/** 评论回复通知事实的格式化入参。 */
export interface CommentRepliedNotificationEventInput {
  receiverUserId: number
  actorUserId: number
  commentId: number
  targetType: number
  targetId: number
  actorNickname?: string
  replyExcerpt?: string
  parentCommentId?: number
  parentCommentExcerpt?: string
  targetDisplayTitle?: string
}
