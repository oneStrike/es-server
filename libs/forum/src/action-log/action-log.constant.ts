/**
 * 论坛用户操作类型枚举
 */
export enum ForumUserActionTypeEnum {
  /** 创建主题 */
  CREATE_TOPIC = 1,
  /** 创建回复 */
  CREATE_REPLY = 2,
  /** 点赞主题 */
  LIKE_TOPIC = 3,
  /** 取消点赞主题 */
  UNLIKE_TOPIC = 4,
  /** 点赞回复 */
  LIKE_REPLY = 5,
  /** 取消点赞回复 */
  UNLIKE_REPLY = 6,
  /** 收藏主题 */
  FAVORITE_TOPIC = 7,
  /** 取消收藏主题 */
  UNFAVORITE_TOPIC = 8,
  /** 更新主题 */
  UPDATE_TOPIC = 9,
  /** 更新回复 */
  UPDATE_REPLY = 10,
  /** 删除主题 */
  DELETE_TOPIC = 11,
  /** 删除回复 */
  DELETE_REPLY = 12,
}

/**
 * 论坛用户操作目标类型枚举
 */
export enum ForumUserActionTargetTypeEnum {
  /** 主题 */
  TOPIC = 1,
  /** 回复 */
  REPLY = 2,
}
