/**
 * forum 话题创建模式枚举。
 */
export enum ForumHashtagCreationModeEnum {
  /** 仅允许引用已存在且可用的话题 */
  EXISTING_ONLY = 1,
  /** 允许在正文中自动创建新话题 */
  AUTO_CREATE = 2,
}

/**
 * forum 话题创建来源枚举。
 */
export enum ForumHashtagCreateSourceTypeEnum {
  /** 管理端人工创建 */
  ADMIN = 1,
  /** forum topic 正文自动创建 */
  TOPIC_BODY = 2,
  /** forum topic 评论正文自动创建 */
  COMMENT_BODY = 3,
}

/**
 * forum 话题引用来源枚举。
 */
export enum ForumHashtagReferenceSourceTypeEnum {
  /** forum topic 正文引用 */
  TOPIC = 1,
  /** forum topic 评论正文引用 */
  COMMENT = 2,
}

/**
 * forum 话题搜索/列表默认限制。
 */
export const FORUM_HASHTAG_DEFAULT_SEARCH_LIMIT = 10

/**
 * forum 话题名称最大长度。
 */
export const FORUM_HASHTAG_NAME_MAX_LENGTH = 64

/**
 * forum 话题正文提取正则。
 * 仅识别 `#` 开头、后接字母/数字/下划线的单段词元。
 */
export const FORUM_HASHTAG_TEXT_REGEX =
  /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]{1,64})/gu
