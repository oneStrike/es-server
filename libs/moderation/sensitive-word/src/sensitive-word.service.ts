import type { SQL } from 'drizzle-orm'
import { buildLikePattern, DrizzleService } from '@db/core'
import { UpdateEnabledStatusDto } from '@libs/platform/dto/base.dto'
import { Injectable } from '@nestjs/common'
import { and, eq, like } from 'drizzle-orm'
import {
  CreateSensitiveWordDto,
  QuerySensitiveWordDto,
  SensitiveWordStatisticsQueryDto,
  SensitiveWordStatisticsResponseDto,
  UpdateSensitiveWordDto,
} from './dto/sensitive-word.dto'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import { StatisticsTypeEnum } from './sensitive-word-constant'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'

// 敏感词服务类，负责敏感词的增删改查、状态管理以及统计分析。
@Injectable()
export class SensitiveWordService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: SensitiveWordCacheService,
    private readonly detectService: SensitiveWordDetectService,
    private readonly statisticsService: SensitiveWordStatisticsService,
  ) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 敏感词表。
  private get sensitiveWord() {
    return this.drizzle.schema.sensitiveWord
  }

  // 获取敏感词列表。
  async getSensitiveWordPage(dto: QuerySensitiveWordDto) {
    // 构建查询条件。
    const conditions: SQL[] = []
    if (dto.word) {
      conditions.push(
        like(this.sensitiveWord.word, buildLikePattern(dto.word)!),
      )
    }

    ;['isEnabled', 'level', 'type', 'matchMode'].forEach((key) => {
      if (dto[key] !== undefined) {
        conditions.push(eq(this.sensitiveWord[key], dto[key]))
      }
    })

    return this.drizzle.ext.findPagination(this.sensitiveWord, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...dto,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    })
  }

  // 创建敏感词。
  async createSensitiveWord(dto: CreateSensitiveWordDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.sensitiveWord).values(dto),
    )

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return true
  }

  // 更新敏感词。
  async updateSensitiveWord(dto: UpdateSensitiveWordDto) {
    const { id, ...updateData } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.sensitiveWord)
          .set(updateData)
          .where(eq(this.sensitiveWord.id, id)),
      { notFound: `ID【${id}】数据不存在` },
    )

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return true
  }

  // 删除敏感词。
  async deleteSensitiveWord(dto: { id: number }) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .delete(this.sensitiveWord)
          .where(eq(this.sensitiveWord.id, dto.id)),
      { notFound: `ID【${dto.id}】数据不存在` },
    )

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return true
  }

  // 更新敏感词状态。
  async updateSensitiveWordStatus(dto: UpdateEnabledStatusDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.sensitiveWord)
          .set({ isEnabled: dto.isEnabled })
          .where(eq(this.sensitiveWord.id, dto.id)),
      { notFound: `ID【${dto.id}】数据不存在` },
    )

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return true
  }

  // 获取统计查询结果。
  async getStatistics(dto: SensitiveWordStatisticsQueryDto) {
    const type = dto.type || StatisticsTypeEnum.LEVEL

    let data: SensitiveWordStatisticsResponseDto['data']

    switch (type) {
      case StatisticsTypeEnum.LEVEL:
        data = await this.statisticsService.getLevelStatistics()
        break
      case StatisticsTypeEnum.TYPE:
        data = await this.statisticsService.getTypeStatistics()
        break
      case StatisticsTypeEnum.TOP_HITS:
        data = await this.statisticsService.getTopHitWords()
        break
      case StatisticsTypeEnum.RECENT_HITS:
        data = await this.statisticsService.getRecentHitWords()
        break
      default:
        data = await this.statisticsService.getLevelStatistics()
    }

    return {
      type,
      data,
    }
  }
}
