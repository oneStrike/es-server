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
  ForumMatchModeEnum,
  ForumSensitiveWordLevelEnum,
  ForumSensitiveWordTypeEnum,
} from '../sensitive-word-constant'

/**
 * 敏感词基础DTO
 */
export class BaseForumSensitiveWordDto extends BaseDto {
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
    required: true,
    example: true,
    default: true,
  })
  isEnabled!: boolean

  @ValidateEnum({
    description: '敏感词级别',
    required: true,
    example: ForumSensitiveWordLevelEnum.SEVERE,
    default: ForumSensitiveWordLevelEnum.SEVERE,
    enum: ForumSensitiveWordLevelEnum,
  })
  level!: ForumSensitiveWordLevelEnum

  @ValidateEnum({
    description: '敏感词类型',
    required: true,
    example: ForumSensitiveWordTypeEnum.OTHER,
    default: ForumSensitiveWordTypeEnum.OTHER,
    enum: ForumSensitiveWordTypeEnum,
  })
  type!: ForumSensitiveWordTypeEnum

  @ValidateEnum({
    description: '匹配模式',
    required: false,
    example: ForumMatchModeEnum.EXACT,
    default: ForumMatchModeEnum.EXACT,
    enum: ForumMatchModeEnum,
  })
  matchMode?: ForumMatchModeEnum

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
export class CreateForumSensitiveWordDto extends OmitType(
  BaseForumSensitiveWordDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新敏感词DTO
 */
export class UpdateForumSensitiveWordDto extends IntersectionType(
  CreateForumSensitiveWordDto,
  IdDto,
) {}

/**
 * 查询敏感词DTO
 */
export class QueryForumSensitiveWordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(CreateForumSensitiveWordDto, [
      'word',
      'isEnabled',
      'level',
      'matchMode',
      'type',
    ]),
  ),
) {}
