import { ApiProperty } from '@nestjs/swagger'
import {
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
  StatisticsTypeEnum,
} from '../sensitive-word-constant'

/**
 * 级别统计结果DTO
 */
export class SensitiveWordLevelStatisticsDto {
  @ApiProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
  })
  level!: number

  @ApiProperty({
    description: '级别名称',
    example: '严重',
  })
  levelName!: string

  @ApiProperty({
    description: '该级别的敏感词数量',
    example: 100,
  })
  count!: number

  @ApiProperty({
    description: '该级别的敏感词命中总次数',
    example: 5000,
  })
  hitCount!: number
}

/**
 * 类型统计结果DTO
 */
export class SensitiveWordTypeStatisticsDto {
  @ApiProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    enum: SensitiveWordTypeEnum,
  })
  type!: number

  @ApiProperty({
    description: '类型名称',
    example: '政治',
  })
  typeName!: string

  @ApiProperty({
    description: '该类型的敏感词数量',
    example: 100,
  })
  count!: number

  @ApiProperty({
    description: '该类型的敏感词命中总次数',
    example: 5000,
  })
  hitCount!: number
}

/**
 * 热门敏感词统计DTO
 */
export class SensitiveWordTopHitStatisticsDto {
  @ApiProperty({
    description: '敏感词',
    example: '测试',
  })
  word!: string

  @ApiProperty({
    description: '命中次数',
    example: 100,
  })
  hitCount!: number

  @ApiProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
  })
  level!: number

  @ApiProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
  })
  type!: number

  @ApiProperty({
    description: '最后命中时间',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  lastHitAt?: Date
}

/**
 * 最近命中敏感词统计DTO
 */
export class SensitiveWordRecentHitStatisticsDto {
  @ApiProperty({
    description: '敏感词',
    example: '测试',
  })
  word!: string

  @ApiProperty({
    description: '命中次数',
    example: 100,
  })
  hitCount!: number

  @ApiProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
  })
  level!: number

  @ApiProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
  })
  type!: number

  @ApiProperty({
    description: '最后命中时间',
    example: '2024-01-01T00:00:00Z',
  })
  lastHitAt!: Date
}

/**
 * 统计查询参数DTO
 */
export class SensitiveWordStatisticsQueryDto {
  @ApiProperty({
    description: '统计类型',
    enum: StatisticsTypeEnum,
    required: false,
    example: StatisticsTypeEnum.LEVEL,
  })
  type?: StatisticsTypeEnum
}

/**
 * 统计查询响应DTO
 */
export class SensitiveWordStatisticsResponseDto {
  @ApiProperty({
    description: '统计类型',
    enum: StatisticsTypeEnum,
    example: StatisticsTypeEnum.LEVEL,
  })
  type!: StatisticsTypeEnum

  @ApiProperty({
    description: '统计数据',
    type: Object,
  })
  data!:
    | SensitiveWordLevelStatisticsDto[]
    | SensitiveWordTypeStatisticsDto[]
    | SensitiveWordTopHitStatisticsDto[]
    | SensitiveWordRecentHitStatisticsDto[]
}

/**
 * 完整统计数据DTO
 */
export class SensitiveWordStatisticsDataDto {
  @ApiProperty({
    description: '敏感词总数',
    example: 100,
  })
  totalWords!: number

  @ApiProperty({
    description: '启用的敏感词数量',
    example: 80,
  })
  enabledWords!: number

  @ApiProperty({
    description: '禁用的敏感词数量',
    example: 20,
  })
  disabledWords!: number

  @ApiProperty({
    description: '总命中次数',
    example: 5000,
  })
  totalHits!: number

  @ApiProperty({
    description: '今日命中次数',
    example: 100,
  })
  todayHits!: number

  @ApiProperty({
    description: '最近一周命中次数',
    example: 700,
  })
  lastWeekHits!: number

  @ApiProperty({
    description: '最近一月命中次数',
    example: 3000,
  })
  lastMonthHits!: number

  @ApiProperty({
    description: '级别统计',
    type: [SensitiveWordLevelStatisticsDto],
  })
  levelStatistics!: SensitiveWordLevelStatisticsDto[]

  @ApiProperty({
    description: '类型统计',
    type: [SensitiveWordTypeStatisticsDto],
  })
  typeStatistics!: SensitiveWordTypeStatisticsDto[]

  @ApiProperty({
    description: '热门敏感词',
    type: [SensitiveWordTopHitStatisticsDto],
  })
  topHitWords!: SensitiveWordTopHitStatisticsDto[]

  @ApiProperty({
    description: '最近命中的敏感词',
    type: [SensitiveWordRecentHitStatisticsDto],
  })
  recentHitWords!: SensitiveWordRecentHitStatisticsDto[]
}
