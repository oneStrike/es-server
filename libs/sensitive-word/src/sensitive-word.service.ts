import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/drizzle.service'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, gt, like, isNotNull, sql } from 'drizzle-orm'
import {
  SensitiveWordLevelStatisticsDto,
  SensitiveWordRecentHitStatisticsDto,
  SensitiveWordStatisticsQueryDto,
  SensitiveWordStatisticsResponseDto,
  SensitiveWordTopHitStatisticsDto,
  SensitiveWordTypeStatisticsDto,
} from './dto/sensitive-word-statistics.dto'
import {
  CreateSensitiveWordDto,
  QuerySensitiveWordDto,
  UpdateSensitiveWordDto,
} from './dto/sensitive-word.dto'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import {
  SensitiveWordLevelNames,
  SensitiveWordTypeNames,
  StatisticsTypeEnum,
} from './sensitive-word-constant'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'

/**
 * 敏感词服务类
 * 负责敏感词的增删改查、状态管理以及统计分析
 */
@Injectable()
export class SensitiveWordService {
  private readonly logger = new Logger(SensitiveWordDetectService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: SensitiveWordCacheService,
    private readonly detectService: SensitiveWordDetectService,
  ) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 敏感词表 */
  private get sensitiveWord() {
    return this.drizzle.schema.sensitiveWord
  }

  /**
   * 获取敏感词列表
   * @param dto 查询条件
   * @returns 分页结果
   */
  async getSensitiveWordPage(dto: QuerySensitiveWordDto) {
    const { word, isEnabled, level, matchMode, type, pageIndex, pageSize, orderBy, startDate, endDate } = dto

    // 构建查询条件
    const conditions: SQL[] = []
    if (word) {
      conditions.push(like(this.sensitiveWord.word, `%${word}%`))
    }
    if (isEnabled !== undefined) {
      conditions.push(eq(this.sensitiveWord.isEnabled, isEnabled))
    }
    if (level !== undefined) {
      conditions.push(eq(this.sensitiveWord.level, level))
    }
    if (matchMode !== undefined) {
      conditions.push(eq(this.sensitiveWord.matchMode, matchMode))
    }
    if (type !== undefined) {
      conditions.push(eq(this.sensitiveWord.type, type))
    }

    return this.drizzle.ext.findPagination(this.sensitiveWord, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      pageIndex,
      pageSize,
      orderBy,
      startDate,
      endDate,
    })
  }

  /**
   * 创建敏感词
   * @param dto 创建参数
   * @returns 新建敏感词
   */
  async createSensitiveWord(dto: CreateSensitiveWordDto) {
    const [result] = await this.db
      .insert(this.sensitiveWord)
      .values(dto)
      .returning()

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 更新敏感词
   * @param dto 更新参数
   * @returns 更新后的敏感词
   */
  async updateSensitiveWord(dto: UpdateSensitiveWordDto) {
    const exists = await this.drizzle.ext.exists(
      this.sensitiveWord,
      eq(this.sensitiveWord.id, dto.id),
    )
    if (!exists) {
      throw new BadRequestException(`ID【${dto.id}】数据不存在`)
    }

    const [result] = await this.db
      .update(this.sensitiveWord)
      .set(dto)
      .where(eq(this.sensitiveWord.id, dto.id))
      .returning()

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 删除敏感词
   * @param dto 删除参数
   * @returns 删除结果
   */
  async deleteSensitiveWord(dto: IdDto) {
    const [result] = await this.db
      .delete(this.sensitiveWord)
      .where(eq(this.sensitiveWord.id, dto.id))
      .returning()

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 更新敏感词状态
   * @param dto 状态更新参数
   * @returns 更新结果
   */
  async updateSensitiveWordStatus(dto: UpdateEnabledStatusDto) {
    const [result] = await this.db
      .update(this.sensitiveWord)
      .set({ isEnabled: dto.isEnabled })
      .where(eq(this.sensitiveWord.id, dto.id))
      .returning()

    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 获取级别统计
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
      count: Number(result.count),
      levelName: SensitiveWordLevelNames[result.level] || '未知',
      hitCount: Number(result.hitCount) || 0,
    }))
  }

  /**
   * 获取类型统计
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
      count: Number(result.count),
      typeName: SensitiveWordTypeNames[result.type] || '未知',
      hitCount: Number(result.hitCount) || 0,
    }))
  }

  /**
   * 获取顶部命中统计
   * @returns 命中次数最高的敏感词
   */
  private async getTopHitStatistics(): Promise<SensitiveWordTopHitStatisticsDto[]> {
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
   * 获取最近命中统计
   * @returns 最近命中的敏感词
   */
  private async getRecentHitStatistics(): Promise<
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
   * 获取统计查询结果
   * @param dto 统计查询参数
   * @returns 统计结果
   */
  async getStatistics(
    dto: SensitiveWordStatisticsQueryDto,
  ): Promise<SensitiveWordStatisticsResponseDto> {
    const type = dto.type || StatisticsTypeEnum.LEVEL

    let data:
      | SensitiveWordLevelStatisticsDto[]
      | SensitiveWordTypeStatisticsDto[]
      | SensitiveWordRecentHitStatisticsDto[]
      | SensitiveWordTopHitStatisticsDto[]

    switch (type) {
      case StatisticsTypeEnum.LEVEL:
        data = await this.getLevelStatistics()
        break
      case StatisticsTypeEnum.TYPE:
        data = await this.getTypeStatistics()
        break
      case StatisticsTypeEnum.TOP_HITS:
        data = await this.getTopHitStatistics()
        break
      case StatisticsTypeEnum.RECENT_HITS:
        data = await this.getRecentHitStatistics()
        break
      default:
        data = await this.getLevelStatistics()
    }

    return {
      type,
      data,
    }
  }
}
