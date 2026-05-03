import type { BodyToken } from '../body/body-token.type'
import type { EmojiParseInput } from './emoji.type'
import { Injectable } from '@nestjs/common'
import { EmojiCatalogService } from './emoji-catalog.service'
import { EMOJI_SHORTCODE_REGEX } from './emoji.constant'

const EMOJI_UNICODE_REGEX = /\p{RGI_Emoji}/gv

/**
 * 将文本解析为普通文本、Unicode 表情和自定义短码三类 token。
 * - 解析不到的短码保持原文，避免误替换造成内容丢失。
 */
@Injectable()
export class EmojiParserService {
  constructor(private readonly emojiCatalogService: EmojiCatalogService) {}

  /**
   * 将文本解析为普通文本、Unicode 表情和自定义短码三类 token。
   * - 先提取所有短码和 Unicode 序列并批量查询映射，再按顺序生成 token 列表。
   * - 未命中映射的短码保持原文，避免误替换造成内容丢失。
   * - 命中平台托管资源的 token 会补齐 emojiAssetId，供最近使用统计复用。
   * - 剩余文本段再拆分 Unicode 表情，最后合并连续文本 token。
   */
  async parse(input: EmojiParseInput): Promise<BodyToken[]> {
    const body = input.body || ''
    if (!body) {
      return []
    }

    const shortcodes = Array.from(
      body.matchAll(
        new RegExp(EMOJI_SHORTCODE_REGEX.source, EMOJI_SHORTCODE_REGEX.flags),
      ),
      (match) => match[1],
    )
    const unicodeSequences = Array.from(
      body.matchAll(
        new RegExp(EMOJI_UNICODE_REGEX.source, EMOJI_UNICODE_REGEX.flags),
      ),
      (match) => match[0],
    )
    const [shortcodeAssetMap, unicodeAssetMap] = await Promise.all([
      this.emojiCatalogService.findCustomAssetsByShortcodes(
        input.scene,
        shortcodes,
      ),
      this.emojiCatalogService.findUnicodeAssetsBySequences(
        input.scene,
        unicodeSequences,
      ),
    ])

    const tokens: BodyToken[] = []
    let cursor = 0
    const shortcodeRegex = new RegExp(
      EMOJI_SHORTCODE_REGEX.source,
      EMOJI_SHORTCODE_REGEX.flags,
    )

    for (const match of body.matchAll(shortcodeRegex)) {
      const full = match[0]
      const shortcode = match[1]
      const index = match.index ?? 0

      if (index > cursor) {
        this.pushTextSegment(tokens, body.slice(cursor, index), unicodeAssetMap)
      }

      const asset = shortcodeAssetMap.get(shortcode)
      if (asset) {
        tokens.push({
          type: 'emojiCustom',
          emojiAssetId: asset.emojiAssetId,
          shortcode: asset.shortcode,
          packCode: asset.packCode,
          imageUrl: asset.imageUrl,
          staticUrl: asset.staticUrl ?? undefined,
          isAnimated: asset.isAnimated,
          ariaLabel: asset.ariaLabel,
        })
      } else {
        // 未命中短码映射时按普通文本回写，保持输入内容可逆。
        this.pushTextToken(tokens, full)
      }

      cursor = index + full.length
    }

    if (cursor < body.length) {
      this.pushTextSegment(tokens, body.slice(cursor), unicodeAssetMap)
    }

    return tokens
  }

  /**
   * 将文本段拆分为普通文本和 Unicode 表情 token。
   * - 使用 RGI_Emoji 正则匹配完整 Unicode 表情序列。
   * - 命中平台托管 Unicode 资源时补齐 emojiAssetId。
   * - 递归调用 pushTextToken 合并连续的普通文本。
   */
  private pushTextSegment(
    tokens: BodyToken[],
    segment: string,
    unicodeAssetMap: Map<string, { emojiAssetId: number }>,
  ) {
    if (!segment) {
      return
    }

    let cursor = 0
    for (const match of segment.matchAll(
      new RegExp(EMOJI_UNICODE_REGEX.source, EMOJI_UNICODE_REGEX.flags),
    )) {
      const unicode = match[0]
      const index = match.index ?? 0

      if (index > cursor) {
        this.pushTextToken(tokens, segment.slice(cursor, index))
      }

      tokens.push({
        type: 'emojiUnicode',
        unicodeSequence: unicode,
        emojiAssetId: unicodeAssetMap.get(unicode)?.emojiAssetId,
      })
      cursor = index + unicode.length
    }

    if (cursor < segment.length) {
      this.pushTextToken(tokens, segment.slice(cursor))
    }
  }

  /**
   * 添加普通文本 token。
   * - 如果最后一个 token 已是文本类型，则合并到该 token。
   * - 避免生成连续的文本 token，减少结果数组长度。
   */
  private pushTextToken(tokens: BodyToken[], text: string) {
    if (!text) {
      return
    }
    const last = tokens.at(-1)
    if (last?.type === 'text') {
      last.text += text
      return
    }
    tokens.push({
      type: 'text',
      text,
    })
  }
}
