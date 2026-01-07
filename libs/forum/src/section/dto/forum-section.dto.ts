import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 论坛板块基础DTO
 */
export class BaseForumSectionDto extends BaseDto {
  @ValidateString({
    description: '板块名称',
    example: '技术交流',
    required: true,
    maxLength: 100,
  })
  name!: string

  @ValidateNumber({
    description: '板块分组ID（为空表示未分组）',
    example: 1,
    required: false,
    min: 1,
  })
  groupId?: number

  @ValidateString({
    description: '板块分组名称（仅用于响应）',
    example: '技术讨论',
    required: false,
    maxLength: 50,
  })
  groupName?: string

  @ValidateString({
    description: '板块描述',
    example: '讨论技术相关问题',
    required: true,
    maxLength: 500,
  })
  description!: string

  @ValidateString({
    description: '板块图标',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 500,
  })
  icon?: string

  @ValidateNumber({
    description: '排序权重',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ValidateBoolean({
    description: '是否需要审核',
    example: false,
    required: true,
    default: false,
  })
  requireAudit!: boolean

  @ValidateNumber({
    description: '主题数量',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  topicCount!: number

  @ValidateNumber({
    description: '回复数量',
    example: 500,
    required: true,
    min: 0,
    default: 0,
  })
  replyCount!: number
}

/**
 * 创建论坛板块DTO
 */
export class CreateForumSectionDto extends OmitType(BaseForumSectionDto, [
  ...OMIT_BASE_FIELDS,
  'topicCount',
  'replyCount',
]) {}

/**
 * 更新论坛板块DTO
 */
export class UpdateForumSectionDto extends IntersectionType(
  PartialType(CreateForumSectionDto),
  IdDto,
) {}

/**
 * 查询论坛板块DTO
 */
export class QueryForumSectionDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumSectionDto, [
      'name',
      'isEnabled',
      'requireAudit',
      'groupId',
    ]),
  ),
) {}

/**
 * 更新板块启用状态DTO
 */
export class UpdateSectionEnabledDto extends IntersectionType(
  IdDto,
  PickType(BaseForumSectionDto, ['isEnabled']),
) {}
