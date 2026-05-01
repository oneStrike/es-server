import type { EmojiParseToken } from '@libs/interaction/emoji/emoji.type'
import type {
  BuildForumTopicContentPreviewOptions,
  ForumTopicContentPreview,
  ForumTopicContentPreviewSegment,
} from './forum-topic.type'
import {
  FORUM_TOPIC_CONTENT_PREVIEW_MAX_LENGTH,
  FORUM_TOPIC_CONTENT_PREVIEW_MAX_SEGMENTS,
} from './forum-topic.constant'

/**
 * 从编译后的正文 token 派生列表预览。
 */
export function buildForumTopicContentPreview(
  bodyTokens: EmojiParseToken[],
  options: BuildForumTopicContentPreviewOptions = {},
): ForumTopicContentPreview {
  const maxLength = normalizePositiveInteger(
    options.maxLength,
    FORUM_TOPIC_CONTENT_PREVIEW_MAX_LENGTH,
  )
  const maxSegments = normalizePositiveInteger(
    options.maxSegments,
    FORUM_TOPIC_CONTENT_PREVIEW_MAX_SEGMENTS,
  )
  const preview: ForumTopicContentPreview = {
    plainText: '',
    segments: [],
  }

  if (maxLength <= 0 || maxSegments <= 0) {
    return preview
  }

  appendBodyTokens(bodyTokens, preview, maxLength, maxSegments)

  return preview
}

// 按顺序追加 body compiler 生成的预览片段。
function appendBodyTokens(
  bodyTokens: EmojiParseToken[],
  preview: ForumTopicContentPreview,
  maxLength: number,
  maxSegments: number,
) {
  for (const token of bodyTokens) {
    const segment = buildSegmentFromBodyToken(token)
    if (!segment) {
      continue
    }
    appendPreviewSegment(segment, preview, maxLength, maxSegments)
    if (isPreviewFull(preview, maxLength, maxSegments)) {
      break
    }
  }
}

// 将编译后的正文 token 转换为列表预览片段。
function buildSegmentFromBodyToken(
  token: EmojiParseToken,
): ForumTopicContentPreviewSegment | undefined {
  switch (token.type) {
    case 'text':
      return token.text ? { type: 'text', text: token.text } : undefined
    case 'mentionUser': {
      const nickname = token.nickname.trim()
      return nickname
        ? {
            type: 'mention',
            text: token.text || `@${nickname}`,
            userId: token.userId,
            nickname,
          }
        : undefined
    }
    case 'emojiUnicode':
      return token.unicodeSequence
        ? {
            type: 'emoji',
            text: token.unicodeSequence,
            kind: 1,
            unicodeSequence: token.unicodeSequence,
            ...(token.emojiAssetId ? { emojiAssetId: token.emojiAssetId } : {}),
          }
        : undefined
    case 'emojiCustom':
      return token.shortcode
        ? {
            type: 'emoji',
            text: `:${token.shortcode}:`,
            kind: 2,
            shortcode: token.shortcode,
            ...(token.emojiAssetId ? { emojiAssetId: token.emojiAssetId } : {}),
          }
        : undefined
    case 'forumHashtag': {
      const displayName = token.displayName.trim()
      return displayName
        ? {
            type: 'hashtag',
            text: token.text || `#${displayName}`,
            hashtagId: token.hashtagId,
            slug: token.slug,
            displayName,
          }
        : undefined
    }
  }
}

// 在长度和片段数限制内追加一个预览片段。
function appendPreviewSegment(
  segment: ForumTopicContentPreviewSegment,
  preview: ForumTopicContentPreview,
  maxLength: number,
  maxSegments: number,
) {
  if (isPreviewFull(preview, maxLength, maxSegments)) {
    return
  }

  const remainingLength = maxLength - countCharacters(preview.plainText)
  const nextText = takeCharacters(segment.text, remainingLength)
  if (!nextText) {
    return
  }

  const nextSegment =
    countCharacters(nextText) === countCharacters(segment.text)
      ? segment
      : {
          type: 'text' as const,
          text: nextText,
        }

  preview.plainText += nextText
  appendBoundedSegment(nextSegment, preview, maxSegments)
}

// 追加片段并合并相邻普通文本片段。
function appendBoundedSegment(
  segment: ForumTopicContentPreviewSegment,
  preview: ForumTopicContentPreview,
  maxSegments: number,
) {
  if (segment.type === 'text') {
    const lastSegment = preview.segments.at(-1)
    if (lastSegment?.type === 'text') {
      lastSegment.text += segment.text
      return
    }
  }

  if (preview.segments.length >= maxSegments) {
    return
  }

  preview.segments.push(segment)
}

// 判断当前预览是否已经达到长度或片段数上限。
function isPreviewFull(
  preview: ForumTopicContentPreview,
  maxLength: number,
  maxSegments: number,
) {
  return (
    countCharacters(preview.plainText) >= maxLength ||
    preview.segments.length >= maxSegments
  )
}

// 按 Unicode code point 统计字符数，避免截断 surrogate pair。
function countCharacters(value: string) {
  return Array.from(value).length
}

// 按 Unicode code point 截取指定字符数。
function takeCharacters(value: string, maxLength: number) {
  if (maxLength <= 0) {
    return ''
  }
  return Array.from(value).slice(0, maxLength).join('')
}

// 将可选配置规整为非负整数，非法值回退到默认上限。
function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.floor(value))
}
