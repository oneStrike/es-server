import type { DbExecutor } from '@db/core'
import type { AppUserSelect } from '@db/schema'
import type { CommentTargetTypeEnum } from '../comment/comment.constant'
import type { EmojiSceneEnum } from '../emoji/emoji.constant'
import type { MentionDraftDto } from './dto/mention.dto'
import type { MentionSourceTypeEnum } from './mention.constant'

/** 触发者用户快照，仅承载通知文案所需的最小字段。 */
export type MentionUserRef = Pick<AppUserSelect, 'id' | 'nickname'>

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
 * mention 草稿快照。
 * 直接复用 DTO 的稳定字段子集，避免 service 输入与 HTTP contract 漂移。
 */
export type MentionDraftSnapshot = Pick<
  MentionDraftDto,
  'userId' | 'nickname' | 'start' | 'end'
>

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
  tx: DbExecutor
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
  targetType: CommentTargetTypeEnum
  targetId: number
  content: string
  targetDisplayTitle?: string
  excludedReceiverUserIds?: number[]
}

/**
 * topic mention 通知补发输入。
 */
export interface DispatchTopicMentionsInTxInput {
  topicId: number
  actorUserId: number
  topicTitle: string
  excludedReceiverUserIds?: number[]
}

/**
 * 删除 mention 事实输入。
 */
export interface DeleteMentionsInTxInput {
  tx: DbExecutor
  sourceType: MentionSourceTypeEnum
  sourceIds: number[]
}
