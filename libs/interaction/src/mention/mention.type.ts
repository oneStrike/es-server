import type { Db } from '@db/core'
import type { EmojiSceneEnum } from '../emoji/emoji.constant'
import type { MentionSourceTypeEnum } from './mention.constant'

/**
 * 已规范化的提及草稿。
 * 在进入持久化和 token 构建前，确保 nickname 与正文切片一致。
 */
/** 稳定领域类型 `NormalizedMentionDraft`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NormalizedMentionDraft {
  userId: number
  nickname: string
  start: number
  end: number
  text: string
}

/**
 * mention 草稿快照。
 * 与 DTO 字段保持一致，但仅用于内部解析/事务链路，避免 type 文件直接依赖 HTTP DTO。
 */
/** 稳定领域类型 `MentionDraftSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface MentionDraftSnapshot {
  userId: number
  nickname: string
  start: number
  end: number
}

/**
 * mention token 构建输入。
 */
export interface BuildMentionBodyTokensInput {
  content: string
  mentions?: MentionDraftSnapshot[]
  scene: EmojiSceneEnum
}

/**
 * mention 事实替换输入。
 */
export interface ReplaceMentionsInTxInput {
  tx: Db
  sourceType: MentionSourceTypeEnum
  sourceId: number
  content: string
  mentions?: MentionDraftSnapshot[]
}

/**
 * comment mention 通知补发输入。
 */
export interface DispatchCommentMentionsInTxInput {
  commentId: number
  actorUserId: number
  targetType: number
  targetId: number
  content: string
  targetDisplayTitle?: string
}

/**
 * topic mention 通知补发输入。
 */
export interface DispatchTopicMentionsInTxInput {
  topicId: number
  actorUserId: number
  topicTitle: string
}

/**
 * 删除 mention 事实输入。
 */
export interface DeleteMentionsInTxInput {
  tx: Db
  sourceType: MentionSourceTypeEnum
  sourceIds: number[]
}
