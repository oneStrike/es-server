import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import {
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
  StatisticsTypeEnum,
} from '../sensitive-word-constant'

/**
 * 级别统计结果DTO
 */
export class SensitiveWordLevelStatisticsDto {
  @EnumProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    validation: false,
  })
  level!: number

  @StringProperty({
    description: '级别名称',
    example: '严重',
    validation: false,
  })
  levelName!: string

  @NumberProperty({
    description: '该级别的敏感词数量',
    example: 100,
    validation: false,
  })
  count!: number

  @NumberProperty({
    description: '该级别的敏感词命中总次数',
    example: 5000,
    validation: false,
  })
  hitCount!: number
}

/**
 * 类型统计结果DTO
 */
export class SensitiveWordTypeStatisticsDto {
  @EnumProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    enum: SensitiveWordTypeEnum,
    validation: false,
  })
  type!: number

  @StringProperty({
    description: '类型名称',
    example: '政治',
    validation: false,
  })
  typeName!: string

  @NumberProperty({
    description: '该类型的敏感词数量',
    example: 100,
    validation: false,
  })
  count!: number

  @NumberProperty({
    description: '该类型的敏感词命中总次数',
    example: 5000,
    validation: false,
  })
  hitCount!: number
}

/**
 * 热门敏感词统计DTO
 */
export class SensitiveWordTopHitStatisticsDto {
  @StringProperty({
    description: '敏感词',
    example: '测试',
    validation: false,
  })
  word!: string

  @NumberProperty({
    description: '命中次数',
    example: 100,
    validation: false,
  })
  hitCount!: number

  @NumberProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    validation: false,
  })
  level!: number

  @NumberProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    validation: false,
  })
  type!: number

  @DateProperty({
    description: '最后命中时间',
    example: '2024-01-01T00:00:00Z',
    required: false,
    validation: false,
  })
  lastHitAt?: Date
}

/**
 * 最近命中敏感词统计DTO
 */
export class SensitiveWordRecentHitStatisticsDto {
  @StringProperty({
    description: '敏感词',
    example: '测试',
    validation: false,
  })
  word!: string

  @NumberProperty({
    description: '命中次数',
    example: 100,
    validation: false,
  })
  hitCount!: number

  @NumberProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    validation: false,
  })
  level!: number

  @NumberProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    validation: false,
  })
  type!: number

  @DateProperty({
    description: '最后命中时间',
    example: '2024-01-01T00:00:00Z',
    validation: false,
  })
  lastHitAt!: Date
}

/**
 * 统计查询参数DTO
 */
export class SensitiveWordStatisticsQueryDto {
  @EnumProperty({
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
  @EnumProperty({
    description: '统计类型',
    enum: StatisticsTypeEnum,
    example: StatisticsTypeEnum.LEVEL,
    validation: false,
  })
  type!: StatisticsTypeEnum

  @JsonProperty({
    description: '统计数据',
    validation: false,
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
  @NumberProperty({
    description: '敏感词总数',
    example: 100,
    validation: false,
  })
  totalWords!: number

  @NumberProperty({
    description: '启用的敏感词数量',
    example: 80,
    validation: false,
  })
  enabledWords!: number

  @NumberProperty({
    description: '禁用的敏感词数量',
    example: 20,
    validation: false,
  })
  disabledWords!: number

  @NumberProperty({
    description: '总命中次数',
    example: 5000,
    validation: false,
  })
  totalHits!: number

  @NumberProperty({
    description: '今日命中次数',
    example: 100,
    validation: false,
  })
  todayHits!: number

  @NumberProperty({
    description: '最近一周命中次数',
    example: 700,
    validation: false,
  })
  lastWeekHits!: number

  @NumberProperty({
    description: '最近一月命中次数',
    example: 3000,
    validation: false,
  })
  lastMonthHits!: number

  @ArrayProperty({
    description: '级别统计',
    itemClass: SensitiveWordLevelStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  levelStatistics!: SensitiveWordLevelStatisticsDto[]

  @ArrayProperty({
    description: '类型统计',
    itemClass: SensitiveWordTypeStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  typeStatistics!: SensitiveWordTypeStatisticsDto[]

  @ArrayProperty({
    description: '热门敏感词',
    itemClass: SensitiveWordTopHitStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  topHitWords!: SensitiveWordTopHitStatisticsDto[]

  @ArrayProperty({
    description: '最近命中的敏感词',
    itemClass: SensitiveWordRecentHitStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  recentHitWords!: SensitiveWordRecentHitStatisticsDto[]
}
