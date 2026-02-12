/**
 * 积分模块常量定义
 */

/// 积分规则类型枚举
export enum UserPointRuleTypeEnum {
  /** 发表主题 */
  CREATE_TOPIC = 1,
  /** 发表回复 */
  CREATE_REPLY = 2,
  /** 主题被点赞 */
  TOPIC_LIKED = 3,
  /** 回复被点赞 */
  REPLY_LIKED = 4,
  /** 主题被收藏 */
  TOPIC_FAVORITED = 5,
  /** 每日签到 */
  DAILY_CHECK_IN = 6,
  /** 管理员操作 */
  ADMIN = 7,
  /** 主题浏览 */
  TOPIC_VIEW = 8,
  /** 举报 */
  REPORT_CREATE = 9,
  /** 漫画浏览 */
  COMIC_WORK_VIEW = 101,
  /** 漫画点赞 */
  COMIC_WORK_LIKE = 102,
  /** 漫画收藏 */
  COMIC_WORK_FAVORITE = 103,
  /** 章节阅读 */
  COMIC_CHAPTER_READ = 111,
  /** 章节点赞 */
  COMIC_CHAPTER_LIKE = 112,
  /** 章节购买 */
  COMIC_CHAPTER_PURCHASE = 113,
  /** 章节下载 */
  COMIC_CHAPTER_DOWNLOAD = 114,
}
