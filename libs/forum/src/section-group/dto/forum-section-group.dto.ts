import { PublicForumSectionListItemDto } from '@libs/forum/section/dto/forum-section.dto'
import { ArrayProperty, BooleanProperty, DateProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import { BaseDto, DragReorderDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumSectionGroupSummaryDto } from './forum-section-group-summary.dto'

/**
 * 论坛板块分组基础 DTO。
 * 严格对应 forum_section_group 表字段。
 */
export class BaseForumSectionGroupDto extends BaseDto {
  @StringProperty({
    description: '分组名称',
    example: '技术讨论',
    required: true,
    maxLength: 50,
  })
  name!: string

  @StringProperty({
    description: '分组描述',
    example: '包含所有技术相关的板块',
    required: false,
    maxLength: 500,
  })
  description?: string | null

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

  @NumberProperty({
    description: '分组版主数量限制（0表示不限制）',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  maxModerators!: number

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

export class CreateForumSectionGroupDto extends OmitType(
  BaseForumSectionGroupDto,
  [...OMIT_BASE_FIELDS, 'deletedAt'] as const,
) {}

export class UpdateForumSectionGroupDto extends IntersectionType(
  IdDto,
  PartialType(CreateForumSectionGroupDto),
) {}

export class QueryForumSectionGroupDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumSectionGroupDto, ['name', 'isEnabled'] as const),
  ),
) {}

export class QueryVisibleForumSectionGroupCommandDto {
  @NumberProperty({
    description: '当前用户ID；为空表示匿名访问，仅用于拼装权限与关注状态。',
    example: 1,
    required: false,
    min: 1,
    contract: false,
    validation: false,
  })
  userId?: number
}

export class UpdateForumSectionGroupEnabledDto extends IntersectionType(
  IdDto,
  PickType(BaseForumSectionGroupDto, ['isEnabled'] as const),
) {}

export class SwapForumSectionGroupSortDto extends PickType(DragReorderDto, [
  'dragId',
  'targetId',
] as const) {}

/**
 * 公开板块分组列表项 DTO。
 */
export class PublicForumSectionGroupListItemDto extends ForumSectionGroupSummaryDto {
  @ArrayProperty({
    description: '分组下的板块列表',
    itemClass: PublicForumSectionListItemDto,
    required: true,
    validation: false,
  })
  sections!: PublicForumSectionListItemDto[]
}
