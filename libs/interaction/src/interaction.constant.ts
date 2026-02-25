/**
 * 交互模块常量定义
 */

/**
 * 交互目标类型枚举
 * 用于标识用户交互操作的目标对象类型
 *
 * 注意：作品类型必须区分漫画和小说，不能使用通用的"作品"类型
 */
export enum InteractionTargetType {
  /** 漫画 - 漫画作品 */
  COMIC = 1,
  /** 小说 - 小说作品 */
  NOVEL = 2,
  /** 漫画章节 - 漫画作品的章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 - 小说作品的章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 - 论坛板块中的帖子 */
  FORUM_TOPIC = 5,
}

/**
 * 交互操作类型枚举
 * 用于标识用户对目标执行的操作类型
 */
export enum InteractionActionType {
  /** 点赞 - 用户对目标表示认可 */
  LIKE = 1,
  /** 取消点赞 - 用户撤回点赞操作 */
  UNLIKE = 2,
  /** 收藏 - 用户将目标加入收藏夹 */
  FAVORITE = 3,
  /** 取消收藏 - 用户从收藏夹移除目标 */
  UNFAVORITE = 4,
  /** 浏览 - 用户查看目标内容 */
  VIEW = 5,
  /** 删除浏览记录 - 用户删除自己的浏览记录 */
  DELETE_VIEW = 6,
  /** 评论 - 用户对目标发表评论 */
  COMMENT = 7,
  /** 删除评论 - 用户删除自己的评论 */
  DELETE_COMMENT = 8,
  /** 下载 - 用户下载目标内容 */
  DOWNLOAD = 9,
}

/**
 * 审核状态枚举
 * 用于评论等内容的审核流程状态
 */
export enum AuditStatus {
  /** 待审核 - 内容已提交，等待审核 */
  PENDING = 0,
  /** 已通过 - 审核通过，内容可见 */
  APPROVED = 1,
  /** 已拒绝 - 审核拒绝，内容不可见 */
  REJECTED = 2,
}

/**
 * 审核角色枚举
 * 用于标识执行审核操作的角色类型
 */
export enum AuditRole {
  /** 版主 - 论坛版块管理员 */
  MODERATOR = 0,
  /** 管理员 - 系统管理员 */
  ADMIN = 1,
}

/**
 * 举报状态枚举
 * 用于举报记录的处理状态
 */
export enum ReportStatus {
  /** 待处理 - 举报已提交，等待处理 */
  PENDING = 'pending',
  /** 处理中 - 举报正在处理 */
  PROCESSING = 'processing',
  /** 已解决 - 举报已处理完成 */
  RESOLVED = 'resolved',
  /** 已拒绝 - 举报被驳回 */
  REJECTED = 'rejected',
}

/**
 * 目标类型分类
 * 用于判断目标类型的归属分类
 *
 * 注意：此枚举使用字符串值，用于业务逻辑分类，不涉及数据库存储
 * 与 InteractionTargetType（数字枚举）的用途不同
 */
export enum TargetTypeCategory {
  /** 漫画类 - 漫画及其章节 */
  COMIC = 'comic',
  /** 小说类 - 小说及其章节 */
  NOVEL = 'novel',
  /** 论坛类 - 论坛主题 */
  FORUM = 'forum',
}

/**
 * 获取目标类型的分类
 */
export function getTargetTypeCategory(
  type: InteractionTargetType,
): TargetTypeCategory | null {
  switch (type) {
    case InteractionTargetType.COMIC:
    case InteractionTargetType.COMIC_CHAPTER:
      return TargetTypeCategory.COMIC
    case InteractionTargetType.NOVEL:
    case InteractionTargetType.NOVEL_CHAPTER:
      return TargetTypeCategory.NOVEL
    case InteractionTargetType.FORUM_TOPIC:
      return TargetTypeCategory.FORUM
    default:
      return null
  }
}

/**
 * 判断是否为作品类型（漫画或小说）
 */
export function isWorkType(type: InteractionTargetType): boolean {
  return (
    type === InteractionTargetType.COMIC || type === InteractionTargetType.NOVEL
  )
}

/**
 * 判断是否为章节类型
 */
export function isChapterType(type: InteractionTargetType): boolean {
  return (
    type === InteractionTargetType.COMIC_CHAPTER ||
    type === InteractionTargetType.NOVEL_CHAPTER
  )
}

/**
 * 获取章节类型对应的作品类型
 */
export function getWorkTypeByChapter(
  type: InteractionTargetType,
): InteractionTargetType | null {
  switch (type) {
    case InteractionTargetType.COMIC_CHAPTER:
      return InteractionTargetType.COMIC
    case InteractionTargetType.NOVEL_CHAPTER:
      return InteractionTargetType.NOVEL
    case InteractionTargetType.COMIC:
    case InteractionTargetType.NOVEL:
    case InteractionTargetType.FORUM_TOPIC:
      return null
    default:
      return null
  }
}

/**
 * 评论功能支持的目标类型
 */
export const COMMENT_TARGET_TYPES = [
  InteractionTargetType.COMIC,
  InteractionTargetType.NOVEL,
  InteractionTargetType.COMIC_CHAPTER,
  InteractionTargetType.NOVEL_CHAPTER,
  InteractionTargetType.FORUM_TOPIC,
] as const

/**
 * 点赞功能支持的目标类型
 */
export const LIKE_TARGET_TYPES = [
  InteractionTargetType.COMIC,
  InteractionTargetType.NOVEL,
  InteractionTargetType.COMIC_CHAPTER,
  InteractionTargetType.NOVEL_CHAPTER,
  InteractionTargetType.FORUM_TOPIC,
] as const

/**
 * 收藏功能支持的目标类型
 */
export const FAVORITE_TARGET_TYPES = [
  InteractionTargetType.COMIC,
  InteractionTargetType.NOVEL,
  InteractionTargetType.FORUM_TOPIC,
] as const

/**
 * 浏览记录功能支持的目标类型
 */
export const VIEW_TARGET_TYPES = [
  InteractionTargetType.COMIC,
  InteractionTargetType.NOVEL,
  InteractionTargetType.COMIC_CHAPTER,
  InteractionTargetType.NOVEL_CHAPTER,
  InteractionTargetType.FORUM_TOPIC,
] as const

/**
 * 下载功能支持的目标类型
 */
export const DOWNLOAD_TARGET_TYPES = [
  InteractionTargetType.COMIC,
  InteractionTargetType.NOVEL,
  InteractionTargetType.COMIC_CHAPTER,
  InteractionTargetType.NOVEL_CHAPTER,
] as const
