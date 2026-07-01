import {
  AdminForumSectionDto,
  PublicForumSectionListItemDto,
} from '@libs/forum/section/dto/forum-section.dto'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
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
    required: true,
    nullable: true,
    maxLength: 500,
  })
  description!: string | null

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

class CreateForumSectionGroupRequiredFieldsDto extends OmitType(
  BaseForumSectionGroupDto,
  [...OMIT_BASE_FIELDS, 'description', 'deletedAt'] as const,
) {}

class CreateForumSectionGroupOptionalFieldsDto extends PartialType(
  PickType(BaseForumSectionGroupDto, ['description'] as const),
) {}

export class CreateForumSectionGroupDto extends IntersectionType(
  CreateForumSectionGroupRequiredFieldsDto,
  CreateForumSectionGroupOptionalFieldsDto,
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

export class ForumSectionGroupOutputDto extends OmitType(
  BaseForumSectionGroupDto,
  ['deletedAt'] as const,
) {}

export class SwapForumSectionGroupSortDto extends PickType(DragReorderDto, [
  'dragId',
  'targetId',
] as const) {}

/**
 * 管理端板块树节点 DTO。
 * group 为空时代表未分组板块集合。
 */
export class ForumSectionTreeNodeDto {
  @BooleanProperty({
    description: '是否为未分组节点',
    example: false,
    required: true,
    validation: false,
  })
  isUngrouped!: boolean

  @NestedProperty({
    description: '分组信息；未分组节点为空',
    nullable: true,
    type: ForumSectionGroupOutputDto,
    validation: false,
  })
  group!: ForumSectionGroupOutputDto | null

  @ArrayProperty({
    description: '该节点下的板块列表',
    itemClass: AdminForumSectionDto,
    required: true,
    validation: false,
  })
  sections!: AdminForumSectionDto[]
}

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
