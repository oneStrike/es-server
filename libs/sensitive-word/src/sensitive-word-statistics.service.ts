import { DrizzleService } from '@db/drizzle.service'
import { Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, gte, gt, isNotNull, sql } from 'drizzle-orm'
import {
  SensitiveWordLevelStatisticsDto,
  SensitiveWordRecentHitStatisticsDto,
  SensitiveWordStatisticsDataDto,
  SensitiveWordTopHitStatisticsDto,
  SensitiveWordTypeStatisticsDto,
} from './dto/sensitive-word-statistics.dto'
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
  private get sensitiveWord() {
    return this.drizzle.schema.sensitiveWord
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
  private async getTotalWords(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.sensitiveWord)
    return Number(result?.count ?? 0)
  }

  /**
   * 获取启用的敏感词数量
   * @returns 启用的敏感词数量
   */
  private async getEnabledWords(): Promise<number> {
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
  private async getDisabledWords(): Promise<number> {
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
  private async getTotalHits(): Promise<number> {
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
  private async getHitsInDateRange(startDate: Date): Promise<number> {
    const [result] = await this.db
      .select({ sum: sql<number>`sum(${this.sensitiveWord.hitCount})` })
      .from(this.sensitiveWord)
      .where(gte(this.sensitiveWord.lastHitAt, startDate))
    return Number(result?.sum ?? 0)
  }

  /**
   * 获取今日命中次数
   * 统计今日所有敏感词的命中次数总和
   * @returns 今日命中次数
   */
  private async getTodayHits(): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return this.getHitsInDateRange(today)
  }

  /**
   * 获取最近一周命中次数
   * 统计最近一周所有敏感词的命中次数总和
   * @returns 最近一周命中次数
   */
  private async getLastWeekHits(): Promise<number> {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    return this.getHitsInDateRange(lastWeek)
  }

  /**
   * 获取最近一月命中次数
   * 统计最近一月所有敏感词的命中次数总和
   * @returns 最近一月命中次数
   */
  private async getLastMonthHits(): Promise<number> {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    return this.getHitsInDateRange(lastMonth)
  }

  /**
   * 获取级别统计
   * 按敏感词级别分组统计，包含每个级别的敏感词数量和命中次数
   * @returns 级别统计列表
   */
  private async getLevelStatistics(): Promise<SensitiveWordLevelStatisticsDto[]> {
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
  private async getTypeStatistics(): Promise<SensitiveWordTypeStatisticsDto[]> {
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
  private async getTopHitWords(): Promise<SensitiveWordTopHitStatisticsDto[]> {
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
  private async getRecentHitWords(): Promise<
    SensitiveWordRecentHitStatisticsDto[]
  > {
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
      await this.db
        .update(this.sensitiveWord)
        .set({
          hitCount: sql`${this.sensitiveWord.hitCount} + 1`,
          lastHitAt: new Date(),
        })
        .where(eq(this.sensitiveWord.word, word))
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
