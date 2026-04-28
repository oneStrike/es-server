import type {
  BodyBlockNode,
  BodyDoc,
  BodyInlineNode,
  BodyListItemNode,
  BodyTextMark,
} from './body.type'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  BODY_TEXT_MARK_TYPES,
  BodySceneEnum,
  COMMENT_BODY_BLOCK_TYPES,
  TOPIC_BODY_BLOCK_TYPES,
} from './body.constant'

/**
 * 正文结构校验服务。
 * - 统一校验 topic/comment canonical body 的节点类型、递归结构和场景白名单。
 */
@Injectable()
export class BodyValidatorService {
  // 按场景校验正文结构，并返回强类型 body。
  validateBodyOrThrow(rawBody: unknown, scene: BodySceneEnum): BodyDoc {
    if (!this.isRecord(rawBody) || rawBody.type !== 'doc') {
      throw new BadRequestException('body 根节点必须是 doc')
    }

    const content = rawBody.content
    if (!Array.isArray(content)) {
      throw new BadRequestException('body.content 必须是数组')
    }

    const blocks = content.map((block, index) =>
      this.validateBlockNodeOrThrow(block, scene, `body.content[${index}]`),
    )

    return {
      type: 'doc',
      content: blocks,
    }
  }

  // 校验块级节点。
  private validateBlockNodeOrThrow(
    rawBlock: unknown,
    scene: BodySceneEnum,
    path: string,
  ): BodyBlockNode {
    if (!this.isRecord(rawBlock) || typeof rawBlock.type !== 'string') {
      throw new BadRequestException(`${path} 必须是合法块级节点`)
    }

    const allowedBlockTypes =
      scene === BodySceneEnum.TOPIC
        ? TOPIC_BODY_BLOCK_TYPES
        : COMMENT_BODY_BLOCK_TYPES

    if (!allowedBlockTypes.includes(rawBlock.type as never)) {
      throw new BadRequestException(`${path}.type 不允许在当前场景使用`)
    }

    switch (rawBlock.type) {
      case 'paragraph':
      case 'blockquote':
        return {
          type: rawBlock.type,
          content: this.validateInlineContentOrThrow(
            rawBlock.content,
            `${path}.content`,
          ),
        }
      case 'heading': {
        if (
          !Number.isInteger(rawBlock.level) ||
          rawBlock.level < 1 ||
          rawBlock.level > 6
        ) {
          throw new BadRequestException(`${path}.level 必须是 1-6 的整数`)
        }

        return {
          type: 'heading',
          level: rawBlock.level,
          content: this.validateInlineContentOrThrow(
            rawBlock.content,
            `${path}.content`,
          ),
        }
      }
      case 'listItem':
        return {
          type: 'listItem',
          content: this.validateInlineContentOrThrow(
            rawBlock.content,
            `${path}.content`,
          ),
        }
      case 'bulletList':
      case 'orderedList':
        return {
          type: rawBlock.type,
          content: this.validateListItemsOrThrow(
            rawBlock.content,
            `${path}.content`,
          ),
        }
      default:
        throw new BadRequestException(`${path}.type 不支持`)
    }
  }

  // 校验列表项数组。
  private validateListItemsOrThrow(
    rawItems: unknown,
    path: string,
  ): BodyListItemNode[] {
    if (!Array.isArray(rawItems)) {
      throw new BadRequestException(`${path} 必须是数组`)
    }

    return rawItems.map((item, index) => {
      const validated = this.validateBlockNodeOrThrow(
        item,
        BodySceneEnum.TOPIC,
        `${path}[${index}]`,
      )
      if (validated.type !== 'listItem') {
        throw new BadRequestException(`${path}[${index}] 必须是 listItem`)
      }
      return validated
    })
  }

  // 校验 inline 节点数组。
  private validateInlineContentOrThrow(
    rawContent: unknown,
    path: string,
  ): BodyInlineNode[] {
    if (!Array.isArray(rawContent)) {
      throw new BadRequestException(`${path} 必须是数组`)
    }

    return rawContent.map((node, index) =>
      this.validateInlineNodeOrThrow(node, `${path}[${index}]`),
    )
  }

  // 校验 inline 节点。
  private validateInlineNodeOrThrow(
    rawNode: unknown,
    path: string,
  ): BodyInlineNode {
    if (!this.isRecord(rawNode) || typeof rawNode.type !== 'string') {
      throw new BadRequestException(`${path} 必须是合法内联节点`)
    }

    switch (rawNode.type) {
      case 'text':
        if (typeof rawNode.text !== 'string') {
          throw new BadRequestException(`${path}.text 必须是字符串`)
        }
        return {
          type: 'text',
          text: rawNode.text,
          marks: this.validateTextMarksOrThrow(rawNode.marks, `${path}.marks`),
        }
      case 'hardBreak':
        return {
          type: 'hardBreak',
        }
      case 'mentionUser':
        if (!Number.isInteger(rawNode.userId) || rawNode.userId <= 0) {
          throw new BadRequestException(`${path}.userId 必须是正整数`)
        }
        if (
          typeof rawNode.nickname !== 'string' ||
          rawNode.nickname.trim().length === 0
        ) {
          throw new BadRequestException(`${path}.nickname 不能为空`)
        }
        return {
          type: 'mentionUser',
          userId: rawNode.userId,
          nickname: rawNode.nickname.trim(),
        }
      case 'emojiUnicode':
        if (
          typeof rawNode.unicodeSequence !== 'string' ||
          rawNode.unicodeSequence.length === 0
        ) {
          throw new BadRequestException(`${path}.unicodeSequence 不能为空`)
        }
        return {
          type: 'emojiUnicode',
          unicodeSequence: rawNode.unicodeSequence,
        }
      case 'emojiCustom':
        if (
          typeof rawNode.shortcode !== 'string' ||
          !/^[a-z0-9_]{2,32}$/.test(rawNode.shortcode)
        ) {
          throw new BadRequestException(`${path}.shortcode 非法`)
        }
        return {
          type: 'emojiCustom',
          shortcode: rawNode.shortcode,
        }
      case 'forumHashtag':
        if (!Number.isInteger(rawNode.hashtagId) || rawNode.hashtagId <= 0) {
          throw new BadRequestException(`${path}.hashtagId 必须是正整数`)
        }
        if (
          typeof rawNode.slug !== 'string' ||
          rawNode.slug.trim().length === 0
        ) {
          throw new BadRequestException(`${path}.slug 不能为空`)
        }
        if (
          typeof rawNode.displayName !== 'string' ||
          rawNode.displayName.trim().length === 0
        ) {
          throw new BadRequestException(`${path}.displayName 不能为空`)
        }
        return {
          type: 'forumHashtag',
          hashtagId: rawNode.hashtagId,
          slug: rawNode.slug.trim(),
          displayName: rawNode.displayName.trim(),
        }
      default:
        throw new BadRequestException(`${path}.type 不支持`)
    }
  }

  // 校验文本 mark。
  private validateTextMarksOrThrow(
    rawMarks: unknown,
    path: string,
  ): BodyTextMark[] | undefined {
    if (rawMarks === undefined) {
      return undefined
    }
    if (!Array.isArray(rawMarks)) {
      throw new BadRequestException(`${path} 必须是数组`)
    }

    return rawMarks.map((mark, index) => {
      const nextPath = `${path}[${index}]`
      if (!this.isRecord(mark) || typeof mark.type !== 'string') {
        throw new BadRequestException(`${nextPath} 必须是合法 mark`)
      }
      if (!BODY_TEXT_MARK_TYPES.includes(mark.type as never)) {
        throw new BadRequestException(`${nextPath}.type 不支持`)
      }

      if (mark.type === 'link') {
        if (typeof mark.href !== 'string' || mark.href.trim().length === 0) {
          throw new BadRequestException(`${nextPath}.href 不能为空`)
        }
        return {
          type: 'link',
          href: mark.href.trim(),
        }
      }

      return {
        type: mark.type,
      } as BodyTextMark
    })
  }

  // 判断未知值是否为 object record。
  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
