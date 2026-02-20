import { BaseService } from '@libs/base/database'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
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
export class SensitiveWordService extends BaseService {
  private readonly logger = new Logger(SensitiveWordDetectService.name)

  constructor(
    private readonly cacheService: SensitiveWordCacheService,
    private readonly detectService: SensitiveWordDetectService,
  ) {
    super()
  }

  /**
   * 获取敏感词模型
   */
  get sensitiveWord() {
    return this.prisma.sensitiveWord
  }

  /**
   * 获取敏感词列表
   * @param dto 查询条件
   * @returns 分页结果
   */
  async getSensitiveWordPage(dto: QuerySensitiveWordDto) {
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
   * @param dto 创建参数
   * @returns 新建敏感词
   */
  async createSensitiveWord(dto: CreateSensitiveWordDto) {
    const result = await this.sensitiveWord.create({
      data: dto,
    })
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
   * @param dto 删除参数
   * @returns 删除结果
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
   * @param dto 状态更新参数
   * @returns 更新结果
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
   * @returns 级别统计列表
   */
  private async getLevelStatistics(): Promise<SensitiveWordLevelStatisticsDto[]> {
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
   * @returns 类型统计列表
   */
  private async getTypeStatistics(): Promise<SensitiveWordTypeStatisticsDto[]> {
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
   * @returns 命中次数最高的敏感词
   */
  private async getTopHitStatistics(): Promise<SensitiveWordTopHitStatisticsDto[]> {
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
