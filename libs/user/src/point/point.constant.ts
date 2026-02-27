// 积分规则类型枚举
export enum UserPointRuleTypeEnum {
  CREATE_TOPIC = 1,
  CREATE_REPLY = 2,
  TOPIC_LIKED = 3,
  REPLY_LIKED = 4,
  TOPIC_FAVORITED = 5,
  DAILY_CHECK_IN = 6,
  ADMIN = 7,
  TOPIC_VIEW = 8,
  REPORT_CREATE = 9,
  COMIC_WORK_VIEW = 101,
  COMIC_WORK_LIKE = 102,
  COMIC_WORK_FAVORITE = 103,
  COMIC_CHAPTER_READ = 111,
  COMIC_CHAPTER_LIKE = 112,
  COMIC_CHAPTER_PURCHASE = 113,
  COMIC_CHAPTER_DOWNLOAD = 114,
  COMIC_CHAPTER_EXCHANGE = 115,
}

export const USER_POINT_RULE_TYPE_NAMES: Record<UserPointRuleTypeEnum, string> = {
  [UserPointRuleTypeEnum.CREATE_TOPIC]: '发表主题',
  [UserPointRuleTypeEnum.CREATE_REPLY]: '发表回复',
  [UserPointRuleTypeEnum.TOPIC_LIKED]: '主题被点赞',
  [UserPointRuleTypeEnum.REPLY_LIKED]: '回复被点赞',
  [UserPointRuleTypeEnum.TOPIC_FAVORITED]: '主题被收藏',
  [UserPointRuleTypeEnum.DAILY_CHECK_IN]: '每日签到',
  [UserPointRuleTypeEnum.ADMIN]: '管理员操作',
  [UserPointRuleTypeEnum.TOPIC_VIEW]: '主题浏览',
  [UserPointRuleTypeEnum.REPORT_CREATE]: '举报',
  [UserPointRuleTypeEnum.COMIC_WORK_VIEW]: '漫画浏览',
  [UserPointRuleTypeEnum.COMIC_WORK_LIKE]: '漫画点赞',
  [UserPointRuleTypeEnum.COMIC_WORK_FAVORITE]: '漫画收藏',
  [UserPointRuleTypeEnum.COMIC_CHAPTER_READ]: '章节阅读',
  [UserPointRuleTypeEnum.COMIC_CHAPTER_LIKE]: '章节点赞',
  [UserPointRuleTypeEnum.COMIC_CHAPTER_PURCHASE]: '章节购买',
  [UserPointRuleTypeEnum.COMIC_CHAPTER_DOWNLOAD]: '章节下载',
  [UserPointRuleTypeEnum.COMIC_CHAPTER_EXCHANGE]: '章节兑换',
}

export function getPointRuleTypeName(type: UserPointRuleTypeEnum): string {
  return USER_POINT_RULE_TYPE_NAMES[type] ?? '未知规则'
}
