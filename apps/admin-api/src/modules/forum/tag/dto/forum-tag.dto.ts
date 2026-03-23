import { BaseForumTagDto } from '@libs/forum/tag'
import { NumberProperty } from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateForumTagDto extends PickType(BaseForumTagDto, [
  'icon',
  'name',
  'description',
  'sortOrder',
  'isEnabled',
] as const) {}

export class UpdateForumTagDto extends IntersectionType(
  CreateForumTagDto,
  IdDto,
) {}

export class QueryForumTagDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTagDto, ['name', 'isEnabled'] as const)),
) {}

export class AssignForumTagToTopicDto {
  @NumberProperty({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @NumberProperty({
    description: '标签ID',
    example: 1,
    required: true,
    min: 1,
  })
  tagId!: number
}
