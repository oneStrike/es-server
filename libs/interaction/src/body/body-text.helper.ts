import type {
  BodyBlockNode,
  BodyDoc,
  BodyInlineNode,
  BodyListItemNode,
  PlainTextBodyBuildOptions,
} from './body.type'
import { BadRequestException } from '@nestjs/common'
import { EMOJI_SHORTCODE_REGEX } from '../emoji/emoji.constant'

type BodySegment =
  | {
      type: 'text'
      text: string
    }
    | {
      type: 'mentionUser'
      userId: number
      nickname: string
    }
    | {
      type: 'emojiUnicode'
      unicodeSequence: string
    }
    | {
      type: 'emojiCustom'
      shortcode: string
    }

const EMOJI_UNICODE_REGEX = /\p{RGI_Emoji}/gv

/**
 * 将纯文本包装成 canonical body。
 * - 双换行拆段，单换行变 hardBreak，兼顾 topic plain 与 comment 纯文本输入。
 */
export function createBodyDocFromPlainText(
  text: string,
  options: PlainTextBodyBuildOptions = {},
): BodyDoc {
  const normalizedText = text.replace(/\r\n?/g, '\n')
  const segments = createSegmentsFromPlainText(normalizedText, options)

  return createBodyDocFromSegments(segments)
}

/**
 * 将 legacy segment 流重建为 canonical body。
 * - 统一按段落 / hardBreak 规则拆分，供 migration helper 复用。
 */
export function createBodyDocFromSegments(segments: BodySegment[]): BodyDoc {
  const blocks: BodyBlockNode[] = []
  let currentParagraph: BodyInlineNode[] = []

  const pushCurrentParagraph = () => {
    if (currentParagraph.length === 0) {
      return
    }
    blocks.push({
      type: 'paragraph',
      content: currentParagraph,
    })
    currentParagraph = []
  }

  for (const segment of segments) {
    if (segment.type !== 'text') {
      currentParagraph.push(segment)
      continue
    }

    const parts = segment.text.replace(/\r\n?/g, '\n').split(/(\n+)/)
    for (const part of parts) {
      if (!part) {
        continue
      }

      if (!part.startsWith('\n')) {
        currentParagraph.push({
          type: 'text',
          text: part,
        })
        continue
      }

      if (part.length >= 2) {
        pushCurrentParagraph()
        continue
      }

      if (currentParagraph.length > 0) {
        currentParagraph.push({
          type: 'hardBreak',
        })
      }
    }
  }

  if (blocks.length === 0 || currentParagraph.length > 0) {
    pushCurrentParagraph()
  }

  return {
    type: 'doc',
    content: blocks,
  }
}

/**
 * 规范化 legacy 列表项文本为 list item。
 * - 供 future migration 或 body 构造扩展时复用。
 */
export function createListItemFromPlainText(text: string): BodyListItemNode {
  return {
    type: 'listItem',
    content: createInlineNodesFromParagraphText(text),
  }
}

/**
 * 将单段文本拆为 inline 节点。
 * - 单换行保留为 hardBreak，其余内容保持 text 节点。
 */
function createInlineNodesFromParagraphText(text: string): BodyInlineNode[] {
  if (!text) {
    return []
  }

  const lines = text.split('\n')
  const nodes: BodyInlineNode[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.length > 0) {
      nodes.push({
        type: 'text',
        text: line,
      })
    }

    if (index < lines.length - 1) {
      nodes.push({
        type: 'hardBreak',
      })
    }
  }

  return nodes
}

/**
 * 将纯文本与显式 mention 元数据组装为 segment 流。
 * - 先按 mention 切片，再在普通文本片段里识别 custom / unicode emoji。
 */
function createSegmentsFromPlainText(
  plainText: string,
  options: PlainTextBodyBuildOptions,
): BodySegment[] {
  const normalizedMentions = normalizeMentionSnapshots(
    plainText,
    options.mentions,
  )
  if (normalizedMentions.length === 0) {
    return createSegmentsFromText(plainText)
  }

  const segments: BodySegment[] = []
  let cursor = 0

  for (const mention of normalizedMentions) {
    if (mention.start > cursor) {
      segments.push(...createSegmentsFromText(plainText.slice(cursor, mention.start)))
    }

    segments.push({
      type: 'mentionUser',
      userId: mention.userId,
      nickname: mention.nickname,
    })
    cursor = mention.end
  }

  if (cursor < plainText.length) {
    segments.push(...createSegmentsFromText(plainText.slice(cursor)))
  }

  return segments
}

/**
 * 将普通文本片段拆成 text / emojiUnicode / emojiCustom segment。
 * - custom emoji 先按 `:shortcode:` 识别，再拆 Unicode emoji。
 */
function createSegmentsFromText(text: string): BodySegment[] {
  if (!text) {
    return []
  }

  const segments: BodySegment[] = []
  let cursor = 0
  const shortcodeRegex = new RegExp(
    EMOJI_SHORTCODE_REGEX.source,
    EMOJI_SHORTCODE_REGEX.flags,
  )

  for (const match of text.matchAll(shortcodeRegex)) {
    const full = match[0]
    const shortcode = match[1]
    const index = match.index ?? 0

    if (index > cursor) {
      segments.push(...createSegmentsFromUnicodeText(text.slice(cursor, index)))
    }

    segments.push({
      type: 'emojiCustom',
      shortcode,
    })
    cursor = index + full.length
  }

  if (cursor < text.length) {
    segments.push(...createSegmentsFromUnicodeText(text.slice(cursor)))
  }

  return segments
}

/**
 * 将文本片段拆成 text / emojiUnicode segment。
 */
function createSegmentsFromUnicodeText(text: string): BodySegment[] {
  if (!text) {
    return []
  }

  const segments: BodySegment[] = []
  let cursor = 0
  const unicodeRegex = new RegExp(
    EMOJI_UNICODE_REGEX.source,
    EMOJI_UNICODE_REGEX.flags,
  )

  for (const match of text.matchAll(unicodeRegex)) {
    const unicode = match[0]
    const index = match.index ?? 0

    if (index > cursor) {
      segments.push({
        type: 'text',
        text: text.slice(cursor, index),
      })
    }

    segments.push({
      type: 'emojiUnicode',
      unicodeSequence: unicode,
    })
    cursor = index + unicode.length
  }

  if (cursor < text.length) {
    segments.push({
      type: 'text',
      text: text.slice(cursor),
    })
  }

  return segments
}

/**
 * 规范化 plain mention 元数据。
 * - 正文切片必须精确等于 `@昵称`
 * - 区间必须有序且不重叠
 */
function normalizeMentionSnapshots(
  plainText: string,
  mentions?: PlainTextBodyBuildOptions['mentions'],
) {
  if (!mentions?.length) {
    return []
  }

  const normalizedMentions = mentions
    .map((mention) => {
      const nickname = mention.nickname.trim()
      if (!nickname) {
        throw new BadRequestException('提及昵称不能为空')
      }
      if (
        !Number.isInteger(mention.start) ||
        !Number.isInteger(mention.end) ||
        mention.start < 0 ||
        mention.end <= mention.start ||
        mention.end > plainText.length
      ) {
        throw new BadRequestException('提及位置非法')
      }

      const text = plainText.slice(mention.start, mention.end)
      if (text !== `@${nickname}`) {
        throw new BadRequestException('提及位置与正文不匹配')
      }

      return {
        userId: mention.userId,
        nickname,
        start: mention.start,
        end: mention.end,
      }
    })
    .sort((left, right) => left.start - right.start || left.end - right.end)

  let previousEnd = -1
  for (const mention of normalizedMentions) {
    if (mention.start < previousEnd) {
      throw new BadRequestException('提及区间不能重叠')
    }
    previousEnd = mention.end
  }

  return normalizedMentions
}
