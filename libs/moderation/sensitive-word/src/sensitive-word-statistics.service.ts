import type { Db } from '@db/core'
import type {
  SensitiveWordStatisticsDataDto,
  SensitiveWordTopHitStatisticsDto,
} from './dto/sensitive-word.dto'
import type {
  RecordSensitiveWordEntityHitsInput,
} from './sensitive-word.types'
import { DrizzleService } from '@db/core'
import {
  startOfTodayInAppTimeZone,
  subtractDaysInAppTimeZone,
  subtractMonthsInAppTimeZone,
} from '@libs/platform/utils/time'
import { Injectable } from '@nestjs/common'
import { desc, eq, gt, isNotNull, sql } from 'drizzle-orm'
import {
  SensitiveWordLevelNames,
  SensitiveWordTypeNames,
} from './sensitive-word-constant'
import {
  SensitiveWordHitEntityTypeMap,
  SensitiveWordHitOperationTypeMap,
} from './sensitive-word.types'

/**
 * 敏感词统计服务
 * 提供敏感词数量、命中与分类统计能力
 */
@Injectable()
export class SensitiveWordStatisticsService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 敏感词表 */
  private get sensitiveWord() {
    return this.drizzle.schema.sensitiveWord
  }

  /** 敏感词命中明细表 */
  private get sensitiveWordHitLog() {
    return this.drizzle.schema.sensitiveWordHitLog
  }

  /**
   * 获取完整的统计数据
   * 包含所有维度的统计信息
   * @returns 完整的统计数据
   */
  async getStatistics(): Promise<SensitiveWordStatisticsDataDto> {
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

  /**
   * 获取敏感词总数
   * @returns 敏感词总数
   */
  private async getTotalWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
    return Number(result?.count ?? 0)
  }

  /**
   * 获取启用的敏感词数量
   * @returns 启用的敏感词数量
   */
  private async getEnabledWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
      .where(eq(this.sensitiveWord.isEnabled, true))
    return Number(result?.count ?? 0)
  }

  /**
   * 获取禁用的敏感词数量
   * @returns 禁用的敏感词数量
   */
  private async getDisabledWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
      .where(eq(this.sensitiveWord.isEnabled, false))
    return Number(result?.count ?? 0)
  }

  /**
   * 获取总命中次数
   * 统计所有敏感词的命中次数总和
   * @returns 总命中次数
   */
  private async getTotalHits() {
    const [result] = await this.db
      .select({ sum: sql<number>`sum(${this.sensitiveWord.hitCount})` })
      .from(this.sensitiveWord)
    return Number(result?.sum ?? 0)
  }

  /**
   * 获取指定时间范围内的命中次数
   * 统计指定时间范围内所有敏感词的命中次数总和
   * @param startDate - 开始时间
   * @returns 命中次数
   */
  private async getHitsInDateRange(startDate: Date) {
    const [result] = await this.db
      .select({ sum: sql<number>`count(*)` })
      .from(this.sensitiveWordHitLog)
      .where(sql`${this.sensitiveWordHitLog.createdAt} >= ${startDate}`)
    return Number(result?.sum ?? 0)
  }

  /**
   * 获取今日命中次数
   * 统计今日所有敏感词的命中次数总和
   * @returns 今日命中次数
   */
  private async getTodayHits() {
    const today = startOfTodayInAppTimeZone()
    return this.getHitsInDateRange(today)
  }

  /**
   * 获取最近一周命中次数
   * 统计最近一周所有敏感词的命中次数总和
   * @returns 最近一周命中次数
   */
  private async getLastWeekHits() {
    const lastWeek = subtractDaysInAppTimeZone(7)
    return this.getHitsInDateRange(lastWeek)
  }

  /**
   * 获取最近一月命中次数
   * 统计最近一月所有敏感词的命中次数总和
   * @returns 最近一月命中次数
   */
  private async getLastMonthHits() {
    const lastMonth = subtractMonthsInAppTimeZone(1)
    return this.getHitsInDateRange(lastMonth)
  }

  /**
   * 获取级别统计
   * 按敏感词级别分组统计，包含每个级别的敏感词数量和命中次数
   * @returns 级别统计列表
   */
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

  /**
   * 获取类型统计
   * 按敏感词类型分组统计，包含每个类型的敏感词数量和命中次数
   * @returns 类型统计列表
   */
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

  /**
   * 获取命中次数最多的敏感词
   * 返回命中次数最高的20个敏感词
   * @returns 热门敏感词列表
   */
  async getTopHitWords(): Promise<SensitiveWordTopHitStatisticsDto[]> {
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
      lastHitAt: result.lastHitAt ?? undefined,
    }))
  }

  /**
   * 获取最近命中的敏感词
   * 返回最近命中的20个敏感词，按最后命中时间倒序排列
   * @returns 最近命中的敏感词列表
   */
  async getRecentHitWords(): Promise<SensitiveWordTopHitStatisticsDto[]> {
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
      lastHitAt: result.lastHitAt ?? undefined,
    }))
  }

  /**
   * 在业务写事务中记录敏感词命中，并同步词表累计快照。
   * 管理端检测/替换接口不调用该方法，避免把调试流量混入业务统计。
   */
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

    for (const [sensitiveWordId, hitCount] of aggregateMap.entries()) {
      await this.drizzle.withErrorHandling(() =>
        tx
          .update(this.sensitiveWord)
          .set({
            hitCount: sql`${this.sensitiveWord.hitCount} + ${hitCount}`,
            lastHitAt: occurredAt,
          })
          .where(eq(this.sensitiveWord.id, sensitiveWordId)),
      )
    }
  }
}
