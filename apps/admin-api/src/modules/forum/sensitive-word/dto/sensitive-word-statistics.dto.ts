import { ArrayProperty, EnumProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import {
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
  StatisticsTypeEnum,
} from '@libs/sensitive-word'

export class SensitiveWordLevelStatisticsDto {
  @EnumProperty({
    description: '敏感词级别',
    enum: SensitiveWordLevelEnum,
    example: SensitiveWordLevelEnum.SEVERE,
    validation: false,
  })
  level!: SensitiveWordLevelEnum

  @StringProperty({
    description: '级别名称',
    example: '严重',
    validation: false,
  })
  levelName!: string

  @NumberProperty({
    description: '词数量',
    example: 10,
    validation: false,
  })
  count!: number

  @NumberProperty({
    description: '命中次数',
    example: 100,
    validation: false,
  })
  hitCount!: number
}

export class SensitiveWordTypeStatisticsDto {
  @EnumProperty({
    description: '敏感词类型',
    enum: SensitiveWordTypeEnum,
    example: SensitiveWordTypeEnum.POLITICS,
    validation: false,
  })
  type!: SensitiveWordTypeEnum

  @StringProperty({
    description: '类型名称',
    example: '政治',
    validation: false,
  })
  typeName!: string

  @NumberProperty({
    description: '词数量',
    example: 10,
    validation: false,
  })
  count!: number

  @NumberProperty({
    description: '命中次数',
    example: 100,
    validation: false,
  })
  hitCount!: number
}

export class SensitiveWordTopHitStatisticsDto {
  @StringProperty({ description: '敏感词', example: '测试', validation: false })
  word!: string

  @NumberProperty({ description: '命中次数', example: 20, validation: false })
  hitCount!: number

  @EnumProperty({
    description: '敏感词级别',
    enum: SensitiveWordLevelEnum,
    example: SensitiveWordLevelEnum.SEVERE,
    validation: false,
  })
  level!: SensitiveWordLevelEnum

  @EnumProperty({
    description: '敏感词类型',
    enum: SensitiveWordTypeEnum,
    example: SensitiveWordTypeEnum.POLITICS,
    validation: false,
  })
  type!: SensitiveWordTypeEnum

  @StringProperty({
    description: '最后命中时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
    validation: false,
  })
  lastHitAt?: Date
}

export class SensitiveWordRecentHitStatisticsDto extends SensitiveWordTopHitStatisticsDto {}

export class SensitiveWordStatisticsQueryDto {
  @EnumProperty({
    description: '统计类型',
    required: false,
    enum: StatisticsTypeEnum,
    example: StatisticsTypeEnum.LEVEL,
  })
  type?: StatisticsTypeEnum
}

export class SensitiveWordStatisticsResponseDto {
  @EnumProperty({
    description: '统计类型',
    enum: StatisticsTypeEnum,
    example: StatisticsTypeEnum.LEVEL,
    validation: false,
  })
  type!: StatisticsTypeEnum

  @ArrayProperty({
    description: '统计结果',
    itemClass: Object,
    itemType: 'object',
    validation: false,
  })
  data!: Array<
    | SensitiveWordLevelStatisticsDto
    | SensitiveWordTypeStatisticsDto
    | SensitiveWordTopHitStatisticsDto
    | SensitiveWordRecentHitStatisticsDto
  >
}

export class SensitiveWordStatisticsDataDto {
  @NumberProperty({ description: '总词数', example: 100, validation: false })
  totalWords!: number

  @NumberProperty({ description: '启用词数', example: 80, validation: false })
  enabledWords!: number

  @NumberProperty({ description: '禁用词数', example: 20, validation: false })
  disabledWords!: number

  @NumberProperty({ description: '总命中次数', example: 1000, validation: false })
  totalHits!: number

  @NumberProperty({ description: '今日命中次数', example: 12, validation: false })
  todayHits!: number

  @NumberProperty({ description: '最近一周命中次数', example: 55, validation: false })
  lastWeekHits!: number

  @NumberProperty({ description: '最近一月命中次数', example: 180, validation: false })
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
    description: '热门命中词',
    itemClass: SensitiveWordTopHitStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  topHitWords!: SensitiveWordTopHitStatisticsDto[]

  @ArrayProperty({
    description: '最近命中词',
    itemClass: SensitiveWordRecentHitStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  recentHitWords!: SensitiveWordRecentHitStatisticsDto[]
}
