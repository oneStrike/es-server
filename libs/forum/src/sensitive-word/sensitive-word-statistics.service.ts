import { BaseService } from '@libs/base/database'
import { Injectable, Logger } from '@nestjs/common'
import {
  LevelStatisticsDto,
  RecentHitStatisticsDto,
  StatisticsDataDto,
  TopHitStatisticsDto,
  TypeStatisticsDto,
} from './dto/sensitive-word-statistics.dto'
import {
  SensitiveWordLevelNames,
  SensitiveWordTypeNames,
} from './sensitive-word-constant'

/**
 * 敏感词统计服务类
 * 提供敏感词相关的统计功能，包括：
 * - 敏感词数量统计（总数、启用数、禁用数）
 * - 命中次数统计（总命中、今日命中、最近一周、最近一月）
 * - 级别统计（按敏感词级别分组统计）
 * - 类型统计（按敏感词类型分组统计）
 * - 热门敏感词（命中次数最多的敏感词）
 * - 最近命中的敏感词
 */
@Injectable()
export class SensitiveWordStatisticsService extends BaseService {
  private readonly logger = new Logger(SensitiveWordStatisticsService.name)

  get sensitiveWord() {
    return this.prisma.forumSensitiveWord
  }

  /**
   * 获取完整的统计数据
   * 包含所有维度的统计信息
   * @returns 完整的统计数据
   */
  async getStatistics(): Promise<StatisticsDataDto> {
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
    return this.sensitiveWord.count()
  }

  /**
   * 获取启用的敏感词数量
   * @returns 启用的敏感词数量
   */
  private async getEnabledWords(): Promise<number> {
    return this.sensitiveWord.count({
      where: {
        isEnabled: true,
      },
    })
  }

  /**
   * 获取禁用的敏感词数量
   * @returns 禁用的敏感词数量
   */
  private async getDisabledWords(): Promise<number> {
    return this.sensitiveWord.count({
      where: {
        isEnabled: false,
      },
    })
  }

  /**
   * 获取总命中次数
   * 统计所有敏感词的命中次数总和
   * @returns 总命中次数
   */
  private async getTotalHits(): Promise<number> {
    const result = await this.sensitiveWord.aggregate({
      _sum: {
        hitCount: true,
      },
    })

    return result._sum.hitCount || 0
  }

  /**
   * 获取指定时间范围内的命中次数
   * 统计指定时间范围内所有敏感词的命中次数总和
   * @param startDate - 开始时间
   * @returns 命中次数
   */
  private async getHitsInDateRange(startDate: Date): Promise<number> {
    const result = await this.sensitiveWord.aggregate({
      where: {
        lastHitAt: {
          gte: startDate,
        },
      },
      _sum: {
        hitCount: true,
      },
    })

    return result._sum.hitCount || 0
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
  private async getLevelStatistics(): Promise<LevelStatisticsDto[]> {
    const results = await this.sensitiveWord.groupBy({
      by: ['level'],
      _count: {
        id: true,
      },
      _sum: {
        hitCount: true,
      },
    })

    return results.map((result) => ({
      level: result.level,
      levelName: SensitiveWordLevelNames[result.level] || '未知',
      count: result._count.id,
      hitCount: result._sum.hitCount || 0,
    }))
  }

  /**
   * 获取类型统计
   * 按敏感词类型分组统计，包含每个类型的敏感词数量和命中次数
   * @returns 类型统计列表
   */
  private async getTypeStatistics(): Promise<TypeStatisticsDto[]> {
    const results = await this.sensitiveWord.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
      _sum: {
        hitCount: true,
      },
    })

    return results.map((result) => ({
      type: result.type,
      typeName: SensitiveWordTypeNames[result.type] || '未知',
      count: result._count.id,
      hitCount: result._sum.hitCount || 0,
    }))
  }

  /**
   * 获取命中次数最多的敏感词
   * 返回命中次数最高的20个敏感词
   * @returns 热门敏感词列表
   */
  private async getTopHitWords(): Promise<TopHitStatisticsDto[]> {
    const results = await this.sensitiveWord.findMany({
      where: {
        hitCount: {
          gt: 0,
        },
      },
      orderBy: {
        hitCount: 'desc',
      },
      take: 20,
      select: {
        word: true,
        hitCount: true,
        level: true,
        type: true,
        lastHitAt: true,
      },
    })

    return results.map((result) => ({
      word: result.word,
      hitCount: result.hitCount,
      level: result.level,
      type: result.type,
      lastHitAt: result.lastHitAt,
    }))
  }

  /**
   * 获取最近命中的敏感词
   * 返回最近命中的20个敏感词，按最后命中时间倒序排列
   * @returns 最近命中的敏感词列表
   */
  private async getRecentHitWords(): Promise<RecentHitStatisticsDto[]> {
    const results = await this.sensitiveWord.findMany({
      where: {
        lastHitAt: {
          not: null,
        },
      },
      orderBy: {
        lastHitAt: 'desc',
      },
      take: 20,
      select: {
        word: true,
        hitCount: true,
        level: true,
        type: true,
        lastHitAt: true,
      },
    })

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
      await this.sensitiveWord.updateMany({
        where: {
          word,
        },
        data: {
          hitCount: {
            increment: 1,
          },
          lastHitAt: new Date(),
        },
      })
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
