import type { Db } from '@db/core'
import type { EmojiSceneEnum } from '../emoji/emoji.constant'
import type { MentionDraftDto } from './dto/mention.dto'
import type { MentionSourceTypeEnum } from './mention.constant'

/**
 * 已规范化的提及草稿。
 * 在进入持久化和 token 构建前，确保 nickname 与正文切片一致。
 */
export interface NormalizedMentionDraft {
  userId: number
  nickname: string
  start: number
  end: number
  text: string
}

/**
 * mention token 构建输入。
 */
export interface BuildMentionBodyTokensInput {
  content: string
  mentions?: MentionDraftDto[]
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
  mentions?: MentionDraftDto[]
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
