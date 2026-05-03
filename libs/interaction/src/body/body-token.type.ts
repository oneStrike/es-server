import type { EmojiAssetSelect } from '@db/schema'

interface BodyTextToken {
  type: 'text'
  text: string
}

interface BodyMentionUserToken {
  type: 'mentionUser'
  userId: number
  nickname: string
  text: string
}

interface BodyEmojiUnicodeToken {
  type: 'emojiUnicode'
  unicodeSequence: string
  emojiAssetId?: EmojiAssetSelect['id']
}

interface BodyEmojiCustomToken {
  type: 'emojiCustom'
  shortcode: string
  emojiAssetId?: EmojiAssetSelect['id']
  packCode?: string
  imageUrl?: string
  staticUrl?: string
  isAnimated?: boolean
  ariaLabel?: string
}

interface BodyForumHashtagToken {
  type: 'forumHashtag'
  hashtagId: number
  slug: string
  displayName: string
  text: string
}

/**
 * 正文语义 token。
 * - 作为 bodyTokens 的内部运行时合同，覆盖普通文本、提及、话题与表情。
 */
export type BodyToken =
  | BodyTextToken
  | BodyMentionUserToken
  | BodyEmojiUnicodeToken
  | BodyEmojiCustomToken
  | BodyForumHashtagToken
