import type { NormalizedMentionDraft } from '../mention/mention.type'
import type { BodyToken } from './body-token.type'
import type { BodySceneEnum } from './body.constant'
import type {
  BodyBlockNode,
  BodyDoc,
  BodyEmojiCustomInlineNode,
  BodyEmojiUnicodeInlineNode,
  BodyForumHashtagInlineNode,
  BodyInlineNode,
  BodyMentionUserInlineNode,
  CompiledBodyResult,
} from './body.type'
import { EmojiCatalogService } from '@libs/interaction/emoji/emoji-catalog.service'
import { EmojiParserService } from '@libs/interaction/emoji/emoji-parser.service'
import { buildRecentEmojiUsageItems } from '@libs/interaction/emoji/emoji-recent-usage.helper'
import { Injectable } from '@nestjs/common'
import { mapBodySceneToEmojiScene } from './body.constant'

/**
 * 正文编译服务。
 * - 从 canonical body 一次性派生 plainText、bodyTokens、mention facts 与 emoji recent usage。
 */
@Injectable()
export class BodyCompilerService {
  constructor(
    private readonly emojiCatalogService: EmojiCatalogService,
    private readonly emojiParserService: EmojiParserService,
  ) {}

  // 编译 canonical body，并统一产出所有运行时派生结果。
  async compile(
    body: BodyDoc,
    scene: BodySceneEnum,
  ): Promise<CompiledBodyResult> {
    const explicitEmojiRefs = this.collectExplicitEmojiRefs(body)
    const emojiScene = mapBodySceneToEmojiScene(scene)
    const [customEmojiMap, unicodeEmojiMap] = await Promise.all([
      this.emojiCatalogService.findCustomAssetsByShortcodes(
        emojiScene,
        explicitEmojiRefs.shortcodes,
      ),
      this.emojiCatalogService.findUnicodeAssetsBySequences(
        emojiScene,
        explicitEmojiRefs.unicodeSequences,
      ),
    ])

    const mentionFacts: NormalizedMentionDraft[] = []
    const bodyTokens: BodyToken[] = []
    let plainText = ''

    const appendText = async (text: string) => {
      if (!text) {
        return
      }
      plainText += text
      bodyTokens.push(
        ...(await this.emojiParserService.parse({
          body: text,
          scene: emojiScene,
        })),
      )
    }

    const appendMention = (mention: BodyMentionUserInlineNode) => {
      const text = `@${mention.nickname}`
      const start = plainText.length
      plainText += text
      mentionFacts.push({
        userId: mention.userId,
        nickname: mention.nickname,
        start,
        end: plainText.length,
        text,
      })
      bodyTokens.push({
        type: 'mentionUser',
        userId: mention.userId,
        nickname: mention.nickname,
        text,
      })
    }

    const appendExplicitUnicodeEmoji = (
      emojiNode: BodyEmojiUnicodeInlineNode,
    ) => {
      plainText += emojiNode.unicodeSequence
      bodyTokens.push({
        type: 'emojiUnicode',
        unicodeSequence: emojiNode.unicodeSequence,
        emojiAssetId: unicodeEmojiMap.get(emojiNode.unicodeSequence)
          ?.emojiAssetId,
      })
    }

    const appendExplicitCustomEmoji = (
      emojiNode: BodyEmojiCustomInlineNode,
    ) => {
      const shortcodeText = `:${emojiNode.shortcode}:`
      const asset = customEmojiMap.get(emojiNode.shortcode)
      plainText += shortcodeText
      if (!asset) {
        bodyTokens.push({
          type: 'emojiCustom',
          shortcode: emojiNode.shortcode,
        })
        return
      }

      bodyTokens.push({
        type: 'emojiCustom',
        emojiAssetId: asset.emojiAssetId,
        shortcode: asset.shortcode,
        packCode: asset.packCode,
        imageUrl: asset.imageUrl,
        staticUrl: asset.staticUrl ?? undefined,
        isAnimated: asset.isAnimated,
        ariaLabel: asset.ariaLabel,
      })
    }

    const appendForumHashtag = (hashtagNode: BodyForumHashtagInlineNode) => {
      const text = `#${hashtagNode.displayName}`
      plainText += text
      bodyTokens.push({
        type: 'forumHashtag',
        hashtagId: hashtagNode.hashtagId,
        slug: hashtagNode.slug,
        displayName: hashtagNode.displayName,
        text,
      })
    }

    const renderInlineNodes = async (nodes: BodyInlineNode[]) => {
      for (const node of nodes) {
        switch (node.type) {
          case 'text':
            await appendText(node.text)
            break
          case 'hardBreak':
            await appendText('\n')
            break
          case 'mentionUser':
            appendMention(node)
            break
          case 'emojiUnicode':
            appendExplicitUnicodeEmoji(node)
            break
          case 'emojiCustom':
            appendExplicitCustomEmoji(node)
            break
          case 'forumHashtag':
            appendForumHashtag(node)
            break
          default: {
            const unsupportedNode: never = node
            throw new Error(
              `Unsupported body inline node: ${this.describeUnsupportedNodeType(
                unsupportedNode,
              )}`,
            )
          }
        }
      }
    }

    const renderBlockNode = async (block: BodyBlockNode) => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
        case 'blockquote':
        case 'listItem':
          await renderInlineNodes(block.content)
          break
        case 'bulletList':
        case 'orderedList':
          for (let index = 0; index < block.content.length; index += 1) {
            if (index > 0) {
              await appendText('\n')
            }
            await renderInlineNodes(block.content[index].content)
          }
          break
        default: {
          const unsupportedBlock: never = block
          throw new Error(
            `Unsupported body block node: ${this.describeUnsupportedNodeType(
              unsupportedBlock,
            )}`,
          )
        }
      }
    }

    for (let index = 0; index < body.content.length; index += 1) {
      if (index > 0) {
        await appendText('\n\n')
      }
      await renderBlockNode(body.content[index])
    }

    return {
      body,
      plainText,
      bodyTokens,
      mentionFacts,
      emojiRecentUsageItems: buildRecentEmojiUsageItems(bodyTokens),
    }
  }

  // 描述未知节点类型，供穷尽分支的兜底错误使用。
  private describeUnsupportedNodeType(node: unknown) {
    if (typeof node === 'object' && node !== null && 'type' in node) {
      return String((node as { type?: unknown }).type)
    }

    return 'unknown'
  }

  // 预先收集显式 emoji 节点，避免逐节点重复查 catalog。
  private collectExplicitEmojiRefs(body: BodyDoc) {
    const unicodeSequences = new Set<string>()
    const shortcodes = new Set<string>()

    const collectInlineNodes = (nodes: BodyInlineNode[]) => {
      for (const node of nodes) {
        if (node.type === 'emojiUnicode') {
          unicodeSequences.add(node.unicodeSequence)
        } else if (node.type === 'emojiCustom') {
          shortcodes.add(node.shortcode)
        }
      }
    }

    for (const block of body.content) {
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        for (const item of block.content) {
          collectInlineNodes(item.content)
        }
        continue
      }
      collectInlineNodes(block.content)
    }

    return {
      unicodeSequences: [...unicodeSequences],
      shortcodes: [...shortcodes],
    }
  }
}
