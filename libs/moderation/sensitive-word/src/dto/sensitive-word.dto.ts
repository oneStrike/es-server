import { AuditStatusEnum } from '@libs/platform/constant'

import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

import {
  MatchModeEnum,
  SensitiveWordHitEntityTypeEnum,
  SensitiveWordHitLogEntityStatusEnum,
  SensitiveWordHitOperationTypeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
  StatisticsTypeEnum,
} from '../sensitive-word-constant'

// 敏感词基础 DTO。
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
    nullable: true,
    example: '***',
    default: '***',
  })
  replaceWord!: string | null

  @BooleanProperty({
    description: '是否启用',
    required: true,
    example: true,
    default: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '敏感词级别（1=严重；2=一般；3=轻微）',
    required: true,
    example: SensitiveWordLevelEnum.SEVERE,
    default: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
  })
  level!: SensitiveWordLevelEnum

  @EnumProperty({
    description: '敏感词类型（1=政治；2=色情；3=暴力；4=广告；5=其他）',
    required: true,
    example: SensitiveWordTypeEnum.OTHER,
    default: SensitiveWordTypeEnum.OTHER,
    enum: SensitiveWordTypeEnum,
  })
  type!: SensitiveWordTypeEnum

  @EnumProperty({
    description: '匹配模式（1=精确匹配；2=模糊匹配）',
    required: true,
    example: MatchModeEnum.EXACT,
    default: MatchModeEnum.EXACT,
    enum: MatchModeEnum,
  })
  matchMode!: MatchModeEnum

  @StringProperty({
    description: '备注',
    maxLength: 500,
    nullable: true,
  })
  remark!: string | null

  @NumberProperty({
    description: '创建人ID',
    nullable: true,
    example: 1,
    validation: false,
  })
  createdBy!: number | null

  @NumberProperty({
    description: '更新人ID',
    nullable: true,
    example: 1,
    validation: false,
  })
  updatedBy!: number | null

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
    nullable: true,
    example: '2026-03-19T12:00:00.000Z',
    validation: false,
  })
  lastHitAt!: Date | null
}

export class SensitiveWordOutputDto extends BaseSensitiveWordDto {}

// 敏感词命中结果 DTO
export class SensitiveWordHitDto extends IntersectionType(
  PickType(BaseSensitiveWordDto, ['word', 'level', 'type'] as const),
  PickType(SensitiveWordOutputDto, ['replaceWord'] as const),
) {
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

  @StringProperty({
    description: '命中字段（标题；正文）',
    example: 'content',
    required: true,
    validation: false,
  })
  field!: string
}

class CreateSensitiveWordRequiredDto extends OmitType(BaseSensitiveWordDto, [
  ...OMIT_BASE_FIELDS,
  'replaceWord',
  'remark',
  'createdBy',
  'updatedBy',
  'hitCount',
  'lastHitAt',
] as const) {}

class CreateSensitiveWordOptionalDto extends PartialType(
  PickType(BaseSensitiveWordDto, ['replaceWord', 'remark'] as const),
) {}

export class CreateSensitiveWordDto extends IntersectionType(
  CreateSensitiveWordRequiredDto,
  CreateSensitiveWordOptionalDto,
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

export class QuerySensitiveWordHitLogDto extends PageDto {
  @StringProperty({
    description: '敏感词文本搜索',
    maxLength: 100,
    required: false,
  })
  word?: string

  @NumberProperty({
    description: '敏感词ID（高级精确筛选）',
    min: 1,
    required: false,
  })
  sensitiveWordId?: number

  @EnumProperty({
    description: '敏感词级别（1=严重；2=一般；3=轻微）',
    enum: SensitiveWordLevelEnum,
    required: false,
  })
  level?: SensitiveWordLevelEnum

  @EnumProperty({
    description: '敏感词类型（1=政治；2=色情；3=暴力；4=广告；5=其他）',
    enum: SensitiveWordTypeEnum,
    required: false,
  })
  type?: SensitiveWordTypeEnum

  @EnumProperty({
    description: '命中实体类型（1=主题；2=评论）',
    enum: SensitiveWordHitEntityTypeEnum,
    required: false,
  })
  entityType?: SensitiveWordHitEntityTypeEnum

  @NumberProperty({
    description: '命中实体ID（高级精确筛选）',
    min: 1,
    required: false,
  })
  entityId?: number

  @EnumProperty({
    description: '命中操作类型（1=创建；2=更新）',
    enum: SensitiveWordHitOperationTypeEnum,
    required: false,
  })
  operationType?: SensitiveWordHitOperationTypeEnum
}

export class SensitiveWordDetectDto {
  @StringProperty({
    description: '检测内容',
    maxLength: 10000,
    required: true,
    example: '这里是一段待检测的文本',
  })
  content!: string
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
    itemClass: SensitiveWordHitDto,
    validation: false,
  })
  hits!: SensitiveWordHitDto[]

  @EnumProperty({
    description: '最高敏感等级（1=严重；2=一般；3=轻微）',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    required: true,
    nullable: true,
    validation: false,
  })
  highestLevel!: SensitiveWordLevelEnum | null
}

// 敏感词最高等级响应 DTO，复用 SensitiveWordDetectResponseDto 的 highestLevel 字段。
export class SensitiveWordHighestLevelResponseDto extends PickType(
  SensitiveWordDetectResponseDto,
  ['highestLevel'] as const,
) {}

export class SensitiveWordReplaceResponseDto {
  @StringProperty({
    description: '替换后的文本',
    example: '这是一个***文本',
    validation: false,
  })
  replacedText!: string
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

export class SensitiveWordHitLogEntitySummaryDto {
  @EnumProperty({
    description:
      '实体状态返回值域（内容可查看；内容已删除；内容已隐藏；不可处置；关联实体缺失）',
    enum: SensitiveWordHitLogEntityStatusEnum,
    example: SensitiveWordHitLogEntityStatusEnum.AVAILABLE,
    validation: false,
  })
  status!: SensitiveWordHitLogEntityStatusEnum

  @BooleanProperty({
    description: '是否可跳转到内容处置入口',
    example: true,
    validation: false,
  })
  canNavigate!: boolean

  @StringProperty({
    description: '主题标题',
    maxLength: 200,
    required: true,
    nullable: true,
    validation: false,
  })
  title!: string | null

  @StringProperty({
    description: '内容摘要',
    maxLength: 200,
    required: true,
    nullable: true,
    validation: false,
  })
  snippet!: string | null

  @EnumProperty({
    description: '审核状态（0=待审核；1=已通过；2=已拒绝）',
    enum: AuditStatusEnum,
    required: true,
    nullable: true,
    validation: false,
  })
  auditStatus!: AuditStatusEnum | null

  @BooleanProperty({
    description: '是否隐藏',
    required: true,
    nullable: true,
    validation: false,
  })
  isHidden!: boolean | null

  @NumberProperty({
    description: '评论目标类型',
    required: true,
    nullable: true,
    validation: false,
  })
  targetType!: number | null

  @NumberProperty({
    description: '评论目标ID',
    required: true,
    nullable: true,
    validation: false,
  })
  targetId!: number | null
}

export class SensitiveWordHitLogAuthorSummaryDto {
  @NumberProperty({
    description: '作者ID',
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '作者昵称',
    maxLength: 100,
    required: true,
    nullable: true,
    validation: false,
  })
  nickname!: string | null

  @StringProperty({
    description: '作者头像URL',
    maxLength: 500,
    required: true,
    nullable: true,
    validation: false,
  })
  avatarUrl!: string | null

  @NumberProperty({
    description: '作者状态',
    required: true,
    nullable: true,
    validation: false,
  })
  status!: number | null

  @BooleanProperty({
    description: '作者是否启用',
    required: true,
    nullable: true,
    validation: false,
  })
  isEnabled!: boolean | null
}

export class SensitiveWordHitLogPageItemDto {
  @NumberProperty({ description: '命中日志ID', example: 1, validation: false })
  id!: number

  @NumberProperty({ description: '敏感词ID', example: 1, validation: false })
  sensitiveWordId!: number

  @StringProperty({
    description: '敏感词库中的词',
    maxLength: 100,
    required: true,
    nullable: true,
    validation: false,
  })
  word!: string | null

  @StringProperty({
    description: '实际命中的文本',
    maxLength: 100,
    validation: false,
  })
  matchedWord!: string

  @EnumProperty({
    description: '敏感词级别（1=严重；2=一般；3=轻微）',
    enum: SensitiveWordLevelEnum,
    validation: false,
  })
  level!: SensitiveWordLevelEnum

  @EnumProperty({
    description: '敏感词类型（1=政治；2=色情；3=暴力；4=广告；5=其他）',
    enum: SensitiveWordTypeEnum,
    validation: false,
  })
  type!: SensitiveWordTypeEnum

  @EnumProperty({
    description: '命中实体类型（1=主题；2=评论）',
    enum: SensitiveWordHitEntityTypeEnum,
    validation: false,
  })
  entityType!: SensitiveWordHitEntityTypeEnum

  @NumberProperty({ description: '命中实体ID', example: 1, validation: false })
  entityId!: number

  @EnumProperty({
    description: '命中操作类型（1=创建；2=更新）',
    enum: SensitiveWordHitOperationTypeEnum,
    validation: false,
  })
  operationType!: SensitiveWordHitOperationTypeEnum

  @NestedProperty({
    description: '实体摘要',
    type: SensitiveWordHitLogEntitySummaryDto,
    validation: false,
  })
  entitySummary!: SensitiveWordHitLogEntitySummaryDto

  @NestedProperty({
    description: '作者摘要',
    required: true,
    nullable: true,
    type: SensitiveWordHitLogAuthorSummaryDto,
    validation: false,
  })
  authorSummary!: SensitiveWordHitLogAuthorSummaryDto | null

  @DateProperty({
    description: '命中时间',
    example: '2026-03-19T12:00:00.000Z',
    validation: false,
  })
  createdAt!: Date
}

// 敏感词级别字段 DTO，供统计类 DTO 复用。
class SensitiveWordLevelFieldDto extends PickType(BaseSensitiveWordDto, [
  'level',
] as const) {
  @StringProperty({
    description: '级别名称',
    example: '严重',
    validation: false,
  })
  levelName!: string
}

// 敏感词类型字段 DTO，供统计类 DTO 复用。
class SensitiveWordTypeFieldDto extends PickType(BaseSensitiveWordDto, [
  'type',
] as const) {
  @StringProperty({
    description: '类型名称',
    example: '政治',
    validation: false,
  })
  typeName!: string
}

// 敏感词统计基础字段 DTO，供级别和类型统计复用。
class SensitiveWordStatisticsBaseDto {
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

export class SensitiveWordLevelStatisticsDto extends IntersectionType(
  SensitiveWordLevelFieldDto,
  SensitiveWordStatisticsBaseDto,
) {}

export class SensitiveWordTypeStatisticsDto extends IntersectionType(
  SensitiveWordTypeFieldDto,
  SensitiveWordStatisticsBaseDto,
) {}

export class SensitiveWordTopHitStatisticsDto extends IntersectionType(
  PickType(BaseSensitiveWordDto, ['word', 'level', 'type'] as const),
  PickType(SensitiveWordStatisticsBaseDto, ['hitCount'] as const),
) {
  @DateProperty({
    description: '最后命中时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
    nullable: true,
    validation: false,
  })
  lastHitAt!: Date | null
}

// 统计类型字段 DTO，供 Query 和 Response 复用。
export class StatisticsTypeFieldDto {
  @EnumProperty({
    description:
      '统计类型（按级别统计；按类型统计；热门敏感词统计；最近命中统计）',
    required: false,
    enum: StatisticsTypeEnum,
    example: StatisticsTypeEnum.LEVEL,
  })
  type?: StatisticsTypeEnum
}

class StatisticsTypeOutputFieldDto {
  @EnumProperty({
    description:
      '统计类型（按级别统计；按类型统计；热门敏感词统计；最近命中统计）',
    required: true,
    enum: StatisticsTypeEnum,
    example: StatisticsTypeEnum.LEVEL,
    validation: false,
  })
  type!: StatisticsTypeEnum
}

export class SensitiveWordStatisticsResponseDto extends StatisticsTypeOutputFieldDto {
  @ArrayProperty({
    description: '统计结果',
    itemClass: Object,
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

  @NumberProperty({
    description: '总命中次数',
    example: 1000,
    validation: false,
  })
  totalHits!: number

  @NumberProperty({
    description: '今日命中次数',
    example: 12,
    validation: false,
  })
  todayHits!: number

  @NumberProperty({
    description: '最近一周命中次数',
    example: 55,
    validation: false,
  })
  lastWeekHits!: number

  @NumberProperty({
    description: '最近一月命中次数',
    example: 180,
    validation: false,
  })
  lastMonthHits!: number

  @ArrayProperty({
    description: '级别统计',
    itemClass: SensitiveWordLevelStatisticsDto,
    validation: false,
  })
  levelStatistics!: SensitiveWordLevelStatisticsDto[]

  @ArrayProperty({
    description: '类型统计',
    itemClass: SensitiveWordTypeStatisticsDto,
    validation: false,
  })
  typeStatistics!: SensitiveWordTypeStatisticsDto[]

  @ArrayProperty({
    description: '热门命中词',
    itemClass: SensitiveWordTopHitStatisticsDto,
    validation: false,
  })
  topHitWords!: SensitiveWordTopHitStatisticsDto[]

  @ArrayProperty({
    description: '最近命中词',
    itemClass: SensitiveWordTopHitStatisticsDto,
    validation: false,
  })
  recentHitWords!: SensitiveWordTopHitStatisticsDto[]
}
