import { EmojiSceneEnum } from '../emoji/emoji.constant'

/**
 * 正文场景。
 * - `topic` 使用更宽的富文本 schema。
 * - `comment` 只允许受限的纯文本增强 schema。
 */
export enum BodySceneEnum {
  // 论坛主题正文，允许富文本块级结构。
  TOPIC = 'topic',
  // 评论正文，限制为段落型增强文本。
  COMMENT = 'comment',
}

/**
 * 当前 canonical body 版本。
 * - 用于正文 schema 演进时的版本门禁。
 */
export const BODY_VERSION_V1 = 1

/**
 * topic 场景允许的块级节点。
 * - 使用字符串闭集，供 validator 统一校验。
 */
export const TOPIC_BODY_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
] as const

/**
 * comment 场景允许的块级节点。
 * - 评论正文保持受限 schema，不开放 heading/list/quote。
 */
export const COMMENT_BODY_BLOCK_TYPES = ['paragraph'] as const

/**
 * 正文允许的内联节点。
 * - topic/comment 共用同一组 inline 语义。
 */
export const BODY_INLINE_NODE_TYPES = [
  'text',
  'hardBreak',
  'mentionUser',
  'emojiUnicode',
  'emojiCustom',
  'forumHashtag',
] as const

/**
 * 正文文本 mark。
 * - 当前仅 topic rich body 允许使用。
 */
export const BODY_TEXT_MARK_TYPES = [
  'bold',
  'italic',
  'underline',
  'link',
] as const

/**
 * 将正文场景映射为 emoji 场景。
 * - body compiler 通过它加载 scene-aware emoji 资源与 recent usage。
 */
export function mapBodySceneToEmojiScene(scene: BodySceneEnum) {
  return scene === BodySceneEnum.TOPIC
    ? EmojiSceneEnum.FORUM
    : EmojiSceneEnum.COMMENT
}
