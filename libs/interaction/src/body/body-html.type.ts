import type { BodySceneEnum } from './body.constant'
import type { BodyBlockNode, BodyDoc, BodyInlineNode } from './body.type'

/**
 * HTML codec 的词法 token。
 * - 仅服务受限白名单 HTML 的解析流程。
 */
export interface BodyHtmlTagToken {
  kind: 'openTag' | 'closeTag' | 'selfClosingTag' | 'text'
  raw: string
  name?: string
  text?: string
  attributes?: Record<string, string>
}

/**
 * 受限 HTML 中的特殊内联节点上下文。
 * - 用于在 `<span data-node=...>` 范围内收集文本，再映射为 canonical inline node。
 */
export interface BodyHtmlInlineNodeContext {
  nodeType: 'mention' | 'hashtag' | 'emoji'
  attributes: Record<string, string>
  textContent: string
}

/**
 * HTML 解析中的块级栈元素。
 * - list 容器与普通块级节点共享同一套栈模型。
 */
export interface BodyHtmlBlockStackEntry {
  blockType:
    | 'paragraph'
    | 'heading'
    | 'blockquote'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
  block: BodyBlockNode
}

/**
 * HTML 解析输入。
 * - scene 决定白名单块级节点是否允许进入 canonical body。
 */
export interface BodyHtmlParseInput {
  html: string
  scene: BodySceneEnum
}

/**
 * HTML 渲染输入。
 * - 由已校验的 canonical body 反向生成规范化 HTML。
 */
export interface BodyHtmlRenderInput {
  body: BodyDoc
  scene: BodySceneEnum
}

/**
 * HTML 解析中可追加 inline 内容的块节点。
 * - 统一收口 paragraph / heading / blockquote / listItem。
 */
export type BodyHtmlInlineContainer = Extract<
  BodyBlockNode,
  { content: BodyInlineNode[] }
>
