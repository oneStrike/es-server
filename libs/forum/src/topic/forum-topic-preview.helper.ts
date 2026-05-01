import type {
  BodyBlockNode,
  BodyDoc,
  BodyInlineNode,
  BodyListItemNode,
} from '@libs/interaction/body/body.type'
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
 * 从 canonical body 派生列表预览。
 */
export function buildForumTopicContentPreview(
  body: BodyDoc,
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

  for (let index = 0; index < body.content.length; index += 1) {
    if (isPreviewFull(preview, maxLength, maxSegments)) {
      break
    }
    if (index > 0) {
      appendPreviewSegment(
        { type: 'text', text: '\n\n' },
        preview,
        maxLength,
        maxSegments,
      )
    }
    appendBlockPreview(body.content[index], preview, maxLength, maxSegments)
  }

  return preview
}

// 追加单个顶层块的预览片段。
function appendBlockPreview(
  block: BodyBlockNode,
  preview: ForumTopicContentPreview,
  maxLength: number,
  maxSegments: number,
) {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'blockquote':
    case 'listItem':
      appendInlineNodes(block.content, preview, maxLength, maxSegments)
      break
    case 'bulletList':
    case 'orderedList':
      appendListItems(block.content, preview, maxLength, maxSegments)
      break
  }
}

// 追加列表项内容，并在相邻列表项之间保留单换行。
function appendListItems(
  items: BodyListItemNode[],
  preview: ForumTopicContentPreview,
  maxLength: number,
  maxSegments: number,
) {
  items.forEach((item, index) => {
    if (index > 0) {
      appendPreviewSegment(
        { type: 'text', text: '\n' },
        preview,
        maxLength,
        maxSegments,
      )
    }
    appendInlineNodes(item.content, preview, maxLength, maxSegments)
  })
}

// 按顺序追加行内节点转换出的预览片段。
function appendInlineNodes(
  nodes: BodyInlineNode[],
  preview: ForumTopicContentPreview,
  maxLength: number,
  maxSegments: number,
) {
  for (const node of nodes) {
    const segment = buildSegmentFromInlineNode(node)
    if (!segment) {
      continue
    }
    appendPreviewSegment(segment, preview, maxLength, maxSegments)
    if (isPreviewFull(preview, maxLength, maxSegments)) {
      break
    }
  }
}

// 将 canonical body 行内节点转换为列表预览片段。
function buildSegmentFromInlineNode(
  node: BodyInlineNode,
): ForumTopicContentPreviewSegment | undefined {
  switch (node.type) {
    case 'text':
      return node.text ? { type: 'text', text: node.text } : undefined
    case 'hardBreak':
      return { type: 'text', text: '\n' }
    case 'mentionUser': {
      const nickname = node.nickname.trim()
      return nickname
        ? {
            type: 'mention',
            text: `@${nickname}`,
            userId: node.userId,
            nickname,
          }
        : undefined
    }
    case 'emojiUnicode':
      return node.unicodeSequence
        ? { type: 'text', text: node.unicodeSequence }
        : undefined
    case 'emojiCustom':
      return node.shortcode
        ? { type: 'text', text: `:${node.shortcode}:` }
        : undefined
    case 'forumHashtag': {
      const displayName = node.displayName.trim()
      return displayName
        ? {
            type: 'hashtag',
            text: `#${displayName}`,
            hashtagId: node.hashtagId,
            slug: node.slug,
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
    nextText.length === segment.text.length
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
