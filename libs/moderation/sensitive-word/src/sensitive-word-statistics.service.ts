import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'

import type { RecordSensitiveWordEntityHitsInput } from './sensitive-word.type'
import { buildLikePattern, DrizzleService, toPageResult } from '@db/core'
import { AuditStatusEnum } from '@libs/platform/constant'
import {
  buildDateOnlyRangeInAppTimeZone,
  startOfTodayInAppTimeZone,
  subtractDaysInAppTimeZone,
  subtractMonthsInAppTimeZone,
} from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import {
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'
import { QuerySensitiveWordHitLogDto } from './dto/sensitive-word.dto'
import {
  SensitiveWordHitEntityTypeEnum,
  SensitiveWordHitLogEntityStatusEnum,
  SensitiveWordLevelNames,
  SensitiveWordTypeNames,
} from './sensitive-word-constant'
import {
  SensitiveWordHitEntityTypeMap,
  SensitiveWordHitOperationTypeMap,
} from './sensitive-word.type'

/**
 * 敏感词统计服务
 * 提供敏感词数量、命中与分类统计能力
 */
@Injectable()
export class SensitiveWordStatisticsService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例
  private get db() {
    return this.drizzle.db
  }

  // 敏感词表
  private get sensitiveWord() {
    return this.drizzle.schema.sensitiveWord
  }

  // 敏感词命中明细表
  private get sensitiveWordHitLog() {
    return this.drizzle.schema.sensitiveWordHitLog
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 获取完整的统计数据 包含所有维度的统计信息
  async getStatistics() {
    const [
      totalWords,
      enabledWords,
      disabledWords,
      totalHits,
      todayHits,
      lastWeekHits,
      lastMonthHits,
      levelStatistics,
      typeStatistics,
      topHitWords,
      recentHitWords,
    ] = await Promise.all([
      this.getTotalWords(),
      this.getEnabledWords(),
      this.getDisabledWords(),
      this.getTotalHits(),
      this.getTodayHits(),
      this.getLastWeekHits(),
      this.getLastMonthHits(),
      this.getLevelStatistics(),
      this.getTypeStatistics(),
      this.getTopHitWords(),
      this.getRecentHitWords(),
    ])

    return {
      totalWords,
      enabledWords,
      disabledWords,
      totalHits,
      todayHits,
      lastWeekHits,
      lastMonthHits,
      levelStatistics,
      typeStatistics,
      topHitWords,
      recentHitWords,
    }
  }

  // 获取敏感词总数
  private async getTotalWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
    return Number(result?.count ?? 0)
  }

  // 获取启用的敏感词数量
  private async getEnabledWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
      .where(eq(this.sensitiveWord.isEnabled, true))
    return Number(result?.count ?? 0)
  }

  // 获取禁用的敏感词数量
  private async getDisabledWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
      .where(eq(this.sensitiveWord.isEnabled, false))
    return Number(result?.count ?? 0)
  }

  // 获取总命中次数 统计所有敏感词的命中次数总和
  private async getTotalHits() {
    const [result] = await this.db
      .select({ sum: sql<number>`sum(${this.sensitiveWord.hitCount})` })
      .from(this.sensitiveWord)
    return Number(result?.sum ?? 0)
  }

  // 获取指定时间范围内的命中次数 统计指定时间范围内所有敏感词的命中次数总和
  private async getHitsInDateRange(startDate: Date) {
    const [result] = await this.db
      .select({ sum: sql<number>`count(*)` })
      .from(this.sensitiveWordHitLog)
      .where(sql`${this.sensitiveWordHitLog.createdAt} >= ${startDate}`)
    return Number(result?.sum ?? 0)
  }

  // 获取今日命中次数 统计今日所有敏感词的命中次数总和
  private async getTodayHits() {
    const today = startOfTodayInAppTimeZone()
    return this.getHitsInDateRange(today)
  }

  // 获取最近一周命中次数 统计最近一周所有敏感词的命中次数总和
  private async getLastWeekHits() {
    const lastWeek = subtractDaysInAppTimeZone(7)
    return this.getHitsInDateRange(lastWeek)
  }

  // 获取最近一月命中次数 统计最近一月所有敏感词的命中次数总和
  private async getLastMonthHits() {
    const lastMonth = subtractMonthsInAppTimeZone(1)
    return this.getHitsInDateRange(lastMonth)
  }

  // 获取级别统计 按敏感词级别分组统计，包含每个级别的敏感词数量和命中次数
  async getLevelStatistics() {
    const results = await this.db
      .select({
        level: this.sensitiveWord.level,
        count: sql<number>`count(*)`,
        hitCount: sql<number>`sum(${this.sensitiveWord.hitCount})`,
      })
      .from(this.sensitiveWord)
      .groupBy(this.sensitiveWord.level)

    return results.map((result) => ({
      level: result.level,
      levelName: SensitiveWordLevelNames[result.level] || '未知',
      count: Number(result.count),
      hitCount: Number(result.hitCount) || 0,
    }))
  }

  // 获取类型统计 按敏感词类型分组统计，包含每个类型的敏感词数量和命中次数
  async getTypeStatistics() {
    const results = await this.db
      .select({
        type: this.sensitiveWord.type,
        count: sql<number>`count(*)`,
        hitCount: sql<number>`sum(${this.sensitiveWord.hitCount})`,
      })
      .from(this.sensitiveWord)
      .groupBy(this.sensitiveWord.type)

    return results.map((result) => ({
      type: result.type,
      typeName: SensitiveWordTypeNames[result.type] || '未知',
      count: Number(result.count),
      hitCount: Number(result.hitCount) || 0,
    }))
  }

  // 获取命中次数最多的敏感词 返回命中次数最高的20个敏感词
  async getTopHitWords() {
    const results = await this.db
      .select({
        word: this.sensitiveWord.word,
        hitCount: this.sensitiveWord.hitCount,
        level: this.sensitiveWord.level,
        type: this.sensitiveWord.type,
        lastHitAt: this.sensitiveWord.lastHitAt,
      })
      .from(this.sensitiveWord)
      .where(gt(this.sensitiveWord.hitCount, 0))
      .orderBy(desc(this.sensitiveWord.hitCount))
      .limit(20)

    return results.map((result) => ({
      word: result.word,
      hitCount: result.hitCount,
      level: result.level,
      type: result.type,
      lastHitAt: result.lastHitAt ?? null,
    }))
  }

  // 获取最近命中的敏感词 返回最近命中的20个敏感词，按最后命中时间倒序排列
  async getRecentHitWords() {
    const results = await this.db
      .select({
        word: this.sensitiveWord.word,
        hitCount: this.sensitiveWord.hitCount,
        level: this.sensitiveWord.level,
        type: this.sensitiveWord.type,
        lastHitAt: this.sensitiveWord.lastHitAt,
      })
      .from(this.sensitiveWord)
      .where(isNotNull(this.sensitiveWord.lastHitAt))
      .orderBy(desc(this.sensitiveWord.lastHitAt))
      .limit(20)

    return results.map((result) => ({
      word: result.word,
      hitCount: result.hitCount,
      level: result.level,
      type: result.type,
      lastHitAt: result.lastHitAt ?? null,
    }))
  }

  async getHitLogPage(dto: QuerySensitiveWordHitLogDto) {
    const conditions = this.buildHitLogConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          id: this.sensitiveWordHitLog.id,
          sensitiveWordId: this.sensitiveWordHitLog.sensitiveWordId,
          word: this.sensitiveWord.word,
          matchedWord: this.sensitiveWordHitLog.matchedWord,
          level: this.sensitiveWordHitLog.level,
          type: this.sensitiveWordHitLog.type,
          entityType: this.sensitiveWordHitLog.entityType,
          entityId: this.sensitiveWordHitLog.entityId,
          operationType: this.sensitiveWordHitLog.operationType,
          createdAt: this.sensitiveWordHitLog.createdAt,
          topicId: this.forumTopic.id,
          topicTitle: this.forumTopic.title,
          topicContent: this.forumTopic.content,
          topicAuditStatus: this.forumTopic.auditStatus,
          topicIsHidden: this.forumTopic.isHidden,
          topicDeletedAt: this.forumTopic.deletedAt,
          commentId: this.userComment.id,
          commentContent: this.userComment.content,
          commentAuditStatus: this.userComment.auditStatus,
          commentIsHidden: this.userComment.isHidden,
          commentDeletedAt: this.userComment.deletedAt,
          commentTargetType: this.userComment.targetType,
          commentTargetId: this.userComment.targetId,
          authorId: this.appUser.id,
          authorNickname: this.appUser.nickname,
          authorAvatarUrl: this.appUser.avatarUrl,
          authorStatus: this.appUser.status,
          authorIsEnabled: this.appUser.isEnabled,
          authorDeletedAt: this.appUser.deletedAt,
        })
        .from(this.sensitiveWordHitLog)
        .leftJoin(
          this.sensitiveWord,
          eq(
            this.sensitiveWord.id,
            this.sensitiveWordHitLog.sensitiveWordId,
          ),
        )
        .leftJoin(
          this.forumTopic,
          and(
            eq(
              this.sensitiveWordHitLog.entityType,
              SensitiveWordHitEntityTypeEnum.TOPIC,
            ),
            eq(this.forumTopic.id, this.sensitiveWordHitLog.entityId),
          ),
        )
        .leftJoin(
          this.userComment,
          and(
            eq(
              this.sensitiveWordHitLog.entityType,
              SensitiveWordHitEntityTypeEnum.COMMENT,
            ),
            eq(this.userComment.id, this.sensitiveWordHitLog.entityId),
          ),
        )
        .leftJoin(
          this.appUser,
          or(
            and(
              eq(
                this.sensitiveWordHitLog.entityType,
                SensitiveWordHitEntityTypeEnum.TOPIC,
              ),
              eq(this.appUser.id, this.forumTopic.userId),
            ),
            and(
              eq(
                this.sensitiveWordHitLog.entityType,
                SensitiveWordHitEntityTypeEnum.COMMENT,
              ),
              eq(this.appUser.id, this.userComment.userId),
            ),
          ),
        )
        .where(where)
        .orderBy(
          desc(this.sensitiveWordHitLog.createdAt),
          desc(this.sensitiveWordHitLog.id),
        )
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.sensitiveWordHitLog)
        .leftJoin(
          this.sensitiveWord,
          eq(
            this.sensitiveWord.id,
            this.sensitiveWordHitLog.sensitiveWordId,
          ),
        )
        .where(where),
    ])

    const total = Number(totalRows[0]?.count ?? 0)
    return toPageResult(
      rows.map((row) => ({
        id: row.id,
        sensitiveWordId: row.sensitiveWordId,
        word: row.word ?? null,
        matchedWord: row.matchedWord,
        level: row.level,
        type: row.type,
        entityType: row.entityType,
        entityId: row.entityId,
        operationType: row.operationType,
        entitySummary: this.buildEntitySummary(row),
        authorSummary: this.buildAuthorSummary(row),
        createdAt: row.createdAt,
      })),
      total,
      page,
    )
  }

  private buildHitLogConditions(dto: QuerySensitiveWordHitLogDto): SQL[] {
    const conditions: SQL[] = []
    const wordPattern = buildLikePattern(dto.word)

    if (wordPattern) {
      const wordCondition = or(
        ilike(this.sensitiveWord.word, wordPattern),
        ilike(this.sensitiveWordHitLog.matchedWord, wordPattern),
      )
      if (wordCondition) {
        conditions.push(wordCondition)
      }
    }

    if (dto.sensitiveWordId !== undefined) {
      conditions.push(
        eq(this.sensitiveWordHitLog.sensitiveWordId, dto.sensitiveWordId),
      )
    }
    if (dto.level !== undefined) {
      conditions.push(eq(this.sensitiveWordHitLog.level, dto.level))
    }
    if (dto.type !== undefined) {
      conditions.push(eq(this.sensitiveWordHitLog.type, dto.type))
    }
    if (dto.entityType !== undefined) {
      conditions.push(eq(this.sensitiveWordHitLog.entityType, dto.entityType))
    }
    if (dto.entityId !== undefined) {
      conditions.push(eq(this.sensitiveWordHitLog.entityId, dto.entityId))
    }
    if (dto.operationType !== undefined) {
      conditions.push(
        eq(this.sensitiveWordHitLog.operationType, dto.operationType),
      )
    }

    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.sensitiveWordHitLog.createdAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.sensitiveWordHitLog.createdAt, dateRange.lt))
    }
    if (!dto.startDate && !dto.endDate) {
      conditions.push(
        gte(this.sensitiveWordHitLog.createdAt, subtractDaysInAppTimeZone(7)),
      )
    }

    return conditions
  }

  private buildEntitySummary(row: {
    entityType: number
    topicId: number | null
    topicTitle: string | null
    topicContent: string | null
    topicAuditStatus: number | null
    topicIsHidden: boolean | null
    topicDeletedAt: Date | null
    commentId: number | null
    commentContent: string | null
    commentAuditStatus: number | null
    commentIsHidden: boolean | null
    commentDeletedAt: Date | null
    commentTargetType: number | null
    commentTargetId: number | null
  }) {
    if (row.entityType === SensitiveWordHitEntityTypeEnum.TOPIC) {
      const status = this.resolveEntityStatus({
        exists: row.topicId !== null,
        deletedAt: row.topicDeletedAt,
        auditStatus: row.topicAuditStatus,
        isHidden: row.topicIsHidden,
      })
      const hideContent = this.shouldHideEntityContent(status)
      return {
        status,
        canNavigate: this.canOpenAdminDisposition(status),
        title: hideContent ? null : (row.topicTitle ?? null),
        snippet: hideContent ? null : this.buildSnippet(row.topicContent),
        auditStatus:
          row.topicAuditStatus === null
            ? null
            : (row.topicAuditStatus),
        isHidden: row.topicIsHidden ?? null,
        targetType: null,
        targetId: null,
      }
    }

    const status = this.resolveEntityStatus({
      exists: row.commentId !== null,
      deletedAt: row.commentDeletedAt,
      auditStatus: row.commentAuditStatus,
      isHidden: row.commentIsHidden,
    })
    const hideContent = this.shouldHideEntityContent(status)
    return {
      status,
      canNavigate: this.canOpenAdminDisposition(status),
      title: null,
      snippet: hideContent ? null : this.buildSnippet(row.commentContent),
      auditStatus:
        row.commentAuditStatus === null
          ? null
          : (row.commentAuditStatus),
      isHidden: row.commentIsHidden ?? null,
      targetType: row.commentTargetType ?? null,
      targetId: row.commentTargetId ?? null,
    }
  }

  private buildAuthorSummary(row: {
    authorAvatarUrl: string | null
    authorDeletedAt: Date | null
    authorId: number | null
    authorIsEnabled: boolean | null
    authorNickname: string | null
    authorStatus: number | null
  }) {
    if (!row.authorId) {
      return null
    }

    return {
      id: row.authorId,
      nickname: row.authorNickname ?? null,
      avatarUrl: row.authorAvatarUrl ?? null,
      status: row.authorDeletedAt ? null : (row.authorStatus ?? null),
      isEnabled: row.authorDeletedAt ? null : (row.authorIsEnabled ?? null),
    }
  }

  private resolveEntityStatus(input: {
    auditStatus: number | null
    deletedAt: Date | null
    exists: boolean
    isHidden: boolean | null
  }) {
    if (!input.exists) {
      return SensitiveWordHitLogEntityStatusEnum.MISSING
    }
    if (input.deletedAt) {
      return SensitiveWordHitLogEntityStatusEnum.DELETED
    }
    if (input.isHidden) {
      return SensitiveWordHitLogEntityStatusEnum.HIDDEN
    }
    if (input.auditStatus === AuditStatusEnum.REJECTED) {
      return SensitiveWordHitLogEntityStatusEnum.FORBIDDEN
    }
    return SensitiveWordHitLogEntityStatusEnum.AVAILABLE
  }

  private canOpenAdminDisposition(
    status: SensitiveWordHitLogEntityStatusEnum,
  ) {
    return !this.shouldHideEntityContent(status)
  }

  private shouldHideEntityContent(status: SensitiveWordHitLogEntityStatusEnum) {
    return (
      status === SensitiveWordHitLogEntityStatusEnum.MISSING ||
      status === SensitiveWordHitLogEntityStatusEnum.DELETED
    )
  }

  private buildSnippet(content: string | null | undefined) {
    const normalized = content?.replace(/\s+/g, ' ').trim()
    return normalized ? normalized.slice(0, 200) : null
  }

  // 在业务写事务中记录敏感词命中，并同步词表累计快照。 管理端检测/替换接口不调用该方法，避免把调试流量混入业务统计。
  async recordEntityHitsInTx(
    tx: Db,
    input: RecordSensitiveWordEntityHitsInput,
  ) {
    if (input.hits.length === 0) {
      return
    }

    const occurredAt = input.occurredAt ?? new Date()
    const logRows = input.hits.map((hit) => ({
      sensitiveWordId: hit.sensitiveWordId,
      entityType: SensitiveWordHitEntityTypeMap[input.entityType],
      entityId: input.entityId,
      operationType: SensitiveWordHitOperationTypeMap[input.operationType],
      matchedWord: hit.word,
      level: hit.level,
      type: hit.type,
      createdAt: occurredAt,
    }))

    await this.drizzle.withErrorHandling(() =>
      tx.insert(this.sensitiveWordHitLog).values(logRows),
    )

    const aggregateMap = new Map<number, number>()
    input.hits.forEach((hit) => {
      aggregateMap.set(
        hit.sensitiveWordId,
        (aggregateMap.get(hit.sensitiveWordId) ?? 0) + 1,
      )
    })

    const aggregateRows = [...aggregateMap.entries()].map(
      ([sensitiveWordId, hitCount]) => sql`(${sensitiveWordId}, ${hitCount})`,
    )
    await this.drizzle.withErrorHandling(() =>
      tx.execute(sql`
        UPDATE "sensitive_word" AS sw
        SET
          "hit_count" = sw."hit_count" + delta."hit_count"::integer,
          "last_hit_at" = ${occurredAt}
        FROM (
          VALUES ${sql.join(aggregateRows, sql`, `)}
        ) AS delta("id", "hit_count")
        WHERE sw."id" = delta."id"::integer
      `),
    )
  }
}
