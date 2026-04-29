import type { Db } from '@db/core'
import type { ForumHashtagSelect } from '@db/schema'
import type { BodyDoc } from '@libs/interaction/body/body.type'
import type { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import type { BodyInlineNode } from '@libs/interaction/body/body.type'
import type {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from './forum-hashtag.constant'

/**
 * forum 话题候选项。
 * 由正文中的 `#话题` 文本或显式 hashtag node 提取而来。
 */
export interface ForumHashtagCandidate {
  slug: string
  displayName: string
}

/**
 * 已物化的 forum 话题事实。
 * 供 body 替换和引用事实表写入链路复用。
 */
export interface MaterializedForumHashtagFact {
  hashtagId: number
  slug: string
  displayName: string
  occurrenceCount: number
}

export type ForumHashtagVisibilityState = Pick<
  ForumHashtagSelect,
  'auditStatus' | 'isHidden' | 'deletedAt'
>

export interface ForumHashtagRecord {
  id: number
  slug: string
  displayName: string
}

export type ForumHashtagRecordMap = Map<string, ForumHashtagRecord>

export type ForumHashtagTextNode = BodyInlineNode & { type: 'text' }

export interface CreateForumHashtagInput {
  displayName: string
  description?: string
  manualBoost?: number
}

export interface UpdateForumHashtagInput {
  id: number
  description?: string | null
  manualBoost?: number
}

export interface UpdateForumHashtagHiddenInput {
  id: number
  isHidden: boolean
}

export interface UpdateForumHashtagAuditStatusInput {
  id: number
  auditStatus: AuditStatusEnum
  auditReason?: string
}

export interface UpdateForumHashtagAuditStatusOptions {
  auditById?: number
  auditRole?: AuditRoleEnum
}

export interface ForumHashtagAdminPageQuery {
  pageIndex: number
  pageSize: number
  keyword?: string
  auditStatus?: AuditStatusEnum
  isHidden?: boolean
}

export interface ForumHashtagHotPageQuery {
  pageIndex: number
  pageSize: number
  userId?: number
}

export interface ForumHashtagLinkedContentPageQuery {
  pageIndex: number
  pageSize: number
  userId?: number
}

/**
 * forum 话题正文物化输入。
 */
export interface MaterializeForumHashtagBodyInTxInput {
  tx: Db
  body: BodyDoc
  actorUserId: number
  createSourceType: ForumHashtagCreateSourceTypeEnum
}

/**
 * forum 话题正文物化结果。
 */
export interface MaterializeForumHashtagBodyResult {
  body: BodyDoc
  hashtagFacts: MaterializedForumHashtagFact[]
}

/**
 * forum 话题引用事实替换输入。
 */
export interface ReplaceForumHashtagReferencesInTxInput {
  tx: Db
  sourceType: ForumHashtagReferenceSourceTypeEnum
  sourceId: number
  topicId: number
  sectionId: number
  userId: number
  sourceAuditStatus: AuditStatusEnum
  sourceIsHidden: boolean
  isSourceVisible: boolean
  hashtagFacts: MaterializedForumHashtagFact[]
}

/**
 * forum 话题引用事实删除输入。
 */
export interface DeleteForumHashtagReferencesInTxInput {
  tx: Db
  sourceType: ForumHashtagReferenceSourceTypeEnum
  sourceIds: number[]
}

/**
 * forum 话题引用可见性同步输入。
 */
export interface SyncForumHashtagReferenceVisibilityInTxInput {
  tx: Db
  sourceType: ForumHashtagReferenceSourceTypeEnum
  sourceId: number
  sourceAuditStatus: AuditStatusEnum
  sourceIsHidden: boolean
  isSourceVisible: boolean
}
