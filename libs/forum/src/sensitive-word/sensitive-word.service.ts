import { BaseService } from '@libs/base/database'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import {
  ForumSensitiveWordLevelStatisticsDto,
  ForumSensitiveWordRecentHitStatisticsDto,
  ForumSensitiveWordStatisticsQueryDto,
  ForumSensitiveWordStatisticsResponseDto,
  ForumSensitiveWordTopHitStatisticsDto,
  ForumSensitiveWordTypeStatisticsDto,
} from './dto/sensitive-word-statistics.dto'
import {
  CreateForumSensitiveWordDto,
  QueryForumSensitiveWordDto,
  UpdateForumSensitiveWordDto,
} from './dto/sensitive-word.dto'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import {
  SensitiveWordLevelNames,
  SensitiveWordTypeNames,
  StatisticsTypeEnum,
} from './sensitive-word-constant'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'

@Injectable()
export class ForumSensitiveWordService extends BaseService {
  private readonly logger = new Logger(SensitiveWordService.name)

  constructor(
    private readonly cacheService: SensitiveWordCacheService,
    private readonly detectService: SensitiveWordDetectService,
  ) {
    super()
  }

  get sensitiveWord() {
    return this.prisma.forumSensitiveWord
  }

  /**
   * 获取敏感词列表
   */
  async getSensitiveWordPage(dto: QueryForumSensitiveWordDto) {
    return this.sensitiveWord.findPagination({
      where: {
        ...dto,
        word: {
          contains: dto.word,
        },
      },
    })
  }

  /**
   * 创建敏感词
   */
  async createSensitiveWord(dto: CreateForumSensitiveWordDto) {
    const result = await this.sensitiveWord.create({
      data: dto,
    })
    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 更新敏感词
   */
  async updateSensitiveWord(dto: UpdateForumSensitiveWordDto) {
    if (!(await this.sensitiveWord.exists({ id: dto.id }))) {
      throw new BadRequestException(`ID【${dto.id}】数据不存在`)
    }
    const result = await this.sensitiveWord.update({
      where: {
        id: dto.id,
      },
      data: dto,
    })
    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 删除敏感词
   */
  async deleteSensitiveWord(dto: IdDto) {
    const result = await this.sensitiveWord.delete({
      where: {
        id: dto.id,
      },
    })
    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 更新敏感词状态
   */
  async updateSensitiveWordStatus(dto: UpdateEnabledStatusDto) {
    const result = await this.sensitiveWord.update({
      where: {
        id: dto.id,
      },
      data: dto,
    })
    await this.cacheService.invalidateAll()
    await this.detectService.reloadWords()
    return result
  }

  /**
   * 获取级别统计
   */
  private async getLevelStatistics(): Promise<ForumSensitiveWordLevelStatisticsDto[]> {
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
      count: result._count.id,
      levelName: SensitiveWordLevelNames[result.level] || '未知',
      hitCount: result._sum.hitCount || 0,
    }))
  }

  /**
   * 获取类型统计
   */
  private async getTypeStatistics(): Promise<ForumSensitiveWordTypeStatisticsDto[]> {
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
      count: result._count.id,
      typeName: SensitiveWordTypeNames[result.type] || '未知',
      hitCount: result._sum.hitCount || 0,
    }))
  }

  /**
   * 获取顶部命中统计
   */
  private async getTopHitStatistics(): Promise<ForumSensitiveWordTopHitStatisticsDto[]> {
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
   * 获取最近命中统计
   */
  private async getRecentHitStatistics(): Promise<ForumSensitiveWordRecentHitStatisticsDto[]> {
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
   * 获取统计查询结果
   */
  async getStatistics(dto: ForumSensitiveWordStatisticsQueryDto): Promise<ForumSensitiveWordStatisticsResponseDto> {
    const type = dto.type || StatisticsTypeEnum.LEVEL

    let data:
      | ForumSensitiveWordLevelStatisticsDto[]
      | ForumSensitiveWordTypeStatisticsDto[]
      | ForumSensitiveWordTopHitStatisticsDto[]
      | ForumSensitiveWordRecentHitStatisticsDto[]

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
