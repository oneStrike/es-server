import type {
  BodyHtmlBlockStackEntry,
  BodyHtmlInlineContainer,
  BodyHtmlInlineNodeContext,
  BodyHtmlTagToken,
} from './body-html.type'
import type { BodySceneEnum } from './body.constant'
import type {
  BodyDoc,
  BodyInlineNode,
  BodyTextMark,
} from './body.type'
import {
  decodeHtmlEntities,
} from '@libs/platform/utils'
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common'
import { assertSafeBodyLinkHref } from './body-link.helper'
import { BodyValidatorService } from './body-validator.service'

const SELF_CLOSING_TAG_NAMES = new Set(['br', 'img'])

const INLINE_MARK_TAG_MAP = {
  a: 'link',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  strong: 'bold',
  u: 'underline',
} as const satisfies Record<string, BodyTextMark['type']>

/**
 * 正文 HTML codec。
 * - 对外只接受受限白名单 HTML，再收敛为 canonical body。
 * - 渲染时输出稳定 HTML，供持久化与对外回显复用。
 */
@Injectable()
export class BodyHtmlCodecService {
  constructor(private readonly bodyValidatorService: BodyValidatorService) {}

  // 将受限 HTML 解析成 canonical body，并按 scene 统一校验。
  parseHtmlOrThrow(
    html: string,
    scene: BodySceneEnum,
  ): BodyDoc {
    const normalizedHtml = html.trim()
    if (!normalizedHtml) {
      throw new BadRequestException('html 不能为空')
    }

    const tokens = this.tokenizeHtmlOrThrow(normalizedHtml)
    const body = this.buildBodyFromTokensOrThrow(tokens, scene)

    return this.bodyValidatorService.validateBodyOrThrow(body, scene)
  }

  // 将 canonical body 渲染成规范化 HTML。
  renderHtml(
    body: BodyDoc,
    scene: BodySceneEnum,
  ) {
    const validatedBody = this.bodyValidatorService.validateBodyOrThrow(
      body,
      scene,
    )

    return validatedBody.content
      .map((block) => this.renderBlock(block))
      .join('')
  }

  // 按受限白名单把 HTML 切成 token 序列。
  private tokenizeHtmlOrThrow(html: string) {
    const tokens: BodyHtmlTagToken[] = []
    const parts = html.match(/<[^>]+>|[^<]+/g)
    if (!parts?.length) {
      return []
    }

    for (const part of parts) {
      if (!part.startsWith('<')) {
        tokens.push({
          kind: 'text',
          raw: part,
          text: decodeHtmlEntities(part),
        })
        continue
      }

      const token = this.parseTagTokenOrThrow(part)
      tokens.push(token)
    }

    return tokens
  }

  // 解析单个标签 token，并校验标签形态是否符合白名单。
  private parseTagTokenOrThrow(rawTag: string): BodyHtmlTagToken {
    const closingMatch = rawTag.match(/^<\/([a-z0-9]+)\s*>$/i)
    if (closingMatch) {
      return {
        kind: 'closeTag',
        raw: rawTag,
        name: closingMatch[1].toLowerCase(),
      }
    }

    return this.parseOpeningTagTokenOrThrow(rawTag)
  }

  // 解析开始或自闭合标签，避免用宽松正则处理属性区导致回溯风险。
  private parseOpeningTagTokenOrThrow(rawTag: string): BodyHtmlTagToken {
    const rawInner = rawTag.slice(1, -1).trim()
    const isExplicitSelfClosing = rawInner.endsWith('/')
    const inner = isExplicitSelfClosing
      ? rawInner.slice(0, -1).trim()
      : rawInner
    const attributeStart = inner.search(/\s/)
    const rawName =
      attributeStart === -1 ? inner : inner.slice(0, attributeStart)
    if (!/^[a-z0-9]+$/i.test(rawName)) {
      throw new BadRequestException(`非法 HTML 标签：${rawTag}`)
    }

    const name = rawName.toLowerCase()
    const attributes = this.parseAttributes(
      attributeStart === -1 ? '' : inner.slice(attributeStart),
    )
    const isSelfClosing =
      isExplicitSelfClosing || SELF_CLOSING_TAG_NAMES.has(name)

    return {
      kind: isSelfClosing ? 'selfClosingTag' : 'openTag',
      raw: rawTag,
      name,
      attributes,
    }
  }

  // 解析标签属性，仅允许双引号值，避免输入歧义扩散到业务语义层。
  private parseAttributes(rawAttributes: string) {
    const attributes: Record<string, string> = {}
    const attributePattern = /([:@\w-]+)\s*=\s*"([^"]*)"/g
    for (const match of rawAttributes.matchAll(attributePattern)) {
      attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? '')
    }

    return attributes
  }

  // 将 token 序列组装成 canonical body。
  private buildBodyFromTokensOrThrow(
    tokens: BodyHtmlTagToken[],
    scene: BodySceneEnum,
  ): BodyDoc {
    const body: BodyDoc = { type: 'doc', content: [] }
    const blockStack: BodyHtmlBlockStackEntry[] = []
    const markStack: BodyTextMark[] = []
    const specialInlineStack: BodyHtmlInlineNodeContext[] = []

    const ensureRootParagraph = () => {
      if (blockStack.length > 0) {
        return
      }

      const paragraph: BodyHtmlInlineContainer = {
        type: 'paragraph',
        content: [],
      }
      body.content.push(paragraph)
      blockStack.push({
        blockType: 'paragraph',
        block: paragraph,
      })
    }

    const currentInlineContainer = () => {
      const current = blockStack.at(-1)?.block
      if (
        current &&
        (current.type === 'paragraph' ||
          current.type === 'heading' ||
          current.type === 'blockquote' ||
          current.type === 'listItem')
      ) {
        return current
      }

      return null
    }

    const appendInlineNode = (node: BodyInlineNode) => {
      const specialInline = specialInlineStack.at(-1)
      if (specialInline) {
        if (node.type !== 'text') {
          throw new BadRequestException(
            `特殊 inline 节点内部不允许嵌套 ${node.type}`,
          )
        }
        specialInline.textContent += node.text
        return
      }

      const container = currentInlineContainer()
      if (!container) {
        throw new BadRequestException('HTML 缺少合法块级节点容器')
      }
      container.content.push(node)
    }

    const appendText = (text: string) => {
      if (!text) {
        return
      }

      const container = currentInlineContainer()
      if (!container && specialInlineStack.length === 0) {
        ensureRootParagraph()
      }

      const normalizedText = text
      if (!normalizedText) {
        return
      }

      const node: BodyInlineNode = {
        type: 'text',
        text: normalizedText,
        marks: markStack.length ? [...markStack] : undefined,
      }
      appendInlineNode(node)
    }

    for (const token of tokens) {
      switch (token.kind) {
        case 'text':
          appendText(token.text ?? '')
          break
        case 'selfClosingTag':
          this.handleSelfClosingTagOrThrow(
            token,
            scene,
            currentInlineContainer,
            appendInlineNode,
          )
          break
        case 'openTag':
          this.handleOpenTagOrThrow(
            token,
            scene,
            body,
            blockStack,
            markStack,
            specialInlineStack,
            currentInlineContainer,
          )
          break
        case 'closeTag':
          this.handleCloseTagOrThrow(
            token,
            markStack,
            specialInlineStack,
            blockStack,
            appendInlineNode,
          )
          break
        default:
          throw new BadRequestException(`不支持的 HTML token：${token.kind}`)
      }
    }

    if (specialInlineStack.length > 0 || markStack.length > 0 || blockStack.length > 0) {
      while (blockStack.length > 0 && blockStack.at(-1)?.blockType === 'paragraph') {
        blockStack.pop()
      }
      if (specialInlineStack.length > 0 || markStack.length > 0 || blockStack.length > 0) {
        throw new BadRequestException('HTML 标签未正确闭合')
      }
    }

    return body.content.length > 0
      ? body
      : {
          type: 'doc',
          content: [{ type: 'paragraph', content: [] }],
        }
  }

  // 处理 open tag，并把块级节点、mark 或特殊 inline 节点推进解析栈。
  private handleOpenTagOrThrow(
    token: BodyHtmlTagToken,
    scene: BodySceneEnum,
    body: BodyDoc,
    blockStack: BodyHtmlBlockStackEntry[],
    markStack: BodyTextMark[],
    specialInlineStack: BodyHtmlInlineNodeContext[],
    currentInlineContainer: () => BodyHtmlInlineContainer | null,
  ) {
    const tagName = token.name ?? ''

    if (tagName === 'p' || tagName === 'blockquote') {
      const block: BodyHtmlInlineContainer =
        tagName === 'p'
          ? { type: 'paragraph', content: [] }
          : { type: 'blockquote', content: [] }
      body.content.push(block)
      blockStack.push({ blockType: tagName === 'p' ? 'paragraph' : 'blockquote', block })
      return
    }

    if (/^h[1-6]$/.test(tagName)) {
      if (scene !== 'topic') {
        throw new BadRequestException(`当前场景不允许标签 <${tagName}>`)
      }
      const block: BodyHtmlInlineContainer = {
        type: 'heading',
        level: Number(tagName.slice(1)),
        content: [],
      }
      body.content.push(block)
      blockStack.push({ blockType: 'heading', block })
      return
    }

    if (tagName === 'ul' || tagName === 'ol') {
      if (scene !== 'topic') {
        throw new BadRequestException(`当前场景不允许标签 <${tagName}>`)
      }
      const block =
        tagName === 'ul'
          ? { type: 'bulletList', content: [] as BodyHtmlInlineContainer[] }
          : { type: 'orderedList', content: [] as BodyHtmlInlineContainer[] }
      body.content.push(block as never)
      blockStack.push({
        blockType: tagName === 'ul' ? 'bulletList' : 'orderedList',
        block: block as never,
      })
      return
    }

    if (tagName === 'li') {
      if (scene !== 'topic') {
        throw new BadRequestException('当前场景不允许标签 <li>')
      }
      const listContainer = blockStack.at(-1)?.block
      if (
        !listContainer ||
        (listContainer.type !== 'bulletList' &&
          listContainer.type !== 'orderedList')
      ) {
        throw new BadRequestException('<li> 必须位于列表容器中')
      }
      const item: BodyHtmlInlineContainer = { type: 'listItem', content: [] }
      listContainer.content.push(item as never)
      blockStack.push({ blockType: 'listItem', block: item })
      return
    }

    if (tagName in INLINE_MARK_TAG_MAP) {
      if (tagName === 'a') {
        const href = assertSafeBodyLinkHref(token.attributes?.href ?? '')
        markStack.push({ type: 'link', href })
        return
      }

      const markType =
        INLINE_MARK_TAG_MAP[tagName as keyof typeof INLINE_MARK_TAG_MAP]
      if (markType === 'link') {
        throw new BadRequestException('<a> 需要通过 link 分支处理')
      }
      markStack.push({ type: markType })
      return
    }

    if (tagName === 'span') {
      const nodeType = token.attributes?.['data-node']
      if (
        nodeType === 'mention' ||
        nodeType === 'hashtag' ||
        nodeType === 'emoji'
      ) {
        if (!currentInlineContainer()) {
          throw new BadRequestException(`<span data-node="${nodeType}"> 缺少块级容器`)
        }
        specialInlineStack.push({
          nodeType,
          attributes: token.attributes ?? {},
          textContent: '',
        })
        return
      }
    }

    throw new BadRequestException(`当前 HTML 白名单不支持标签 <${tagName}>`)
  }

  // 处理 self closing tag，专门承接 `<br>` 与带 data-node 的 emoji 节点。
  private handleSelfClosingTagOrThrow(
    token: BodyHtmlTagToken,
    scene: BodySceneEnum,
    currentInlineContainer: () => BodyHtmlInlineContainer | null,
    appendInlineNode: (node: BodyInlineNode) => void,
  ) {
    const tagName = token.name ?? ''
    if (!currentInlineContainer()) {
      throw new BadRequestException(`标签 <${tagName}> 缺少块级容器`)
    }

    if (tagName === 'br') {
      appendInlineNode({ type: 'hardBreak' })
      return
    }

    if (tagName === 'img') {
      const nodeType = token.attributes?.['data-node']
      if (nodeType !== 'emoji') {
        throw new BadRequestException('<img> 只允许作为 emoji 节点使用')
      }
      const unicodeSequence = token.attributes?.['data-unicode-sequence']?.trim()
      const shortcode = token.attributes?.['data-shortcode']?.trim()
      if (unicodeSequence) {
        appendInlineNode({ type: 'emojiUnicode', unicodeSequence })
        return
      }
      if (shortcode) {
        appendInlineNode({ type: 'emojiCustom', shortcode })
        return
      }
      throw new BadRequestException('emoji img 缺少 data-unicode-sequence 或 data-shortcode')
    }

    if (scene === 'topic' && tagName === 'hr') {
      throw new BadRequestException('当前 HTML 白名单不支持标签 <hr>')
    }

    throw new BadRequestException(`当前 HTML 白名单不支持标签 <${tagName}>`)
  }

  // 处理 close tag，并在关闭特殊 inline 节点时把它转为 canonical inline node。
  private handleCloseTagOrThrow(
    token: BodyHtmlTagToken,
    markStack: BodyTextMark[],
    specialInlineStack: BodyHtmlInlineNodeContext[],
    blockStack: BodyHtmlBlockStackEntry[],
    appendInlineNode: (node: BodyInlineNode) => void,
  ) {
    const tagName = token.name ?? ''

    if (tagName in INLINE_MARK_TAG_MAP) {
      markStack.pop()
      return
    }

    if (tagName === 'span') {
      const specialInline = specialInlineStack.pop()
      if (!specialInline) {
        throw new BadRequestException('span 标签闭合顺序非法')
      }

      if (specialInline.nodeType === 'mention') {
        const userId = Number(specialInline.attributes['data-user-id'])
        const nickname =
          specialInline.attributes['data-nickname']?.trim() ??
          specialInline.textContent.replace(/^@/, '').trim()
        if (!Number.isInteger(userId) || userId <= 0 || !nickname) {
          throw new BadRequestException('mention span 缺少合法 data-user-id 或 data-nickname')
        }
        appendInlineNode({
          type: 'mentionUser',
          userId,
          nickname,
        })
        return
      }

      if (specialInline.nodeType === 'emoji') {
        const unicodeSequence =
          specialInline.attributes['data-unicode-sequence']?.trim() ??
          specialInline.textContent.trim()
        if (!unicodeSequence) {
          throw new BadRequestException('emoji span 缺少 data-unicode-sequence')
        }
        appendInlineNode({
          type: 'emojiUnicode',
          unicodeSequence,
        })
        return
      }

      const displayName = specialInline.textContent.replace(/^#/, '').trim()
      const hashtagId = Number(specialInline.attributes['data-hashtag-id'])
      const slug =
        specialInline.attributes['data-slug']?.trim() ??
        displayName.toLowerCase()
      if (!displayName) {
        throw new BadRequestException('hashtag span 缺少展示文本')
      }
      if (Number.isInteger(hashtagId) && hashtagId > 0) {
        appendInlineNode({
          type: 'forumHashtag',
          hashtagId,
          slug,
          displayName,
        })
        return
      }
      appendInlineNode({
        type: 'text',
        text: `#${displayName}`,
      })
      return
    }

    if (
      tagName === 'p' ||
      tagName === 'blockquote' ||
      /^h[1-6]$/.test(tagName) ||
      tagName === 'ul' ||
      tagName === 'ol' ||
      tagName === 'li'
    ) {
      const current = blockStack.at(-1)
      if (!current) {
        throw new BadRequestException(`标签 </${tagName}> 缺少匹配的开始标签`)
      }

      const expectedTag =
        current.blockType === 'paragraph'
          ? 'p'
          : current.blockType === 'blockquote'
            ? 'blockquote'
            : current.blockType === 'heading'
              ? `h${(current.block as Extract<BodyHtmlInlineContainer, { type: 'heading' }>).level}`
              : current.blockType === 'bulletList'
                ? 'ul'
                : current.blockType === 'orderedList'
                  ? 'ol'
                  : 'li'
      if (expectedTag !== tagName) {
        throw new BadRequestException(`标签 </${tagName}> 与开始标签不匹配`)
      }
      blockStack.pop()
      return
    }

    throw new BadRequestException(`当前 HTML 白名单不支持标签 </${tagName}>`)
  }

  // 渲染块级节点为规范化 HTML。
  private renderBlock(block: BodyDoc['content'][number]): string {
    switch (block.type) {
      case 'paragraph':
        return `<p>${this.renderInlineNodes(block.content)}</p>`
      case 'heading':
        return `<h${block.level}>${this.renderInlineNodes(block.content)}</h${block.level}>`
      case 'blockquote':
        return `<blockquote>${this.renderInlineNodes(block.content)}</blockquote>`
      case 'bulletList':
        return `<ul>${block.content
          .map((item) => `<li>${this.renderInlineNodes(item.content)}</li>`)
          .join('')}</ul>`
      case 'orderedList':
        return `<ol>${block.content
          .map((item) => `<li>${this.renderInlineNodes(item.content)}</li>`)
          .join('')}</ol>`
      case 'listItem':
        return `<li>${this.renderInlineNodes(block.content)}</li>`
      default:
        throw new Error(`Unsupported body block node: ${(block as { type: string }).type}`)
    }
  }

  // 渲染 inline 节点，并把 marks 重新编码为白名单 HTML。
  private renderInlineNodes(nodes: BodyInlineNode[]) {
    return nodes
      .map((node) => {
        switch (node.type) {
          case 'text':
            return this.renderTextNode(node.text, node.marks)
          case 'hardBreak':
            return '<br />'
          case 'mentionUser':
            return `<span data-node="mention" data-user-id="${node.userId}" data-nickname="${this.escapeHtmlAttribute(node.nickname)}">@${this.escapeHtmlText(node.nickname)}</span>`
          case 'emojiUnicode':
            return `<span data-node="emoji" data-unicode-sequence="${this.escapeHtmlAttribute(node.unicodeSequence)}">${this.escapeHtmlText(node.unicodeSequence)}</span>`
          case 'emojiCustom':
            return `<img data-node="emoji" data-shortcode="${this.escapeHtmlAttribute(node.shortcode)}" alt=":${this.escapeHtmlAttribute(node.shortcode)}:" />`
          case 'forumHashtag':
            return `<span data-node="hashtag" data-hashtag-id="${node.hashtagId}" data-slug="${this.escapeHtmlAttribute(node.slug)}">#${this.escapeHtmlText(node.displayName)}</span>`
          default:
            throw new Error(`Unsupported body inline node: ${(node as { type: string }).type}`)
        }
      })
      .join('')
  }

  // 渲染文本节点，并按固定顺序重建 marks。
  private renderTextNode(text: string, marks?: BodyTextMark[]) {
    let rendered = this.escapeHtmlText(text)
    const orderedMarks = [...(marks ?? [])].sort((left, right) =>
      this.getMarkOrder(left) - this.getMarkOrder(right),
    )

    for (const mark of orderedMarks.reverse()) {
      if (mark.type === 'bold') {
        rendered = `<strong>${rendered}</strong>`
      } else if (mark.type === 'italic') {
        rendered = `<em>${rendered}</em>`
      } else if (mark.type === 'underline') {
        rendered = `<u>${rendered}</u>`
      } else {
        rendered = `<a href="${this.escapeHtmlAttribute(mark.href)}">${rendered}</a>`
      }
    }

    return rendered
  }

  // 统一 mark 渲染顺序，避免相同语义在不同请求间生成不同 HTML。
  private getMarkOrder(mark: BodyTextMark) {
    switch (mark.type) {
      case 'link':
        return 4
      case 'underline':
        return 3
      case 'italic':
        return 2
      case 'bold':
      default:
        return 1
    }
  }

  // 转义文本节点内容，避免把正文文本误渲染成标签。
  private escapeHtmlText(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // 转义属性值，避免生成不安全 HTML。
  private escapeHtmlAttribute(text: string) {
    return this.escapeHtmlText(text)
  }
}
