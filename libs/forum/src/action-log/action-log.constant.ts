/**
 * 论坛用户操作类型枚举
 */
export enum ForumUserActionTypeEnum {
  /** 创建主题 */
  CREATE_TOPIC = 1,
  /** 创建评论 */
  CREATE_COMMENT = 2,
  /** 点赞主题 */
  LIKE_TOPIC = 3,
  /** 取消点赞主题 */
  UNLIKE_TOPIC = 4,
  /** 点赞评论 */
  LIKE_COMMENT = 5,
  /** 取消点赞评论 */
  UNLIKE_COMMENT = 6,
  /** 收藏主题 */
  FAVORITE_TOPIC = 7,
  /** 取消收藏主题 */
  UNFAVORITE_TOPIC = 8,
  /** 更新主题 */
  UPDATE_TOPIC = 9,
  /** 更新评论 */
  UPDATE_COMMENT = 10,
  /** 删除主题 */
  DELETE_TOPIC = 11,
  /** 删除评论 */
  DELETE_COMMENT = 12,
}

/**
 * 论坛用户操作目标类型枚举
 */
export enum ForumUserActionTargetTypeEnum {
  /** 主题 */
  TOPIC = 1,
  /** 评论 */
  COMMENT = 2,
}
