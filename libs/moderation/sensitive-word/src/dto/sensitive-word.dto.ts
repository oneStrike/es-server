import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  BaseDto,
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
} from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
  StatisticsTypeEnum,
} from '../sensitive-word-constant'

/**
 * 敏感词基础DTO
 */
export class BaseSensitiveWordDto extends BaseDto {
  @StringProperty({
    description: '敏感词',
    maxLength: 100,
    required: true,
    example: '测试',
  })
  word!: string

  @StringProperty({
    description: '替换词',
    maxLength: 100,
    required: false,
    example: '***',
    default: '***',
  })
  replaceWord?: string

  @BooleanProperty({
    description: '是否启用',
    required: true,
    example: true,
    default: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '敏感词级别',
    required: true,
    example: SensitiveWordLevelEnum.SEVERE,
    default: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
  })
  level!: SensitiveWordLevelEnum

  @EnumProperty({
    description: '敏感词类型',
    required: true,
    example: SensitiveWordTypeEnum.OTHER,
    default: SensitiveWordTypeEnum.OTHER,
    enum: SensitiveWordTypeEnum,
  })
  type!: SensitiveWordTypeEnum

  @EnumProperty({
    description: '匹配模式',
    required: true,
    example: MatchModeEnum.EXACT,
    default: MatchModeEnum.EXACT,
    enum: MatchModeEnum,
  })
  matchMode!: MatchModeEnum

  @NumberProperty({
    description: '版本号（乐观锁）',
    required: true,
    example: 0,
    default: 0,
    validation: false,
  })
  version!: number

  @StringProperty({
    description: '备注',
    maxLength: 500,
    required: false,
  })
  remark?: string

  @NumberProperty({
    description: '创建人ID',
    required: false,
    example: 1,
    validation: false,
  })
  createdBy?: number | null

  @NumberProperty({
    description: '更新人ID',
    required: false,
    example: 1,
    validation: false,
  })
  updatedBy?: number | null

  @NumberProperty({
    description: '命中次数',
    required: true,
    example: 0,
    default: 0,
    validation: false,
  })
  hitCount!: number

  @DateProperty({
    description: '最后命中时间',
    required: false,
    example: '2026-03-19T12:00:00.000Z',
    validation: false,
  })
  lastHitAt?: Date | null
}

export class BaseSensitiveWordHitDto {
  @StringProperty({
    description: '敏感词内容',
    example: '测试',
    validation: false,
  })
  word!: string

  @NumberProperty({
    description: '起始位置',
    example: 0,
    validation: false,
  })
  start!: number

  @NumberProperty({
    description: '结束位置',
    example: 2,
    validation: false,
  })
  end!: number

  @EnumProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    validation: false,
  })
  level!: SensitiveWordLevelEnum

  @EnumProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    enum: SensitiveWordTypeEnum,
    validation: false,
  })
  type!: SensitiveWordTypeEnum

  @StringProperty({
    description: '替换词',
    example: '***',
    required: false,
    validation: false,
  })
  replaceWord?: string | null
}

export class CreateSensitiveWordDto extends OmitType(
  BaseSensitiveWordDto,
  [
    ...OMIT_BASE_FIELDS,
    'version',
    'createdBy',
    'updatedBy',
    'hitCount',
    'lastHitAt',
  ] as const,
) {}

export class UpdateSensitiveWordDto extends IntersectionType(
  CreateSensitiveWordDto,
  IdDto,
) {}

export class QuerySensitiveWordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(CreateSensitiveWordDto, [
      'word',
      'isEnabled',
      'level',
      'matchMode',
      'type',
    ] as const),
  ),
) {}

export class SensitiveWordDetectDto {
  @StringProperty({
    description: '检测内容',
    maxLength: 10000,
    required: true,
    example: '这里是一段待检测的文本',
  })
  content!: string

  @EnumProperty({
    description: '匹配模式',
    required: false,
    enum: MatchModeEnum,
    example: MatchModeEnum.EXACT,
  })
  matchMode?: MatchModeEnum
}

export class SensitiveWordReplaceDto extends SensitiveWordDetectDto {
  @StringProperty({
    description: '替换字符',
    maxLength: 10,
    required: false,
    example: '*',
  })
  replaceChar?: string
}

export class SensitiveWordDetectResponseDto {
  @ArrayProperty({
    description: '命中的敏感词列表',
    itemClass: BaseSensitiveWordHitDto,
    itemType: 'object',
    validation: false,
  })
  hits!: BaseSensitiveWordHitDto[]

  @EnumProperty({
    description: '最高敏感等级',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    required: false,
    validation: false,
  })
  highestLevel?: SensitiveWordLevelEnum
}

export class SensitiveWordReplaceResponseDto {
  @StringProperty({
    description: '替换后的文本',
    example: '这是一个***文本',
    validation: false,
  })
  replacedText!: string
}

export class SensitiveWordHighestLevelResponseDto {
  @EnumProperty({
    description: '敏感词最高等级',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    required: false,
    validation: false,
  })
  highestLevel?: SensitiveWordLevelEnum
}

export class SensitiveWordDetectStatusResponseDto {
  @BooleanProperty({
    description: '检测器是否就绪',
    example: true,
    validation: false,
  })
  isReady!: boolean

  @NumberProperty({
    description: '已加载的敏感词数量',
    example: 100,
    validation: false,
  })
  wordCount!: number
}

export class SensitiveWordCountResponseDto {
  @NumberProperty({
    description: '当前加载的敏感词数量',
    example: 100,
    validation: false,
  })
  count!: number
}

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
    itemClass: SensitiveWordTopHitStatisticsDto,
    itemType: 'object',
    validation: false,
  })
  recentHitWords!: SensitiveWordTopHitStatisticsDto[]
}
