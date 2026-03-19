import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
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

/**
 * 创建敏感词DTO
 */
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

/**
 * 更新敏感词DTO
 */
export class UpdateSensitiveWordDto extends IntersectionType(
  CreateSensitiveWordDto,
  IdDto,
) {}

/**
 * 查询敏感词DTO
 */
export class QuerySensitiveWordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(CreateSensitiveWordDto, [
      'word',
      'isEnabled',
      'level',
      'matchMode',
      'type',
    ]),
  ),
) {}
