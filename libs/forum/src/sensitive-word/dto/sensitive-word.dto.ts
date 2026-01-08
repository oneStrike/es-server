import {
  ValidateBoolean,
  ValidateEnum,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from '../sensitive-word-constant'

/**
 * 敏感词基础DTO
 */
export class BaseSensitiveWordDto extends BaseDto {
  @ValidateString({
    description: '敏感词',
    maxLength: 100,
    required: true,
    example: '测试',
  })
  word!: string

  @ValidateString({
    description: '替换词',
    maxLength: 100,
    required: false,
    example: '***',
    default: '***',
  })
  replaceWord?: string

  @ValidateBoolean({
    description: '是否启用',
    required: false,
    example: true,
    default: true,
  })
  isEnabled?: boolean

  @ValidateEnum({
    description: '敏感词级别',
    required: true,
    example: SensitiveWordLevelEnum.SEVERE,
    default: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
  })
  level!: SensitiveWordLevelEnum

  @ValidateEnum({
    description: '敏感词类型',
    required: true,
    example: SensitiveWordTypeEnum.OTHER,
    default: SensitiveWordTypeEnum.OTHER,
    enum: SensitiveWordTypeEnum,
  })
  type!: SensitiveWordTypeEnum

  @ValidateString({
    description: '备注',
    maxLength: 500,
    required: false,
  })
  remark?: string
}

/**
 * 创建敏感词DTO
 */
export class CreateSensitiveWordDto extends OmitType(
  BaseSensitiveWordDto,
  OMIT_BASE_FIELDS,
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
  PartialType(PickType(CreateSensitiveWordDto, ['word', 'isEnabled'])),
) {}
