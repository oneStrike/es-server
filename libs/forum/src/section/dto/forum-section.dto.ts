import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumReviewPolicyEnum } from '../forum-section.constant'

/**
 * 论坛板块基础DTO
 */
export class BaseForumSectionDto extends BaseDto {
  @StringProperty({
    description: '板块名称',
    example: '技术交流',
    required: true,
    maxLength: 100,
  })
  name!: string

  @NumberProperty({
    description: '板块分组ID（为空表示未分组）',
    example: 1,
    required: false,
    min: 1,
  })
  groupId?: number

  @NumberProperty({
    description: '用户等级规则ID（为空表示所有用户）',
    example: 1,
    required: false,
    min: 1,
  })
  userLevelRuleId?: number

  @StringProperty({
    description: '板块图标',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 500,
  })
  icon?: string

  @NumberProperty({
    description: '排序权重',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '审核策略',
    example: ForumReviewPolicyEnum.NONE,
    required: true,
    default: ForumReviewPolicyEnum.SEVERE_SENSITIVE_WORD,
    enum: ForumReviewPolicyEnum,
  })
  topicReviewPolicy!: ForumReviewPolicyEnum

  @StringProperty({
    description: '板块描述',
    example: '讨论技术相关问题',
    required: true,
    maxLength: 500,
  })
  description!: string
}

/**
 * 创建论坛板块DTO
 */
export class CreateForumSectionDto extends OmitType(
  BaseForumSectionDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新论坛板块DTO
 */
export class UpdateForumSectionDto extends IntersectionType(
  CreateForumSectionDto,
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
      'topicReviewPolicy',
      'groupId',
    ]),
  ),
) {}
