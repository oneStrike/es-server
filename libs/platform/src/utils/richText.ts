import type { JsonValue } from './jsonParse'
import { jsonParse } from './jsonParse'

const RICH_TEXT_BLOCK_NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'listitem',
  'bulletlist',
  'orderedlist',
])

/**
 * 从富文本或普通文本内容中提纯可读纯文本。
 * 优先兼容 JSON 富文本，其次处理 HTML 富文本；都不命中时退回普通文本清洗。
 */
export function extractPlainTextFromRichTextContent(content: string) {
  const normalizedContent = content.trim()
  if (!normalizedContent) {
    return ''
  }

  const jsonText = extractPlainTextFromJsonRichText(normalizedContent)
  if (jsonText) {
    return jsonText
  }

  if (/[<&]/.test(normalizedContent)) {
    const htmlText = extractPlainTextFromHtmlRichText(normalizedContent)
    if (htmlText) {
      return htmlText
    }
  }

  return normalizeRichTextPlainText(normalizedContent)
}

/**
 * 统一清洗富文本提纯后的标题候选文本。
 * 负责解码常见 HTML 实体，并把连续空白折叠为单个空格。
 */
function normalizeRichTextPlainText(text: string) {
  return decodeHtmlEntities(text)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 解码富文本正文里高频出现的 HTML 实体。
 * 仅覆盖标题/摘要链路常见转义，避免把标签原文带进读取侧文本。
 */
function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),)
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),)
}

/**
 * 从 HTML 富文本正文提纯可读文本。
 * 块级标签先转换成分隔空白，再移除剩余标签。
 */
function extractPlainTextFromHtmlRichText(content: string) {
  const htmlLikeContent = content
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|li|tr|blockquote|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  return normalizeRichTextPlainText(htmlLikeContent)
}

/**
 * 从 JSON 富文本正文提纯可读文本。
 * 当前兼容常见编辑器的 text / insert 文本节点，其余结构继续递归向下查找。
 */
function extractPlainTextFromJsonRichText(content: string) {
  if (
    !content.startsWith('{') &&
    !content.startsWith('[') &&
    !content.startsWith('"')
  ) {
    return ''
  }

  const parsedContent = jsonParse<JsonValue>(content)
  if (parsedContent === null) {
    return ''
  }

  if (typeof parsedContent === 'string') {
    return normalizeRichTextPlainText(parsedContent)
  }

  return normalizeRichTextPlainText(renderPlainTextFromJsonRichText(parsedContent))
}

/**
 * 递归渲染 JSON 富文本中的文本节点。
 * 内联节点直接拼接，块级节点在尾部补换行，避免把同段文字拆开或把多段正文粘连。
 */
function renderPlainTextFromJsonRichText(value: JsonValue): string {
  if (Array.isArray(value)) {
    return value.map(item => renderPlainTextFromJsonRichText(item)).join('')
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  if (typeof value.text === 'string') {
    return value.text
  }
  if (typeof value.insert === 'string') {
    return value.insert
  }

  const fragments: string[] = []
  for (const child of Object.values(value)) {
    if (Array.isArray(child) || (child && typeof child === 'object')) {
      const fragment = renderPlainTextFromJsonRichText(child as JsonValue)
      if (fragment) {
        fragments.push(fragment)
      }
    }
  }

  const joinedText = fragments.join('')
  if (!joinedText) {
    return ''
  }

  if (isRichTextBlockNode(value)) {
    return `${joinedText}\n`
  }

  return joinedText
}

/**
 * 判断 JSON 富文本节点是否代表块级语义。
 * 仅块级节点追加分隔，避免内联格式节点把文本拆出多余空格。
 */
function isRichTextBlockNode(value: Record<string, JsonValue>) {
  if (typeof value.type !== 'string') {
    return false
  }

  return RICH_TEXT_BLOCK_NODE_TYPES.has(value.type.toLowerCase())
}
