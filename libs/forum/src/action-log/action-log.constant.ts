export enum ForumUserActionTypeEnum {
  CREATE_TOPIC = 1,
  CREATE_REPLY = 2,
  LIKE_TOPIC = 3,
  UNLIKE_TOPIC = 4,
  LIKE_REPLY = 5,
  UNLIKE_REPLY = 6,
  FAVORITE_TOPIC = 7,
  UNFAVORITE_TOPIC = 8,
  UPDATE_TOPIC = 9,
  UPDATE_REPLY = 10,
  DELETE_TOPIC = 11,
  DELETE_REPLY = 12,
}

export enum ForumUserActionTargetTypeEnum {
  TOPIC = 1,
  REPLY = 2,
}

export const ForumUserActionTypeDescriptionMap: Record<ForumUserActionTypeEnum, string> = {
  [ForumUserActionTypeEnum.CREATE_TOPIC]: '创建主题',
  [ForumUserActionTypeEnum.CREATE_REPLY]: '创建回复',
  [ForumUserActionTypeEnum.LIKE_TOPIC]: '点赞主题',
  [ForumUserActionTypeEnum.UNLIKE_TOPIC]: '取消点赞主题',
  [ForumUserActionTypeEnum.LIKE_REPLY]: '点赞回复',
  [ForumUserActionTypeEnum.UNLIKE_REPLY]: '取消点赞回复',
  [ForumUserActionTypeEnum.FAVORITE_TOPIC]: '收藏主题',
  [ForumUserActionTypeEnum.UNFAVORITE_TOPIC]: '取消收藏主题',
  [ForumUserActionTypeEnum.UPDATE_TOPIC]: '更新主题',
  [ForumUserActionTypeEnum.UPDATE_REPLY]: '更新回复',
  [ForumUserActionTypeEnum.DELETE_TOPIC]: '删除主题',
  [ForumUserActionTypeEnum.DELETE_REPLY]: '删除回复',
}
