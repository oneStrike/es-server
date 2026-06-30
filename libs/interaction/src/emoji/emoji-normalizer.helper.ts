import type { EmojiKeywords } from './emoji-normalizer.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'

const EMOJI_UNICODE_REGEX = /\p{RGI_Emoji}/gv
const CODEPOINT_TOKEN_REGEX = /^(?:U\+|0x)?[0-9a-f]{4,6}$/i
const SHORTCODE_REGEX = /^[a-z0-9_]{2,32}$/

export function normalizeEmojiShortcode(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const shortcode = String(value).trim().toLowerCase()
  if (!SHORTCODE_REGEX.test(shortcode)) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      'shortcode 仅允许 2-32 位小写字母、数字和下划线',
    )
  }

  return shortcode
}

export function normalizeEmojiUnicodeSequence(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const normalized = Array.isArray(value)
    ? normalizeCodepointTokens(value)
    : normalizeUnicodeText(String(value))

  if (!isEmojiUnicodeSequence(normalized)) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      'unicodeSequence 必须是可解析的 Unicode 表情序列',
    )
  }

  return normalized
}

export function normalizeEmojiKeywords(value: unknown): EmojiKeywords | null {
  if (value === undefined || value === null) {
    return null
  }
  if (!isPlainObject(value)) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      'keywords 必须是语言到关键词数组的对象',
    )
  }

  const normalized: EmojiKeywords = {}
  for (const [rawLocale, rawKeywords] of Object.entries(value)) {
    const locale = rawLocale.trim()
    if (!locale) {
      continue
    }
    if (!Array.isArray(rawKeywords)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'keywords 每个语言值必须是字符串数组',
      )
    }

    const keywords = [
      ...new Set(
        rawKeywords
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ]
    if (keywords.length > 0) {
      normalized[locale] = keywords
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

export function isEmojiUnicodeSequence(value: string) {
  const matches = Array.from(
    value.matchAll(
      new RegExp(EMOJI_UNICODE_REGEX.source, EMOJI_UNICODE_REGEX.flags),
    ),
    (match) => match[0],
  )
  return matches.length > 0 && matches.join('') === value
}

function normalizeUnicodeText(value: string) {
  const text = value.trim()
  if (!text) {
    return ''
  }
  if (isCodepointList(text)) {
    return normalizeCodepointTokens(tokenizeCodepointText(text))
  }
  return text
}

function isCodepointList(value: string) {
  const tokens = tokenizeCodepointText(value)
  return (
    tokens.length > 0 &&
    tokens.every((token) => CODEPOINT_TOKEN_REGEX.test(token))
  )
}

function tokenizeCodepointText(value: string) {
  return value
    .replace(/(^|[^U])\+/gi, '$1 ')
    .split(/[\s,;_|-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function normalizeCodepointTokens(tokens: unknown[]) {
  return tokens
    .map((token) => normalizeCodepointToken(String(token)))
    .map((codepoint) => String.fromCodePoint(codepoint))
    .join('')
}

function normalizeCodepointToken(token: string) {
  const raw = token.trim().replace(/^U\+/i, '').replace(/^0x/i, '')
  if (!CODEPOINT_TOKEN_REGEX.test(raw)) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      'unicodeSequence 包含非法码点',
    )
  }
  const codepoint = Number.parseInt(raw, 16)
  if (codepoint < 0 || codepoint > 0x10FFFF) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      'unicodeSequence 包含非法码点',
    )
  }
  return codepoint
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}
