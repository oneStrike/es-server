import { ArrayProperty, BooleanProperty, DateProperty, NumberProperty, StringProperty } from '@libs/platform/decorators';

import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto';

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 论坛标签基础 DTO。
 * 严格对应 forum_tag 表中当前对外复用的实体字段。
 */
export class BaseForumTagDto extends BaseDto {
  @StringProperty({
    description: '标签名称',
    example: '技术讨论',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '标签图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @StringProperty({
    description: '标签描述',
    example: '用于标记技术相关的讨论',
    required: false,
    maxLength: 200,
  })
  description?: string

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '使用次数',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  useCount!: number

  @NumberProperty({
    description: '排序值（0=默认排序，数值越小越靠前）',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  sortOrder!: number
}

export class CreateForumTagDto extends OmitType(BaseForumTagDto, [
  ...OMIT_BASE_FIELDS,
  'useCount',
] as const) {}

export class UpdateForumTagDto extends IntersectionType(
  IdDto,
  PartialType(CreateForumTagDto),
) {}

export class QueryForumTagDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTagDto, ['name', 'isEnabled'] as const)),
) {}

export class AssignForumTagToTopicDto {
  @NumberProperty({
    description: '主题 ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @NumberProperty({
    description: '标签 ID',
    example: 1,
    required: true,
    min: 1,
  })
  tagId!: number
}

export class ForumTagTopicSummaryDto extends IdDto {
  @StringProperty({
    description: '主题标题',
    example: '如何学习 TypeScript？',
    validation: false,
  })
  title!: string

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    validation: false,
  })
  createdAt!: Date
}

export class ForumTagDetailResponseDto extends BaseForumTagDto {
  @ArrayProperty({
    description: '最近使用该标签的主题列表',
    itemClass: ForumTagTopicSummaryDto,
    required: true,
    validation: false,
  })
  topics!: ForumTagTopicSummaryDto[]
}
