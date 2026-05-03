import type { EmojiRecentUsageItem } from '../emoji/emoji.type'
import type {
  MentionDraftSnapshot,
  NormalizedMentionDraft,
} from '../mention/mention.type'
import type { BodyToken } from './body-token.type'
import type { BodySceneEnum } from './body.constant'

interface BodyBoldTextMark {
  type: 'bold'
}

interface BodyItalicTextMark {
  type: 'italic'
}

interface BodyUnderlineTextMark {
  type: 'underline'
}

interface BodyLinkTextMark {
  type: 'link'
  href: string
}

/**
 * 文本 mark。
 * - 仅承载正文结构化语义，不直接参与 bodyTokens 展示缓存。
 */
export type BodyTextMark =
  | BodyBoldTextMark
  | BodyItalicTextMark
  | BodyUnderlineTextMark
  | BodyLinkTextMark

/**
 * 纯文本节点。
 * - `marks` 仅用于 rich topic body，不影响纯文本派生。
 */
export interface BodyTextNode {
  type: 'text'
  text: string
  marks?: BodyTextMark[]
}

/**
 * 手动换行节点。
 * - 运行时派生 plainText 时固定渲染为 `\n`。
 */
export interface BodyHardBreakNode {
  type: 'hardBreak'
}

/**
 * 用户提及节点。
 * - `nickname` 会同步参与 plainText 与 mention fact 派生。
 */
export interface BodyMentionUserNode {
  type: 'mentionUser'
  userId: number
  nickname: string
}

/**
 * Unicode emoji 节点。
 * - 直接承载 Unicode 序列，运行时再按 scene 查询 asset 映射。
 */
export interface BodyEmojiUnicodeNode {
  type: 'emojiUnicode'
  unicodeSequence: string
}

/**
 * custom emoji 节点。
 * - 只要求稳定 shortcode，资源细节由 emoji catalog 查询补齐。
 */
export interface BodyEmojiCustomNode {
  type: 'emojiCustom'
  shortcode: string
}

/**
 * forum 话题节点。
 * - 承载已物化的 hashtag 资源快照，供 forum topic / forum comment 正文复用。
 */
export interface BodyForumHashtagNode {
  type: 'forumHashtag'
  hashtagId: number
  slug: string
  displayName: string
}

/**
 * 正文内联节点。
 * - topic/comment 统一共用这一层语义。
 */
export type BodyInlineNode =
  | BodyTextNode
  | BodyHardBreakNode
  | BodyMentionUserNode
  | BodyEmojiUnicodeNode
  | BodyEmojiCustomNode
  | BodyForumHashtagNode

/**
 * 用户提及 inline 节点。
 * - 供 compiler 等内部链路避免重复书写交叉类型。
 */
export type BodyMentionUserInlineNode = Extract<
  BodyInlineNode,
  { type: 'mentionUser' }
>

/**
 * Unicode emoji inline 节点。
 * - 供 compiler 等内部链路避免重复书写交叉类型。
 */
export type BodyEmojiUnicodeInlineNode = Extract<
  BodyInlineNode,
  { type: 'emojiUnicode' }
>

/**
 * custom emoji inline 节点。
 * - 供 compiler 等内部链路避免重复书写交叉类型。
 */
export type BodyEmojiCustomInlineNode = Extract<
  BodyInlineNode,
  { type: 'emojiCustom' }
>

/**
 * forum hashtag inline 节点。
 * - 供 compiler 等内部链路避免重复书写交叉类型。
 */
export type BodyForumHashtagInlineNode = Extract<
  BodyInlineNode,
  { type: 'forumHashtag' }
>

/**
 * 段落节点。
 * - 纯文本与富文本正文都可复用。
 */
export interface BodyParagraphNode {
  type: 'paragraph'
  content: BodyInlineNode[]
}

/**
 * 标题节点。
 * - topic rich body 专用。
 */
export interface BodyHeadingNode {
  type: 'heading'
  level: number
  content: BodyInlineNode[]
}

/**
 * 引用节点。
 * - topic rich body 专用。
 */
export interface BodyBlockquoteNode {
  type: 'blockquote'
  content: BodyInlineNode[]
}

/**
 * 列表项节点。
 * - 为控制复杂度，v1 只允许一层 inline content。
 */
export interface BodyListItemNode {
  type: 'listItem'
  content: BodyInlineNode[]
}

/**
 * 无序列表节点。
 * - topic rich body 专用。
 */
export interface BodyBulletListNode {
  type: 'bulletList'
  content: BodyListItemNode[]
}

/**
 * 有序列表节点。
 * - topic rich body 专用。
 */
export interface BodyOrderedListNode {
  type: 'orderedList'
  content: BodyListItemNode[]
}

/**
 * 正文块级节点。
 * - v1 不把媒体 block 纳入正文文档。
 */
export type BodyBlockNode =
  | BodyParagraphNode
  | BodyHeadingNode
  | BodyBlockquoteNode
  | BodyListItemNode
  | BodyBulletListNode
  | BodyOrderedListNode

/**
 * canonical body 根节点。
 * - topic/comment 的唯一正文真相源。
 */
export interface BodyDoc {
  type: 'doc'
  content: BodyBlockNode[]
}

/**
 * body 编译输入。
 * - scene 决定 emoji 资源查询和正文 schema 语义。
 */
export interface BodyCompileInput {
  body: BodyDoc
  scene: BodySceneEnum
}

/**
 * body 校验输入。
 * - rawBody 允许来自 HTTP payload 或 migration helper 的未知值。
 */
export interface BodyValidationInput {
  rawBody: unknown
  scene: BodySceneEnum
}

/**
 * 纯文本正文构造中的 mention 输入列表。
 * - 与 `PlainTextBodyBuildOptions.mentions` 保持同一边界。
 */
export type PlainTextBodyMentionInputList = MentionDraftSnapshot[]

/**
 * 纯文本正文构造输入。
 * - 用于把 `plainText + mentions` 收敛成 canonical body。
 */
export interface PlainTextBodyBuildOptions {
  mentions?: PlainTextBodyMentionInputList
}

interface BodyTextSegment {
  type: 'text'
  text: string
}

interface BodyMentionUserSegment {
  type: 'mentionUser'
  userId: number
  nickname: string
}

interface BodyEmojiUnicodeSegment {
  type: 'emojiUnicode'
  unicodeSequence: string
}

interface BodyEmojiCustomSegment {
  type: 'emojiCustom'
  shortcode: string
}

/**
 * plain text / legacy token 进入 canonical body 前的线性 segment。
 * - 供纯文本构造和 migration helper 复用同一输入边界。
 */
export type BodySegment =
  | BodyTextSegment
  | BodyMentionUserSegment
  | BodyEmojiUnicodeSegment
  | BodyEmojiCustomSegment

/**
 * body 编译结果。
 * - 统一输出所有运行时派生结果，避免 topic/comment 各自重复推导。
 */
export interface CompiledBodyResult {
  body: BodyDoc
  plainText: string
  bodyTokens: BodyToken[]
  mentionFacts: NormalizedMentionDraft[]
  emojiRecentUsageItems: EmojiRecentUsageItem[]
}

/**
 * migration 辅助输入。
 * - 只承载旧模型到 canonical body 的最小事实。
 */
export interface LegacyMentionFactInput {
  userId: number
  start: number
  end: number
}

interface LegacyBodyTextTokenNode {
  type: 'text'
  text: string
}

interface LegacyBodyMentionUserTokenNode {
  type: 'mentionUser'
  userId: number
  nickname: string
  text: string
}

interface LegacyBodyEmojiUnicodeTokenNode {
  type: 'emojiUnicode'
  unicodeSequence: string
}

interface LegacyBodyEmojiCustomTokenNode {
  type: 'emojiCustom'
  shortcode: string
}

/**
 * legacy token 节点。
 * - 供 migration helper 识别旧 bodyTokens 中的最小可用结构。
 */
export type LegacyBodyTokenNode =
  | LegacyBodyTextTokenNode
  | LegacyBodyMentionUserTokenNode
  | LegacyBodyEmojiUnicodeTokenNode
  | LegacyBodyEmojiCustomTokenNode
