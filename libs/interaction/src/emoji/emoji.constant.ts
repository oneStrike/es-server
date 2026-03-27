/**
 * 表情场景枚举
 */
export enum EmojiSceneEnum {
  CHAT = 1,
  COMMENT = 2,
  FORUM = 3,
}

/**
 * 表情场景可选值列表。
 * - 供 DTO 示例值、默认值与服务校验共享，避免散落魔法数字。
 */
export const EMOJI_SCENE_VALUES = [
  EmojiSceneEnum.CHAT,
  EmojiSceneEnum.COMMENT,
  EmojiSceneEnum.FORUM,
] as const

/**
 * 判断值是否属于 EmojiSceneEnum。
 */
export function isEmojiScene(value: unknown): value is EmojiSceneEnum {
  return (
    typeof value === 'number' &&
    EMOJI_SCENE_VALUES.includes(value as EmojiSceneEnum)
  )
}

/**
 * 表情资源类型枚举
 */
export enum EmojiAssetKindEnum {
  UNICODE = 1,
  CUSTOM = 2,
}

/**
 * 搜索默认条数
 */
export const EMOJI_SEARCH_LIMIT_DEFAULT = 30
/**
 * 搜索最大条数
 */
export const EMOJI_SEARCH_LIMIT_MAX = 100

/**
 * 最近使用默认条数
 */
export const EMOJI_RECENT_LIMIT_DEFAULT = 20
/**
 * 最近使用最大条数
 */
export const EMOJI_RECENT_LIMIT_MAX = 50

/**
 * 短码正则
 */
export const EMOJI_SHORTCODE_REGEX = /:([a-z0-9_]{2,32}):/g
