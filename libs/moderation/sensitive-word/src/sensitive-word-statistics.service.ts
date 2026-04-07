import type {
  SensitiveWordRecentHitStatistics,
} from './sensitive-word.types'
import { DrizzleService } from '@db/core'
import { startOfTodayInAppTimeZone, subtractDaysInAppTimeZone, subtractMonthsInAppTimeZone } from '@libs/platform/utils/time';
import { Injectable, Logger } from '@nestjs/common'
import { desc, eq, gt, gte, isNotNull, sql } from 'drizzle-orm'
import { SensitiveWordStatisticsDataDto } from './dto/sensitive-word.dto'
import {
  SensitiveWordLevelNames,
  SensitiveWordTypeNames,
} from './sensitive-word-constant'

/**
 * 敏感词统计服务
 * 提供敏感词数量、命中与分类统计能力
 */
@Injectable()
export class SensitiveWordStatisticsService {
  private readonly logger = new Logger(SensitiveWordStatisticsService.name)

  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 敏感词表 */
  private get systemSensitiveWord() {
    return this.drizzle.schema.systemSensitiveWord
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
      .from(this.systemSensitiveWord)
    return Number(result?.count ?? 0)
  }

  /**
   * 获取启用的敏感词数量
   * @returns 启用的敏感词数量
   */
  private async getEnabledWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.systemSensitiveWord)
      .where(eq(this.systemSensitiveWord.isEnabled, true))
    return Number(result?.count ?? 0)
  }

  /**
   * 获取禁用的敏感词数量
   * @returns 禁用的敏感词数量
   */
  private async getDisabledWords() {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.systemSensitiveWord)
      .where(eq(this.systemSensitiveWord.isEnabled, false))
    return Number(result?.count ?? 0)
  }

  /**
   * 获取总命中次数
   * 统计所有敏感词的命中次数总和
   * @returns 总命中次数
   */
  private async getTotalHits() {
    const [result] = await this.db
      .select({ sum: sql<number>`sum(${this.systemSensitiveWord.hitCount})` })
      .from(this.systemSensitiveWord)
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
      .select({ sum: sql<number>`sum(${this.systemSensitiveWord.hitCount})` })
      .from(this.systemSensitiveWord)
      .where(gte(this.systemSensitiveWord.lastHitAt, startDate))
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
  private async getLevelStatistics() {
    const results = await this.db
      .select({
        level: this.systemSensitiveWord.level,
        count: sql<number>`count(*)`,
        hitCount: sql<number>`sum(${this.systemSensitiveWord.hitCount})`,
      })
      .from(this.systemSensitiveWord)
      .groupBy(this.systemSensitiveWord.level)

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
  private async getTypeStatistics() {
    const results = await this.db
      .select({
        type: this.systemSensitiveWord.type,
        count: sql<number>`count(*)`,
        hitCount: sql<number>`sum(${this.systemSensitiveWord.hitCount})`,
      })
      .from(this.systemSensitiveWord)
      .groupBy(this.systemSensitiveWord.type)

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
  private async getTopHitWords() {
    const results = await this.db
      .select({
        word: this.systemSensitiveWord.word,
        hitCount: this.systemSensitiveWord.hitCount,
        level: this.systemSensitiveWord.level,
        type: this.systemSensitiveWord.type,
        lastHitAt: this.systemSensitiveWord.lastHitAt,
      })
      .from(this.systemSensitiveWord)
      .where(gt(this.systemSensitiveWord.hitCount, 0))
      .orderBy(desc(this.systemSensitiveWord.hitCount))
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
  private async getRecentHitWords(): Promise<
    SensitiveWordRecentHitStatistics[]
  > {
    const results = await this.db
      .select({
        word: this.systemSensitiveWord.word,
        hitCount: this.systemSensitiveWord.hitCount,
        level: this.systemSensitiveWord.level,
        type: this.systemSensitiveWord.type,
        lastHitAt: this.systemSensitiveWord.lastHitAt,
      })
      .from(this.systemSensitiveWord)
      .where(isNotNull(this.systemSensitiveWord.lastHitAt))
      .orderBy(desc(this.systemSensitiveWord.lastHitAt))
      .limit(20)

    return results.map((result) => ({
      word: result.word,
      hitCount: result.hitCount,
      level: result.level,
      type: result.type,
      lastHitAt: result.lastHitAt!,
    }))
  }

  /**
   * 更新敏感词命中次数
   * 将指定敏感词的命中次数加1，并更新最后命中时间
   * @param word - 敏感词
   */
  async incrementHitCount(word: string): Promise<void> {
    try {
      await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.systemSensitiveWord)
          .set({
            hitCount: sql`${this.systemSensitiveWord.hitCount} + 1`,
            lastHitAt: new Date(),
          })
          .where(eq(this.systemSensitiveWord.word, word)),
      )
    } catch (error) {
      this.logger.error(`更新敏感词命中次数失败: ${word}`, error)
    }
  }

  /**
   * 批量更新敏感词命中次数
   * 将多个敏感词的命中次数分别加1，并更新各自的最后命中时间
   * @param words - 敏感词列表
   */
  async incrementHitCounts(words: string[]): Promise<void> {
    if (words.length === 0) {
      return
    }

    try {
      await Promise.all(words.map(async (word) => this.incrementHitCount(word)))
    } catch (error) {
      this.logger.error('批量更新敏感词命中次数失败', error)
    }
  }
}
