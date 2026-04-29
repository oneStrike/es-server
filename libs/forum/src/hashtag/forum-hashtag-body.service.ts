import type {
  BodyBlockNode,
  BodyDoc,
  BodyInlineNode,
} from '@libs/interaction/body/body.type'
import type {
  ForumHashtagCandidate,
  ForumHashtagRecordMap,
  ForumHashtagTextNode,
  MaterializeForumHashtagBodyInTxInput,
  MaterializeForumHashtagBodyResult,
} from './forum-hashtag.type'
import { DrizzleService } from '@db/core'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { ConfigReader } from '@libs/system-config/config-reader'
import { Injectable } from '@nestjs/common'
import { inArray } from 'drizzle-orm'
import {
  FORUM_HASHTAG_NAME_MAX_LENGTH,
  FORUM_HASHTAG_TEXT_REGEX,
  ForumHashtagCreationModeEnum,
} from './forum-hashtag.constant'

/**
 * forum 话题正文物化服务。
 * 统一负责把正文中的 `#话题` 文本或显式 node 解析成正式 hashtag 资源与 body node。
 */
@Injectable()
export class ForumHashtagBodyService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly configReader: ConfigReader,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
  ) {}

  private get forumHashtag() {
    return this.drizzle.schema.forumHashtag
  }

  // 规范化展示名。
  private normalizeDisplayName(displayName: string) {
    return displayName.normalize('NFKC').trim()
  }

  // 规范化 slug。
  private normalizeSlug(value: string) {
    return value.normalize('NFKC').trim().replace(/^#/, '').toLowerCase()
  }

  // 基于共享内容审核策略计算 auto-create 话题的初始审核状态。
  private resolveAutoCreateAuditDecision(displayName: string) {
    const result = this.sensitiveWordDetectService.getMatchedWordsWithMetadata({
      content: displayName,
    })
    const policy = this.configReader.getContentReviewPolicy()

    let auditStatus: AuditStatusEnum = AuditStatusEnum.APPROVED
    let isHidden = false

    if (result.highestLevel) {
      if (result.highestLevel === SensitiveWordLevelEnum.SEVERE) {
        auditStatus = policy.severeAction.auditStatus as AuditStatusEnum
        isHidden = policy.severeAction.isHidden
      } else if (result.highestLevel === SensitiveWordLevelEnum.GENERAL) {
        auditStatus = policy.generalAction.auditStatus as AuditStatusEnum
        isHidden = policy.generalAction.isHidden
      } else {
        auditStatus = policy.lightAction.auditStatus as AuditStatusEnum
        isHidden = policy.lightAction.isHidden
      }
    }

    return {
      auditStatus,
      isHidden,
      sensitiveWordHits:
        policy.recordHits && result.publicHits.length > 0
          ? result.publicHits
          : null,
    }
  }

  // 从文本节点中提取 hashtag 候选。
  private extractHashtagCandidatesFromText(text: string) {
    const candidates: ForumHashtagCandidate[] = []
    for (const match of text.matchAll(
      new RegExp(
        FORUM_HASHTAG_TEXT_REGEX.source,
        FORUM_HASHTAG_TEXT_REGEX.flags,
      ),
    )) {
      const displayName = this.normalizeDisplayName(match[1] ?? '')
      const slug = this.normalizeSlug(displayName)
      if (!displayName || !slug) {
        continue
      }
      candidates.push({
        slug,
        displayName,
      })
    }
    return candidates
  }

  // 收集正文里的所有 hashtag 候选。
  private collectCandidates(body: BodyDoc) {
    const candidates: ForumHashtagCandidate[] = []

    const collectInlineNodes = (nodes: BodyInlineNode[]) => {
      for (const node of nodes) {
        if (node.type === 'text') {
          candidates.push(...this.extractHashtagCandidatesFromText(node.text))
          continue
        }

        if (node.type === 'forumHashtag') {
          const displayName = this.normalizeDisplayName(node.displayName)
          const slug = this.normalizeSlug(node.slug || node.displayName)
          if (!displayName || !slug) {
            continue
          }
          candidates.push({
            slug,
            displayName,
          })
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

    return candidates
  }

  // 为候选话题加载或创建正式资源。
  private async materializeCandidateMapInTx(
    input: MaterializeForumHashtagBodyInTxInput,
    candidates: ForumHashtagCandidate[],
  ): Promise<ForumHashtagRecordMap> {
    const uniqueCandidates = [
      ...new Map(candidates.map((item) => [item.slug, item] as const)).values(),
    ]
    if (uniqueCandidates.length === 0) {
      return new Map()
    }

    const existingRows = await input.tx
      .select({
        id: this.forumHashtag.id,
        slug: this.forumHashtag.slug,
        displayName: this.forumHashtag.displayName,
        auditStatus: this.forumHashtag.auditStatus,
        isHidden: this.forumHashtag.isHidden,
        deletedAt: this.forumHashtag.deletedAt,
      })
      .from(this.forumHashtag)
      .where(
        inArray(
          this.forumHashtag.slug,
          uniqueCandidates.map((item) => item.slug),
        ),
      )

    const existingMap = new Map(
      existingRows.map((row) => [row.slug, row] as const),
    )
    const creationMode = this.configReader.getForumHashtagConfig()
      .creationMode as ForumHashtagCreationModeEnum

    if (creationMode === ForumHashtagCreationModeEnum.EXISTING_ONLY) {
      const invalidCandidate = uniqueCandidates.find((candidate) => {
        const existing = existingMap.get(candidate.slug)
        return (
          !existing ||
          existing.deletedAt !== null ||
          existing.auditStatus !== AuditStatusEnum.APPROVED ||
          existing.isHidden
        )
      })

      if (invalidCandidate) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `话题 #${invalidCandidate.displayName} 不存在或不可用`,
        )
      }
    }

    if (creationMode === ForumHashtagCreationModeEnum.AUTO_CREATE) {
      for (const candidate of uniqueCandidates) {
        if (existingMap.has(candidate.slug)) {
          continue
        }

        const decision = this.resolveAutoCreateAuditDecision(
          candidate.displayName,
        )
        const [created] = await input.tx
          .insert(this.forumHashtag)
          .values({
            slug: candidate.slug,
            displayName: candidate.displayName.slice(
              0,
              FORUM_HASHTAG_NAME_MAX_LENGTH,
            ),
            createSourceType: input.createSourceType,
            createdByUserId: input.actorUserId,
            auditStatus: decision.auditStatus,
            isHidden: decision.isHidden,
            sensitiveWordHits: decision.sensitiveWordHits,
          })
          .onConflictDoNothing()
          .returning({
            id: this.forumHashtag.id,
            slug: this.forumHashtag.slug,
            displayName: this.forumHashtag.displayName,
            auditStatus: this.forumHashtag.auditStatus,
            isHidden: this.forumHashtag.isHidden,
            deletedAt: this.forumHashtag.deletedAt,
          })

        if (created) {
          existingMap.set(created.slug, created)
          continue
        }

        const [concurrent] = await input.tx
          .select({
            id: this.forumHashtag.id,
            slug: this.forumHashtag.slug,
            displayName: this.forumHashtag.displayName,
            auditStatus: this.forumHashtag.auditStatus,
            isHidden: this.forumHashtag.isHidden,
            deletedAt: this.forumHashtag.deletedAt,
          })
          .from(this.forumHashtag)
          .where(inArray(this.forumHashtag.slug, [candidate.slug]))
        if (concurrent) {
          existingMap.set(concurrent.slug, concurrent)
        }
      }
    }

    return new Map(
      [...existingMap.values()].map((row) => [
        row.slug,
        {
          id: row.id,
          slug: row.slug,
          displayName: row.displayName,
        },
      ]),
    )
  }

  // 把文本节点拆成 text + forumHashtag node。
  private splitTextNodeByHashtags(
    node: ForumHashtagTextNode,
    hashtagMap: ForumHashtagRecordMap,
    occurrenceMap: Map<number, number>,
  ) {
    const pieces: BodyInlineNode[] = []
    let cursor = 0

    for (const match of node.text.matchAll(
      new RegExp(
        FORUM_HASHTAG_TEXT_REGEX.source,
        FORUM_HASHTAG_TEXT_REGEX.flags,
      ),
    )) {
      const displayName = this.normalizeDisplayName(match[1] ?? '')
      const slug = this.normalizeSlug(displayName)
      const hashtag = hashtagMap.get(slug)
      const index = match.index ?? 0

      if (index > cursor) {
        pieces.push({
          type: 'text',
          text: node.text.slice(cursor, index),
          marks: node.marks,
        })
      }

      if (!hashtag) {
        pieces.push({
          type: 'text',
          text: node.text.slice(index, index + match[0].length),
          marks: node.marks,
        })
      } else {
        occurrenceMap.set(hashtag.id, (occurrenceMap.get(hashtag.id) ?? 0) + 1)
        pieces.push({
          type: 'forumHashtag',
          hashtagId: hashtag.id,
          slug: hashtag.slug,
          displayName: hashtag.displayName,
        })
      }

      cursor = index + match[0].length
    }

    if (cursor < node.text.length) {
      pieces.push({
        type: 'text',
        text: node.text.slice(cursor),
        marks: node.marks,
      })
    }

    return pieces
  }

  // 用正式资源替换正文里的 hashtag 候选。
  private rewriteBodyWithHashtags(
    body: BodyDoc,
    hashtagMap: ForumHashtagRecordMap,
  ) {
    const occurrenceMap = new Map<number, number>()

    const rewriteInlineNodes = (nodes: BodyInlineNode[]) => {
      const rewritten: BodyInlineNode[] = []

      for (const node of nodes) {
        if (node.type === 'text') {
          rewritten.push(
            ...this.splitTextNodeByHashtags(node, hashtagMap, occurrenceMap),
          )
          continue
        }

        if (node.type === 'forumHashtag') {
          const slug = this.normalizeSlug(node.slug || node.displayName)
          const hashtag = hashtagMap.get(slug)
          if (hashtag) {
            occurrenceMap.set(
              hashtag.id,
              (occurrenceMap.get(hashtag.id) ?? 0) + 1,
            )
            rewritten.push({
              type: 'forumHashtag',
              hashtagId: hashtag.id,
              slug: hashtag.slug,
              displayName: hashtag.displayName,
            })
            continue
          }
        }

        rewritten.push(node)
      }

      return rewritten
    }

    const rewriteBlockNode = (block: BodyBlockNode): BodyBlockNode => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
        case 'blockquote':
        case 'listItem':
          return {
            ...block,
            content: rewriteInlineNodes(block.content),
          }
        case 'bulletList':
        case 'orderedList':
          return {
            ...block,
            content: block.content.map((item) => ({
              ...item,
              content: rewriteInlineNodes(item.content),
            })),
          }
        default:
          return block
      }
    }

    return {
      body: {
        type: 'doc' as const,
        content: body.content.map((block) => rewriteBlockNode(block)),
      },
      occurrenceMap,
    }
  }

  // 在事务内物化 forum 正文中的 hashtag。
  async materializeBodyInTx(
    input: MaterializeForumHashtagBodyInTxInput,
  ): Promise<MaterializeForumHashtagBodyResult> {
    const candidates = this.collectCandidates(input.body)
    if (candidates.length === 0) {
      return {
        body: input.body,
        hashtagFacts: [],
      }
    }

    const hashtagMap = await this.materializeCandidateMapInTx(input, candidates)
    const { body, occurrenceMap } = this.rewriteBodyWithHashtags(
      input.body,
      hashtagMap,
    )

    return {
      body,
      hashtagFacts: [...occurrenceMap.entries()].map(
        ([hashtagId, occurrenceCount]) => {
          const hashtag = [...hashtagMap.values()].find(
            (item) => item.id === hashtagId,
          )!
          return {
            hashtagId,
            slug: hashtag.slug,
            displayName: hashtag.displayName,
            occurrenceCount,
          }
        },
      ),
    }
  }
}
